const Ad = require('./ad.model');
const AdImpression = require('./ad_impression.model');
const { calculateRevenueSplit } = require('./ad_serving');

const ANALYTICS_WINDOW_DAYS = 30;
const ANALYTICS_CACHE_TTL_MS = 5 * 60_000;

let analyticsCache = null;
let analyticsCacheUpdatedAt = 0;
let analyticsRequestInFlight = null;

function createDailyBuckets(days) {
  const now = Date.now();
  const buckets = {};

  for (let index = 0; index < days; index += 1) {
    const date = new Date(now - (days - 1 - index) * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    buckets[key] = { date: key, impressions: 0, revenue: 0, viewers: 0 };
  }

  return buckets;
}

function getPlayedAtDate(impression) {
  if (impression?.played_at?.toDate) {
    return impression.played_at.toDate();
  }
  return new Date(impression?.played_at || 0);
}

function isCacheFresh() {
  return analyticsCache && (Date.now() - analyticsCacheUpdatedAt) < ANALYTICS_CACHE_TTL_MS;
}

async function getAdminAnalytics({ forceRefresh = false } = {}) {
  if (!forceRefresh && isCacheFresh()) {
    return analyticsCache;
  }

  if (analyticsRequestInFlight) {
    return analyticsRequestInFlight;
  }

  analyticsRequestInFlight = (async () => {
    const now = Date.now();
    const sinceTimestamp = now - (ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const allAds = await Ad.getAll();
    const recentImpressions = await AdImpression.getSince(sinceTimestamp);

    const dailyMap = createDailyBuckets(ANALYTICS_WINDOW_DAYS);
    const categoryMap = {};
    const adMap = {};
    const channelMap = {};
    let totalRevenue = 0;
    let totalViewers = 0;
    let operationsRevenue = 0;
    let channelRevenue = 0;
    let poolRevenue = 0;

    for (const impression of recentImpressions) {
      const playedAt = getPlayedAtDate(impression);
      const key = playedAt.toISOString().slice(0, 10);
      const revenue = impression.cost || 0;
      const viewers = impression.viewer_count || 0;
      const category = impression.category || 'unknown';
      const adId = impression.ad_id;
      const channelId = impression.channel_id || 'direct';
      const split = calculateRevenueSplit(category, revenue);

      totalRevenue += revenue;
      totalViewers += viewers;
      operationsRevenue += split.operations_share;
      channelRevenue += split.channel_share;
      poolRevenue += split.pool_share;

      if (dailyMap[key]) {
        dailyMap[key].impressions += 1;
        dailyMap[key].revenue += revenue;
        dailyMap[key].viewers += viewers;
      }

      if (!categoryMap[category]) {
        categoryMap[category] = { category, impressions: 0, revenue: 0, viewers: 0 };
      }
      categoryMap[category].impressions += 1;
      categoryMap[category].revenue += revenue;
      categoryMap[category].viewers += viewers;

      if (!adMap[adId]) {
        adMap[adId] = { ad_id: adId, impressions: 0, revenue: 0, viewers: 0 };
      }
      adMap[adId].impressions += 1;
      adMap[adId].revenue += revenue;
      adMap[adId].viewers += viewers;

      if (!channelMap[channelId]) {
        channelMap[channelId] = { channel_id: channelId, impressions: 0, revenue: 0, viewers: 0 };
      }
      channelMap[channelId].impressions += 1;
      channelMap[channelId].revenue += revenue;
      channelMap[channelId].viewers += viewers;
    }

    const topAdEntries = Object.values(adMap)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 10);

    const topAds = await Promise.all(topAdEntries.map(async (entry) => {
      const ad = await Ad.findById(entry.ad_id).catch(() => null);
      return {
        ...entry,
        title: ad?.title || 'Unknown',
        category: ad?.category || 'unknown',
        status: ad?.status || 'unknown',
      };
    }));

    const statusBreakdown = {};
    for (const ad of allAds) {
      const status = ad.status || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    }

    analyticsCache = {
      window_days: ANALYTICS_WINDOW_DAYS,
      overview: {
        total_ads: allAds.length,
        active_ads: allAds.filter((ad) => ad.status === 'active').length,
        total_budget: +allAds.reduce((sum, ad) => sum + (ad.budget || 0), 0).toFixed(2),
        total_revenue: +totalRevenue.toFixed(2),
        total_impressions: recentImpressions.length,
        total_viewers: totalViewers,
        operations_revenue: +operationsRevenue.toFixed(2),
        channel_revenue: +channelRevenue.toFixed(2),
        pool_revenue: +poolRevenue.toFixed(2),
        lifetime_total_revenue: +allAds.reduce((sum, ad) => sum + (ad.spent || 0), 0).toFixed(2),
        lifetime_total_impressions: allAds.reduce((sum, ad) => sum + (ad.impression_count || 0), 0),
      },
      daily: Object.values(dailyMap),
      categories: Object.values(categoryMap),
      top_ads: topAds,
      top_channels: Object.values(channelMap)
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      status_breakdown: statusBreakdown,
    };
    analyticsCacheUpdatedAt = Date.now();
    return analyticsCache;
  })();

  try {
    return await analyticsRequestInFlight;
  } finally {
    analyticsRequestInFlight = null;
  }
}

module.exports = {
  ANALYTICS_WINDOW_DAYS,
  getAdminAnalytics,
};