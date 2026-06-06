const { getFirestore } = require('../utils/firestore');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const PoolService = require('../vpt/pool.service');
const SettingsService = require('../admin/settings.service');

const POOL_CACHE_TTL_MS = 60_000;
const HIGHLIGHTS_CACHE_TTL_MS = 5 * 60_000;

let poolCache = null;
let poolCacheUpdatedAt = 0;
let poolRequestInFlight = null;

let highlightsCache = null;
let highlightsCacheUpdatedAt = 0;
let highlightsRequestInFlight = null;

function isFresh(updatedAt, ttlMs) {
  return updatedAt > 0 && (Date.now() - updatedAt) < ttlMs;
}

async function getVptRate() {
  let vptToNaira = 750;
  try {
    const stored = await SettingsService.get('VPT_PRICE_NGN');
    if (stored && Number(stored) > 0) vptToNaira = Number(stored);
  } catch (_) {
    // Use fallback default when settings lookup fails.
  }
  return vptToNaira;
}

function toCommunityPoolPayload(pool, vptRate) {
  return {
    community_pool: {
      total_vpt: pool.balance_vpt,
      total_ngn: pool.balance_ngn,
      vpt_rate: vptRate,
      naira_equivalent: pool.balance_ngn,
      total_distributed_vpt: pool.total_distributed_vpt,
      total_distributed_ngn: pool.total_distributed,
      total_beneficiaries: pool.total_beneficiaries,
    },
  };
}

function sortByCreatedAtDesc(left, right) {
  return new Date(right.created_at || 0) - new Date(left.created_at || 0);
}

async function countActiveChannels() {
  const db = getFirestore();
  const snapshot = await db.collection('channels')
    .where('is_active', '==', true)
    .count()
    .get();
  return snapshot.data().count || 0;
}

async function countActiveMembers() {
  const db = getFirestore();
  const totalSnapshot = await db.collection('users').count().get();
  let deletedCount = 0;

  try {
    const deletedSnapshot = await db.collection('users')
      .where('deleted_at', '!=', null)
      .count()
      .get();
    deletedCount = deletedSnapshot.data().count || 0;
  } catch (_) {
    // Fall back to total users if deleted-user aggregation is unavailable.
  }

  return Math.max(0, (totalSnapshot.data().count || 0) - deletedCount);
}

async function getCommunityPoolStats({ forceRefresh = false } = {}) {
  if (!forceRefresh && poolCache && isFresh(poolCacheUpdatedAt, POOL_CACHE_TTL_MS)) {
    return poolCache;
  }

  if (poolRequestInFlight) {
    return poolRequestInFlight;
  }

  poolRequestInFlight = (async () => {
    const [poolStats, vptRate] = await Promise.all([
      PoolService.getPoolStats(),
      getVptRate(),
    ]);

    poolCache = toCommunityPoolPayload(poolStats.pool, vptRate);
    poolCacheUpdatedAt = Date.now();
    return poolCache;
  })();

  try {
    return await poolRequestInFlight;
  } finally {
    poolRequestInFlight = null;
  }
}

async function getChannelHighlights({ forceRefresh = false } = {}) {
  if (!forceRefresh && highlightsCache && isFresh(highlightsCacheUpdatedAt, HIGHLIGHTS_CACHE_TTL_MS)) {
    return highlightsCache;
  }

  if (highlightsRequestInFlight) {
    return highlightsRequestInFlight;
  }

  highlightsRequestInFlight = (async () => {
    const [recentSource, promotedSource] = await Promise.all([
      Channel.getRecentPublic(10),
      Channel.getFeaturedChannels(5),
    ]);

    const recentChannels = await Promise.all(recentSource.map(async (channel) => {
      const owner = await User.findById(channel.owner_id);
      return {
        id: channel.id,
        name: channel.name,
        category: channel.category,
        channel_number: channel.channel_number,
        logo_url: channel.logo_url,
        banner_url: channel.banner_url,
        created_at: channel.created_at,
        owner_name: owner?.name || owner?.email || 'Unknown',
      };
    }));

    const promotedChannels = promotedSource
      .sort(sortByCreatedAtDesc)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        category: channel.category,
        channel_number: channel.channel_number,
        logo_url: channel.logo_url,
        banner_url: channel.banner_url,
      }));

    const [totalChannels, totalMembers] = await Promise.all([
      countActiveChannels(),
      countActiveMembers(),
    ]);

    highlightsCache = {
      recent_channels: recentChannels,
      promoted_channels: promotedChannels,
      stats: {
        total_channels: totalChannels,
        total_members: totalMembers,
      },
    };
    highlightsCacheUpdatedAt = Date.now();
    return highlightsCache;
  })();

  try {
    return await highlightsRequestInFlight;
  } finally {
    highlightsRequestInFlight = null;
  }
}

async function getLegacyHomeStats(options) {
  const [poolPayload, highlightsPayload] = await Promise.all([
    getCommunityPoolStats(options),
    getChannelHighlights(options),
  ]);

  return {
    ...poolPayload,
    ...highlightsPayload,
  };
}

module.exports = {
  getCommunityPoolStats,
  getChannelHighlights,
  getLegacyHomeStats,
};