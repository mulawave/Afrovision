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
};
