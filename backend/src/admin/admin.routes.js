const { Router } = require('express');
const { cacheJson } = require('./responseCache');
const { requireReason, optionalReason } = require('./requireReason');
const { authenticateToken, requireAdminRole } = require('../utils/jwt');
const { adminLimiter } = require('../utils/rate_limit');
const ctrl = require('./admin.controller');
const premiumCtrl = require('../channels/premium_stream.controller');
const creatorSubCtrl = require('../subscriptions/creator_subscription.controller');
const creatorAnalyticsCtrl = require('../analytics/creator_analytics.controller');
const designCtrl = require('../design/homepage-design.controller');
const challengeContentCtrl = require('../design/challenge-content.controller');
const staticPagesContentCtrl = require('../design/static-pages-content.controller');
const cersAdminCtrl = require('./cers.admin.controller');
const aiVideoAdminCtrl = require('../ai_video/ai_video.admin.controller');
const referralCtrl = require('../referrals/referral.controller');
const promoModalCtrl = require('../promo/promo-modal.controller');
const mediaCenterHeroesCtrl = require('../media_center/media_center_heroes.controller');
const { upload, uploadSingleToGCS, uploadFieldsToGCS } = require('../utils/upload');

const router = Router();

// Router-level gate: every route mounted on this router requires an admin
// role, closing any handler that forgot its own per-handler check (or has
// one with a missing await). Per-handler checks below are now redundant
// but left in place — they fail safe (403) if this gate is ever bypassed.
router.use(authenticateToken, requireAdminRole, adminLimiter);

router.post('/set-role', authenticateToken, ctrl.setRole);
router.post('/set-premium', authenticateToken, ctrl.setPremium);
router.post('/set-kyc', authenticateToken, ctrl.setKyc);

// Plan management
router.get('/plans', authenticateToken, ctrl.listPlans);
router.post('/plans', authenticateToken, ctrl.createPlan);
router.patch('/plans/:id', authenticateToken, ctrl.updatePlan);
router.delete('/plans/:id', authenticateToken, ctrl.deletePlan);
router.post('/plans/:id/features', authenticateToken, ctrl.addFeatureToPlan);
router.delete('/plans/:id/features/:feature', authenticateToken, ctrl.removeFeatureFromPlan);

// Viewer plan management
router.get('/viewer-plans', authenticateToken, ctrl.listViewerPlans);
router.post('/viewer-plans', authenticateToken, ctrl.createViewerPlan);
router.patch('/viewer-plans/:id', authenticateToken, ctrl.updateViewerPlan);
router.delete('/viewer-plans/:id', authenticateToken, ctrl.deleteViewerPlan);
router.post('/viewer-plans/:id/toggle-active', authenticateToken, ctrl.toggleViewerPlanActive);

// Category management
router.get('/categories', authenticateToken, ctrl.getCategories);
router.post('/categories', authenticateToken, ctrl.createCategory);
router.patch('/categories/:id', authenticateToken, ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, ctrl.deleteCategory);

// Settings management
router.get('/settings', authenticateToken, ctrl.getSettings);
router.patch('/settings/bulk', authenticateToken, ctrl.bulkUpdateSettings);
router.post('/settings/smtp/test', authenticateToken, ctrl.testSmtpSettings);
router.get('/settings/:key', authenticateToken, ctrl.getSetting);
router.patch('/settings/:key', authenticateToken, ctrl.updateSetting);
router.post('/settings/:key/reset', authenticateToken, ctrl.resetSetting);

// Homepage design management
router.get('/design/homepage', authenticateToken, designCtrl.getHomepageDesign);
router.patch('/design/homepage', authenticateToken, designCtrl.updateHomepageDesign);
router.post('/design/homepage/assets', authenticateToken, upload.single('file'), uploadSingleToGCS, designCtrl.uploadHomepageAsset);
router.post('/design/homepage/branding', authenticateToken, upload.single('file'), uploadSingleToGCS, designCtrl.uploadBrandingAsset);

