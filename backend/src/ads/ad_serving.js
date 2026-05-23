const Ad = require('./ad.model');

/**
 * Ad Serving Engine
 *
 * Selects the best ad to show for a given category and optional channel.
 * Priority: super ads first, then lowest impression count (round-robin fairness).
 * If target_channels is set, only matches those channels.
 */

async function getNextAd(category, channelId = null) {
  const candidates = await Ad.getActiveByCategory(category);
  if (candidates.length === 0) return null;

  // Filter by channel targeting
  const targeted = candidates.filter((ad) => {
    if (!ad.target_channels || ad.target_channels.length === 0) return true;
    return ad.target_channels.includes(channelId);
  });
  if (targeted.length === 0) return null;

  // Super ads get priority
  const superAds = targeted.filter((a) => a.is_super_ad);
  if (superAds.length > 0) {
    // Among super ads, pick lowest impression count (fairness)
    superAds.sort((a, b) => a.impression_count - b.impression_count);
    return superAds[0];
  }

  // Regular ads: round-robin by lowest impression count
  targeted.sort((a, b) => a.impression_count - b.impression_count);
  return targeted[0];
}

/**
 * Get a banner ad for a given placement (home or page).
 */
async function getBannerAd(placement, channelId = null) {
  const category = placement === 'home' ? 'banner_home' : 'banner_page';
  return getNextAd(category, channelId);
}

/**
 * Get in-stream ads for a program break.
 * Returns an ordered array: [pre-roll?, mid-roll?, brief?]
 * based on what's available.
 */
async function getInStreamAds(channelId = null) {
  const result = [];
  const pre = await getNextAd('in_stream_pre', channelId);
  if (pre) result.push(pre);
  const mid = await getNextAd('in_stream_mid', channelId);
  if (mid) result.push(mid);
  const brief = await getNextAd('in_stream_brief', channelId);
  if (brief) result.push(brief);
  return result;
}

/**
 * Revenue split calculation.
 *
 * For in-stream ads (on channels): 50% operations, 30% channel owner, 20% community pool
 * For banner/page ads (site-wide): 70% operations, 30% community pool
 */
function calculateRevenueSplit(category, cost) {
  if (category.startsWith('in_stream')) {
    return {
      operations_share: +(cost * 0.50).toFixed(4),
      channel_share: +(cost * 0.30).toFixed(4),
      pool_share: +(cost * 0.20).toFixed(4),
    };
  }
  // Banner ads — no channel involved
  return {
    operations_share: +(cost * 0.70).toFixed(4),
    channel_share: 0,
    pool_share: +(cost * 0.30).toFixed(4),
  };
}

module.exports = {
  getNextAd,
  getBannerAd,
  getInStreamAds,
  calculateRevenueSplit,
};
