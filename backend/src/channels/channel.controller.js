const Channel = require('./channel.model');
const User = require('../users/user.model');
const CreatorSub = require('../subscriptions/creator_subscription.model');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const { isAdultKycVerified } = require('./exclusive_policy.service');
const { getFirestore } = require('../utils/firestore');
const crypto = require('crypto');
const StreamResolver = require('./stream_resolver.service');
const SettingsService = require('../admin/settings.service');
const ChannelSub = require('../subscriptions/channel_subscription.model');
const ChannelStats = require('./channel_stats.model');
const ChannelLive = require('./channel_live.model');
const { normalizePlatform } = require('../utils/platform');

// Despite the name, this used to re-throw in production when a single
// channel's owner lookup failed (stale/missing owner_id, a transient
// Firestore error, etc). Since getPublicChannels/getFeaturedChannels run
// this inside a bare Promise.all with no surrounding try/catch, one bad
// owner_id took down the ENTIRE channel list for every user — every
// channel disappeared app-wide (Home carousel, Channels screen, channel
// surfer) instead of just the one broken channel. Owner lookup failures
// are never fatal to listing channels: every caller already treats a null
// owner as "show a generic/fallback name," so this must always degrade
// gracefully, in every environment.
async function getOwnerSafely(ownerId) {
  try {
    return await User.findById(ownerId);
  } catch (error) {
    console.warn('[Channel] owner lookup failed, continuing without owner:', error.message, 'owner_id=', ownerId);
    return null;
  }
}

/**
 * Returns true unless EXTERNAL_STREAMING_ENABLED is explicitly set to 'false'.
 * Setting it to 'false' in deploy-env.yaml is the rollback/kill-switch for
 * the external link-based streaming feature (AV-STR-010).
 */
function isExternalStreamingEnabled() {
  return process.env.EXTERNAL_STREAMING_ENABLED !== 'false';
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim();
}

async function createChannel(req, res) {
  const user = req.user || await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or fewer' });
  if (description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });

  const channelType = type || 'public';
  if (!['public', 'private', 'exclusive'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public, private, or exclusive' });
  }

  if ((channelType === 'private' || channelType === 'exclusive') && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private or exclusive channels' });
  }

  const channel = await Channel.create({
    ownerId: req.userId,
    name: sanitize(name),
    description: sanitize(description),
    category: sanitize(category),
    type: channelType,
  });

  res.status(201).json({ channel: await safeEnrichChannel(channel, user, req.userId) });
}

async function getPublicChannels(req, res) {
  const channels = await Channel.getAll();

  // If user is authenticated, fetch their active exclusive channel accesses
  let exclusiveChannelIds = new Set();
  if (req.userId) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('exclusive_channel_access')
        .where('user_uid', '==', req.userId)
        .where('status', '==', 'active')
        .get();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.channel_id) exclusiveChannelIds.add(data.channel_id);
      });
    } catch (err) {
      console.error('[Channels] Failed to fetch exclusive accesses:', err.message);
    }
  }

  const visibleChannels = channels.filter((channel) => {
    if (channel.is_banned) return false;
    if (channel.type !== 'public') return false;
    // Include exclusive channels only if the user has active access
    if (Number(channel.exclusive_monthly_fee_ngn || 0) > 0) {
      return exclusiveChannelIds.has(channel.id);
    }
    return true;
  });

  const enriched = await Promise.all(visibleChannels.map(async (ch) => {
    const owner = await getOwnerSafely(ch.owner_id);
    return safeEnrichChannel(ch, owner, req.userId || null);
  }));
  res.json({ channels: enriched });
}

