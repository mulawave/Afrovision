const crypto = require('crypto');
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

async function countActiveByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'active')
    .get();
  return snapshot.size;
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

/**
 * Create `amount` synthetic (admin-injected) follower rows for a channel.
 * These are real `channel_subscriptions` docs (status 'active', amount 0)
 * so they count everywhere real followers do (countActiveByChannel, the
 * public channel payload, etc.) — flagged is_synthetic so they can be
 * targeted for removal without touching genuine followers.
 */
async function injectSyntheticFollowers(channelId, channelName, ownerId, amount) {
  const db = getFirestore();
  const now = Date.now();
  const batchSize = 400; // stay under Firestore's 500-write batch limit
  let remaining = Math.max(0, Math.floor(amount));
  const created = [];

  while (remaining > 0) {
    const chunk = Math.min(remaining, batchSize);
    const batch = db.batch();
    for (let i = 0; i < chunk; i++) {
      const id = crypto.randomUUID();
      const sub = {
        id,
        subscriber_uid: `synthetic:admin:${id}`,
        channel_id: channelId,
        channel_name: channelName || '',
        owner_id: ownerId || '',
        plan: 'channel_subscription',
        currency: null,
        amount: 0,
        vpt_equivalent: 0,
        status: 'active',
        is_premium: false,
        interval_count: 1,
        interval_unit: 'month',
        next_billing: null,
        subscribed_at: now,
        last_renewed_at: null,
        cancelled_at: null,
        cancel_reason: null,
        renewal_count: 0,
        is_synthetic: true,
      };
      batch.set(db.collection(COLLECTION).doc(id), sub);
      created.push(sub);
    }
    await batch.commit();
    remaining -= chunk;
  }

  return created;
}

/**
 * Remove up to `amount` synthetic (admin-injected) follower rows for a
 * channel, oldest first. Returns the number actually removed (may be less
 * than requested if there aren't that many synthetic rows left).
 */
async function removeSyntheticFollowers(channelId, amount) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('is_synthetic', '==', true)
    .orderBy('subscribed_at', 'asc')
    .limit(Math.max(0, Math.floor(amount)))
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function countSyntheticByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('is_synthetic', '==', true)
    .count()
    .get();
  return snapshot.data().count || 0;
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
  getActiveSubscriberUids,
  getActiveSubscribedChannelIds,
  findBySubscriberAndChannel,
  banSubscriber,
  unbanSubscriber,
  injectSyntheticFollowers,
  removeSyntheticFollowers,
  countSyntheticByChannel,
};
