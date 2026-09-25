const crypto = require('crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_subscriptions';

async function init() {
  return [];
}

async function create({
  subscriberUid,
  channelId,
  channelName,
  ownerId,
  plan,
  currency,
  amount,
  vptEquivalent,
  isPremium,
  intervalCount,
  intervalUnit,
  nextBilling,
}) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const sub = {
    id,
    subscriber_uid: subscriberUid,
    channel_id: channelId,
    channel_name: channelName || '',
    owner_id: ownerId || '',
    plan: plan || 'channel_subscription',
    currency: currency || null,
    amount: amount || 0,
    vpt_equivalent: vptEquivalent || 0,
    status: 'active',
    is_premium: !!isPremium,
    interval_count: intervalCount || 1,
    interval_unit: intervalUnit || 'month',
    next_billing: nextBilling || null,
    subscribed_at: now,
    last_renewed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    renewal_count: 0,
  };

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).set(sub);
  return sub;
}

async function findActive(subscriberUid, channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = { ...doc.data(), id: doc.id };
  const nextBilling = data.next_billing ? Number(data.next_billing) : 0;
  if (nextBilling > 0 && Date.now() > nextBilling) return null;
  return data;
}

async function getBySubscriber(subscriberUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

async function getByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

async function getActiveDue() {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((s) => s.next_billing && s.next_billing <= now);
}

async function markCancelled(id, reason) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const sub = { ...doc.data(), id: doc.id };

  sub.status = 'cancelled';
  sub.cancelled_at = Date.now();
  sub.cancel_reason = reason || 'user_cancelled';

  await ref.set({
    status: sub.status,
    cancelled_at: sub.cancelled_at,
    cancel_reason: sub.cancel_reason,
  }, { merge: true });
  return sub;
}

async function markCancelledOnFailure(id, reason) {
  return markCancelled(id, reason);
}

async function markRenewed(id) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const sub = { ...doc.data(), id: doc.id };

  const now = Date.now();
  sub.last_renewed_at = now;
  sub.renewal_count = (sub.renewal_count || 0) + 1;

  // Compute next billing based on interval (only for premium subscriptions)
  if (sub.is_premium && sub.interval_count && sub.interval_unit) {
    const msMap = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    const intervalMs = msMap[sub.interval_unit] || msMap.month;
    sub.next_billing = now + intervalMs * sub.interval_count;
  }

  await ref.update({
    last_renewed_at: sub.last_renewed_at,
    renewal_count: sub.renewal_count,
    next_billing: sub.next_billing,
  });
  return sub;
}

// Uses Firestore's server-side count aggregation (`.count().get()`) instead
// of `.get()` + `snapshot.size`, which pulled every matching document's full
// data into memory just to count them. That was cheap for genuine follower
// counts but became a production incident the moment a channel had tens of
// thousands of admin-injected synthetic followers: this function runs twice
// per channel (see enrichChannel below) on every single `/channels` list
// request, for every channel, concurrently — so one heavily-injected channel
// was enough to blow the Node process's heap and crash it (SIGABRT) on every
// request, taking the entire channel list down for all users. The count
// aggregation is computed server-side and returns just a number, with
// memory cost independent of how many documents match.
async function countRealActiveByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'active')
    .count()
    .get();
  return snapshot.data().count;
}

// Public follower count shown everywhere: real subscriptions plus the
// admin-injected counter on channel_stats (served from its in-memory cache).
async function countActiveByChannel(channelId) {
  const ChannelStats = require('../channels/channel_stats.model');
  const [real, synthetic] = await Promise.all([
    countRealActiveByChannel(channelId),
    ChannelStats.getSyntheticFollowers(channelId).catch(() => 0),
  ]);
  return real + synthetic;
}

async function getActiveSubscriberUids(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs.map((doc) => doc.data().subscriber_uid).filter(Boolean);
}

async function getActiveSubscribedChannelIds(subscriberUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs.map((doc) => doc.data().channel_id).filter(Boolean);
}