async function getFeaturedChannels(req, res) {
  const channels = await Channel.getFeaturedChannels(5);
  let canSeeExclusive = false;
  if (req.userId) {
    const kycResult = await isAdultKycVerified(req.userId);
    canSeeExclusive = kycResult.isVerified;
  }

  const visibleChannels = channels.filter((channel) => {
    if (channel.is_banned) return false;
    if (channel.type === 'public') return true;
    if (channel.type === 'exclusive') return canSeeExclusive;
    return false;
  });

  const enriched = await Promise.all(visibleChannels.map(async (ch) => {
    const owner = await getOwnerSafely(ch.owner_id);
    return safeEnrichChannel(ch, owner, req.userId || null);
  }));
  res.json({ channels: enriched });
}

async function getChannelById(req, res) {
  const channel = await Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  if (channel.is_banned) {
    return res.status(403).json({ error: 'CHANNEL_BANNED', message: 'This channel has been banned.' });
  }

  if (channel.type === 'exclusive') {
    if (!req.userId) {
      return res.status(403).json({
        error: 'Login required for exclusive channels',
        requires_login: true,
      });
    }

    const isOwner = channel.owner_id === req.userId;
    const caller = await User.findById(req.userId);
    const isAdmin = caller && caller.role === 'admin';
    if (!isOwner && !isAdmin) {
      const eligibleByKyc = await isAdultKycVerified(req.userId);
      if (!eligibleByKyc.isVerified) {
        return res.status(403).json({
          error: eligibleByKyc.isMinor
            ? 'Exclusive channels are not available for users under 18'
            : 'KYC verification is required for exclusive channels',
          requires_kyc: !eligibleByKyc.isMinor,
        });
      }
    }
  }

  const owner = await getOwnerSafely(channel.owner_id);
  res.json({ channel: await safeEnrichChannel(channel, owner, req.userId) });
}

async function getChannelByNumber(req, res) {
  const channel = await Channel.findByNumber(req.params.channelNumber);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  if (channel.is_banned) {
    return res.status(403).json({ error: 'CHANNEL_BANNED', message: 'This channel has been banned.' });
  }

  const owner = await getOwnerSafely(channel.owner_id);
  res.json({ channel: await safeEnrichChannel(channel, owner, req.userId) });
}

async function updateChannel(req, res) {
  const channel = await Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  // vPT edit gating: configurable via admin settings; never applies to exclusive channel owners
  const isExclusiveChannel = Number(channel.exclusive_monthly_fee_ngn || 0) > 0;
  if (!isExclusiveChannel) {
    const [feeEnabledRaw, feeAmountRaw] = await Promise.all([
      SettingsService.get('CHANNEL_EDIT_VPT_FEE_ENABLED'),
      SettingsService.getNumber('CHANNEL_EDIT_VPT_FEE'),
    ]);
    const feeEnabled = feeEnabledRaw !== 'false';
    const feeAmount = (feeAmountRaw != null && Number.isFinite(feeAmountRaw)) ? feeAmountRaw : 500;
    if (feeEnabled) {
      const user = req.user || await User.findById(req.userId);
      if (user && user.role === 'creator' && user.vpt < feeAmount) {
        return res.status(403).json({
          error: `Insufficient vPT balance. You need at least ₦${feeAmount} vPT to edit a channel.`,
          required_vpt: feeAmount,
          current_vpt: user.vpt || 0,
        });
      }
    }
  }

  const { name, description, category } = req.body;
  const updated = await Channel.update(req.params.id, {
    name: name ? sanitize(name) : undefined,
    description: description ? sanitize(description) : undefined,
    category: category ? sanitize(category) : undefined,
  });
  const owner = await getOwnerSafely(updated.owner_id);
  res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
}

async function deleteChannel(req, res) {
  const channel = await Channel.findAnyById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const user = req.user || await User.findById(req.userId);
  const isOwner = channel.owner_id === req.userId;
  const isAdmin = user && user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only channel owner or admin can delete this channel' });
  }

  await Channel.hardDelete(req.params.id);
  res.json({ message: 'Channel permanently deleted' });
}

async function getMyChannels(req, res) {
  const channels = await Channel.getAllByOwner(req.userId);
  const enriched = await Promise.all(channels.map(async (ch) => {
    const owner = await getOwnerSafely(ch.owner_id);
    return safeEnrichChannel(ch, owner, req.userId);
  }));
  res.json({ channels: enriched });
}

