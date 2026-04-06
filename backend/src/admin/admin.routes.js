const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./admin.controller');
const premiumCtrl = require('../channels/premium_stream.controller');
const creatorSubCtrl = require('../subscriptions/creator_subscription.controller');
const creatorAnalyticsCtrl = require('../analytics/creator_analytics.controller');
const designCtrl = require('../design/homepage-design.controller');
const { upload, uploadSingleToGCS } = require('../utils/upload');

const router = Router();

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

// Category management
router.get('/categories', authenticateToken, ctrl.getCategories);
router.post('/categories', authenticateToken, ctrl.createCategory);
router.patch('/categories/:id', authenticateToken, ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, ctrl.deleteCategory);

// Settings management
router.get('/settings', authenticateToken, ctrl.getSettings);
router.patch('/settings/bulk', authenticateToken, ctrl.bulkUpdateSettings);
router.get('/settings/:key', authenticateToken, ctrl.getSetting);
router.patch('/settings/:key', authenticateToken, ctrl.updateSetting);
router.post('/settings/:key/reset', authenticateToken, ctrl.resetSetting);

// Homepage design management
router.get('/design/homepage', authenticateToken, designCtrl.getHomepageDesign);
router.patch('/design/homepage', authenticateToken, designCtrl.updateHomepageDesign);
router.post('/design/homepage/assets', authenticateToken, upload.single('file'), uploadSingleToGCS, designCtrl.uploadHomepageAsset);
router.post('/design/homepage/branding', authenticateToken, upload.single('file'), uploadSingleToGCS, designCtrl.uploadBrandingAsset);

// User management
router.get('/users', authenticateToken, ctrl.listUsers);
router.delete('/users/:uid', authenticateToken, ctrl.deleteUser);
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
router.get('/wallets', authenticateToken, ctrl.listWallets);

// Channel control
router.get('/channels', authenticateToken, ctrl.listAllChannels);
router.post('/channels/:id/disable', authenticateToken, ctrl.adminDisableChannel);
router.post('/channels/:id/enable', authenticateToken, ctrl.adminEnableChannel);

// Premium stream management (Module 11)
router.get('/channels/premium', authenticateToken, premiumCtrl.adminListPremiumChannels);
router.patch('/channels/:id/premium', authenticateToken, premiumCtrl.adminSetPremium);

// Creator subscription management (Module 11)
router.get('/creator-subscriptions', authenticateToken, creatorSubCtrl.adminListSubscriptions);
router.delete('/creator-subscriptions/:id/cancel', authenticateToken, creatorSubCtrl.adminCancelSubscription);

// Feature flags
router.get('/features', authenticateToken, ctrl.getFeatureFlags);
router.post('/features', authenticateToken, ctrl.setFeatureFlag);

// Dashboard
router.get('/dashboard', authenticateToken, ctrl.getDashboard);
router.get('/dashboard/trend', authenticateToken, ctrl.getDashboardTrend);

// Analytics
router.get('/analytics/creators/:uid/stats', authenticateToken, creatorAnalyticsCtrl.adminGetCreatorStats);

// Audit logs
router.get('/audit', authenticateToken, ctrl.getAuditLogs);

module.exports = router;
