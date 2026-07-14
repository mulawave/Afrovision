const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./ad.controller');

const router = Router();

// ─── SERVING (public — no auth required for ad display) ──
router.get('/serve/banner', ctrl.serveBanner);
router.get('/serve/stream', ctrl.serveInStream);

// ─── TRACKING (public with optional auth) ─────────────────
router.post('/impression', optionalAuth, ctrl.recordImpression);
router.post('/click', optionalAuth, ctrl.recordClick);

// ─── ADVERTISER (authenticated) ───────────────────────────
router.post('/', authenticateToken, ctrl.submitAd);
router.get('/me', authenticateToken, ctrl.getMyAds);
router.get('/billing', authenticateToken, ctrl.getBilling);
router.get('/my-analytics', authenticateToken, ctrl.getMyAnalytics);
router.post('/upload-url', authenticateToken, ctrl.getAdUploadUrl);
router.get('/:id/stats', authenticateToken, ctrl.getAdStats);
router.patch('/:id/budget', authenticateToken, ctrl.topUpBudget);
router.patch('/:id/pause', authenticateToken, ctrl.pauseAd);

// ─── ADMIN ────────────────────────────────────────────────
router.get('/all', authenticateToken, ctrl.getAllAds);
router.get('/pending', authenticateToken, ctrl.getPendingAds);
router.get('/impressions', authenticateToken, ctrl.getAllImpressions);
router.get('/revenue-report', authenticateToken, ctrl.getRevenueReport);
router.get('/analytics', authenticateToken, ctrl.getAnalytics);
router.post('/super', authenticateToken, ctrl.createSuperAd);
router.patch('/:id/approve', authenticateToken, ctrl.approveAd);
router.patch('/:id/reject', authenticateToken, ctrl.rejectAd);
router.patch('/:id/activate', authenticateToken, ctrl.activateAd);
router.put('/:id', authenticateToken, ctrl.updateAd);
router.delete('/:id', authenticateToken, ctrl.deleteAd);

module.exports = router;
