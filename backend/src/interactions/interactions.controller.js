const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');
const GiftModel = require('./gift.model');
const GiftWallet = require('./gift-wallet.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const LedgerService = require('../vpt/ledger.service');
const { emitChannelEvent } = require('../realtime/socket.service');
const { getSenderDisplayName } = require('./live_identity');
const SettingsService = require('../admin/settings.service');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const CreatorSupporter = require('../analytics/creator_supporter.model');
const StreamStats = require('../analytics/stream_stats.model');
const NotificationService = require('../notifications/notification.service');
const ReputationService = require('../reputation/reputation.service');

// ─── Constants ───────────────────────────────────────────
const SPLIT = { creator: 0.5, operations: 0.3, community: 0.2 };
const COMBO_WINDOW = 3000;
const LEADERBOARD_COLLECTION = 'channel_leaderboards';

function getLeaderboardCollections(channelId) {
  const root = getFirestore().collection(LEADERBOARD_COLLECTION).doc(channelId);
  return {
    public: root.collection('public'),
    private: root.collection('private'),
  };
}

function getPrivateLeaderboardKey(senderAlias) {
  return crypto.createHash('sha1').update(senderAlias).digest('hex');
}

function updateLeaderboardEntries(tx, db, { channelId, senderUid, senderAlias, total }) {
  const admin = require('firebase-admin');
  const collections = getLeaderboardCollections(channelId);

  if (senderUid) {
    tx.set(collections.public.doc(senderUid), {
      channel_id: channelId,
      sender_uid: senderUid,
      total: admin.firestore.FieldValue.increment(total),
      updated_at: Date.now(),
    }, { merge: true });
  }

  const privateAlias = senderAlias || 'Anonymous';
  tx.set(collections.private.doc(getPrivateLeaderboardKey(privateAlias)), {
    channel_id: channelId,
    sender_alias: privateAlias,
    total: admin.firestore.FieldValue.increment(total),
    updated_at: Date.now(),
  }, { merge: true });
}

async function backfillLeaderboard(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection('gift_stats')
    .where('channel_id', '==', channelId)
    .get();

  if (snapshot.empty) return;

  const publicTotals = new Map();
  const privateTotals = new Map();
  snapshot.forEach((doc) => {
    const data = doc.data();
    const total = data.vpt_units || data.naira || 0;
    if (total <= 0) return;

    if (data.sender_uid) {
      const existing = publicTotals.get(data.sender_uid) || { total: 0 };
      existing.total += total;
      publicTotals.set(data.sender_uid, existing);
    }

    const privateAlias = data.sender_alias || 'Anonymous';
    const privateExisting = privateTotals.get(privateAlias) || { total: 0 };
    privateExisting.total += total;
    privateTotals.set(privateAlias, privateExisting);
  });

  const collections = getLeaderboardCollections(channelId);
  let batch = db.batch();
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  };

  for (const [senderUid, entry] of publicTotals.entries()) {
    batch.set(collections.public.doc(senderUid), {
      channel_id: channelId,
      sender_uid: senderUid,
      total: entry.total,
      updated_at: Date.now(),
    }, { merge: true });
    batchCount += 1;
    if (batchCount >= 400) await commitBatch();
  }

  for (const [senderAlias, entry] of privateTotals.entries()) {
    batch.set(collections.private.doc(getPrivateLeaderboardKey(senderAlias)), {
      channel_id: channelId,
      sender_alias: senderAlias,
      total: entry.total,
      updated_at: Date.now(),
    }, { merge: true });
    batchCount += 1;
    if (batchCount >= 400) await commitBatch();
  }

  await commitBatch();
}

async function getLeaderboardSnapshot(channelId, isPrivate) {
  const collections = getLeaderboardCollections(channelId);
  const targetCollection = isPrivate ? collections.private : collections.public;

  let snapshot = await targetCollection
    .orderBy('total', 'desc')
    .limit(10)
    .get();

  if (!snapshot.empty) {
    return snapshot;
  }

  await backfillLeaderboard(channelId);
  return targetCollection
    .orderBy('total', 'desc')
    .limit(10)
    .get();
}

// ─── Admin: Gift CRUD ────────────────────────────────────

