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
const { generateSignedUploadUrl, generateSignedReadUrl, extractGCSPath } = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');
const CersService = require('./wave.cers.service');

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const INTEREST_COLLECTION = 'wave_interest_signals';
const REPORTS_COLLECTION = 'wave_reports';
const AGE_CLASSIFICATION_VALUES = ['minor_safe', 'teen', 'adult'];
const VIEW_LOG_COLLECTION = 'wave_view_logs';
const FEED_MAX_FETCH_ROUNDS = 5;
const FEED_FETCH_FACTOR = 3;
const FEED_RECENT_SEEN_LIMIT = 400;
const FEED_NOT_INTERESTED_LIMIT = 300;
const FEED_CLIENT_EXCLUDE_LIMIT = 160;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolvePlayableUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  const gcsPath = extractGCSPath(rawUrl);
  if (!gcsPath) return rawUrl;
  try {
    return await generateSignedReadUrl(gcsPath, 120);
  } catch {
    return rawUrl;
  }
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
  old.sort(() => Math.random() - 0.5);
  return [...fresh, ...old];
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

    const freshCount = all.reduce((acc, wave) => acc + (excludedIds.has(wave.id) ? 0 : 1), 0);
    if (freshCount >= limit) break;

    currentCursor = nextCursor;
  }

  const ordered = reorderFeedForNovelty(all, excludedIds);
  return {
    waves: ordered.slice(0, limit),
    nextCursor,
  };
}

async function enrichWave(wave, userId = null) {
  const signed = { ...wave, video_url: await resolvePlayableUrl(wave.video_url) };
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

async function evaluateExclusiveChannelAccess({ channel, userId, user }) {
  if (!channel || channel.type !== 'exclusive') {
    return {
      allowed: true,
      requires_consent: false,
      reason: null,
      code: null,
    };
  }

  if (!userId || !user) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Login required for exclusive channels',
      code: 'EXCLUSIVE_LOGIN_REQUIRED',
    };
  }

  const isOwnerOrAdmin = channel.owner_id === userId || user.role === 'admin';
  if (isOwnerOrAdmin) {
    return {
      allowed: true,
      requires_consent: false,
      reason: null,
      code: null,
    };
  }

  const rolloutEnabled = await isExclusiveRolloutEnabledForUser(userId);
  if (!rolloutEnabled) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Exclusive channels are not available for your account yet',
      code: 'EXCLUSIVE_ROLLOUT_BLOCKED',
    };
  }

  const eligibleByKyc = await isAdultKycVerified(userId);
  if (!eligibleByKyc) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Adult KYC verification is required for exclusive channels',
      code: 'EXCLUSIVE_KYC_REQUIRED',
    };
  }

  const activeAccess = await ExclusiveAccess.findActiveByUserAndChannel(userId, channel.id);
  if (!activeAccess) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Personal identifier code access required',
      code: 'EXCLUSIVE_ENTITLEMENT_REQUIRED',
    };
  }

  const activeUnlock = await ExclusivePicUnlock.findActiveByUserAndChannel(userId, channel.id);
  const isUnlockValid = Boolean(
    activeUnlock
    && (!activeUnlock.access_id || activeUnlock.access_id === activeAccess.id),
  );

  if (!isUnlockValid) {
    return {
      allowed: false,
      requires_consent: false,
      reason: 'Personal identifier code access required',
      code: 'EXCLUSIVE_PIC_REQUIRED',
    };
  }

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

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
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

    const updated = await Wave.update(wave.id, {
      title: title !== undefined ? String(title).trim() : undefined,
      description: description !== undefined ? String(description) : undefined,
      thumbnail_url: thumbnail_url !== undefined ? (thumbnail_url || null) : undefined,
      age_classification:
        age_classification !== undefined ? String(age_classification).toLowerCase() : undefined,
      has_explicit_language,
      has_nudity,
      has_violence,
    });

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

    const enriched = await Promise.all(visibleWaves.map((w) => enrichWave(w, userId)));
    const nextCursor = novel.nextCursor;
    res.json({ waves: enriched, next_cursor: nextCursor });
  } catch (err) {
    console.error('[Wave] getFeed:', err.message);
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

    res.json(await enrichWave(wave, userId));
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
    res.json(waves);
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
    const comments = await WaveComment.getComments(wave.id);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postComment(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    const comment = await WaveComment.addComment(
      wave.id,
      req.userId,
      user.display_name || user.username || 'Viewer',
      user.avatar_url || null,
      text
    );

    await Wave.incrementField(wave.id, 'comment_count', 1);
    res.status(201).json(comment);
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
    if (comment.user_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await WaveComment.deleteComment(comment.id);
    await Wave.incrementField(req.params.waveId, 'comment_count', -1);
    res.json({ success: true });
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
        return w && w.status === 'active' ? enrichWave(w, req.userId) : null;
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

    const exclusiveDecision = await evaluateExclusiveChannelAccess({
      channel,
      userId: req.userId || null,
      user,
    });
    if (!exclusiveDecision.allowed) {
      return res.json(exclusiveDecision);
    }

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

// ─── View tracking ───────────────────────────────────────────────────────────

async function trackView(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const userKey = req.userId || (req.ip || '').replace(/:/g, '_').slice(-20);
    await Wave.trackView(wave.id, userKey);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getWaveUploadUrl,
  registerWave,
  updateWave,
  getFeed,
  getWave,
  getChannelWaves,
  deleteWave,
  setTimelineVisibility,
  bulkDeleteWaves,
  bulkSetTimelineVisibility,
  addPulse,
  getPulseMoments,
  getComments,
  postComment,
  deleteComment,
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
};