// Challenge page content management
router.get('/content/challenge', authenticateToken, challengeContentCtrl.getAdminChallengeContent);
router.patch('/content/challenge', authenticateToken, challengeContentCtrl.updateAdminChallengeContent);

// Static website pages content management
router.get('/content/pages/:slug', authenticateToken, staticPagesContentCtrl.getAdminPageContent);
router.patch('/content/pages/:slug', authenticateToken, staticPagesContentCtrl.updateAdminPageContent);

// CERS policy + moderation management
router.get('/cers/policy', authenticateToken, cersAdminCtrl.getPolicy);
router.patch('/cers/policy', authenticateToken, cersAdminCtrl.updatePolicy);
router.get('/cers/cases', authenticateToken, cersAdminCtrl.listModerationCases);
router.patch('/cers/cases/:caseId/review', authenticateToken, cersAdminCtrl.reviewModerationCase);
router.get('/cers/reporter-state/:userId', authenticateToken, cersAdminCtrl.getReporterState);

// User management
router.get('/users', authenticateToken, ctrl.listUsers);
router.get('/users/search', authenticateToken, ctrl.searchUsers);
router.delete('/users/:uid', authenticateToken, requireReason, ctrl.deleteUser);
router.post('/users/cleanup/duplicates', authenticateToken, ctrl.cleanupDuplicates);
router.post('/users/cleanup/empty',      authenticateToken, ctrl.cleanupEmpty);
router.post('/users/recover',            authenticateToken, ctrl.recoverAccounts);
router.post('/users/reconstruct',        authenticateToken, ctrl.reconstructHardDeleted);
router.post('/users/enrich',             authenticateToken, ctrl.enrichRecoveredUsers);
router.post('/users/reload',             authenticateToken, ctrl.reloadFromFirestore);
router.post('/users/recover-from-index', authenticateToken, ctrl.recoverFromEmailIndex);
router.post('/users/repair',            authenticateToken, ctrl.repairUserDocument);
router.post('/users/cleanup-shells',     authenticateToken, ctrl.cleanupRecoveryShells);
router.post('/users/pitr-restore',       authenticateToken, ctrl.pitrRestore);
router.get('/users/:uid/wallet', authenticateToken, ctrl.getUserWallet);
router.get('/users/:uid/detail', authenticateToken, ctrl.getUserDetail);
router.post('/users/:uid/ban', authenticateToken, requireReason, ctrl.banUser);
router.post('/users/:uid/unban', authenticateToken, optionalReason, ctrl.unbanUser);
router.post('/users/:uid/freeze-wallet', authenticateToken, requireReason, ctrl.freezeWallet);
router.post('/users/:uid/unfreeze-wallet', authenticateToken, optionalReason, ctrl.unfreezeWallet);
router.post('/users/:uid/ban-withdrawal', authenticateToken, requireReason, ctrl.banWithdrawal);
router.post('/users/:uid/unban-withdrawal', authenticateToken, optionalReason, ctrl.unbanWithdrawal);
router.post('/users/:uid/ban-channel-creation', authenticateToken, requireReason, ctrl.banChannelCreation);
router.post('/users/:uid/unban-channel-creation', authenticateToken, optionalReason, ctrl.unbanChannelCreation);
router.post('/users/:uid/debit', authenticateToken, requireReason, ctrl.debitUserAssets);
router.get('/wallets', authenticateToken, ctrl.listWallets);

