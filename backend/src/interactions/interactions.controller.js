const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');
const GiftModel = require('./gift.model');
const GiftWallet = require('./gift-wallet.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const LedgerService = require('../vpt/ledger.service');
const { emitChannelEvent } = require('../realtime/socket.service');
const { getSenderDisplayName } = require('./live_identity');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');

// ─── Constants ───────────────────────────────────────────
const SPLIT = { creator: 0.5, operations: 0.3, community: 0.2 };
const RATE_LIMIT = 5;
const RATE_WINDOW = 5000;
const COMBO_WINDOW = 3000;

// ─── In-memory rate limit ────────────────────────────────
const rateBuckets = new Map();

function checkRateLimit(uid) {
  const now = Date.now();
  const bucket = rateBuckets.get(uid) || [];
  const recent = bucket.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) {
    return false;
  }
  recent.push(now);
  rateBuckets.set(uid, recent);
  return true;
}

// Prune stale rate-limit buckets every 60 s
setInterval(() => {
  const now = Date.now();
  for (const [uid, bucket] of rateBuckets) {
    const live = bucket.filter((t) => now - t < RATE_WINDOW);
    if (live.length === 0) rateBuckets.delete(uid);
    else rateBuckets.set(uid, live);
  }
}, 60_000).unref();

// ─── Admin: Gift CRUD ────────────────────────────────────

async function createGift(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { name, icon, animation, currency, vpt_units, naira_value, sort_order } = req.body;
    if (!name || !icon) {
      return res.status(400).json({ error: 'Name and icon are required' });
    }
    if (!['vpt', 'ngn'].includes(currency)) {
      return res.status(400).json({ error: 'Currency must be vpt or ngn' });
    }

    const gift = await GiftModel.create({
      name,
      icon,
      animation,
      currency,
      vptUnits: vpt_units,
      nairaValue: naira_value,
      sortOrder: sort_order,
    });

    res.status(201).json({ gift });
  } catch (err) {
    console.error('[Interactions] createGift error:', err.message);
    res.status(500).json({ error: 'Failed to create gift' });
  }
}

async function updateGift(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const gift = await GiftModel.update(req.params.giftId, req.body);
    if (!gift) return res.status(404).json({ error: 'Gift not found' });

    res.json({ gift });
  } catch (err) {
    console.error('[Interactions] updateGift error:', err.message);
    res.status(500).json({ error: 'Failed to update gift' });
  }
}

async function deleteGift(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const removed = await GiftModel.remove(req.params.giftId);
    if (!removed) return res.status(404).json({ error: 'Gift not found' });

    res.json({ message: 'Gift deleted' });
  } catch (err) {
    console.error('[Interactions] deleteGift error:', err.message);
    res.status(500).json({ error: 'Failed to delete gift' });
  }
}

function getGifts(req, res) {
  const gifts = GiftModel.getActive();
  res.json({ gifts });
}

function getAllGifts(req, res) {
  const user = User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  res.json({ gifts: GiftModel.getAll() });
}

// ─── Wallet ──────────────────────────────────────────────

async function getMyGiftWallet(req, res) {
  try {
    const wallet = await GiftWallet.ensureWallet(req.userId);
    res.json({ wallet: { vpt_units: wallet.vpt_units, ngn_balance: wallet.ngn_balance } });
  } catch (err) {
    console.error('[Interactions] getMyGiftWallet error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve wallet' });
  }
}

// ─── Send Reaction (free) ────────────────────────────────

