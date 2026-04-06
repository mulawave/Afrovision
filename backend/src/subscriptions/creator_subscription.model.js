const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'creator_subscriptions';
let subs = [];
let initialized = false;

async function persist(sub) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(sub.id).set(sub);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  subs = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return subs;
}

function isInitialized() {
  return initialized;
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
  subs.push(sub);
  await persist(sub);
  return sub;
}

function findById(id) {
  return subs.find((s) => s.id === id);
}

/** Returns the active subscription between a subscriber and a creator, if one exists. */
function findActive(subscriberUid, creatorUid) {
  return subs.find(
    (s) =>
      s.subscriber_uid === subscriberUid &&
      s.creator_uid === creatorUid &&
      s.status === 'active',
  );
}

function getBySubscriber(subscriberUid) {
  return subs
    .filter((s) => s.subscriber_uid === subscriberUid)
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

function getByCreator(creatorUid) {
  return subs
    .filter((s) => s.creator_uid === creatorUid && s.status === 'active')
    .sort((a, b) => b.subscribed_at - a.subscribed_at);
}

/** Returns all active subscriptions whose next_billing has passed. */
function getActiveDue() {
  const now = Date.now();
  return subs.filter((s) => s.status === 'active' && s.next_billing <= now);
}

async function cancel(id) {
  const sub = findById(id);
  if (!sub) return null;
  sub.status = 'cancelled';
  sub.cancelled_at = Date.now();
  await persist(sub);
  return sub;
}

async function markRenewed(id) {
  const sub = findById(id);
  if (!sub) return null;
  sub.last_renewed_at = Date.now();
  sub.next_billing = Date.now() + 30 * 86_400_000;
  sub.renewal_count = (sub.renewal_count || 0) + 1;
  await persist(sub);
  return sub;
}

async function markCancelledOnFailure(id, reason = 'payment_failed') {
  const sub = findById(id);
  if (!sub) return null;
  sub.status = 'cancelled';
  sub.cancelled_at = Date.now();
  sub.cancel_reason = reason;
  await persist(sub);
  return sub;
}

function getAll() {
  return subs.sort((a, b) => b.subscribed_at - a.subscribed_at);
}

function getStats() {
  const now = Date.now();
  return {
    total: subs.length,
    active: subs.filter((s) => s.status === 'active').length,
    cancelled: subs.filter((s) => s.status === 'cancelled').length,
    due_for_renewal: subs.filter((s) => s.status === 'active' && s.next_billing <= now).length,
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
  getStats,
};
