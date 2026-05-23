const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_stats';

// In-memory cache: Map<channelId, statsObject>
const cache = new Map();

async function _persist(channelId, data) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(channelId).set(data, { merge: true });
}

/**
 * Ensure a stats document exists for the given channel ID.
 * Returns the stats object (from cache or Firestore).
 */
async function ensureStats(channelId) {
  if (cache.has(channelId)) return cache.get(channelId);

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(channelId).get();

  const stats = doc.exists
    ? doc.data()
    : {
        channel_id: channelId,
        subscriber_count: 0,
        total_gifts_received_vpt: 0,
        total_gifts_received_ngn: 0,
        top_gifter_uid: null,
        updated_at: Date.now(),
      };

  if (!doc.exists) {
    await _persist(channelId, stats);
  }

  cache.set(channelId, stats);
  return stats;
}

/**
 * Increment subscriber_count by 1.
 */
async function incrementSubscribers(channelId) {
  const stats = await ensureStats(channelId);
  stats.subscriber_count = (stats.subscriber_count || 0) + 1;
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { subscriber_count: stats.subscriber_count, updated_at: stats.updated_at });
  return stats;
}

/**
 * Decrement subscriber_count (floor at 0).
 */
async function decrementSubscribers(channelId) {
  const stats = await ensureStats(channelId);
  stats.subscriber_count = Math.max(0, (stats.subscriber_count || 0) - 1);
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { subscriber_count: stats.subscriber_count, updated_at: stats.updated_at });
  return stats;
}

/**
 * Get current stats for a channel (initialises if missing).
 */
async function getStats(channelId) {
  return ensureStats(channelId);
}

module.exports = {
  ensureStats,
  incrementSubscribers,
  decrementSubscribers,
  getStats,
};
