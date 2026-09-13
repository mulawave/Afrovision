const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_live_stats';

// In-memory cache of last-known state, kept in lockstep with Firestore
// writes below so the admin dashboard can poll without extra reads.
const cache = new Map();

/**
 * Persist the current viewer count for a channel (called from the socket
 * server on join/leave/disconnect). Debounced naturally by socket.io event
 * volume — this is a cheap merge write, not a transaction, since exact
 * precision isn't required for a live dashboard number.
 */
async function setViewerCount(channelId, count) {
  const safeCount = Math.max(0, Number(count) || 0);
  const existing = cache.get(channelId) || { channel_id: channelId, current_viewers: 0, peak_viewers: 0 };
  const peak = Math.max(existing.peak_viewers || 0, safeCount);
  const data = {
    channel_id: channelId,
    current_viewers: safeCount,
    peak_viewers: peak,
    updated_at: Date.now(),
  };
  cache.set(channelId, data);

  const db = getFirestore();
  await db.collection(COLLECTION).doc(channelId).set(data, { merge: true }).catch((err) => {
    console.error('[ChannelLive] setViewerCount persist error:', err.message);
  });

  return data;
}

async function getForChannel(channelId) {
  if (cache.has(channelId)) return cache.get(channelId);
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(channelId).get();
  const data = doc.exists ? doc.data() : { channel_id: channelId, current_viewers: 0, peak_viewers: 0, updated_at: null };
  cache.set(channelId, data);
  return data;
}

/**
 * Get live stats for many channels in one pass (used by the admin
 * live-overview dashboard). Falls back to Firestore for anything not in the
 * in-memory cache (e.g. after a server restart on a fresh instance).
 */
async function getForChannels(channelIds) {
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
      const data = doc.exists ? doc.data() : { channel_id: id, current_viewers: 0, peak_viewers: 0, updated_at: null };
      cache.set(id, data);
      results.set(id, data);
    });
  }

  return results;
}

/**
 * Sum of current_viewers across every channel we have live data for
 * (in-memory cache only — this process's view of the world). Sufficient for
 * a single-instance deployment; if the backend ever runs multiple
 * instances, this would need to move to a shared store (e.g. Redis).
 */
function getTotalCurrentViewers() {
  let total = 0;
  for (const data of cache.values()) {
    total += data.current_viewers || 0;
  }
  return total;
}

function getLiveChannelIds() {
  const ids = [];
  for (const [channelId, data] of cache.entries()) {
    if ((data.current_viewers || 0) > 0) ids.push(channelId);
  }
  return ids;
}

module.exports = {
  setViewerCount,
  getForChannel,
  getForChannels,
  getTotalCurrentViewers,
  getLiveChannelIds,
};
