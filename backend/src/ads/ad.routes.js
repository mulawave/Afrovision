const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./ad.controller');

const router = Router();

// ─── SERVING (public — no auth required for ad display) ──
router.get('/serve/banner', ctrl.serveBanner);
router.get('/serve/stream', ctrl.serveInStream);

// ─── IMPRESSION TRACKING (authenticated) ──────────────────
router.post('/impression', authenticateToken, ctrl.recordImpression);

// ─── ADVERTISER (authenticated) ───────────────────────────
router.post('/', authenticateToken, ctrl.submitAd);
router.get('/me', authenticateToken, ctrl.getMyAds);
router.post('/upload-url', authenticateToken, ctrl.getAdUploadUrl);
router.get('/:id/stats', authenticateToken, ctrl.getAdStats);
router.patch('/:id/budget', authenticateToken, ctrl.topUpBudget);
router.patch('/:id/pause', authenticateToken, ctrl.pauseAd);

// ─── ADMIN ────────────────────────────────────────────────
router.get('/all', authenticateToken, ctrl.getAllAds);
router.get('/pending', authenticateToken, ctrl.getPendingAds);
router.get('/impressions', authenticateToken, ctrl.getAllImpressions);
router.post('/super', authenticateToken, ctrl.createSuperAd);
router.patch('/:id/approve', authenticateToken, ctrl.approveAd);
router.patch('/:id/reject', authenticateToken, ctrl.rejectAd);
router.patch('/:id/activate', authenticateToken, ctrl.activateAd);
router.put('/:id', authenticateToken, ctrl.updateAd);
router.delete('/:id', authenticateToken, ctrl.deleteAd);

module.exports = router;