async function sendReaction(req, res) {
  try {
    const { channel_id, emoji } = req.body;
    if (!channel_id || !emoji) {
      return res.status(400).json({ error: 'channel_id and emoji are required' });
    }

    if (!checkRateLimit(req.userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const db = getFirestore();
    const event = {
      id: crypto.randomUUID(),
      channel_id,
      type: 'reaction',
      emoji,
      sender_uid: req.userId,
      created_at: Date.now(),
    };
    await db.collection('channel_events').doc(event.id).set(event);

    emitChannelEvent(channel_id, {
      id: event.id,
      type: 'reaction',
      sender_name: getSenderDisplayName(req.userId, channel),
      emoji,
      created_at: event.created_at,
    });

    // Return only confirmation — no sender_uid in response
    res.json({ message: 'Reaction sent' });
  } catch (err) {
    console.error('[Interactions] sendReaction error:', err.message);
    res.status(500).json({ error: 'Failed to send reaction' });
  }
}

// ─── Send Gift (atomic transaction) ──────────────────────

async function sendGift(req, res) {
  try {
    const { channel_id, gift_id } = req.body;
    if (!channel_id || !gift_id) {
      return res.status(400).json({ error: 'channel_id and gift_id are required' });
    }

    if (!checkRateLimit(req.userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const gift = GiftModel.findById(gift_id);
    if (!gift || !gift.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive gift' });
    }

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const creatorUid = channel.owner_id;
    if (creatorUid === req.userId) {
      return res.status(400).json({ error: 'Cannot gift your own channel' });
    }

    const db = getFirestore();

    let analyticsShare;
    if (gift.currency === 'vpt') {
      analyticsShare = await _sendVptGift(db, req.userId, creatorUid, channel_id, gift);
    } else if (gift.currency === 'ngn') {
      analyticsShare = await _sendNgnGift(db, req.userId, creatorUid, channel_id, gift);
    } else {
      return res.status(400).json({ error: 'Unknown gift currency' });
    }

    try {
      await CreatorDailyStats.incrementGifts(creatorUid, analyticsShare);
      const activeStream = StreamStats.getActiveByChannel(channel_id);
      if (activeStream) {
        await StreamStats.addGifts(activeStream.id, analyticsShare);
      }
    } catch (analyticsError) {
      console.error('[Interactions] gift analytics update error:', analyticsError.message);
    }

    // Register combo
    await _registerCombo(db, channel_id, req.userId, gift_id);

    // Get display name
    const user = User.findById(req.userId);
    const displayName = channel.type === 'private'
      ? getSenderDisplayName(req.userId, channel)
      : (user?.name || user?.email || 'Anonymous');

    emitChannelEvent(channel_id, {
      id: crypto.randomUUID(),
      type: 'gift',
      sender_name: displayName,
      gift_name: gift.name,
      gift_icon: gift.icon,
      animation: gift.animation,
      created_at: Date.now(),
    });

    res.json({
      message: 'Gift sent',
      gift_name: gift.name,
      gift_icon: gift.icon,
      animation: gift.animation,
      sender_name: displayName,
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_VPT') {
      return res.status(400).json({ error: 'Insufficient vPT balance' });
    }
    if (err.message === 'INSUFFICIENT_NGN') {
      return res.status(400).json({ error: 'Insufficient NGN balance' });
    }
    console.error('[Interactions] sendGift error:', err.message);
    res.status(500).json({ error: 'Failed to send gift' });
  }
}

async function _sendVptGift(db, senderUid, creatorUid, channelId, gift) {
  const senderRef = db.collection('gift_wallets').doc(senderUid);
  const creatorRef = db.collection('gift_wallets').doc(creatorUid);

  await db.runTransaction(async (tx) => {
    const senderDoc = await tx.get(senderRef);
    const creatorDoc = await tx.get(creatorRef);

    const senderData = senderDoc.exists ? senderDoc.data() : { uid: senderUid, vpt_units: 0, ngn_balance: 0 };
    const creatorData = creatorDoc.exists ? creatorDoc.data() : { uid: creatorUid, vpt_units: 0, ngn_balance: 0 };

    const cost = gift.vpt_units;
    const senderBefore = senderData.vpt_units || 0;
    if (senderBefore < cost) throw new Error('INSUFFICIENT_VPT');

    const creatorShare = Math.floor(cost * SPLIT.creator);
    const opsShare = Math.floor(cost * SPLIT.operations);
    const communityShare = cost - creatorShare - opsShare;

    const senderAfter = senderBefore - cost;
    const creatorBefore = creatorData.vpt_units || 0;
    const creatorAfter = creatorBefore + creatorShare;

    // Debit sender
    tx.set(senderRef, {
      ...senderData,
      vpt_units: senderAfter,
      updated_at: Date.now(),
    });

    // Credit creator
    tx.set(creatorRef, {
      ...creatorData,
      vpt_units: creatorAfter,
      updated_at: Date.now(),
    });

    // Pools
    const admin = require('firebase-admin');
    tx.set(db.collection('pools').doc('operations'), {
      vpt_units: admin.firestore.FieldValue.increment(opsShare),
    }, { merge: true });
    tx.set(db.collection('pools').doc('community'), {
      vpt_units: admin.firestore.FieldValue.increment(communityShare),
    }, { merge: true });

    // Ledger entries via LedgerService
    LedgerService.record({
      type: 'GIFT_SENT_VPT',
      uid: senderUid,
      direction: 'debit',
      currency: 'vpt',
      amount_vpt_units: cost,
      balance_before: senderBefore,
      balance_after: senderAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
    }, tx);

    LedgerService.record({
      type: 'GIFT_RECEIVED_VPT',
      uid: creatorUid,
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: creatorShare,
      balance_before: creatorBefore,
      balance_after: creatorAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
    }, tx);

    // Channel event
    tx.set(db.collection('channel_events').doc(crypto.randomUUID()), {
      channel_id: channelId,
      type: 'gift',
      gift_id: gift.id,
      sender_uid: senderUid,
      created_at: Date.now(),
    });

    // Gift stats
    tx.set(db.collection('gift_stats').doc(crypto.randomUUID()), {
      channel_id: channelId,
      gift_id: gift.id,
      sender_uid: senderUid,
      vpt_units: cost,
      created_at: Date.now(),
    });
  });

  // Reload wallet caches from Firestore (authoritative source)
  await GiftWallet.reloadFromFirestore(senderUid);
  await GiftWallet.reloadFromFirestore(creatorUid);

  return { ngn: 0, vpt: creatorShare };
}

async function _sendNgnGift(db, senderUid, creatorUid, channelId, gift) {
  const senderRef = db.collection('gift_wallets').doc(senderUid);
  const creatorRef = db.collection('gift_wallets').doc(creatorUid);

  await db.runTransaction(async (tx) => {
    const senderDoc = await tx.get(senderRef);
    const creatorDoc = await tx.get(creatorRef);

    const senderData = senderDoc.exists ? senderDoc.data() : { uid: senderUid, vpt_units: 0, ngn_balance: 0 };
    const creatorData = creatorDoc.exists ? creatorDoc.data() : { uid: creatorUid, vpt_units: 0, ngn_balance: 0 };

    const cost = gift.naira_value;
    const senderBefore = senderData.ngn_balance || 0;
    if (senderBefore < cost) throw new Error('INSUFFICIENT_NGN');

    const creatorShare = cost * SPLIT.creator;
    const opsShare = cost * SPLIT.operations;
    const communityShare = cost - creatorShare - opsShare;

    const senderAfter = senderBefore - cost;
    const creatorBefore = creatorData.ngn_balance || 0;
    const creatorAfter = creatorBefore + creatorShare;

    // Debit sender
    tx.set(senderRef, {
      ...senderData,
      ngn_balance: senderAfter,
      updated_at: Date.now(),
    });

    // Credit creator
    tx.set(creatorRef, {
      ...creatorData,
      ngn_balance: creatorAfter,
      updated_at: Date.now(),
    });

    // Pools
    const admin = require('firebase-admin');
    tx.set(db.collection('pools').doc('operations'), {
      naira: admin.firestore.FieldValue.increment(opsShare),
    }, { merge: true });
    tx.set(db.collection('pools').doc('community'), {
      naira: admin.firestore.FieldValue.increment(communityShare),
    }, { merge: true });

    // Ledger entries via LedgerService
    LedgerService.record({
      type: 'GIFT_SENT_NGN',
      uid: senderUid,
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: cost,
      balance_before: senderBefore,
      balance_after: senderAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
    }, tx);

    LedgerService.record({
      type: 'GIFT_RECEIVED_NGN',
      uid: creatorUid,
      direction: 'credit',
      currency: 'ngn',
      amount_ngn: creatorShare,
      balance_before: creatorBefore,
      balance_after: creatorAfter,
      reference_id: gift.id,
      channel_id: channelId,
      status: 'success',
    }, tx);

    // Channel event
    tx.set(db.collection('channel_events').doc(crypto.randomUUID()), {
      channel_id: channelId,
      type: 'gift',
      gift_id: gift.id,
      sender_uid: senderUid,
      created_at: Date.now(),
    });

    // Gift stats
    tx.set(db.collection('gift_stats').doc(crypto.randomUUID()), {
      channel_id: channelId,
      gift_id: gift.id,
      sender_uid: senderUid,
      naira: cost,
      created_at: Date.now(),
    });
  });

  // Reload wallet caches from Firestore (authoritative source)
  await GiftWallet.reloadFromFirestore(senderUid);
  await GiftWallet.reloadFromFirestore(creatorUid);

  return { ngn: creatorShare, vpt: 0 };
}

// ─── Combo System ────────────────────────────────────────

async function _registerCombo(db, channelId, senderUid, giftId) {
  const key = `${channelId}_${senderUid}_${giftId}`;
  const ref = db.collection('gift_combos').doc(key);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const now = Date.now();

    if (!doc.exists || now - doc.data().last_sent > COMBO_WINDOW) {
      tx.set(ref, { count: 1, last_sent: now });
    } else {
      tx.update(ref, {
        count: doc.data().count + 1,
        last_sent: now,
      });
    }
  });
}

async function getCombo(req, res) {
  try {
    const { channel_id, gift_id } = req.query;
    if (!channel_id || !gift_id) {
      return res.status(400).json({ error: 'channel_id and gift_id are required' });
    }

    const key = `${channel_id}_${req.userId}_${gift_id}`;
    const db = getFirestore();
    const doc = await db.collection('gift_combos').doc(key).get();

    if (!doc.exists) return res.json({ combo: 0 });

    const data = doc.data();
    const isActive = Date.now() - data.last_sent <= COMBO_WINDOW;
    res.json({ combo: isActive ? data.count : 0 });
  } catch (err) {
    console.error('[Interactions] getCombo error:', err.message);
    res.status(500).json({ error: 'Failed to get combo' });
  }
}

// ─── Leaderboard ─────────────────────────────────────────

async function getLeaderboard(req, res) {
  try {
    const channelId = req.params.channelId;
    if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

    const db = getFirestore();
    const snapshot = await db.collection('gift_stats')
      .where('channel_id', '==', channelId)
      .get();

    const totals = {};
    snapshot.forEach((doc) => {
      const d = doc.data();
      const uid = d.sender_uid;
      totals[uid] = (totals[uid] || 0) + (d.vpt_units || d.naira || 0);
    });

    const channel = Channel.findById(channelId);
    const isPrivate = channel?.type === 'private';

    const leaderboard = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([uid, total], idx) => {
        const displayName = isPrivate
          ? getSenderDisplayName(uid, channel)
          : getSenderDisplayName(uid, { ...channel, type: 'public' });
        return { rank: idx + 1, display_name: displayName, total };
      });

    res.json({ leaderboard });
  } catch (err) {
    console.error('[Interactions] getLeaderboard error:', err.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}

// ─── Channel Events (recent) ────────────────────────────

async function getChannelEvents(req, res) {
  try {
    const channelId = req.params.channelId;
    if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

    const after = Number(req.query.after || 0);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);

    const db = getFirestore();
    const snapshot = await db.collection('channel_events')
      .where('channel_id', '==', channelId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    const channel = Channel.findById(channelId);
    const isPrivate = channel?.type === 'private';

    const docs = [...snapshot.docs].reverse();
    const filteredDocs = after > 0
      ? docs.filter((doc) => (doc.data().created_at || 0) > after)
      : docs;

    const events = filteredDocs.map((doc) => {
      const d = doc.data();
      const senderName = isPrivate
        ? getSenderDisplayName(d.sender_uid, channel)
        : getSenderDisplayName(d.sender_uid, { ...channel, type: 'public' });

      const event = {
        id: d.id || doc.id,
        type: d.type,
        sender_name: senderName,
        created_at: d.created_at,
      };

      if (d.type === 'gift') {
        const gift = GiftModel.findById(d.gift_id);
        event.gift_name = gift?.name || 'Gift';
        event.gift_icon = gift?.icon || '🎁';
        event.animation = gift?.animation || null;
      }
      if (d.type === 'reaction') {
        event.emoji = d.emoji;
      }

      return event;
    });

    res.json({ events });
  } catch (err) {
    console.error('[Interactions] getChannelEvents error:', err.message);
    res.status(500).json({ error: 'Failed to get events' });
  }
}

module.exports = {
  createGift,
  updateGift,
  deleteGift,
  getGifts,
  getAllGifts,
  getMyGiftWallet,
  sendReaction,
  sendGift,
  getCombo,
  getLeaderboard,
  getChannelEvents,
};
