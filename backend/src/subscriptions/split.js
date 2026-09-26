const SettingsService = require('../admin/settings.service');

/**
 * Subscription revenue split, shared by every subscription payment path
 * (creator, channel, viewer plans, Google Play, renewals).
 *
 *   Subscriber vPT reward  15%  (fixed)
 *   Referral pool          15%  (fixed)
 *   Community pool          C%  (admin setting COMMUNITY_POOL_PERCENT, default 20, 0–70)
 *   Operations pool    70 − C%  (platform share absorbs the change)
 *
 * With the default C = 20 this is exactly the historical 50/15/15/20 split,
 * so amounts are unchanged unless an admin changes the setting. If the
 * setting can't be read or is out of range, the default is used so a
 * payment is never blocked by a settings problem.
 */
const SUBSCRIBER_VPT_PERCENT = 15;
const REFERRAL_PERCENT = 15;
const DEFAULT_COMMUNITY_PERCENT = 20;
const MAX_COMMUNITY_PERCENT = 100 - SUBSCRIBER_VPT_PERCENT - REFERRAL_PERCENT; // 70

async function getSubscriptionSplit() {
  let community = DEFAULT_COMMUNITY_PERCENT;
  try {
    const value = await SettingsService.getNumber('COMMUNITY_POOL_PERCENT');
    if (Number.isFinite(value) && value >= 0 && value <= MAX_COMMUNITY_PERCENT) community = value;
  } catch (err) {
    console.warn('[split] COMMUNITY_POOL_PERCENT unreadable, using default:', err.message);
  }
  const operations = MAX_COMMUNITY_PERCENT - community;
  return {
    communityPercent: community,
    operationsPercent: operations,
    subscriberVptPercent: SUBSCRIBER_VPT_PERCENT,
    referralPercent: REFERRAL_PERCENT,
    // Fractions for Math.floor(amount * fraction); 50/100 etc. are exact.
    community: community / 100,
    operations: operations / 100,
    subscriberVpt: SUBSCRIBER_VPT_PERCENT / 100,
    referral: REFERRAL_PERCENT / 100,
  };
}

module.exports = { getSubscriptionSplit, MAX_COMMUNITY_PERCENT, DEFAULT_COMMUNITY_PERCENT };
