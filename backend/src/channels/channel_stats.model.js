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
        total_views: 0,
        total_watch_seconds: 0,
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

/**
 * Increment total_views by `amount` (defaults to 1). Used both by organic
 * view recording and admin injection.
 */
async function incrementViews(channelId, amount = 1) {
  const stats = await ensureStats(channelId);
  stats.total_views = Math.max(0, (stats.total_views || 0) + amount);
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { total_views: stats.total_views, updated_at: stats.updated_at });
  return stats;
}

/**
 * Remove `amount` views (floored at 0). Used by admin injection tooling.
 */
async function decrementViews(channelId, amount = 1) {
  const stats = await ensureStats(channelId);
  stats.total_views = Math.max(0, (stats.total_views || 0) - amount);
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { total_views: stats.total_views, updated_at: stats.updated_at });
  return stats;
}

/**
 * Add watch-time (in seconds) accumulated from a client's periodic
 * watch-ping while actively viewing a channel.
 */
async function addWatchSeconds(channelId, seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  if (safeSeconds === 0) return ensureStats(channelId);
  const stats = await ensureStats(channelId);
  stats.total_watch_seconds = Math.max(0, (stats.total_watch_seconds || 0) + safeSeconds);
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { total_watch_seconds: stats.total_watch_seconds, updated_at: stats.updated_at });
  return stats;
}

/**
 * Inject or remove watch-time (in minutes) — admin tooling.
 */
async function adjustWatchMinutes(channelId, minutesDelta) {
  const secondsDelta = Math.round(Number(minutesDelta) || 0) * 60;
  const stats = await ensureStats(channelId);
  stats.total_watch_seconds = Math.max(0, (stats.total_watch_seconds || 0) + secondsDelta);
  stats.updated_at = Date.now();
  cache.set(channelId, stats);
  await _persist(channelId, { total_watch_seconds: stats.total_watch_seconds, updated_at: stats.updated_at });
  return stats;
}

/**
 * Get stats for many channels in one pass (used by the admin live-overview
 * dashboard). Uses the cache where available, otherwise reads Firestore.
 */
async function getStatsForChannels(channelIds) {
  const results = new Map();
  const toFetch = [];

  for (const id of channelIds) {
    if (cache.has(id)) {
      results.set(id, cache.get(id));
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length > 0) {
    const db = getFirestore();
    const refs = toFetch.map((id) => db.collection(COLLECTION).doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach((doc, idx) => {
      const id = toFetch[idx];
      const stats = doc.exists
        ? doc.data()
        : {
            channel_id: id,
            subscriber_count: 0,
            total_gifts_received_vpt: 0,
            total_gifts_received_ngn: 0,
            top_gifter_uid: null,
            total_views: 0,
            total_watch_seconds: 0,
            updated_at: Date.now(),
          };
      cache.set(id, stats);
      results.set(id, stats);
    });
  }

  return results;
}

module.exports = {
  ensureStats,
  incrementSubscribers,
  decrementSubscribers,
  getStats,
  incrementViews,
  decrementViews,
  addWatchSeconds,
  adjustWatchMinutes,
  getStatsForChannels,
};