async function findBySubscriberAndChannel(subscriberUid, channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .where('channel_id', '==', channelId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function banSubscriber(channelId, subscriberUid, reason) {
  const db = getFirestore();
  const sub = await findBySubscriberAndChannel(subscriberUid, channelId);
  if (!sub) return null;
  const ref = db.collection(COLLECTION).doc(sub.id);
  await ref.set({
    status: 'banned_by_owner',
    cancelled_at: Date.now(),
    cancel_reason: reason || 'banned_by_owner',
  }, { merge: true });
  return { ...sub, status: 'banned_by_owner' };
}

async function unbanSubscriber(channelId, subscriberUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'banned_by_owner')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const ref = db.collection(COLLECTION).doc(doc.id);
  await ref.set({
    status: 'active',
    cancelled_at: null,
    cancel_reason: null,
  }, { merge: true });
  return { ...doc.data(), id: doc.id, status: 'active' };
}

// Legacy: synthetic followers used to be stored as one channel_subscriptions
// doc each (is_synthetic: true). They are now a counter on channel_stats; these
// helpers remove/convert any legacy docs that still exist.
const LEGACY_BATCH = 400; // stay under Firestore's 500-write batch limit

async function deleteLegacySyntheticDocs(channelId, amount) {
  const db = getFirestore();
  let removed = 0;
  while (removed < amount) {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('is_synthetic', '==', true)
      .limit(Math.min(LEGACY_BATCH, amount - removed))
      .get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    removed += snapshot.size;
  }
  return removed;
}

/**
 * Add `amount` synthetic (admin-injected) followers to a channel. One write to
 * channel_stats; no per-follower documents.
 */
async function injectSyntheticFollowers(channelId, amount) {
  const ChannelStats = require('../channels/channel_stats.model');
  return ChannelStats.adjustSyntheticFollowers(channelId, Math.max(0, Math.floor(amount)));
}

/**
 * Remove up to `amount` synthetic followers. Takes from the counter first,
 * then deletes any remaining legacy synthetic docs. Never touches real
 * subscriptions. Returns the number actually removed.
 */
async function removeSyntheticFollowers(channelId, amount) {
  const ChannelStats = require('../channels/channel_stats.model');
  const wanted = Math.max(0, Math.floor(amount));
  const { applied } = await ChannelStats.adjustSyntheticFollowers(channelId, -wanted);
  let removed = -applied;
  if (removed < wanted) {
    removed += await deleteLegacySyntheticDocs(channelId, wanted - removed);
  }
  return removed;
}

/** Synthetic followers for a channel: counter plus any legacy docs. */
async function countSyntheticByChannel(channelId) {
  const ChannelStats = require('../channels/channel_stats.model');
  const db = getFirestore();
  const [legacy, counter] = await Promise.all([
    db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('is_synthetic', '==', true)
      .count()
      .get()
      .then((snap) => snap.data().count || 0),
    ChannelStats.getSyntheticFollowers(channelId),
  ]);
  return legacy + counter;
}

async function countLegacySyntheticDocs() {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).where('is_synthetic', '==', true).count().get();
  return snap.data().count || 0;
}

/**
 * One-time conversion: delete legacy synthetic follower docs and add the same
 * number to each channel's synthetic counter, atomically per batch, so the
 * displayed follower count never changes. Safe to re-run; processes at most
 * `maxDocs` per call. Returns { converted, remaining }.
 */
async function convertLegacySyntheticFollowers(maxDocs = 2000) {
  const ChannelStats = require('../channels/channel_stats.model');
  const db = getFirestore();
  let converted = 0;

  while (converted < maxDocs) {
    const snapshot = await db.collection(COLLECTION)
      .where('is_synthetic', '==', true)
      .limit(Math.min(LEGACY_BATCH, maxDocs - converted))
      .get();
    if (snapshot.empty) break;

    const perChannel = new Map();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      const channelId = doc.data().channel_id;
      if (channelId) perChannel.set(channelId, (perChannel.get(channelId) || 0) + 1);
      batch.delete(doc.ref);
    });
    for (const [channelId, count] of perChannel) {
      batch.set(
        db.collection('channel_stats').doc(channelId),
        { synthetic_followers: admin.firestore.FieldValue.increment(count), updated_at: Date.now() },
        { merge: true },
      );
    }
    await batch.commit();
    perChannel.forEach((_, channelId) => ChannelStats.invalidate(channelId));
    converted += snapshot.size;
  }

  return { converted, remaining: await countLegacySyntheticDocs() };
}

module.exports = {
  init,
  create,
  findActive,
  getBySubscriber,
  getByChannel,
  getActiveDue,
  markCancelled,
  markCancelledOnFailure,
  markRenewed,
  countActiveByChannel,
  countRealActiveByChannel,
  getActiveSubscriberUids,
  getActiveSubscribedChannelIds,
  findBySubscriberAndChannel,
  banSubscriber,
  unbanSubscriber,
  injectSyntheticFollowers,
  removeSyntheticFollowers,
  countSyntheticByChannel,
  countLegacySyntheticDocs,
  convertLegacySyntheticFollowers,
};
