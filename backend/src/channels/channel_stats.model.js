const { getFirestore } = require('../utils/firestore');
const { normalizePlatform, emptyPlatformBreakdown } = require('../utils/platform');

const COLLECTION = 'channel_stats';

// In-memory cache: Map<channelId, statsObject>
const cache = new Map();

function defaultStats(channelId) {
  return {
    channel_id: channelId,
    subscriber_count: 0,
    total_gifts_received_vpt: 0,
    total_gifts_received_ngn: 0,
    top_gifter_uid: null,
    total_views: 0,
    total_watch_seconds: 0,
    views_by_platform: emptyPlatformBreakdown(),
    watch_seconds_by_platform: emptyPlatformBreakdown(),
    updated_at: Date.now(),
  };
}

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
    ? { ...defaultStats(channelId), ...doc.data() }
    : defaultStats(channelId);

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
 * Increment total_views by `amount` (defaults to 1), plus the per-platform
 * breakdown when a platform is given. Used both by organic view recording
 * (platform known) and admin injection (platform omitted).
 */
async function incrementViews(channelId, amount = 1, platform = null) {
  const stats = await ensureStats(channelId);
  stats.total_views = Math.max(0, (stats.total_views || 0) + amount);
  stats.updated_at = Date.now();

  const persistPayload = { total_views: stats.total_views, updated_at: stats.updated_at };
  if (platform) {
    const key = normalizePlatform(platform);
    stats.views_by_platform = stats.views_by_platform || emptyPlatformBreakdown();
    stats.views_by_platform[key] = Math.max(0, (stats.views_by_platform[key] || 0) + amount);
    persistPayload[`views_by_platform.${key}`] = stats.views_by_platform[key];
  }

  cache.set(channelId, stats);
  await _persist(channelId, persistPayload);
  return stats;
}

/**
 * Remove `amount` views (floored at 0). Used by admin injection tooling —
 * always platform-agnostic (only adjusts the aggregate total).
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
 * watch-ping while actively viewing a channel, tagged by platform.
 */
async function addWatchSeconds(channelId, seconds = 0, platform = null) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  if (safeSeconds === 0) return ensureStats(channelId);

  const stats = await ensureStats(channelId);
  stats.total_watch_seconds = Math.max(0, (stats.total_watch_seconds || 0) + safeSeconds);
  stats.updated_at = Date.now();

  const persistPayload = { total_watch_seconds: stats.total_watch_seconds, updated_at: stats.updated_at };
  if (platform) {
    const key = normalizePlatform(platform);
    stats.watch_seconds_by_platform = stats.watch_seconds_by_platform || emptyPlatformBreakdown();
    stats.watch_seconds_by_platform[key] = Math.max(0, (stats.watch_seconds_by_platform[key] || 0) + safeSeconds);
    persistPayload[`watch_seconds_by_platform.${key}`] = stats.watch_seconds_by_platform[key];
  }

  cache.set(channelId, stats);
  await _persist(channelId, persistPayload);
  return stats;
}

/**
 * Inject or remove watch-time (in minutes) — admin tooling. Platform-agnostic
 * (only adjusts the aggregate total).
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
      const stats = doc.exists ? { ...defaultStats(id), ...doc.data() } : defaultStats(id);
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