async function enableChannel(req, res) {
  const ownedChannels = await Channel.getAllByOwner(req.userId);
  const channel = await Channel.findById(req.params.id) ||
    ownedChannels.find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  const enabled = await Channel.enable(req.params.id);
  const owner = await getOwnerSafely(enabled.owner_id);
  res.json({ channel: await safeEnrichChannel(enabled, owner, req.userId) });
}

/**
 * PATCH /channels/:id/external-source
 * Sets or clears the external stream source configuration for a channel.
 * Restricted to the channel owner. Accepts: stream_source_mode, external_provider,
 * external_url, resolved_playback_url, stream_status, last_checked_at, provider_metadata.
 * Passing stream_source_mode: 'native' effectively clears the external source.
 * Passing stream_source_mode: 'external_url' stores the raw URL directly with
 * no source-type classification.
 */
async function updateExternalSource(req, res) {
  const channel = await Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const user = req.user || await User.findById(req.userId);
  const isOwner = channel.owner_id === req.userId;
  const isAdmin = user && user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  const {
    stream_source_mode,
    external_provider,
    external_url,
    resolved_playback_url,
    stream_status,
    last_checked_at,
    provider_metadata,
  } = req.body;

  // Block non-native external source assignments when feature is disabled.
  // Admins can still set channels back to 'native' (the kill-switch path).
  const requestedMode = stream_source_mode || channel.stream_source_mode || 'native';
  if (requestedMode !== 'native' && !isExternalStreamingEnabled()) {
    return res.status(503).json({
      error: 'External streaming is currently disabled.',
      error_code: 'EXTERNAL_STREAMING_DISABLED',
    });
  }

  // Validate stream_source_mode if provided
  if (stream_source_mode !== undefined && !Channel.ALLOWED_SOURCE_MODES.includes(stream_source_mode)) {
    return res.status(400).json({
      error: `Invalid stream_source_mode. Allowed values: ${Channel.ALLOWED_SOURCE_MODES.join(', ')}`,
    });
  }

  // Validate stream_status if provided
  if (stream_status !== undefined && !Channel.ALLOWED_STREAM_STATUSES.includes(stream_status)) {
    return res.status(400).json({
      error: `Invalid stream_status. Allowed values: ${Channel.ALLOWED_STREAM_STATUSES.join(', ')}`,
    });
  }

  // external_url must be a non-empty string when source mode is not native
  const effectiveMode = stream_source_mode || channel.stream_source_mode || 'native';
  if (effectiveMode === 'native') {
    const updated = await Channel.updateExternalSource(req.params.id, {
      stream_source_mode: 'native',
      external_provider: null,
      external_url: null,
      resolved_playback_url: null,
      stream_status: 'unknown',
      last_checked_at: null,
      provider_metadata: null,
    });

    const owner = await getOwnerSafely(updated.owner_id);
    return res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
  }

  if (effectiveMode !== 'native' && external_url !== undefined && typeof external_url === 'string') {
    const trimmed = external_url.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'external_url cannot be empty for non-native source modes' });
    }
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
      return res.status(400).json({ error: 'external_url must be a valid URL' });
    }
  }

  // Auto-resolve when a new external_url is provided — the resolver classifies and probes
  // the URL and populates stream_source_mode, resolved_playback_url, stream_status,
  // last_checked_at, and provider_metadata automatically unless the caller already
  // provided explicit overrides for those fields.
  let resolvedFields = {};
  const urlToResolve = external_url !== undefined ? external_url : null;
  if (urlToResolve && typeof urlToResolve === 'string' && urlToResolve.trim().length > 0) {
    if (effectiveMode === 'external_url') {
      const rawUrl = sanitize(String(urlToResolve)).trim();
      resolvedFields = {
        stream_source_mode: 'external_url',
        external_provider:
          external_provider !== undefined
            ? external_provider
            : 'external_url',
        external_url: rawUrl,
        resolved_playback_url:
          resolved_playback_url !== undefined
            ? resolved_playback_url
            : rawUrl,
        stream_status:
          stream_status !== undefined ? stream_status : 'live',
        last_checked_at:
          last_checked_at !== undefined
            ? last_checked_at
            : new Date().toISOString(),
        provider_metadata:
          provider_metadata !== undefined
            ? provider_metadata
            : { mode: 'external_url', validation: 'none' },
      };
    } else {
      const resolution = await StreamResolver.resolveSource(urlToResolve.trim());
      if (!resolution.ok) {
        return res.status(422).json({
          error: resolution.error_message,
          error_code: resolution.error_code,
        });
      }
      resolvedFields = {
        stream_source_mode: stream_source_mode !== undefined ? stream_source_mode : resolution.stream_source_mode,
        external_provider: external_provider !== undefined ? external_provider : resolution.external_provider,
        external_url: resolution.external_url,
        resolved_playback_url: resolved_playback_url !== undefined ? resolved_playback_url : resolution.resolved_playback_url,
        stream_status: stream_status !== undefined ? stream_status : resolution.stream_status,
        last_checked_at: last_checked_at !== undefined ? last_checked_at : resolution.last_checked_at,
        provider_metadata: provider_metadata !== undefined ? provider_metadata : resolution.provider_metadata,
      };
    }
  }

  const updated = await Channel.updateExternalSource(req.params.id, Object.keys(resolvedFields).length > 0 ? resolvedFields : {
    stream_source_mode,
    external_provider: external_provider !== undefined ? sanitize(String(external_provider || '')) || null : undefined,
    external_url: external_url !== undefined ? (external_url ? sanitize(String(external_url)).trim() : null) : undefined,
    resolved_playback_url: resolved_playback_url !== undefined ? (resolved_playback_url || null) : undefined,
    stream_status,
    last_checked_at: last_checked_at !== undefined ? (last_checked_at || null) : undefined,
    provider_metadata: provider_metadata !== undefined ? (provider_metadata || null) : undefined,
  });

  const owner = await getOwnerSafely(updated.owner_id);
  res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
}

