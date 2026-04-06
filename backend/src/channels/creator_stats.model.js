const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'creator_stats';

// In-memory cache: Map<creatorUid, statsObject>
const cache = new Map();

async function _persist(uid, data) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
}

/**
 * Ensure a stats document exists for the given creator UID.
 * Returns the stats object (from cache or Firestore).
 */
async function ensureStats(uid) {
  if (cache.has(uid)) return cache.get(uid);

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(uid).get();

  const stats = doc.exists
    ? doc.data()
    : {
        creator_uid: uid,
        subscriber_count: 0,
        total_gifts_received_vpt: 0,
        total_gifts_received_ngn: 0,
        top_gifter_uid: null,
        updated_at: Date.now(),
      };

  if (!doc.exists) {
    await _persist(uid, stats);
  }

  cache.set(uid, stats);
  return stats;
}

/**
 * Increment subscriber_count by 1.
 */
async function incrementSubscribers(uid) {
  const stats = await ensureStats(uid);
  stats.subscriber_count = (stats.subscriber_count || 0) + 1;
  stats.updated_at = Date.now();
  cache.set(uid, stats);
  await _persist(uid, { subscriber_count: stats.subscriber_count, updated_at: stats.updated_at });
  return stats;
}

/**
 * Decrement subscriber_count (floor at 0).
 */
async function decrementSubscribers(uid) {
  const stats = await ensureStats(uid);
  stats.subscriber_count = Math.max(0, (stats.subscriber_count || 0) - 1);
  stats.updated_at = Date.now();
  cache.set(uid, stats);
  await _persist(uid, { subscriber_count: stats.subscriber_count, updated_at: stats.updated_at });
  return stats;
}

/**
 * Get current stats for a creator (initialises if missing).
 */
async function getStats(uid) {
  return ensureStats(uid);
}

module.exports = {
  ensureStats,
  incrementSubscribers,
  decrementSubscribers,
  getStats,
};
