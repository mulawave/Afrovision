const Channel = require('./channel.model');
const ChannelAccess = require('./channel_access.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');

/**
 * GET /channels/:id/access
 * Returns whether the authenticated user has valid access to a premium channel.
 */
async function checkAccess(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    if (!channel.requires_payment) {
      return res.json({ has_access: true, reason: 'free' });
    }

    const access = await ChannelAccess.findActiveAccess(req.userId, channel.id);
    if (access) {
      return res.json({ has_access: true, expires_at: access.expires_at, access_id: access.id });
    }

    return res.json({
      has_access: false,
      entry_fee_type: channel.entry_fee_type,
      entry_fee_vpt_units: channel.entry_fee_vpt_units,
      entry_fee_ngn: channel.entry_fee_ngn,
      access_duration_minutes: channel.access_duration_minutes,
    });
  } catch (err) {
    console.error('[PremiumStream] checkAccess:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /channels/:id/pay
 * Charges the user's gift wallet and grants timed channel access.
 */
async function payForAccess(req, res) {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    if (!channel.requires_payment) {
      return res.json({ has_access: true, reason: 'free' });
    }

    // Idempotency: already has valid access?
    const existing = await ChannelAccess.findActiveAccess(req.userId, channel.id);
    if (existing) {
      return res.json({ has_access: true, expires_at: existing.expires_at, access_id: existing.id });
    }

    if (channel.entry_fee_type === 'vpt') {
      return _payWithVPT(req, res, channel);
    }
    return _payWithNGN(req, res, channel);
  } catch (err) {
    console.error('[PremiumStream] payForAccess:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function _payWithVPT(req, res, channel) {
  const uid = req.userId;
  const cost = channel.entry_fee_vpt_units || 0;
  const wallet = await GiftWallet.ensureWallet(uid);

  if (wallet.vpt_units < cost) {
    return res.status(402).json({
      error: 'INSUFFICIENT_VPT',
      required: cost,
      available: wallet.vpt_units,
    });
  }

  // Split: creator 50 %, ops 30 %, community 20 %
  const creatorShare = Math.floor(cost * 0.5);
  const opsShare = Math.floor(cost * 0.3);
  const communityShare = cost - creatorShare - opsShare;

  // Deduct from buyer, credit creator
  await GiftWallet.adjustVptUnits(uid, -cost);
  await GiftWallet.adjustVptUnits(channel.owner_id, creatorShare);

  const durationMinutes = channel.access_duration_minutes || 120;
  const access = await ChannelAccess.grant({ uid, channelId: channel.id, durationMinutes });

  await Ledger.create({
    uid,
    type: 'STREAM_ENTRY_VPT',
    direction: 'debit',
    currency: 'vpt',
    amount_vpt_units: cost,
    channel_id: channel.id,
    status: 'success',
    meta: {
      channel_name: channel.name,
      creator_uid: channel.owner_id,
      creator_share_vpt: creatorShare,
      ops_share_vpt: opsShare,
      community_share_vpt: communityShare,
      access_id: access.id,
    },
    description: `Stream entry (vPT) — ${channel.name}`,
  });

  try {
    await CreatorDailyStats.incrementStreamEntry(channel.owner_id, {
      ngn: 0,
      vpt: creatorShare,
    });
    const activeStream = await StreamStats.getActiveByChannel(channel.id);
    if (activeStream) {
      await StreamStats.incrementViewer(activeStream.id);
    }
  } catch (analyticsError) {
    console.error('[PremiumStream] VPT analytics update error:', analyticsError.message);
  }

  return res.json({
    has_access: true,
    expires_at: access.expires_at,
    access_id: access.id,
  });
}

async function _payWithNGN(req, res, channel) {
  const uid = req.userId;
  const cost = channel.entry_fee_ngn || 0;
  const wallet = await GiftWallet.ensureWallet(uid);

  if (wallet.ngn_balance < cost) {
    return res.status(402).json({
      error: 'INSUFFICIENT_NGN',
      required: cost,
      available: wallet.ngn_balance,
    });
  }

  const creatorShare = Math.floor(cost * 0.5);
  const opsShare = Math.floor(cost * 0.3);
  const communityShare = cost - creatorShare - opsShare;

  await GiftWallet.adjustNgnBalance(uid, -cost);
  await GiftWallet.adjustNgnBalance(channel.owner_id, creatorShare);

  const durationMinutes = channel.access_duration_minutes || 120;
  const access = await ChannelAccess.grant({ uid, channelId: channel.id, durationMinutes });

  await Ledger.create({
    uid,
    type: 'STREAM_ENTRY_NGN',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: cost,
    channel_id: channel.id,
    status: 'success',
    meta: {
      channel_name: channel.name,
      creator_uid: channel.owner_id,
      creator_share_ngn: creatorShare,
      ops_share_ngn: opsShare,
      community_share_ngn: communityShare,
      access_id: access.id,
    },
    description: `Stream entry (NGN) — ${channel.name}`,
  });

  try {
    await CreatorDailyStats.incrementStreamEntry(channel.owner_id, {
      ngn: creatorShare,
      vpt: 0,
    });
    const activeStream = await StreamStats.getActiveByChannel(channel.id);
    if (activeStream) {
      await StreamStats.incrementViewer(activeStream.id);
    }
  } catch (analyticsError) {
    console.error('[PremiumStream] NGN analytics update error:', analyticsError.message);
  }

  return res.json({
    has_access: true,
    expires_at: access.expires_at,
    access_id: access.id,
  });
}

/**
 * GET /channels/my-accesses
 * Returns all active (non-expired) channel access grants for the current user.
 */
async function getMyAccesses(req, res) {
  try {
    const accesses = await ChannelAccess.getByUser(req.userId);
    res.json({ accesses });
  } catch (err) {
    console.error('[PremiumStream] getMyAccesses:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /admin/channels/:id/premium
 * Admin: configure or remove premium gating on a channel.
 */
async function adminSetPremium(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const {
      requires_payment,
      entry_fee_type,
      entry_fee_vpt_units,
      entry_fee_ngn,
      access_duration_minutes,
      subscription_price_ngn,
      subscription_interval_count,
      subscription_interval_unit,
      is_premium_channel,
      premium_elevation_status,
    } = req.body;

    await Channel.updatePremium(req.params.id, {
      requires_payment,
      entry_fee_type,
      entry_fee_vpt_units,
      entry_fee_ngn,
      access_duration_minutes,
      subscription_price_ngn,
      subscription_interval_count,
      subscription_interval_unit,
      is_premium_channel,
      premium_elevation_status,
    });

    await AuditService.logAction(caller.id, 'set_channel_premium', req.params.id, {
      requires_payment,
      entry_fee_type,
      entry_fee_vpt_units,
      entry_fee_ngn,
      access_duration_minutes,
      subscription_price_ngn,
      subscription_interval_count,
      subscription_interval_unit,
      is_premium_channel,
      premium_elevation_status,
    });

    res.json({ channel: await Channel.findById(req.params.id) });
  } catch (err) {
    console.error('[PremiumStream] adminSetPremium:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /admin/channels/premium
 * Admin: list all channels that have requires_payment = true.
 */
async function adminListPremiumChannels(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const channels = await Channel.getPremiumChannels();
    res.json({ channels, total: channels.length });
  } catch (err) {
    console.error('[PremiumStream] adminListPremiumChannels:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /channels/:id/request-premium
 * Creator requests premium elevation for their channel.
 */
async function requestPremiumElevation(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.is_premium_creator) {
      return res.status(403).json({ error: 'Only premium creators can request premium elevation' });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'You can only request premium elevation for your own channels' });
    }

    await Channel.updatePremium(req.params.id, {
      premium_elevation_status: 'pending',
    });

    res.json({
      message: 'Premium elevation requested successfully',
      channel: await Channel.findById(req.params.id),
    });
  } catch (err) {
    console.error('[PremiumStream] requestPremiumElevation:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /admin/channels/premium-requests
 * Admin: list all channels with pending premium elevation requests.
 */
async function adminListPendingPremiumRequests(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const channels = await Channel.getPendingPremiumRequests();
    res.json({ channels, total: channels.length });
  } catch (err) {
    console.error('[PremiumStream] adminListPendingPremiumRequests:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  checkAccess,
  payForAccess,
  getMyAccesses,
  adminSetPremium,
  adminListPremiumChannels,
  requestPremiumElevation,
  adminListPendingPremiumRequests,
};