async function enrichChannel(channel, owner, requesterId) {
  const ownerDisplayMode = channel.owner_display_mode || 'show_owner';
  const ownerBrandName = typeof channel.owner_brand_name === 'string'
    ? channel.owner_brand_name.trim()
    : null;
  const trueOwnerName = owner?.name || owner?.email || 'Unknown';

  let publicOwnerName = trueOwnerName;
  let ownerDetailsVisible = true;

  if (ownerDisplayMode === 'hide_owner') {
    publicOwnerName = '';
    ownerDetailsVisible = false;
  } else if (ownerDisplayMode === 'brand_only') {
    publicOwnerName = ownerBrandName || 'Brand';
    ownerDetailsVisible = false;
  }

  // followers_count and subscriber_count are the same query — was run
  // twice per channel, doubling the read cost for no reason.
  const followersCount = await ChannelSub.countActiveByChannel(channel.id);

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    category: channel.category,
    type: channel.type,
    channel_number: Number(channel.channel_number) || channel.channel_number,
    logo_url: channel.logo_url,
    banner_url: channel.banner_url,
    is_active: channel.is_active,
    created_at: channel.created_at,
    owner_id: channel.owner_id,
    owner_name: publicOwnerName,
    followers_count: followersCount,
    subscriber_count: followersCount,
    owner_display_mode: ownerDisplayMode,
    owner_brand_name: ownerBrandName,
    owner_details_visible: ownerDetailsVisible,
    public_owner_name: publicOwnerName,
    // External source fields — safe defaults for legacy records
    stream_source_mode: channel.stream_source_mode || 'native',
    external_provider: channel.external_provider || null,
    external_url: channel.external_url || null,
    resolved_playback_url: channel.resolved_playback_url || null,
    stream_status: channel.stream_status || 'unknown',
    last_checked_at: channel.last_checked_at || null,
    provider_metadata: channel.provider_metadata || null,
    exclusive_monthly_fee_ngn: Number(channel.exclusive_monthly_fee_ngn || 0),
    exclusive_fee_currency: channel.exclusive_fee_currency || 'NGN',
    exclusive_fee_last_updated_at: channel.exclusive_fee_last_updated_at || null,
    exclusive_fee_last_updated_by: channel.exclusive_fee_last_updated_by || null,
  };
}