// Channel control
router.get('/channels', authenticateToken, ctrl.listAllChannels);
router.get('/channels/imported', authenticateToken, ctrl.adminListImportedChannels);
router.post(
	'/channels/import-with-media',
	authenticateToken,
	upload.fields([
		{ name: 'logo', maxCount: 1 },
		{ name: 'banner', maxCount: 1 },
	]),
	uploadFieldsToGCS,
	ctrl.adminImportChannel,
);
router.post('/channels/bulk-recheck-sources', authenticateToken, ctrl.adminBulkRecheckSources);
router.post('/channels/backfill-defaults', authenticateToken, ctrl.adminBackfillChannelDefaults);
router.post('/channels/cleanup-orphaned-events', authenticateToken, ctrl.adminCleanupOrphanedChannelEvents);
router.post('/channels/:id/disable', authenticateToken, ctrl.adminDisableChannel);
router.post('/channels/:id/enable', authenticateToken, ctrl.adminEnableChannel);
router.patch('/channels/:id/number', authenticateToken, ctrl.adminUpdateChannelNumber);
router.post('/channels/:id/recheck-source', authenticateToken, ctrl.adminRecheckChannelSource);
router.patch('/channels/:id/external-source', authenticateToken, ctrl.adminUpdateChannelExternalSource);
router.patch('/channels/:id/owner-display', authenticateToken, ctrl.adminUpdateChannelOwnerDisplay);
router.delete('/channels/:id', authenticateToken, ctrl.adminHardDeleteChannel);
router.post('/channels/:id/ban', authenticateToken, requireReason, ctrl.adminBanChannel);
router.post('/channels/:id/unban', authenticateToken, optionalReason, ctrl.adminUnbanChannel);
router.get('/channels/:id/analytics', authenticateToken, ctrl.adminChannelAnalytics);
router.get('/channels/:id/audit/gifts', authenticateToken, ctrl.adminChannelAuditGifts);
router.get('/channels/:id/audit/subscriptions', authenticateToken, ctrl.adminChannelAuditSubscriptions);
router.get('/channels/:id/audit/events', authenticateToken, ctrl.adminChannelAuditEvents);
router.get('/channels/:id/audit/asset-flow', authenticateToken, ctrl.adminChannelAuditAssetFlow);
router.get('/channels/:id/audit/logs', authenticateToken, ctrl.adminChannelAuditLogs);
router.post('/channels/migrate-follows-to-subscriptions', authenticateToken, ctrl.adminMigrateFollowsToSubscriptions);

// Live viewers dashboard
router.get('/channels/live-overview', authenticateToken, ctrl.adminChannelsLiveOverview);

// Data injection — channels (views/followers)
router.post('/channels/:id/views/inject', authenticateToken, ctrl.adminInjectChannelViews);
router.post('/channels/:id/views/remove', authenticateToken, ctrl.adminRemoveChannelViews);
router.post('/channels/:id/followers/inject', authenticateToken, ctrl.adminInjectChannelFollowers);
router.post('/channels/:id/followers/remove', authenticateToken, ctrl.adminRemoveChannelFollowers);
router.get('/synthetic-followers/legacy', authenticateToken, ctrl.adminLegacySyntheticFollowersStatus);
router.post('/synthetic-followers/convert', authenticateToken, ctrl.adminConvertLegacySyntheticFollowers);

// Data injection — waves (views/replays)
router.get('/waves/search', authenticateToken, ctrl.adminSearchWaves);
router.post('/waves/:id/views/inject', authenticateToken, ctrl.adminInjectWaveViews);
router.post('/waves/:id/views/remove', authenticateToken, ctrl.adminRemoveWaveViews);
router.post('/waves/:id/replays/inject', authenticateToken, ctrl.adminInjectWaveReplays);
router.post('/waves/:id/replays/remove', authenticateToken, ctrl.adminRemoveWaveReplays);

// Site-wide withdrawals toggle
router.post('/settings/withdrawals-toggle', authenticateToken, ctrl.toggleWithdrawalsSiteWide);

// Premium stream management (Module 11)
router.get('/channels/premium', authenticateToken, premiumCtrl.adminListPremiumChannels);
router.get('/channels/premium-requests', authenticateToken, premiumCtrl.adminListPendingPremiumRequests);
router.patch('/channels/:id/premium', authenticateToken, premiumCtrl.adminSetPremium);

