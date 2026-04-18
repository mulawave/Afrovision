const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const Ledger = require('../vpt/ledger.model');
const designCtrl = require('../design/homepage-design.controller');
const SettingsService = require('../admin/settings.service');
const adminCtrl = require('../admin/admin.controller');

const router = Router();

// GET /home/content — public homepage design/content payload for website rendering
router.get('/content', designCtrl.getHomepageContent);

// GET /home/marquee — public, returns active marquee/ticker topics
router.get('/marquee', adminCtrl.getActiveMarqueeTopics);

// GET /home/captcha-key — public, returns reCAPTCHA site key for client-side use
router.get('/captcha-key', async (req, res) => {
  try {
    const siteKey = await SettingsService.get('RECAPTCHA_SITE_KEY');
    res.json({ siteKey: siteKey || '' });
  } catch (err) {
    console.error('[Home] captcha-key error:', err);
    res.json({ siteKey: '' });
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

  // Community pool balance = sum of (community_pool - vpt_extraction) from all SPLIT entries
  // i.e., the 70% that stays in the pool, converted to vPT at market rate
  const splits = Ledger.getAll().filter((e) => e.type === 'SPLIT' && e.status === 'success');
  let communityPoolNgn = 0;
  for (const s of splits) {
    const fullPool = (s.meta && s.meta.community_pool) || 0;
    const extracted = s.amount_ngn || 0; // the 30% that went to vPT queue
    communityPoolNgn += (fullPool - extracted); // 70% remains
  }
  const communityPoolVpt = Math.round((communityPoolNgn / vptToNaira) * 100) / 100;

  // Total distributed from pool (VPT_DISTRIBUTION entries)
  const distributions = Ledger.getAll().filter((e) => e.type === 'VPT_DISTRIBUTION' && e.status === 'success');
  const totalDistributedVpt = distributions.reduce((sum, e) => sum + (e.amount_vpt || 0), 0);
  const totalDistributedNgn = Math.round(totalDistributedVpt * vptToNaira * 100) / 100;

  // Total beneficiaries = unique users who received a distribution
  const beneficiarySet = new Set(distributions.map((e) => e.uid).filter(Boolean));
  const totalBeneficiaries = beneficiarySet.size;

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
      total_vpt: communityPoolVpt,
      total_ngn: communityPoolNgn,
      vpt_rate: vptToNaira,
      naira_equivalent: communityPoolNgn,
      total_distributed_vpt: Math.round(totalDistributedVpt * 100) / 100,
      total_distributed_ngn: totalDistributedNgn,
      total_beneficiaries: totalBeneficiaries,
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