async function safeEnrichChannel(channel, owner, requesterId) {
  try {
    return await enrichChannel(channel, owner, requesterId);
  } catch (err) {
    console.error('[Channel] enrich fallback:', err && err.message ? err.message : err, 'channel_id=', channel && channel.id);

    const ownerDisplayMode = channel.owner_display_mode || 'show_owner';
    const ownerBrandName = typeof channel.owner_brand_name === 'string'
      ? channel.owner_brand_name.trim()
      : null;
    const trueOwnerName = owner?.name || owner?.email || 'Unknown';
    const publicOwnerName = ownerDisplayMode === 'brand_only'
      ? (ownerBrandName || 'Brand')
      : (ownerDisplayMode === 'hide_owner' ? '' : trueOwnerName);

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      category: channel.category,
      type: channel.type,
      channel_number: Number(channel.channel_number) || channel.channel_number,
      logo_url: channel.logo_url,
      banner_url: channel.banner_url,
      is_active: channel.is_active,
      created_at: channel.created_at,
      owner_id: channel.owner_id,
      owner_name: publicOwnerName,
      followers_count: 0,
      subscriber_count: 0,
      owner_display_mode: ownerDisplayMode,
      owner_brand_name: ownerBrandName,
      owner_details_visible: ownerDisplayMode === 'show_owner',
      public_owner_name: publicOwnerName,
      stream_source_mode: channel.stream_source_mode || 'native',
      external_provider: channel.external_provider || null,
      external_url: channel.external_url || null,
      resolved_playback_url: channel.resolved_playback_url || null,
      stream_status: channel.stream_status || 'unknown',
      last_checked_at: channel.last_checked_at || null,
      provider_metadata: channel.provider_metadata || null,
      exclusive_monthly_fee_ngn: Number(channel.exclusive_monthly_fee_ngn || 0),
      exclusive_fee_currency: channel.exclusive_fee_currency || 'NGN',
      exclusive_fee_last_updated_at: channel.exclusive_fee_last_updated_at || null,
      exclusive_fee_last_updated_by: channel.exclusive_fee_last_updated_by || null,
    };
  }
}

async function uploadMedia(req, res) {
  const ownedChannels = await Channel.getAllByOwner(req.userId);
  const channel = await Channel.findById(req.params.id) ||
    ownedChannels.find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const mediaType = req.params.mediaType;
  if (!['logo', 'banner'].includes(mediaType)) {
    return res.status(400).json({ error: 'Media type must be logo or banner' });
  }

  const url = req.file.gcsUrl;
  const field = mediaType === 'logo' ? 'logo_url' : 'banner_url';
  await Channel.update(channel.id, { [field]: url });

  // Re-fetch to get updated data (handle disabled channels)
  const updated = (await Channel.getAllByOwner(req.userId)).find((c) => c.id === channel.id);
  const owner = await getOwnerSafely(updated.owner_id);
  res.json({ channel: await enrichChannel(updated, owner, req.userId) });
}

async function createChannelWithMedia(req, res) {
  const user = req.user || await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or fewer' });
  if (description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });

  const channelType = type || 'public';
  if (!['public', 'private', 'exclusive'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public, private, or exclusive' });
  }

  if ((channelType === 'private' || channelType === 'exclusive') && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private or exclusive channels' });
  }

  const channel = await Channel.create({
    ownerId: req.userId,
    name: sanitize(name),
    description: sanitize(description),
    category: sanitize(category),
    type: channelType,
  });

  // Attach uploaded files if present
  if (req.files) {
    if (req.files.logo && req.files.logo[0]) {
      await Channel.update(channel.id, { logo_url: req.files.logo[0].gcsUrl });
    }
    if (req.files.banner && req.files.banner[0]) {
      await Channel.update(channel.id, { banner_url: req.files.banner[0].gcsUrl });
    }
  }

  const updated = await Channel.findById(channel.id);
  res.status(201).json({ channel: await safeEnrichChannel(updated, user, req.userId) });
}

