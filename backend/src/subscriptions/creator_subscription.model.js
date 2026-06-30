const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'creator_subscriptions';

async function persist(sub) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(sub.id).set(sub);
}

async function init() {
  return [];
}

function isInitialized() {
  return true;
}

/**
 * Create a new active creator subscription.
 */
async function create({ subscriberUid, creatorUid, plan, currency, amount }) {
  const sub = {
    id: crypto.randomUUID(),
    subscriber_uid: subscriberUid,
    creator_uid: creatorUid,
    plan: plan || 'monthly',
    currency,
    amount,
    status: 'active',
    next_billing: Date.now() + 30 * 86_400_000,
    subscribed_at: Date.now(),
    last_renewed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    renewal_count: 0,
  };
  await persist(sub);
  return sub;
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

/** Returns the active subscription between a subscriber and a creator, if one exists. */
async function findActive(subscriberUid, creatorUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('subscriber_uid', '==', subscriberUid)
    .where('creator_uid', '==', creatorUid)
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

async function getByCreator(creatorUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .where('status', '==', 'active')
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

/** Returns all active subscriptions whose next_billing has passed. */
async function getActiveDue() {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'active')
    .where('next_billing', '<=', now)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function cancel(id) {
  const sub = await findById(id);
  if (!sub) return null;
  sub.status = 'cancelled';
  sub.cancelled_at = Date.now();
  await persist(sub);
  return sub;
}

async function markRenewed(id) {
  const sub = await findById(id);
  if (!sub) return null;
  sub.last_renewed_at = Date.now();
  sub.next_billing = Date.now() + 30 * 86_400_000;
  sub.renewal_count = (sub.renewal_count || 0) + 1;
  await persist(sub);
  return sub;
}

async function markCancelledOnFailure(id, reason = 'payment_failed') {
  const sub = await findById(id);
  if (!sub) return null;
  sub.status = 'cancelled';
  sub.cancelled_at = Date.now();
  sub.cancel_reason = reason;
  await persist(sub);
  return sub;
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

async function listPage({ limit = 100, startAfterSubscribedAt = null, startAfterId = null, status = null, creatorUid = null } = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);
  if (creatorUid) query = query.where('creator_uid', '==', creatorUid);

  query = query.orderBy('subscribed_at', 'desc').orderBy('__name__', 'desc').limit(Math.max(1, Math.min(limit, 500)));
  if (startAfterSubscribedAt != null && startAfterId) {
    query = query.startAfter(startAfterSubscribedAt, startAfterId);
  }

  const snapshot = await query.get();
  const subscriptions = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return {
    subscriptions,
    nextCursor: lastDoc
      ? {
        subscribed_at: Number(lastDoc.data().subscribed_at || 0),
        id: lastDoc.id,
      }
      : null,
  };
}

async function getStats() {
  const now = Date.now();
  const db = getFirestore();
  const [totalSnap, activeSnap, cancelledSnap, dueSnap] = await Promise.all([
    db.collection(COLLECTION).count().get(),
    db.collection(COLLECTION).where('status', '==', 'active').count().get(),
    db.collection(COLLECTION).where('status', '==', 'cancelled').count().get(),
    db.collection(COLLECTION).where('status', '==', 'active').where('next_billing', '<=', now).count().get(),
  ]);

  return {
    total: totalSnap.data().count || 0,
    active: activeSnap.data().count || 0,
    cancelled: cancelledSnap.data().count || 0,
    due_for_renewal: dueSnap.data().count || 0,
  };
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  findActive,
  getBySubscriber,
  getByCreator,
  getActiveDue,
  cancel,
  markRenewed,
  markCancelledOnFailure,
  getAll,
  listPage,
  getStats,
};
