const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const Ledger = require('../vpt/ledger.model');
const PoolService = require('../vpt/pool.service');
const designCtrl = require('../design/homepage-design.controller');
const challengeContentCtrl = require('../design/challenge-content.controller');
const staticPagesContentCtrl = require('../design/static-pages-content.controller');
const SettingsService = require('../admin/settings.service');
const adminCtrl = require('../admin/admin.controller');

const router = Router();

// GET /home/content — public homepage design/content payload for website rendering
router.get('/content', designCtrl.getHomepageContent);

// GET /home/challenge-content — public challenge page content payload
router.get('/challenge-content', challengeContentCtrl.getPublicChallengeContent);

// GET /home/page-content/:slug — public static page content payload
router.get('/page-content/:slug', staticPagesContentCtrl.getPublicPageContent);

// GET /home/page-content-slugs — public list of supported static page slugs
router.get('/page-content-slugs', staticPagesContentCtrl.listPageSlugs);

// GET /home/marquee — public, returns active marquee/ticker topics
router.get('/marquee', adminCtrl.getActiveMarqueeTopics);

// GET /home/captcha-key — public, returns reCAPTCHA site key for client-side use
router.get('/captcha-key', async (req, res) => {
  const fallbackSiteKey = process.env.RECAPTCHA_SITE_KEY || '6LeuIsEsAAAAAO6xD7D08pQAraweXcxw9pHBg94k';
  try {
    const siteKey = await SettingsService.get('RECAPTCHA_SITE_KEY');
    res.json({ siteKey: siteKey || fallbackSiteKey });
  } catch (err) {
    console.error('[Home] captcha-key error:', err);
    res.json({ siteKey: fallbackSiteKey });
  }
});

// GET /home/app-links — public app linking config sourced from admin settings
router.get('/app-links', async (req, res) => {
  try {
    const [
      androidEnabled,
      androidPackage,
      androidFingerprints,
      androidStoreUrl,
      iosEnabled,
      iosTeamId,
      iosBundleId,
      appLinkPaths,
    ] = await Promise.all([
      SettingsService.get('ANDROID_APP_LINKS_ENABLED'),
      SettingsService.get('ANDROID_APP_PACKAGE'),
      SettingsService.get('ANDROID_APP_SHA256_FINGERPRINTS'),
      SettingsService.get('ANDROID_PLAY_STORE_URL'),
      SettingsService.get('IOS_UNIVERSAL_LINKS_ENABLED'),
      SettingsService.get('IOS_TEAM_ID'),
      SettingsService.get('IOS_BUNDLE_ID'),
      SettingsService.get('APP_LINK_PATHS'),
    ]);

    const splitList = (value) => String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    res.json({
      android: {
        enabled: String(androidEnabled || '').toLowerCase() === 'true',
        package_name: androidPackage || 'com.afrovision.afrovision',
        sha256_cert_fingerprints: splitList(androidFingerprints),
        play_store_url: androidStoreUrl || '',
      },
      ios: {
        enabled: String(iosEnabled || '').toLowerCase() === 'true',
        team_id: iosTeamId || '',
        bundle_id: iosBundleId || 'com.afrovision.afrovision',
      },
      paths: splitList(appLinkPaths || '/reset-password*'),
    });
  } catch (err) {
    console.error('[Home] app-links error:', err.message || err);
    res.json({
      android: {
        enabled: false,
        package_name: 'com.afrovision.afrovision',
        sha256_cert_fingerprints: [],
        play_store_url: '',
      },
      ios: {
        enabled: false,
        team_id: '',
        bundle_id: 'com.afrovision.afrovision',
      },
      paths: ['/reset-password*'],
    });
  }
});

// GET /home/stats — community pool, recent channels, total counts
router.get('/stats', optionalAuth, async (req, res) => {
  // Use admin-configurable vPT price; fall back to 750
  let vptToNaira = 750;
  try {
    const stored = await SettingsService.get('VPT_PRICE_NGN');
    if (stored && Number(stored) > 0) vptToNaira = Number(stored);
  } catch (_) { /* use default */ }

  // Community pool — recalculated from actual confirmed subscription records
  const poolStats = await PoolService.getPoolStats();
  const pool = poolStats.pool;

  // Recent public channels (top 10)
  const recentChannels = Channel.getRecentPublic(10).map((ch) => {
    const owner = User.findById(ch.owner_id);
    return {
      id: ch.id,
      name: ch.name,
      category: ch.category,
      channel_number: ch.channel_number,
      logo_url: ch.logo_url,
      banner_url: ch.banner_url,
      created_at: ch.created_at,
      owner_name: owner?.name || owner?.email || 'Unknown',
    };
  });

  // Promoted channels (for now: public channels with banners)
  const promoted = Channel.getPublicChannels()
    .filter((ch) => ch.banner_url)
    .slice(0, 5)
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      channel_number: ch.channel_number,
      logo_url: ch.logo_url,
      banner_url: ch.banner_url,
    }));

  const allUsers = User.getAll();
  const totalChannels = Channel.getAll().length;
  const totalMembers = allUsers.length;

  res.json({
    community_pool: {
      total_vpt: pool.balance_vpt,
      total_ngn: pool.balance_ngn,
      vpt_rate: vptToNaira,
      naira_equivalent: pool.balance_ngn,
      total_distributed_vpt: pool.total_distributed_vpt,
      total_distributed_ngn: pool.total_distributed,
      total_beneficiaries: pool.total_beneficiaries,
    },
    recent_channels: recentChannels,
    promoted_channels: promoted,
    stats: {
      total_channels: totalChannels,
      total_members: totalMembers,
    },
  });
});

module.exports = router;