/**
 * GET /channels/subscriber-feed
 * Returns channels owned by creators the authenticated user actively subscribes to.
 * Useful for "Subscriber-Only Live Now" section on home screen.
 */
async function getSubscriberFeed(req, res) {
  // All active subscriptions where the caller is the subscriber
  const subs = (await CreatorSub.getBySubscriber(req.userId)).filter((s) => s.status === 'active');
  const creatorUids = [...new Set(subs.map((s) => s.creator_uid))];

  if (creatorUids.length === 0) {
    return res.json({ channels: [] });
  }

  const channels = await Channel.getActiveByOwnerIds(creatorUids);

  res.json({ channels });
}

/**
 * POST /channels/:id/view
 * Records a view event for analytics.
 */
// Public live-viewer count for the Watch Screen's LIVE badge. The admin
// dashboard already reads this data (ChannelLive.getForChannels); this is
// the first user-facing exposure of it — real numbers only, never a
// fabricated placeholder count.
async function getLiveStats(req, res) {
  try {
    const stats = await ChannelLive.getForChannel(req.params.id);
    res.json({
      current_viewers: stats.current_viewers || 0,
      updated_at: stats.updated_at || null,
    });
  } catch (err) {
    console.error('[Channel] getLiveStats error:', err.message);
    res.status(500).json({ error: 'Failed to load live stats' });
  }
}

async function recordView(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const viewerUid = req.userId;
    const platform = normalizePlatform(req.body?.platform);

    // Record view event in channel_events
    const db = getFirestore();
    const event = {
      id: crypto.randomUUID(),
      channel_id: channel.id,
      type: 'view',
      sender_uid: viewerUid,
      platform,
      created_at: Date.now(),
    };
    await db.collection('channel_events').doc(event.id).set(event);

    // Increment daily stats for the channel owner
    await CreatorDailyStats.incrementViewers(channel.owner_id, viewerUid);

    // Track lifetime views on the channel itself, tagged by platform
    // (surfaced on the admin live-viewers dashboard).
    await ChannelStats.incrementViews(channel.id, 1, platform);

    // Also increment stream stats if there's an active stream
    const activeStream = await StreamStats.getActiveByChannel(channel.id);
    if (activeStream) {
      await StreamStats.incrementViewer(activeStream.id);
    }

    res.json({ message: 'View recorded' });
  } catch (err) {
    console.error('[Channel] recordView error:', err.message);
    res.status(500).json({ error: 'Failed to record view' });
  }
}

/**
 * POST /channels/:id/watch-ping
 * Body: { seconds }
 * Called periodically (e.g. every 30-60s) by a client actively watching a
 * channel to accumulate real "hours watched" totals. Best-effort — a missed
 * or duplicated ping just under/over-counts a small window, never blocks
 * playback.
 */
async function recordWatchPing(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const seconds = Number(req.body?.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return res.status(400).json({ error: 'seconds must be a positive number' });
    }
    // Clamp a single ping to a sane ceiling so a malformed/malicious client
    // can't inflate watch-time in one call.
    const safeSeconds = Math.min(seconds, 300);
    const platform = normalizePlatform(req.body?.platform);

    await ChannelStats.addWatchSeconds(channel.id, safeSeconds, platform);
    res.json({ message: 'Watch time recorded' });
  } catch (err) {
    console.error('[Channel] recordWatchPing error:', err.message);
    res.status(500).json({ error: 'Failed to record watch time' });
  }
}

