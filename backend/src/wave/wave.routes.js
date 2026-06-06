const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./wave.controller');

const router = Router();

// ─── Upload & Register ────────────────────────────────────────────────────────
router.post('/upload-url', authenticateToken, ctrl.getWaveUploadUrl);
router.post('/register', authenticateToken, ctrl.registerWave);

// ─── Feed & Discovery ────────────────────────────────────────────────────────
router.get('/feed', optionalAuth, ctrl.getFeed);
router.get('/channel/:channelId', optionalAuth, ctrl.getChannelWaves);
router.get('/me/bookmarks', authenticateToken, ctrl.getMyBookmarks);
router.get('/creator/lock-status', authenticateToken, ctrl.getCreatorLockStatus);
router.post('/creator/lock-pay', authenticateToken, ctrl.payCreatorLock);
router.get('/:waveId', optionalAuth, ctrl.getWave);
router.post('/:waveId/access-check', optionalAuth, ctrl.checkWaveAccess);
router.post('/:waveId/access-consent', authenticateToken, ctrl.acknowledgeAdultConsent);

// ─── Wave management ─────────────────────────────────────────────────────────
router.patch('/:waveId', authenticateToken, ctrl.updateWave);
router.delete('/:waveId', authenticateToken, ctrl.deleteWave);
router.post('/:waveId/timeline-visibility', authenticateToken, ctrl.setTimelineVisibility);
router.post('/bulk-delete', authenticateToken, ctrl.bulkDeleteWaves);
router.post('/bulk-timeline-visibility', authenticateToken, ctrl.bulkSetTimelineVisibility);
router.post('/:waveId/view', optionalAuth, ctrl.trackView);

// ─── Pulse ───────────────────────────────────────────────────────────────────
router.post('/:waveId/pulse', authenticateToken, ctrl.addPulse);
router.get('/:waveId/pulses/moments', optionalAuth, ctrl.getPulseMoments);

// ─── Comments ────────────────────────────────────────────────────────────────
router.get('/:waveId/comments', optionalAuth, ctrl.getComments);
router.post('/:waveId/comments', authenticateToken, ctrl.postComment);
router.delete('/:waveId/comments/:commentId', authenticateToken, ctrl.deleteComment);

// ─── Bookmarks ───────────────────────────────────────────────────────────────
router.get('/:waveId/bookmark', authenticateToken, ctrl.getBookmarkStatus);
router.post('/:waveId/bookmark', authenticateToken, ctrl.toggleBookmark);

// ─── Signals ─────────────────────────────────────────────────────────────────
router.post('/:waveId/interest', authenticateToken, ctrl.setInterest);
router.post('/:waveId/report', authenticateToken, ctrl.reportWave);
router.post('/:waveId/classification-report', authenticateToken, ctrl.reportWave);

module.exports = router;
