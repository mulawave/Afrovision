const crypto = require('crypto');
const path = require('path');
const Wave = require('./wave.model');
const WavePulse = require('./wave.pulse.model');
const WaveComment = require('./wave.comment.model');
const WaveBookmark = require('./wave.bookmark.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const ExclusiveAccess = require('../channels/exclusive_access.model');
const ExclusivePicUnlock = require('../channels/exclusive_pic_unlock.model');
const { isAdultKycVerified } = require('../channels/exclusive_policy.service');
const { isExclusiveRolloutEnabledForUser } = require('../channels/exclusive_rollout.service');
const { generateSignedUploadUrl, extractGCSPath, getBucket, createResumableUploadSession, getGCSObjectMetadata, BUCKET_NAME } = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');
// generateThumbnailAsync intentionally omitted — client-side generation
// (Flutter ThumbnailService uploading via POST /wave/:id/thumbnail) now
// handles the fill path. generateThumbnail (synchronous) is kept solely
// for the admin regenerateMissingThumbnails endpoint.
const { generateThumbnail, generateAndStoreThumbnail, getThumbnailUrl } = require('../utils/thumbnail-generator');
const CersService = require('./wave.cers.service');
const NotificationService = require('../notifications/notification.service');
const TranscoderService = require('../broadcast/transcoder.service');

const COLLECTION = 'waves';


const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const INTEREST_COLLECTION = 'wave_interest_signals';
const REPORTS_COLLECTION = 'wave_reports';
const AGE_CLASSIFICATION_VALUES = ['minor_safe', 'teen', 'adult'];
const VIEW_LOG_COLLECTION = 'wave_view_logs';
const FEED_MAX_FETCH_ROUNDS = 8;
const FEED_FETCH_FACTOR = 5;
const FEED_MIN_CHANNEL_DIVERSITY = 3;
const FEED_RECENT_SEEN_LIMIT = 400;
const FEED_NOT_INTERESTED_LIMIT = 300;
const FEED_CLIENT_EXCLUDE_LIMIT = 160;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWaveOutputPrefix(waveId) {
  return `hls/waves/${waveId}`;
}

function getWaveMasterPlaylistUrl(waveId) {
  return `/wave/${waveId}/hls/master.m3u8`;
}

async function prepareWaveTranscode(wave) {
  try {
    const outputPrefix = getWaveOutputPrefix(wave.id);
    const transcoding = await TranscoderService.startTranscode(wave, outputPrefix);
    return await Wave.updateTranscoding(wave.id, transcoding);
  } catch (error) {
    console.error(`[WaveTranscoder] Failed to queue wave ${wave.id}:`, error.message);
    return await Wave.updateTranscoding(wave.id, {
      transcoding_status: 'failed',
      transcoding_error: error.message,
    });
  }
}

async function refreshWaveTranscode(wave) {
  try {
    if (!wave.transcoding_status || (wave.transcoding_status === 'pending' && !wave.transcoding_job_name)) {
      return await prepareWaveTranscode(wave);
    }
    if (wave.transcoding_status === 'processing' && Number(wave.transcoding_checked_at || 0) > Date.now() - 60_000) {
      return wave;
    }
    const update = await TranscoderService.refreshTranscode(wave);
    if (!update) return wave;
    if (update.transcoding_status === 'ready') {
      update.master_playlist_url = getWaveMasterPlaylistUrl(wave.id);
    }
    return await Wave.updateTranscoding(wave.id, update);
  } catch (error) {
    console.warn(`[WaveTranscoder] Failed to refresh wave ${wave.id}:`, error.message);
    return wave;
  }
}

async function resolvePlayableUrl(rawUrl) {
  // Media bucket is publicly readable — raw GCS URLs are already playable,
  // no signing needed.
  return rawUrl;
}

function parseExcludeIdsFromQuery(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  const raw = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  const unique = [...new Set(raw)];
  return unique.slice(0, FEED_CLIENT_EXCLUDE_LIMIT);
}

async function getUserExcludedWaveIds(userId) {
  const db = getFirestore();

  const [viewSnap, interestSnap] = await Promise.all([
    db.collection(VIEW_LOG_COLLECTION)
      .where('user_key', '==', userId)
      .limit(FEED_RECENT_SEEN_LIMIT)
      .get(),
    db.collection(INTEREST_COLLECTION)
      .where('user_id', '==', userId)
      .limit(FEED_NOT_INTERESTED_LIMIT)
      .get(),
  ]);

  const excluded = new Set();

  for (const doc of viewSnap.docs) {
    const waveId = doc.data()?.wave_id;
    if (typeof waveId === 'string' && waveId) {
      excluded.add(waveId);
    }
  }

  for (const doc of interestSnap.docs) {
    const data = doc.data() || {};
    if (data.signal === 'not_interested' && typeof data.wave_id === 'string' && data.wave_id) {
      excluded.add(data.wave_id);
    }
  }

  return excluded;
}

function interleaveByChannel(waves) {
  if (!waves.length) return waves;

  // Group waves by channel_id, preserving original order within each channel
  const channelQueues = new Map();
  const channelOrder = [];
  for (const wave of waves) {
    const cid = wave.channel_id || '_unknown';
    if (!channelQueues.has(cid)) {
      channelQueues.set(cid, []);
      channelOrder.push(cid);
    }
    channelQueues.get(cid).push(wave);
  }

  // If only one channel, shuffle slightly but keep as-is
  if (channelOrder.length === 1) return waves;

  // Round-robin: take one wave from each channel in turn
  const result = [];
  let remaining = waves.length;
  let round = 0;
  while (remaining > 0) {
    let addedThisRound = false;
    for (const cid of channelOrder) {
      const queue = channelQueues.get(cid);
      if (queue.length === 0) continue;
      // Slight randomization: occasionally skip a channel to avoid mechanical pattern
      // But on first pass, always include to ensure diversity
      if (round > 0 && Math.random() < 0.15 && queue.length > 1) continue;
      result.push(queue.shift());
      remaining--;
      addedThisRound = true;
    }
    round++;
    if (!addedThisRound) break; // safety: all queues exhausted
  }

  return result;
}

function reorderFeedForNovelty(waves, excludedIds) {
  if (!waves.length) return waves;
  const fresh = [];
  const old = [];
  for (const wave of waves) {
    if (excludedIds.has(wave.id)) {
      old.push(wave);
    } else {
      fresh.push(wave);
    }
  }
  // Interleave fresh waves across channels so no single channel dominates
  const interleavedFresh = interleaveByChannel(fresh);
  old.sort(() => Math.random() - 0.5);
  return [...interleavedFresh, ...old];
}

async function buildNovelFeed({ limit, cursor, excludedIds }) {
  const all = [];
  const seen = new Set();
  let currentCursor = cursor || null;
  let nextCursor = null;
  const fetchLimit = Math.max(limit * FEED_FETCH_FACTOR, limit);

  for (let i = 0; i < FEED_MAX_FETCH_ROUNDS; i += 1) {
    const page = await Wave.getFeed({ limit: fetchLimit, cursor: currentCursor });
    for (const wave of page) {
      if (wave && typeof wave.id === 'string' && !seen.has(wave.id)) {
        seen.add(wave.id);
        all.push(wave);
      }
    }

    nextCursor = page.length === fetchLimit ? page[page.length - 1].id : null;

    if (!nextCursor) break;

    // Check channel diversity — keep fetching until we have enough channels
    const freshWaves = all.filter((w) => !excludedIds.has(w.id));
    const uniqueChannels = new Set(freshWaves.map((w) => w.channel_id));
    const freshCount = freshWaves.length;

    // Stop if we have enough fresh waves AND enough channel diversity
    if (freshCount >= limit && uniqueChannels.size >= FEED_MIN_CHANNEL_DIVERSITY) break;

    currentCursor = nextCursor;
  }

  const ordered = reorderFeedForNovelty(all, excludedIds);
  return {
    waves: ordered.slice(0, limit),
    nextCursor,
  };
}

async function enrichWave(wave, userId = null, req = null) {
  // Build an absolute base URL so HLS paths like /wave/{id}/hls/master.m3u8
  // are returned as full https:// URLs that every client can play directly.
  const backendBase = req
    ? `${req.protocol}://${req.get('host')}`
    : (process.env.BACKEND_URL || '').replace(/\/$/, '');

  // Use HLS master playlist if transcoding is complete, otherwise sign the raw MP4
  const isHlsReady = wave.transcoding_status === 'ready' && wave.master_playlist_url;
  let videoUrl;
  if (isHlsReady) {
    const hlsPath = wave.master_playlist_url;
    videoUrl = hlsPath.startsWith('http') ? hlsPath : `${backendBase}${hlsPath}`;
  } else {
    videoUrl = await resolvePlayableUrl(wave.video_url);
  }
  const signed = {
    ...wave,
    video_url: videoUrl,
    adaptive: isHlsReady,
    available_renditions: wave.available_renditions || [],
    transcoding_status: wave.transcoding_status || 'unavailable',
  };

  // Sign thumbnail URL so it's always accessible (GCS bucket may not be public).
  // Only return a URL when the status is 'ready' so clients don't try to load a
  // missing object. Thumbnail prefetch / generation is driven by the client via
  // GET /waves/:id/thumbnail, NOT inline during feed enrichment.
  if (wave.thumbnail_url && wave.thumbnail_status === 'ready') {
    signed.thumbnail_url = await resolvePlayableUrl(wave.thumbnail_url);
  }
  signed.thumbnail_status = wave.thumbnail_status || null;
  
  // Include channel exclusive fee so frontend can properly identify exclusive channels
  const channel = await Channel.findById(wave.channel_id);
  if (channel) {
    signed.exclusive_monthly_fee_ngn = Number(channel.exclusive_monthly_fee_ngn || 0);
    signed.channel_type = channel.type || 'public';
    signed.channel_name = channel.name || signed.channel_name || '';
    signed.channel_logo_url = channel.logo_url || null;
    // Expose the channel owner so the app can grant the owner moderation
    // controls (delete any comment, ban commenters) and render the badge.
    signed.owner_id = channel.owner_id || null;
  }
  
  if (userId) {
    const [bookmark, { total: pulseCount }] = await Promise.all([
      WaveBookmark.getStatus(wave.id, userId),
      WavePulse.getPulseStats(wave.id),
    ]);
    signed.is_bookmarked = bookmark.bookmarked;
    signed.pulse_count = pulseCount;
  }
  return signed;
}

async function ensureChannelOwner(userId, channelId) {
  const user = await User.findById(userId);
  if (!user) return { error: { status: 404, message: 'User not found' } };
  if (user.role !== 'creator' && user.role !== 'admin') {
    return { error: { status: 403, message: 'Only creators can manage waves' } };
  }
  const channel = await Channel.findById(channelId);
  if (!channel) return { error: { status: 404, message: 'Channel not found' } };
  if (channel.owner_id !== userId && user.role !== 'admin') {
    return { error: { status: 403, message: 'Not channel owner' } };
  }
  return { user, channel };
}

async function ensureCreatorNotLocked(userId) {
  const lock = await CersService.getCreatorLockStatus(userId);
  if (!lock) return null;
  return {
    status: 423,
    payload: {
      error: 'Account is locked pending Community Standards fine settlement',
      lock: {
        id: lock.id,
        fine_amount_ngn: lock.fine_amount_ngn || 0,
        reason: lock.reason || 'Community Standards Fine',
      },
    },
  };
}

function toExclusiveAccessPayload(decision) {
  const payload = {
    error: decision.reason || 'Exclusive wave access denied',
    code: decision.code || 'EXCLUSIVE_ACCESS_DENIED',
  };

  if (decision.code === 'EXCLUSIVE_LOGIN_REQUIRED') {
    payload.requires_login = true;
  }
  if (decision.code === 'EXCLUSIVE_KYC_REQUIRED') {
    payload.requires_kyc = true;
  }
  if (
    decision.code === 'EXCLUSIVE_ENTITLEMENT_REQUIRED'
    || decision.code === 'EXCLUSIVE_PIC_REQUIRED'
  ) {
    payload.requires_pic = true;
    payload.requires_payment = true;
  }

  return payload;
}

/// Helper: Check if a channel is exclusive based on membership fee (not type)
function isExclusiveChannel(channel) {
  if (!channel) return false;
  // Exclusive channels are identified by having a membership fee > 0
  // Type field is only 'public' or 'private', exclusive channels can be either
  const fee = Number(channel.exclusive_monthly_fee_ngn || 0);
  return fee > 0;
}

async function evaluateExclusiveChannelAccess({ channel, userId, user }) {
  console.log('[ExclusiveAccess] Evaluating access for channel:', channel.id, 'user:', userId);
  
  if (!isExclusiveChannel(channel)) {
    console.log('[ExclusiveAccess] Not an exclusive channel (fee <= 0), allowing access');
    return {
      allowed: true,
      requires_consent: false,
      reason: null,
      code: null,
    };
  }

  const isOwnerOrAdmin = channel.owner_id === userId || user.role === 'admin';
  if (isOwnerOrAdmin) {
    console.log('[ExclusiveAccess] User is owner or admin, allowing access');
    return {
      allowed: true,
      requires_consent: false,
      reason: null,
      code: null,
    };
  }

  // Check if user has admin-approved KYC verification
  const eligibleByKyc = await isAdultKycVerified(userId);
  console.log('[ExclusiveAccess] KYC verified:', eligibleByKyc);
  if (!eligibleByKyc.isVerified) {
    console.log('[ExclusiveAccess] KYC verification failed, denying access');
    return {
      allowed: false,
      requires_consent: false,
      reason: eligibleByKyc.isMinor
        ? 'Exclusive channels are not available for users under 18'
        : 'KYC verification is required for exclusive channels',
      code: eligibleByKyc.isMinor ? 'EXCLUSIVE_MINOR_BLOCKED' : 'EXCLUSIVE_KYC_REQUIRED',
    };
  }

  // Check if user has active paid subscription (not expired)
  const activeAccess = await ExclusiveAccess.findActiveByUserAndChannel(userId, channel.id);
  console.log('[ExclusiveAccess] Active access found:', !!activeAccess);
  if (!activeAccess) {
    console.log('[ExclusiveAccess] No active subscription found, denying access');
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Paid subscription required for exclusive channels',
      code: 'EXCLUSIVE_SUBSCRIPTION_REQUIRED',
    };
  }

  console.log('[ExclusiveAccess] User has valid paid subscription, allowing access');
  // User has valid paid subscription - allow unrestricted access to all channel content
  return {
    allowed: true,
    requires_consent: false,
    reason: null,
    code: null,
  };
}

