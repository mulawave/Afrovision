const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const designCtrl = require('../design/homepage-design.controller');
const challengeContentCtrl = require('../design/challenge-content.controller');
const staticPagesContentCtrl = require('../design/static-pages-content.controller');
const SettingsService = require('../admin/settings.service');
const adminCtrl = require('../admin/admin.controller');
const HomeStatsService = require('./home-stats.service');

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

// GET /home/community-pool — lightweight public pool stats payload
router.get('/community-pool', optionalAuth, async (req, res) => {
  res.json(await HomeStatsService.getCommunityPoolStats());
});

// GET /home/channel-highlights — recent/promoted channels plus public counters
router.get('/channel-highlights', optionalAuth, async (req, res) => {
  res.json(await HomeStatsService.getChannelHighlights());
});

// GET /home/stats — legacy combined payload for older clients
router.get('/stats', optionalAuth, async (req, res) => {
  res.json(await HomeStatsService.getLegacyHomeStats());
});

module.exports = router;