// Creator subscription management (Module 11)
router.get('/creator-subscriptions', authenticateToken, creatorSubCtrl.adminListSubscriptions);
router.delete('/creator-subscriptions/:id/cancel', authenticateToken, creatorSubCtrl.adminCancelSubscription);

// Feature flags
router.get('/features', authenticateToken, ctrl.getFeatureFlags);
router.post('/features', authenticateToken, ctrl.setFeatureFlag);

// AI video generator management
router.get('/ai-video/config', authenticateToken, aiVideoAdminCtrl.getConfig);
router.put('/ai-video/config', authenticateToken, aiVideoAdminCtrl.updateConfig);
router.get('/ai-video/providers', authenticateToken, aiVideoAdminCtrl.getProviders);
router.put('/ai-video/providers/:providerKey', authenticateToken, aiVideoAdminCtrl.updateProvider);
router.post('/ai-video/providers/:providerKey/test', authenticateToken, aiVideoAdminCtrl.testProvider);

// Dashboard
// Dashboard aggregates are expensive (collection scans); cache briefly so the
// console's auto-refresh doesn't multiply Firestore reads.
router.get('/dashboard', authenticateToken, cacheJson(60 * 1000), ctrl.getDashboard);
router.get('/dashboard/trend', authenticateToken, cacheJson(5 * 60 * 1000), ctrl.getDashboardTrend);
router.get('/dashboard/exclusive-ops', authenticateToken, ctrl.getExclusiveOpsDashboard);
router.get('/dashboard/registrations', authenticateToken, cacheJson(10 * 60 * 1000), ctrl.getRegistrationAnalytics);
router.post('/renewals/run', authenticateToken, ctrl.runRenewals);

// Analytics
router.get('/analytics/creators/:uid/stats', authenticateToken, creatorAnalyticsCtrl.adminGetCreatorStats);

// Audit logs
router.get('/audit', authenticateToken, ctrl.getAuditLogs);

// Marquee / Live Wire Topics
router.get('/marquee', authenticateToken, ctrl.getMarqueeTopics);
router.post('/marquee', authenticateToken, ctrl.createMarqueeTopic);
router.patch('/marquee/:id', authenticateToken, ctrl.updateMarqueeTopic);
router.delete('/marquee/:id', authenticateToken, ctrl.deleteMarqueeTopic);

// Referral management
router.get('/referrals', authenticateToken, referralCtrl.adminListReferrals);
router.post('/referrals/assign-upline', authenticateToken, referralCtrl.adminAssignUpline);
router.post('/referrals/recalculate', authenticateToken, referralCtrl.adminRecalculatePayouts);

// Promo modal management
router.get('/promo-modal', authenticateToken, promoModalCtrl.adminGetPromoModal);
router.patch('/promo-modal', authenticateToken, promoModalCtrl.adminUpdatePromoModal);
router.post('/promo-modal/image', authenticateToken, upload.single('file'), uploadSingleToGCS, promoModalCtrl.adminUploadPromoImage);

// Media Center hero banner management
router.get('/media-center/heroes', authenticateToken, mediaCenterHeroesCtrl.adminListHeroes);
router.post('/media-center/heroes', authenticateToken, mediaCenterHeroesCtrl.adminCreateHero);
router.patch('/media-center/heroes/:id', authenticateToken, mediaCenterHeroesCtrl.adminUpdateHero);
router.delete('/media-center/heroes/:id', authenticateToken, mediaCenterHeroesCtrl.adminDeleteHero);
router.post('/media-center/heroes/image', authenticateToken, upload.single('file'), uploadSingleToGCS, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  res.json({ image_url: req.file.gcsUrl, file_name: req.file.filename });
});

module.exports = router;

// Email broadcast (Communication page → Send Email using template)
router.post('/email/send',      authenticateToken, ctrl.sendEmailToUser);
router.post('/email/broadcast', authenticateToken, ctrl.broadcastEmail);
router.get('/communication/audience-preview', authenticateToken, ctrl.getCommunicationAudiencePreview);