// ─── Upload URL ──────────────────────────────────────────────────────────────

async function getWaveUploadUrl(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload waves' });
    }

    const lock = await ensureCreatorNotLocked(req.userId);
    if (lock) return res.status(lock.status).json(lock.payload);

    const { content_type, channel_id } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    if (!ALLOWED_VIDEO_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported type: ${content_type}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const ext = ALLOWED_VIDEO_TYPES[content_type];
    const filename = `waves/${crypto.randomUUID()}${ext}`;
    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, content_type, 60);
    res.json({ signed_url: signedUrl, public_url: publicUrl, filename });
  } catch (err) {
    console.error('[Wave] getWaveUploadUrl:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

async function registerWave(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload waves' });
    }

    const lock = await ensureCreatorNotLocked(req.userId);
    if (lock) return res.status(lock.status).json(lock.payload);

    const {
      channel_id,
      title,
      description,
      video_url,
      thumbnail_url,
      duration,
      age_classification,
      has_explicit_language,
      has_nudity,
      has_violence,
      has_revealing_clothes,
      has_partial_nudity,
      has_explicit_content,
      has_parental_guidance,
      has_erotic_dancing,
      has_sexual_nature,
      has_sex,
    } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (!video_url) return res.status(400).json({ error: 'video_url is required' });
    if (!age_classification || !AGE_CLASSIFICATION_VALUES.includes(String(age_classification).toLowerCase())) {
      return res.status(400).json({ error: 'age_classification must be one of: minor_safe, teen, adult' });
    }
    if (typeof has_explicit_language !== 'boolean') {
      return res.status(400).json({ error: 'has_explicit_language is required and must be boolean' });
    }
    if (typeof has_nudity !== 'boolean') {
      return res.status(400).json({ error: 'has_nudity is required and must be boolean' });
    }
    if (typeof has_violence !== 'boolean') {
      return res.status(400).json({ error: 'has_violence is required and must be boolean' });
    }
    if (typeof has_revealing_clothes !== 'boolean') {
      return res.status(400).json({ error: 'has_revealing_clothes is required and must be boolean' });
    }
    if (typeof has_partial_nudity !== 'boolean') {
      return res.status(400).json({ error: 'has_partial_nudity is required and must be boolean' });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    if (channel.type === 'public' && String(age_classification).toLowerCase() === 'adult') {
      return res.status(400).json({ error: 'Public channels cannot upload 18+ content. Use minor_safe or teen only.' });
    }

    const wave = await Wave.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title: title.trim(),
      description: description || '',
      videoUrl: video_url,
      thumbnailUrl: thumbnail_url || null,
      duration: duration || 0,
      ageClassification: String(age_classification).toLowerCase(),
      hasExplicitLanguage: has_explicit_language,
      hasNudity: has_nudity,
      hasViolence: has_violence,
      hasRevealingClothes: has_revealing_clothes,
      hasPartialNudity: has_partial_nudity,
      hasExplicitContent: has_explicit_content || false,
      hasParentalGuidance: has_parental_guidance || false,
      hasEroticDancing: has_erotic_dancing || false,
      hasSexualNature: has_sexual_nature || false,
      hasSex: has_sex || false,
    });

    // Thumbnail generation is now client-side (ThumbnailService in the
    // Flutter app uploads a JPEG via POST /wave/:id/thumbnail). The old
    // Cloud Run ffmpeg call was removed here to eliminate its per-create
    // cost. See cache-restore-plan-aa665b.md §4.

    // Kick off HLS transcoding asynchronously — the wave is immediately available
    // via the raw MP4 signed URL while transcoding runs in the background.
    prepareWaveTranscode(wave).catch((err) => {
      console.error('[WaveTranscoder] Async transcode failed:', err.message);
    });

    res.status(201).json(wave);
  } catch (err) {
    console.error('[Wave] registerWave:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function updateWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') {
      return res.status(404).json({ error: 'Wave not found' });
    }

    const permission = await ensureChannelOwner(req.userId, wave.channel_id);
    if (permission.error) {
      return res.status(permission.error.status).json({ error: permission.error.message });
    }

    const lock = await ensureCreatorNotLocked(req.userId);
    if (lock) return res.status(lock.status).json(lock.payload);

    const {
      title,
      description,
      thumbnail_url,
      age_classification,
      has_explicit_language,
      has_nudity,
      has_violence,
      has_revealing_clothes,
      has_partial_nudity,
      has_explicit_content,
      has_parental_guidance,
      has_erotic_dancing,
      has_sexual_nature,
      has_sex,
    } = req.body || {};

    if (title !== undefined && (!String(title).trim())) {
      return res.status(400).json({ error: 'title must not be empty' });
    }
    if (age_classification !== undefined
      && !AGE_CLASSIFICATION_VALUES.includes(String(age_classification).toLowerCase())) {
      return res.status(400).json({ error: 'age_classification must be one of: minor_safe, teen, adult' });
    }
    if (has_explicit_language !== undefined && typeof has_explicit_language !== 'boolean') {
      return res.status(400).json({ error: 'has_explicit_language must be boolean' });
    }
    if (has_nudity !== undefined && typeof has_nudity !== 'boolean') {
      return res.status(400).json({ error: 'has_nudity must be boolean' });
    }
    if (has_violence !== undefined && typeof has_violence !== 'boolean') {
      return res.status(400).json({ error: 'has_violence must be boolean' });
    }
    if (has_revealing_clothes !== undefined && typeof has_revealing_clothes !== 'boolean') {
      return res.status(400).json({ error: 'has_revealing_clothes must be boolean' });
    }
    if (has_partial_nudity !== undefined && typeof has_partial_nudity !== 'boolean') {
      return res.status(400).json({ error: 'has_partial_nudity must be boolean' });
    }

    const updated = await Wave.update(wave.id, {
      title: title !== undefined ? String(title).trim() : undefined,
      description: description !== undefined ? String(description) : undefined,
      thumbnail_url: thumbnail_url !== undefined ? (thumbnail_url || null) : undefined,
      age_classification:
        age_classification !== undefined ? String(age_classification).toLowerCase() : undefined,
      has_explicit_language,
      has_nudity,
      has_violence,
      has_revealing_clothes,
      has_partial_nudity,
      has_explicit_content,
      has_parental_guidance,
      has_erotic_dancing,
      has_sexual_nature,
      has_sex,
    });

    // Thumbnail regeneration on update is now client-side (a fresh
    // ThumbnailService pass runs the next time a viewer opens the wave).
    // Removed the Cloud Run ffmpeg call here per cache-restore-plan §4.

    return res.json({ success: true, wave: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Feed ────────────────────────────────────────────────────────────────────

async function getFeed(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const clientExcludedIds = parseExcludeIdsFromQuery(req.query.exclude_ids);
    const userId = req.userId || null;

    const excludedIds = new Set(clientExcludedIds);
    if (userId) {
      const userExcluded = await getUserExcludedWaveIds(userId);
      for (const id of userExcluded) excludedIds.add(id);
    }

    const novel = await buildNovelFeed({ limit, cursor, excludedIds });
    const user = userId ? await User.findById(userId) : null;
    const channelCache = new Map();

    const visibleWaves = [];
    for (const wave of novel.waves) {
      const channelId = wave.channel_id;
      if (!channelId) continue;

      let channel = channelCache.get(channelId) || null;
      if (!channel) {
        channel = await Channel.findById(channelId);
        if (channel) {
          channelCache.set(channelId, channel);
        }
      }
      if (!channel) continue;

      const exclusiveDecision = await evaluateExclusiveChannelAccess({
        channel,
        userId,
        user,
      });
      if (!exclusiveDecision.allowed) continue;
      visibleWaves.push(wave);
    }

    const enriched = await Promise.all(visibleWaves.map((w) => enrichWave(w, userId, req)));
    const nextCursor = novel.nextCursor;
    res.json({ waves: enriched, next_cursor: nextCursor });
  } catch (err) {
    console.error('[Wave] getFeed:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Following feed ──────────────────────────────────────────────────────────

async function getFollowingFeed(req, res) {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const clientExcludedIds = parseExcludeIdsFromQuery(req.query.exclude_ids);

    const ChannelSub = require('../subscriptions/channel_subscription.model');
    const channelIds = await ChannelSub.getActiveSubscribedChannelIds(userId);
    const user = await User.findById(userId);

    if (!channelIds.length) {
      return res.json({ waves: [], next_cursor: null });
    }

    const { waves, nextCursor } = await Wave.getFollowingFeed(channelIds, { limit, cursor });

    const excludedIds = new Set(clientExcludedIds);
    const channelCache = new Map();

    const visibleWaves = [];
    for (const wave of waves) {
      if (excludedIds.has(wave.id)) continue;
      const channelId = wave.channel_id;
      if (!channelId) continue;

      let channel = channelCache.get(channelId) || null;
      if (!channel) {
        channel = await Channel.findById(channelId);
        if (channel) channelCache.set(channelId, channel);
      }
      if (!channel) continue;

      const exclusiveDecision = await evaluateExclusiveChannelAccess({ channel, userId, user });
      if (!exclusiveDecision.allowed) continue;
      visibleWaves.push(wave);
    }

    const enriched = await Promise.all(visibleWaves.map((w) => enrichWave(w, userId, req)));
    res.json({ waves: enriched, next_cursor: nextCursor });
  } catch (err) {
    console.error('[Wave] getFollowingFeed:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Single wave ─────────────────────────────────────────────────────────────

async function getWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const userId = req.userId || null;
    const user = userId ? await User.findById(userId) : null;
    const channel = await Channel.findById(wave.channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const exclusiveDecision = await evaluateExclusiveChannelAccess({
      channel,
      userId,
      user,
    });
    if (!exclusiveDecision.allowed) {
      return res.status(403).json(toExclusiveAccessPayload(exclusiveDecision));
    }

    res.json(await enrichWave(wave, userId, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Channel waves ───────────────────────────────────────────────────────────

async function getChannelWaves(req, res) {
  try {
    const includeHidden = String(req.query.include_hidden || '').toLowerCase() === 'true';
    if (includeHidden) {
      if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
      const permission = await ensureChannelOwner(req.userId, req.params.channelId);
      if (permission.error) {
        return res.status(permission.error.status).json({ error: permission.error.message });
      }
    }

    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const userId = req.userId || null;
    const user = userId ? await User.findById(userId) : null;
    const exclusiveDecision = await evaluateExclusiveChannelAccess({
      channel,
      userId,
      user,
    });
    if (!exclusiveDecision.allowed) {
      return res.status(403).json(toExclusiveAccessPayload(exclusiveDecision));
    }

    const waves = await Wave.getByChannel(req.params.channelId, { includeHidden });
    const enriched = await Promise.all(waves.map((w) => enrichWave(w, userId, req)));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function deleteWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (wave.creator_uid !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const lock = await ensureCreatorNotLocked(req.userId);
    if (lock) return res.status(lock.status).json(lock.payload);

    await Wave.remove(wave.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function setTimelineVisibility(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const hidden = req.body?.hidden;
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const permission = await ensureChannelOwner(req.userId, wave.channel_id);
    if (permission.error) {
      return res.status(permission.error.status).json({ error: permission.error.message });
    }

    await Wave.updateStatus(wave.id, hidden ? 'hidden' : 'active');
    const updated = await Wave.findById(wave.id);
    return res.json({ success: true, wave: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function bulkDeleteWaves(req, res) {
  try {
    const waveIds = Array.isArray(req.body?.wave_ids) ? req.body.wave_ids : [];
    const uniqueIds = [...new Set(waveIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: 'wave_ids is required' });
    }
    if (uniqueIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 wave_ids per request' });
    }

    const deleted_ids = [];
    const failed = {};

    for (const waveId of uniqueIds) {
      try {
        const wave = await Wave.findById(waveId);
        if (!wave || wave.status === 'deleted') {
          failed[waveId] = 'Wave not found';
          continue;
        }

        const permission = await ensureChannelOwner(req.userId, wave.channel_id);
        if (permission.error) {
          failed[waveId] = permission.error.message;
          continue;
        }

        await Wave.remove(wave.id);
        deleted_ids.push(wave.id);
      } catch (err) {
        failed[waveId] = err.message || 'Failed to delete wave';
      }
    }

    return res.json({
      success: true,
      requested_count: uniqueIds.length,
      deleted_count: deleted_ids.length,
      deleted_ids,
      failed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function bulkSetTimelineVisibility(req, res) {
  try {
    const waveIds = Array.isArray(req.body?.wave_ids) ? req.body.wave_ids : [];
    const hidden = req.body?.hidden;

    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const uniqueIds = [...new Set(waveIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: 'wave_ids is required' });
    }
    if (uniqueIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 wave_ids per request' });
    }

    const updated_ids = [];
    const failed = {};

    for (const waveId of uniqueIds) {
      try {
        const wave = await Wave.findById(waveId);
        if (!wave || wave.status === 'deleted') {
          failed[waveId] = 'Wave not found';
          continue;
        }

        const permission = await ensureChannelOwner(req.userId, wave.channel_id);
        if (permission.error) {
          failed[waveId] = permission.error.message;
          continue;
        }

        await Wave.updateStatus(wave.id, hidden ? 'hidden' : 'active');
        updated_ids.push(wave.id);
      } catch (err) {
        failed[waveId] = err.message || 'Failed to update wave';
      }
    }

    return res.json({
      success: true,
      requested_count: uniqueIds.length,
      updated_count: updated_ids.length,
      updated_ids,
      hidden,
      failed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Pulse ───────────────────────────────────────────────────────────────────

async function addPulse(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const intensity = Math.min(Math.max(parseInt(req.body.intensity) || 1, 1), 3);
    const momentSeconds = parseFloat(req.body.moment_seconds) || 0;

    const pulse = await WavePulse.addPulse(wave.id, req.userId, intensity, momentSeconds);
    if (!pulse) return res.status(429).json({ error: 'Daily pulse limit reached for this wave' });

    // Update wave counters and score
    await Wave.incrementField(wave.id, 'pulse_count', 1);
    const { weightedScore } = await WavePulse.getPulseStats(wave.id);
    await Wave.updatePulseScore(wave.id, weightedScore);

    res.json({ success: true, pulse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Pulse moments ───────────────────────────────────────────────────────────

async function getPulseMoments(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const moments = await WavePulse.getPulseMoments(wave.id);
    res.json({ moments, duration: wave.duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

async function getComments(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const channel = await Channel.findById(wave.channel_id);
    const ownerId = channel ? channel.owner_id : null;
    const [comments, bannedIds] = await Promise.all([
      WaveComment.getComments(wave.id),
      WaveComment.getBannedUserIds(wave.channel_id),
    ]);
    const viewerIsOwner = !!(req.userId && ownerId && req.userId === ownerId);
    const enriched = comments.map((c) => ({
      ...c,
      is_channel_owner: !!(ownerId && c.user_id === ownerId),
      author_banned: bannedIds.has(c.user_id),
      // Only expose the ban flag context to the owner so other viewers can't
      // see who is banned.
      viewer_is_owner: viewerIsOwner,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postComment(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const [user, channel] = await Promise.all([
      User.findById(req.userId),
      Channel.findById(wave.channel_id),
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Block users the channel owner has banned from commenting (unless they
    // are the owner themselves or a platform admin).
    const isOwner = channel && channel.owner_id === req.userId;
    if (!isOwner && user.role !== 'admin') {
      const banned = await WaveComment.isCommenterBanned(wave.channel_id, req.userId);
      if (banned) {
        return res.status(403).json({ error: 'You are banned from commenting on this channel' });
      }
    }

    const { text, parent_comment_id: parentCommentId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    // Validate parent comment exists if this is a reply
    if (parentCommentId) {
      const parent = await WaveComment.findComment(parentCommentId);
      if (!parent || parent.wave_id !== wave.id) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const comment = await WaveComment.addComment(
      wave.id,
      req.userId,
      user.name || 'Viewer',
      user.avatar_url || null,
      text,
      parentCommentId || null
    );

    await Wave.incrementField(wave.id, 'comment_count', 1);

    // Notify channel owner if they are not the commenter
    if (channel && channel.owner_id && channel.owner_id !== req.userId) {
      NotificationService.notifyUser(channel.owner_id, {
        title: 'New comment on your wave',
        body: `${user.name || 'Someone'} commented: "${comment.text.slice(0, 80)}${comment.text.length > 80 ? '…' : ''}"`,
        type: 'wave_comment',
        link: `afrovision://wave?wave_id=${wave.id}`,
        data: { wave_id: wave.id, comment_id: comment.id },
      }).catch(() => {});
    }

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function editComment(req, res) {
  try {
    const comment = await WaveComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const updated = await WaveComment.updateComment(comment.id, text);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteComment(req, res) {
  try {
    const comment = await WaveComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Allow deletion by: the comment author, a platform admin, or the channel
    // owner (so owners can moderate any comment on their waves).
    let isChannelOwner = false;
    const wave = await Wave.findById(req.params.waveId);
    if (wave) {
      const channel = await Channel.findById(wave.channel_id);
      isChannelOwner = !!(channel && channel.owner_id === req.userId);
    }
    if (comment.user_id !== req.userId && user.role !== 'admin' && !isChannelOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await WaveComment.deleteComment(comment.id);
    await Wave.incrementField(req.params.waveId, 'comment_count', -1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Commenter moderation (channel owner) ──────────────────────────────────

async function banCommenter(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const permission = await ensureChannelOwner(req.userId, wave.channel_id);
    if (permission.error) {
      return res.status(permission.error.status).json({ error: permission.error.message });
    }
    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ error: 'userId is required' });
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'You cannot ban yourself' });
    }
    const result = await WaveComment.banCommenter(wave.channel_id, targetUserId, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function unbanCommenter(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const permission = await ensureChannelOwner(req.userId, wave.channel_id);
    if (permission.error) {
      return res.status(permission.error.status).json({ error: permission.error.message });
    }
    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ error: 'userId is required' });
    const result = await WaveComment.unbanCommenter(wave.channel_id, targetUserId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getReplies(req, res) {
  try {
    const comment = await WaveComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const replies = await WaveComment.getReplies(req.params.commentId);

    let ownerId = null;
    let bannedIds = new Set();
    const wave = await Wave.findById(req.params.waveId);
    if (wave) {
      const channel = await Channel.findById(wave.channel_id);
      ownerId = channel ? channel.owner_id : null;
      bannedIds = await WaveComment.getBannedUserIds(wave.channel_id);
    }
    const viewerIsOwner = !!(req.userId && ownerId && req.userId === ownerId);
    const enriched = replies.map((c) => ({
      ...c,
      is_channel_owner: !!(ownerId && c.user_id === ownerId),
      author_banned: bannedIds.has(c.user_id),
      viewer_is_owner: viewerIsOwner,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function toggleCommentReaction(req, res) {
  try {
    const comment = await WaveComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const result = await WaveComment.toggleReaction(comment.id, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

async function toggleBookmark(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const result = await WaveBookmark.toggle(wave.id, req.userId);
    await Wave.incrementField(wave.id, 'bookmark_count', result.bookmarked ? 1 : -1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBookmarkStatus(req, res) {
  try {
    const status = await WaveBookmark.getStatus(req.params.waveId, req.userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyBookmarks(req, res) {
  try {
    const bookmarks = await WaveBookmark.getMyBookmarks(req.userId);
    // Fetch wave details for each bookmark
    const waves = await Promise.all(
      bookmarks.map(async (b) => {
        const w = await Wave.findById(b.wave_id);
        return w && w.status === 'active' ? enrichWave(w, req.userId, req) : null;
      })
    );
    res.json(waves.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Interest signal ─────────────────────────────────────────────────────────

async function setInterest(req, res) {
  try {
    const { signal } = req.body;
    if (!['interested', 'not_interested'].includes(signal)) {
      return res.status(400).json({ error: 'signal must be "interested" or "not_interested"' });
    }
    const db = getFirestore();
    const id = `${req.userId}_${req.params.waveId}`;
    await db.collection(INTEREST_COLLECTION).doc(id).set({
      id,
      wave_id: req.params.waveId,
      user_id: req.userId,
      signal,
      created_at: Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

async function reportWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const reporter = await User.findById(req.userId);
    if (!reporter) return res.status(404).json({ error: 'User not found' });

    const result = await CersService.createClassificationReportAndCase({
      wave,
      reporter,
      reason: req.body.reason,
      suggestedClassification: req.body.suggested_classification,
    });

    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message, code: result.error.code });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function checkWaveAccess(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const user = req.userId ? await User.findById(req.userId) : null;
    const channel = await Channel.findById(wave.channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Check exclusive channel access first
    if (isExclusiveChannel(channel)) {
      // This is an exclusive channel - apply exclusive access rules
      const isOwnerOrAdmin = channel.owner_id === req.userId || (user && user.role === 'admin');
      
      if (isOwnerOrAdmin) {
        // Owner/admin gets full access without any gating
        return res.json({
          allowed: true,
          requires_consent: false,
          reason: null,
          code: 'EXCLUSIVE_OWNER_ACCESS',
        });
      }

      // Check if user has admin-approved KYC verification
      const eligibleByKyc = await isAdultKycVerified(req.userId);
      if (!eligibleByKyc.isVerified) {
        return res.json({
          allowed: false,
          requires_consent: false,
          reason: eligibleByKyc.isMinor
            ? 'Exclusive channels are not available for users under 18'
            : 'KYC verification is required for exclusive channels',
          code: eligibleByKyc.isMinor ? 'EXCLUSIVE_MINOR_BLOCKED' : 'EXCLUSIVE_KYC_REQUIRED',
        });
      }

      // Check if user has active paid subscription
      const activeAccess = await ExclusiveAccess.findActiveByUserAndChannel(req.userId, channel.id);
      if (!activeAccess) {
        return res.json({
          allowed: false,
          requires_consent: false,
          reason: 'Your subscription has expired. Renew to continue viewing this content.',
          code: 'EXCLUSIVE_SUBSCRIPTION_EXPIRED',
        });
      }

      // ACTIVE SUBSCRIBER: Bypass ALL gating including age restrictions
      // User is KYC verified (adult) and has active subscription
      return res.json({
        allowed: true,
        requires_consent: false,
        reason: null,
        code: 'EXCLUSIVE_ACTIVE_SUBSCRIBER',
      });
    }

    // Non-exclusive channel: Apply standard age/content gating
    const sessionId = sanitizeSessionId(req.body?.session_id);
    const access = await CersService.checkWaveAudienceAccess({ wave, user, sessionId });
    return res.json(access);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function acknowledgeAdultConsent(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const sessionId = sanitizeSessionId(req.body?.session_id);
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const result = await CersService.acknowledgeAdultConsent({
      userId: req.userId,
      waveId: wave.id,
      sessionId,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getCreatorLockStatus(req, res) {
  try {
    const lock = await CersService.getCreatorLockStatus(req.userId);
    return res.json({
      locked: Boolean(lock),
      lock: lock
        ? {
          id: lock.id,
          fine_amount_ngn: lock.fine_amount_ngn || 0,
          reason: lock.reason || 'Community Standards Fine',
          created_at: lock.created_at || null,
          payment_status: lock.payment_status || 'pending',
          case_id: lock.case_id || null,
        }
        : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function payCreatorLock(req, res) {
  try {
    const result = await CersService.payCreatorLockAndUnlock({ creatorId: req.userId });
    if (result.error) {
      return res.status(result.error.status || 500).json({
        error: result.error.message,
        code: result.error.code,
        required_amount_ngn: result.required_amount_ngn,
        available_cash_ngn: result.available_cash_ngn,
      });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function sanitizeSessionId(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 128);
}

// ─── Thumbnail regeneration (admin only) ───────────────────────────────────────

async function regenerateMissingThumbnails(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = getFirestore();
    const wavesSnapshot = await db.collection(COLLECTION)
      .where('status', '==', 'active')
      .get();

    const wavesWithoutThumbnails = [];
    for (const doc of wavesSnapshot.docs) {
      const wave = doc.data();
      // Regenerate if no thumbnail OR if thumbnail is .webp or .png (convert to .jpg for Android compatibility)
      if (!wave.thumbnail_url || wave.thumbnail_url === '' || wave.thumbnail_url.includes('.webp') || wave.thumbnail_url.includes('.png')) {
        wavesWithoutThumbnails.push({ ...wave, id: doc.id });
      }
    }

    if (wavesWithoutThumbnails.length === 0) {
      return res.json({ success: true, message: 'All waves have JPEG thumbnails', processed: 0 });
    }

    // Trigger thumbnail generation for waves without thumbnails (synchronous for admin endpoint)
    let processed = 0;
    let failed = 0;
    const results = [];

    for (const wave of wavesWithoutThumbnails) {
      if (wave.video_url) {
        try {
          const thumbnailUrl = await generateThumbnail(wave.video_url, wave.id);
          if (thumbnailUrl) {
            // Update wave with thumbnail URL
            await Wave.update(wave.id, { thumbnail_url: thumbnailUrl });
            processed++;
            results.push({ waveId: wave.id, status: 'completed', thumbnailUrl });
          } else {
            failed++;
            results.push({ waveId: wave.id, status: 'failed', reason: 'thumbnail generation returned null' });
          }
        } catch (err) {
          console.error(`[ThumbnailRegeneration] Failed for wave ${wave.id}:`, err);
          failed++;
          results.push({ waveId: wave.id, status: 'failed', reason: err.message });
        }
      } else {
        results.push({ waveId: wave.id, status: 'skipped', reason: 'no video_url' });
      }
    }

    res.json({
      success: true,
      message: `Thumbnail generation completed: ${processed} succeeded, ${failed} failed`,
      total: wavesWithoutThumbnails.length,
      processed,
      failed,
      results,
    });
  } catch (err) {
    console.error('[ThumbnailRegeneration] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─── View tracking ───────────────────────────────────────────────────────────

async function trackView(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const userKey = req.userId || (req.ip || '').replace(/:/g, '_').slice(-20);
    const result = await Wave.trackView(wave.id, userKey);
    res.json({ success: true, unique: result.unique });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Thumbnail prefetch / on-demand generation (viewer) ───────────────────────

const PREFETCH_RETRY_AFTER_SECONDS = 3;

async function getWaveThumbnail(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Ready thumbnail: return immediately with the signed / playable URL.
    if (wave.thumbnail_status === 'ready' && wave.thumbnail_url) {
      const thumbnailUrl = await resolvePlayableUrl(wave.thumbnail_url);
      return res.json({
        thumbnail_url: thumbnailUrl,
        status: 'ready',
      });
    }

    if (!wave.video_url) {
      return res.status(404).json({ error: 'Wave has no video source' });
    }

    // No server-side ffmpeg fallback here anymore — clients (ThumbnailService)
    // now generate + upload the JPEG themselves. This endpoint stays as a
    // pure "does the backend already have one?" probe: the 202 tells the
    // client to keep showing its placeholder and to retry later, at which
    // point another viewer's client-side upload (or this viewer's own)
    // may have populated thumbnail_url. See cache-restore-plan §4.
    return res.status(202)
      .set('Retry-After', String(PREFETCH_RETRY_AFTER_SECONDS))
      .json({ status: wave.thumbnail_status || 'pending' });
  } catch (err) {
    console.error('[Wave] getWaveThumbnail:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Client thumbnail upload (mobile app generates thumbnail locally) ────────

async function uploadWaveThumbnail(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Ownership is not required: any authenticated viewer may upload the
    // FIRST thumbnail for a wave (client-side generation replaces the
    // Cloud Run ffmpeg path). To keep the record stable and prevent
    // drive-by overwrites once a good thumbnail exists, the endpoint is
    // idempotent — a wave that already has a thumbnail_url returns the
    // existing URL as success without persisting the upload.
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (wave.thumbnail_url) {
      return res.json({
        success: true,
        thumbnail_url: wave.thumbnail_url,
        already_exists: true,
      });
    }

    // Channel owner / admin may re-upload to replace a stored thumbnail
    // via a separate admin flow — that path stays untouched. Everyone
    // else may only fill the gap.
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const thumbnailUrl = req.file.gcsUrl;
    if (!thumbnailUrl) return res.status(500).json({ error: 'Failed to upload thumbnail to GCS' });

    await Wave.updateThumbnailStatus(wave.id, {
      thumbnail_url: thumbnailUrl,
      thumbnail_status: 'ready',
      thumbnail_generated_at: Date.now(),
      thumbnail_error: null,
      thumbnail_failed_at: null,
    });
    console.log(`[Wave] Thumbnail uploaded by viewer ${req.userId} for wave ${wave.id}: ${thumbnailUrl}`);
    res.json({ success: true, thumbnail_url: thumbnailUrl });
  } catch (err) {
    console.error('[Wave] uploadWaveThumbnail:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Channel-owner thumbnail regeneration ───────────────────────────────────

async function regenerateChannelThumbnails(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const isOwner = channel.owner_id === req.userId;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the channel owner or admin can regenerate thumbnails' });
    }

    const waves = await Wave.getByChannel(req.params.channelId, { includeHidden: true });
    const wavesWithoutThumbnails = waves.filter((w) =>
      w.status === 'active' && (!w.thumbnail_url || w.thumbnail_url === '' ||
      w.thumbnail_url.includes('.webp') || w.thumbnail_url.includes('.png'))
    );

    if (wavesWithoutThumbnails.length === 0) {
      return res.json({ success: true, message: 'All waves already have JPEG thumbnails', processed: 0 });
    }

    let processed = 0;
    let failed = 0;
    const results = [];

    for (const wave of wavesWithoutThumbnails) {
      if (wave.video_url) {
        try {
          const thumbnailUrl = await generateThumbnail(wave.video_url, wave.id);
          if (thumbnailUrl) {
            await Wave.update(wave.id, { thumbnail_url: thumbnailUrl });
            processed++;
            results.push({ waveId: wave.id, status: 'completed', thumbnailUrl });
          } else {
            failed++;
            results.push({ waveId: wave.id, status: 'failed', reason: 'thumbnail generation returned null' });
          }
        } catch (err) {
          console.error(`[ThumbnailRegeneration] Failed for wave ${wave.id}:`, err.message);
          failed++;
          results.push({ waveId: wave.id, status: 'failed', reason: err.message });
        }
      } else {
        results.push({ waveId: wave.id, status: 'skipped', reason: 'no video_url' });
      }
    }

    res.json({
      success: true,
      message: `Thumbnail generation completed: ${processed} succeeded, ${failed} failed`,
      total: wavesWithoutThumbnails.length,
      processed,
      failed,
      results,
    });
  } catch (err) {
    console.error('[ThumbnailRegeneration] Channel error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─── Wave HLS Streaming (Viewer) ─────────────────────────────────────────────

async function streamWaveAdaptiveAsset(req, res) {
  try {
    const rawAssetPath = Array.isArray(req.params.assetPath)
      ? req.params.assetPath.join('/')
      : String(req.params.assetPath || '');
    const assetPath = rawAssetPath.replace(/\\/g, '/');
    if (!assetPath || assetPath.includes('..') || assetPath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid wave stream asset path' });
    }

    let wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    // Check transcoding status and refresh if needed
    if (wave.transcoding_status !== 'ready') {
      wave = await refreshWaveTranscode(wave);
    }
    if (wave.transcoding_status !== 'ready') {
      return res.status(503).json({ error: 'Wave is still being processed. Please retry shortly.', transcoding_status: wave.transcoding_status });
    }

    const outputPrefix = wave.hls_output_prefix || getWaveOutputPrefix(wave.id);
    const objectPath = `${outputPrefix}/${assetPath}`;
    const extension = path.extname(assetPath).toLowerCase();

    // Segments: redirect directly to the PUBLIC GCS object — no signing,
    // no proxying through Cloud Run.
    if (extension === '.ts' || extension === '.m4s') {
      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${objectPath}`;
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.redirect(302, publicUrl);
    }

    // Manifests: proxy through backend (small, allows quality filtering)
    const file = getBucket().file(objectPath);
    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch (error) {
      if (error.code === 404) return res.status(404).json({ error: 'Wave stream asset not found' });
      throw error;
    }

    const size = Number(metadata.size || 0);
    const range = req.headers.range;
    let start;
    let end;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return res.status(416).end();
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : size - 1;
      if (start >= size || end >= size || start > end) return res.status(416).end();
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
    } else if (size > 0) {
      res.setHeader('Content-Length', size);
    }

    const contentTypes = {
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
      '.m4s': 'video/iso.segment',
      '.mp4': 'video/mp4',
      '.aac': 'audio/aac',
    };
    res.setHeader('Content-Type', metadata.contentType || contentTypes[extension] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', extension === '.m3u8' ? 'no-cache' : 'public, max-age=31536000, immutable');

    const stream = file.createReadStream(
      Object.assign({}, start !== undefined ? { start } : {}, end !== undefined ? { end } : {}),
    );
    stream.on('error', (error) => {
      console.error(`[WaveTranscoder] HLS stream error ${objectPath}:`, error.message);
      if (!res.headersSent) res.status(500).json({ error: 'Unable to stream wave asset' });
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    console.error('[WaveTranscoder] streamWaveAdaptiveAsset error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Unable to stream wave asset' });
  }
}

// ─── Resumable Upload Sessions for Waves ──────────────────────────────────────
const WAVE_UPLOAD_SESSIONS_COLLECTION = 'wave_upload_sessions';

async function createWaveResumableSession(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload waves' });
    }

    const lock = await ensureCreatorNotLocked(req.userId);
    if (lock) return res.status(lock.status).json(lock.payload);

    const {
      channel_id,
      title,
      description,
      duration,
      file_name,
      file_size,
      content_type,
      age_classification,
      has_explicit_language,
      has_nudity,
      has_violence,
      has_revealing_clothes,
      has_partial_nudity,
      has_explicit_content,
      has_parental_guidance,
      has_erotic_dancing,
      has_sexual_nature,
      has_sex,
    } = req.body;

    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });
    if (!ALLOWED_VIDEO_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported type: ${content_type}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      });
    }
    if (!age_classification || !AGE_CLASSIFICATION_VALUES.includes(String(age_classification).toLowerCase())) {
      return res.status(400).json({ error: 'age_classification must be one of: minor_safe, teen, adult' });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    if (channel.type === 'public' && String(age_classification).toLowerCase() === 'adult') {
      return res.status(400).json({ error: 'Public channels cannot upload 18+ content. Use minor_safe or teen only.' });
    }

    const ext = ALLOWED_VIDEO_TYPES[content_type];
    const filename = `waves/${crypto.randomUUID()}${ext}`;
    const { sessionUrl, publicUrl } = await createResumableUploadSession(filename, content_type, req.headers.origin);
    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const totalBytes = Number.isFinite(Number(file_size)) ? Math.max(0, parseInt(file_size, 10)) : 0;

    const session = {
      id: sessionId,
      creator_uid: req.userId,
      channel_id,
      title: title.trim(),
      description: (description || '').trim(),
      duration: duration ? parseInt(duration, 10) : 0,
      file_name: file_name || null,
      content_type,
      filename,
      public_url: publicUrl,
      upload_url: sessionUrl,
      total_bytes: totalBytes,
      uploaded_bytes: 0,
      status: 'initiated',
      error: null,
      wave_id: null,
      created_at: now,
      updated_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
      age_classification: String(age_classification).toLowerCase(),
      has_explicit_language: has_explicit_language || false,
      has_nudity: has_nudity || false,
      has_violence: has_violence || false,
      has_revealing_clothes: has_revealing_clothes || false,
      has_partial_nudity: has_partial_nudity || false,
      has_explicit_content: has_explicit_content || false,
      has_parental_guidance: has_parental_guidance || false,
      has_erotic_dancing: has_erotic_dancing || false,
      has_sexual_nature: has_sexual_nature || false,
      has_sex: has_sex || false,
    };

    const db = getFirestore();
    await db.collection(WAVE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId).set(session);

    res.status(201).json({ session });
  } catch (err) {
    console.error('[Wave] createWaveResumableSession:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function completeWaveResumableSession(req, res) {
  try {
    const sessionId = req.body?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const db = getFirestore();
    const ref = db.collection(WAVE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    const session = snap.data();
    if (session.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not upload owner' });
    }
    if (Number(session.expires_at || 0) > 0 && Number(session.expires_at) < Date.now()) {
      return res.status(410).json({ error: 'Upload session expired. Create a new upload session.' });
    }
    if (session.status === 'completed' && session.wave_id) {
      const existingWave = await Wave.findById(session.wave_id);
      if (existingWave) {
        return res.json({ wave: existingWave, session });
      }
    }

    const metadata = await getGCSObjectMetadata(session.filename);
    if (!metadata) {
      return res.status(409).json({ error: 'Upload is not complete yet. Please retry shortly.' });
    }

    const channel = await Channel.findById(session.channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const wave = await Wave.create({
      creatorUid: req.userId,
      channelId: session.channel_id,
      title: session.title,
      description: session.description || '',
      videoUrl: session.public_url,
      thumbnailUrl: null,
      duration: session.duration ? parseInt(session.duration, 10) : 0,
      ageClassification: session.age_classification || 'teen',
      hasExplicitLanguage: session.has_explicit_language || false,
      hasNudity: session.has_nudity || false,
      hasViolence: session.has_violence || false,
      hasRevealingClothes: session.has_revealing_clothes || false,
      hasPartialNudity: session.has_partial_nudity || false,
      hasExplicitContent: session.has_explicit_content || false,
      hasParentalGuidance: session.has_parental_guidance || false,
      hasEroticDancing: session.has_erotic_dancing || false,
      hasSexualNature: session.has_sexual_nature || false,
      hasSex: session.has_sex || false,
    });

    // Recording-session waves also skip server-side thumbnail generation
    // now; the client fills the gap on first view. See cache-restore-plan §4.

    prepareWaveTranscode(wave).catch((err) => {
      console.error('[WaveTranscoder] Async transcode failed:', err.message);
    });

    const bytes = Number.isFinite(Number(metadata.size)) ? parseInt(metadata.size, 10) : (session.uploaded_bytes || 0);
    await ref.update({
      status: 'completed',
      uploaded_bytes: bytes,
      wave_id: wave.id,
      completed_at: Date.now(),
      updated_at: Date.now(),
      error: null,
      upload_url: null,
    });

    res.json({ wave, session: { ...session, status: 'completed', wave_id: wave.id, uploaded_bytes: bytes } });
  } catch (err) {
    console.error('[Wave] completeWaveResumableSession:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getWaveUploadUrl,
  registerWave,
  createWaveResumableSession,
  completeWaveResumableSession,
  updateWave,
  getFeed,
  getFollowingFeed,
  getWave,
  getChannelWaves,
  getWaveThumbnail,
  deleteWave,
  setTimelineVisibility,
  bulkDeleteWaves,
  bulkSetTimelineVisibility,
  addPulse,
  getPulseMoments,
  getComments,
  postComment,
  editComment,
  deleteComment,
  banCommenter,
  unbanCommenter,
  getReplies,
  toggleCommentReaction,
  toggleBookmark,
  getBookmarkStatus,
  getMyBookmarks,
  setInterest,
  reportWave,
  trackView,
  checkWaveAccess,
  acknowledgeAdultConsent,
  getCreatorLockStatus,
  payCreatorLock,
  regenerateMissingThumbnails,
  regenerateChannelThumbnails,
  uploadWaveThumbnail,
  streamWaveAdaptiveAsset,
};