/**
 * POST /channels/resolve-source
 * Classifies and validates an external stream URL against the approved source
 * matrix. Returns a normalized source contract without persisting anything.
 * Any authenticated user may call this to validate a URL before submission.
 * Body: { url: string }
 */
async function resolveStreamSource(req, res) {
  if (!isExternalStreamingEnabled()) {
    return res.status(503).json({
      error: 'External streaming is currently disabled.',
      error_code: 'EXTERNAL_STREAMING_DISABLED',
    });
  }

  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  const result = await StreamResolver.resolveSource(url.trim());

  if (!result.ok) {
    return res.status(422).json({
      error: result.error_message,
      error_code: result.error_code,
    });
  }

  return res.json(result);
}

/**
 * POST /channels/:id/recheck-source
 * Re-probes the currently configured external source URL and updates
 * stream_status and last_checked_at on the channel record.
 * Restricted to channel owner or admin.
 */
async function recheckStreamHealth(req, res) {
  if (!isExternalStreamingEnabled()) {
    return res.status(503).json({
      error: 'External streaming is currently disabled.',
      error_code: 'EXTERNAL_STREAMING_DISABLED',
    });
  }

  const channel = await Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const user = req.user || await User.findById(req.userId);
  const isOwner = channel.owner_id === req.userId;
  const isAdmin = user && user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  const mode = channel.stream_source_mode || 'native';
  if (mode === 'native') {
    return res.status(400).json({ error: 'Channel is using native source mode; no external source to check' });
  }

  const playbackUrl = channel.resolved_playback_url || channel.external_url;
  if (!playbackUrl) {
    return res.status(400).json({ error: 'Channel has no resolved playback URL to probe' });
  }

  if (mode === 'external_url') {
    const updated = await Channel.updateExternalSource(req.params.id, {
      stream_status: 'live',
      last_checked_at: new Date().toISOString(),
      provider_metadata: channel.provider_metadata
        ? {
            ...channel.provider_metadata,
            probe_method: 'none',
            probe_http_status: null,
            probe_latency_ms: null,
          }
        : {
            probe_method: 'none',
            probe_http_status: null,
            probe_latency_ms: null,
          },
    });
    const owner = await getOwnerSafely(updated.owner_id);
    return res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
  }

  const health = await StreamResolver.recheckHealth(playbackUrl, mode);

  const updated = await Channel.updateExternalSource(req.params.id, {
    stream_status: health.stream_status,
    last_checked_at: health.last_checked_at,
    provider_metadata: channel.provider_metadata
      ? {
          ...channel.provider_metadata,
          probe_http_status: health.probe_http_status,
          probe_latency_ms: health.probe_latency_ms,
        }
      : {
          probe_http_status: health.probe_http_status,
          probe_latency_ms: health.probe_latency_ms,
        },
  });

  const owner = await getOwnerSafely(updated.owner_id);
  return res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
}

/**
 * PATCH /channels/admin/:id/featured
 * Sets or unsets a channel as featured (admin only).
 * Body: { featured: boolean }
 */
async function adminSetFeatured(req, res) {
  const user = req.user || await User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { featured } = req.body;
  if (typeof featured !== 'boolean') {
    return res.status(400).json({ error: 'featured must be a boolean' });
  }

  const updated = await Channel.setFeatured(req.params.id, featured, req.userId);
  if (!updated) return res.status(404).json({ error: 'Channel not found' });

  const owner = await getOwnerSafely(updated.owner_id);
  res.json({ channel: await safeEnrichChannel(updated, owner, req.userId) });
}

module.exports = {
  createChannel,
  createChannelWithMedia,
  getPublicChannels,
  getFeaturedChannels,
  getChannelById,
  getChannelByNumber,
  updateChannel,
  deleteChannel,
  getMyChannels,
  enableChannel,
  updateExternalSource,
  resolveStreamSource,
  recheckStreamHealth,
  uploadMedia,
  getSubscriberFeed,
  getLiveStats,
  recordView,
  recordWatchPing,
  adminSetFeatured,
};