async function createGift(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { name, icon, image_url, animation, currency, vpt_units, naira_value, sort_order } = req.body;
    if (!name || (!icon && !image_url)) {
      return res.status(400).json({ error: 'Name and icon (emoji or image) are required' });
    }
    if (!['vpt', 'ngn'].includes(currency)) {
      return res.status(400).json({ error: 'Currency must be vpt or ngn' });
    }

    const gift = await GiftModel.create({
      name,
      icon,
      imageUrl: image_url,
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

async function uploadGiftImage(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    if (!req.file || !req.file.gcsUrl) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    res.json({ image_url: req.file.gcsUrl });
  } catch (err) {
    console.error('[Interactions] uploadGiftImage error:', err.message);
    res.status(500).json({ error: 'Failed to upload gift image' });
  }
}

async function getGifts(req, res) {
  const gifts = await GiftModel.getActive();
  res.json({ gifts });
}

async function getAllGifts(req, res) {
  const user = User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const gifts = await GiftModel.getAll();
  res.json({ gifts });
}

// ─── Wallet ──────────────────────────────────────────────

async function getMyGiftWallet(req, res) {
  try {
    // Read user directly from Firestore — do not rely on the stale in-memory cache.
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data();

    // blockchain_tokens is a very large integer stored as a Firestore number or string.
    // Return it as a string to avoid JavaScript Number precision loss.
    const tokensRaw = user.blockchain_tokens;
    const blockchainTokens = tokensRaw != null ? String(tokensRaw) : null;

    // Include connected wallet info if available
    let connectedWallet = null;
    try {
      const WalletModel = require('../wallet/wallet.model');
      const walletRecord = await WalletModel.findByUserId(req.userId);
      if (walletRecord && walletRecord.connected_wallet_address) {
        connectedWallet = {
          address: walletRecord.connected_wallet_address,
          type: walletRecord.connected_wallet_type,
          connected_at: walletRecord.connected_wallet_at,
        };
      }
    } catch { /* wallet module not loaded yet */ }

    res.json({
      wallet: {
        vpt: user.vpt || 0,
        cash: user.cash || 0,
        coins: user.coins || 0,
        blockchain_tokens: blockchainTokens,
        connected_wallet: connectedWallet,
      },
    });
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

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const senderAlias = channel.type === 'private'
      ? getSenderDisplayName(req.userId, channel)
      : null;

    const db = getFirestore();
    const event = {
      id: crypto.randomUUID(),
      channel_id,
      type: 'reaction',
      emoji,
      sender_uid: req.userId,
      sender_alias: senderAlias,
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

    const gift = await GiftModel.findById(gift_id);
    if (!gift || !gift.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive gift' });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const senderAlias = channel.type === 'private'
      ? getSenderDisplayName(req.userId, channel)
      : null;

    const creatorUid = channel.owner_id;
    if (creatorUid === req.userId) {
      return res.status(400).json({ error: 'Cannot gift your own channel' });
    }

    const db = getFirestore();

    let analyticsShare;
    if (gift.currency === 'vpt') {
      const channelType = channel.type;
      analyticsShare = await _sendVptGift(
        db,
        req.userId,
        creatorUid,
        channel_id,
        channelType,
        gift,
        senderAlias,
      );
    } else if (gift.currency === 'ngn') {
      const channelType = channel.type;
      analyticsShare = await _sendNgnGift(
        db,
        req.userId,
        creatorUid,
        channel_id,
        channelType,
        gift,
        senderAlias,
      );
    } else {
      return res.status(400).json({ error: 'Unknown gift currency' });
    }

    try {
      await CreatorDailyStats.incrementGifts(creatorUid, analyticsShare);
      const activeStream = await StreamStats.getActiveByChannel(channel_id);
      if (activeStream) {
        await StreamStats.addGifts(activeStream.id, analyticsShare);
      }
    } catch (analyticsError) {
      console.error('[Interactions] gift analytics update error:', analyticsError.message);
    }

    // Notify gift recipient
    const sender = User.findById(req.userId);
    const senderName = sender ? (sender.name || sender.email || 'Someone') : 'Someone';
    const currencyLabel = gift.currency === 'vpt'
      ? `${Math.floor(gift.vpt_units * SPLIT.creator)} vPT`
      : `₦${(gift.naira_value * SPLIT.creator).toFixed(0)}`;
    NotificationService.notifyUser(creatorUid, {
      title: `🎁 You received a ${gift.name}!`,
      body: `${senderName} sent you a ${gift.name} — you earned ${currencyLabel}`,
      type: 'gift_received',
      link: `/live/${channel_id}`,
      data: {
        gift_id: gift.id,
        gift_name: gift.name,
        channel_id,
        sender_uid: req.userId,
      },
    }).catch((err) => console.error('[Interactions] gift notification error:', err.message));

    // Register combo
    await _registerCombo(db, channel_id, req.userId, gift_id);

    // Award reputation points to the sender (non-fatal — gift succeeds even if reps fail)
    let senderRepLevel = 0;
    try {
      const repRecord = await ReputationService.awardReps(
        req.userId,
        gift.naira_value || 0,
        gift.vpt_units || 0,
      );
      senderRepLevel = repRecord?.level ?? 0;
    } catch (repErr) {
      console.error('[Interactions] awardReps error:', repErr.message);
    }

    // Get display name
    const displayName = getSenderDisplayName(req.userId, channel);

    emitChannelEvent(channel_id, {
      id: crypto.randomUUID(),
      type: 'gift',
      sender_name: displayName,
      sender_rep_level: senderRepLevel,
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

async function _sendVptGift(db, senderUid, creatorUid, channelId, channelType, gift, senderAlias = null) {
  const senderRef = db.collection('users').doc(senderUid);
  const creatorRef = db.collection('users').doc(creatorUid);

  let creatorShare;
  await db.runTransaction(async (tx) => {
    const senderDoc = await tx.get(senderRef);
    const creatorDoc = await tx.get(creatorRef);

    const senderData = senderDoc.exists ? senderDoc.data() : { id: senderUid, vpt: 0, cash: 0 };
    const creatorData = creatorDoc.exists ? creatorDoc.data() : { id: creatorUid, vpt: 0, cash: 0 };

    const cost = gift.vpt_units;
    const senderBefore = senderData.vpt || 0;
    if (senderBefore < cost) throw new Error('INSUFFICIENT_VPT');

    creatorShare = Math.floor(cost * SPLIT.creator);
    const opsShare = Math.floor(cost * SPLIT.operations);
    const communityShare = cost - creatorShare - opsShare;

    const senderAfter = senderBefore - cost;
    const creatorBefore = creatorData.vpt || 0;
    const creatorAfter = creatorBefore + creatorShare;

    // Debit sender
    tx.update(senderRef, { vpt: senderAfter });

    // Credit creator
    tx.update(creatorRef, { vpt: creatorAfter });

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
      sender_alias: senderAlias,
      created_at: Date.now(),
    });

    // Gift stats
    tx.set(db.collection('gift_stats').doc(crypto.randomUUID()), {
      channel_id: channelId,
      gift_id: gift.id,
      sender_uid: senderUid,
      sender_alias: senderAlias,
      vpt_units: cost,
      created_at: Date.now(),
    });

    updateLeaderboardEntries(tx, db, {
      channelId,
      senderUid,
      senderAlias,
      total: cost,
    });

    CreatorSupporter.applyGiftDelta(tx, db, {
      creatorUid,
      channelId,
      channelType,
      senderUid,
      senderAlias,
      vpt: creatorShare,
    });
  });

  // Reload wallet caches from Firestore (authoritative source)
  await GiftWallet.reloadFromFirestore(senderUid);
  await GiftWallet.reloadFromFirestore(creatorUid);

  return { ngn: 0, vpt: creatorShare };
}

async function _sendNgnGift(db, senderUid, creatorUid, channelId, channelType, gift, senderAlias = null) {
  const senderRef = db.collection('users').doc(senderUid);
  const creatorRef = db.collection('users').doc(creatorUid);

  let creatorShare;
  await db.runTransaction(async (tx) => {
    const senderDoc = await tx.get(senderRef);
    const creatorDoc = await tx.get(creatorRef);

    const senderData = senderDoc.exists ? senderDoc.data() : { id: senderUid, vpt: 0, cash: 0 };
    const creatorData = creatorDoc.exists ? creatorDoc.data() : { id: creatorUid, vpt: 0, cash: 0 };

    const cost = gift.naira_value;
    const senderBefore = senderData.cash || 0;
    if (senderBefore < cost) throw new Error('INSUFFICIENT_NGN');

    creatorShare = cost * SPLIT.creator;
    const opsShare = cost * SPLIT.operations;
    const communityShare = cost - creatorShare - opsShare;

    const senderAfter = senderBefore - cost;
    const creatorBefore = creatorData.cash || 0;
    const creatorAfter = creatorBefore + creatorShare;

    // Debit sender
    tx.update(senderRef, { cash: senderAfter });

    // Credit creator
    tx.update(creatorRef, { cash: creatorAfter });

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
      sender_alias: senderAlias,
      created_at: Date.now(),
    });

    // Gift stats
    tx.set(db.collection('gift_stats').doc(crypto.randomUUID()), {
      channel_id: channelId,
      gift_id: gift.id,
      sender_uid: senderUid,
      sender_alias: senderAlias,
      naira: cost,
      created_at: Date.now(),
    });

    updateLeaderboardEntries(tx, db, {
      channelId,
      senderUid,
      senderAlias,
      total: cost,
    });

    CreatorSupporter.applyGiftDelta(tx, db, {
      creatorUid,
      channelId,
      channelType,
      senderUid,
      senderAlias,
      ngn: creatorShare,
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

    const channel = await Channel.findById(channelId);
    const isPrivate = channel?.type === 'private';

    const snapshot = await getLeaderboardSnapshot(channelId, isPrivate);
    const leaderboard = snapshot.docs.map((doc, idx) => {
      const entry = doc.data();
      const uid = isPrivate ? '' : (entry.sender_uid || '');
      const displayName = isPrivate
        ? entry.sender_alias || 'Anonymous'
        : getSenderDisplayName(uid, { ...channel, type: 'public' });

      return {
        rank: idx + 1,
        uid,
        display_name: displayName,
        total: entry.total || 0,
      };
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
    let snapshot;
    if (after > 0) {
      snapshot = await db.collection('channel_events')
        .where('channel_id', '==', channelId)
        .where('created_at', '>', after)
        .orderBy('created_at', 'asc')
        .limit(limit)
        .get();
    } else {
      snapshot = await db.collection('channel_events')
        .where('channel_id', '==', channelId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
    }

    const channel = await Channel.findById(channelId);
    const isPrivate = channel?.type === 'private';

    const filteredDocs = after > 0
      ? snapshot.docs
      : [...snapshot.docs].reverse();

    const giftIds = [...new Set(
      filteredDocs
        .map((doc) => {
          const data = doc.data();
          return data.type === 'gift' ? data.gift_id : null;
        })
        .filter(Boolean),
    )];
    const giftsById = await GiftModel.findManyByIds(giftIds);

    const events = await Promise.all(filteredDocs.map(async (doc) => {
      const d = doc.data();
      const senderName = isPrivate
        ? d.sender_alias || getSenderDisplayName(d.sender_uid, channel)
        : getSenderDisplayName(d.sender_uid, { ...channel, type: 'public' });

      const event = {
        id: d.id || doc.id,
        type: d.type,
        sender_name: senderName,
        created_at: d.created_at,
      };

      if (d.type === 'gift') {
        const gift = giftsById.get(d.gift_id) || null;
        event.gift_name = gift?.name || 'Gift';
        event.gift_icon = gift?.icon || '🎁';
        event.animation = gift?.animation || null;
      }
      if (d.type === 'reaction') {
        event.emoji = d.emoji;
      }

      return event;
    }));

    res.json({ events });
  } catch (err) {
    console.error('[Interactions] getChannelEvents error:', err.message);
    res.status(500).json({ error: 'Failed to get events' });
  }
}

// ─── Ravens ↔ vPT Exchange ───────────────────────────────

async function exchangeAssets(req, res) {
  try {
    const { from, to, amount } = req.body;
    if (!from || !to || !amount || amount <= 0) {
      return res.status(400).json({ error: 'from, to, and a positive amount are required' });
    }

    const validPairs = ['ravens_to_vpt', 'vpt_to_ravens'];
    const pair = `${from}_to_${to}`;
    if (!validPairs.includes(pair)) {
      return res.status(400).json({ error: 'Only ravens↔vpt conversions are allowed' });
    }

    const vptRavenRate = (await SettingsService.getNumber('VPT_RAVEN_RATE')) || 75;
    const uid = req.userId;
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    if (pair === 'ravens_to_vpt') {
      // Convert Ravens → vPT  (amount = Ravens to spend)
      const ravensNeeded = Math.floor(amount);
      if (ravensNeeded < vptRavenRate) {
        return res.status(400).json({ error: `Minimum ${vptRavenRate} Ravens required for 1 vPT` });
      }
      const vptGained = parseFloat((ravensNeeded / vptRavenRate).toFixed(4));
      const ravensUsed = Math.floor(vptGained * vptRavenRate); // exact Ravens consumed

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? snap.data() : {};
        const currentCoins = data.coins || 0;
        if (currentCoins < ravensUsed) throw new Error('INSUFFICIENT_RAVENS');
        tx.update(userRef, {
          coins: parseFloat((currentCoins - ravensUsed).toFixed(2)),
          vpt: parseFloat(((data.vpt || 0) + vptGained).toFixed(4)),
        });
      });

      // Sync in-memory cache
      await User.adjustCoins(uid, -ravensUsed);
      await User.adjustVpt(uid, vptGained);
      // Re-read to fix any rounding drift between Firestore tx and in-memory
      const updated = await User.findById(uid);

      return res.json({
        message: `Converted ${ravensUsed} Ravens → ${vptGained} vPT`,
        wallet: { vpt: updated.vpt, cash: updated.cash, coins: updated.coins },
      });
    }

    // vpt_to_ravens
    const vptToSpend = parseFloat(parseFloat(amount).toFixed(4));
    if (vptToSpend <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    const ravensGained = Math.floor(vptToSpend * vptRavenRate);
    if (ravensGained <= 0) return res.status(400).json({ error: 'Amount too small to convert' });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : {};
      const currentVpt = data.vpt || 0;
      if (currentVpt < vptToSpend) throw new Error('INSUFFICIENT_VPT');
      tx.update(userRef, {
        vpt: parseFloat((currentVpt - vptToSpend).toFixed(4)),
        coins: parseFloat(((data.coins || 0) + ravensGained).toFixed(2)),
      });
    });

    await User.adjustVpt(uid, -vptToSpend);
    await User.adjustCoins(uid, ravensGained);
    const updated = await User.findById(uid);

    return res.json({
      message: `Converted ${vptToSpend} vPT → ${ravensGained} Ravens`,
      wallet: { vpt: updated.vpt, cash: updated.cash, coins: updated.coins },
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_RAVENS') {
      return res.status(400).json({ error: 'Insufficient Ravens balance' });
    }
    if (err.message === 'INSUFFICIENT_VPT') {
      return res.status(400).json({ error: 'Insufficient vPT balance' });
    }
    console.error('[Exchange] error:', err.message);
    return res.status(500).json({ error: 'Exchange failed' });
  }
}

// ─── Exchange Rates (public) ─────────────────────────────

async function getExchangeRates(req, res) {
  try {
    const vptRavenRate = (await SettingsService.getNumber('VPT_RAVEN_RATE')) || 75;
    const ravenNgnRate = (await SettingsService.getNumber('RAVEN_NGN_RATE')) || 10;
    const vptPriceNgn = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;

    res.json({
      rates: {
        vpt_raven_rate: vptRavenRate,
        raven_ngn_rate: ravenNgnRate,
        vpt_price_ngn: vptPriceNgn,
      },
    });
  } catch (err) {
    console.error('[ExchangeRates] error:', err.message);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
}

module.exports = {
  createGift,
  updateGift,
  deleteGift,
  uploadGiftImage,
  getGifts,
  getAllGifts,
  getMyGiftWallet,
  sendReaction,
  sendGift,
  getCombo,
  getLeaderboard,
  getChannelEvents,
  exchangeAssets,
  getExchangeRates,
};
