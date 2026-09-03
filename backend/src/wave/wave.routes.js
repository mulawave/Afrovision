const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const { upload, uploadSingleToGCS } = require('../utils/upload');
const ctrl = require('./wave.controller');

const router = Router();

// ─── Upload & Register ────────────────────────────────────────────────────────
router.post('/upload-url', authenticateToken, ctrl.getWaveUploadUrl);
router.post('/register', authenticateToken, ctrl.registerWave);
router.post('/resumable-session', authenticateToken, ctrl.createWaveResumableSession);
router.post('/resumable-complete', authenticateToken, ctrl.completeWaveResumableSession);

// ─── HLS Streaming (Viewer) ───────────────────────────────────────────────────
router.get('/:waveId/hls/*assetPath', optionalAuth, ctrl.streamWaveAdaptiveAsset);

// ─── Feed & Discovery ────────────────────────────────────────────────────────
router.get('/feed', optionalAuth, ctrl.getFeed);
router.get('/following', authenticateToken, ctrl.getFollowingFeed);
router.get('/channel/:channelId', authenticateToken, ctrl.getChannelWaves);
router.get('/me/bookmarks', authenticateToken, ctrl.getMyBookmarks);
router.get('/creator/lock-status', authenticateToken, ctrl.getCreatorLockStatus);
router.post('/creator/lock-pay', authenticateToken, ctrl.payCreatorLock);
router.get('/:waveId/thumbnail', optionalAuth, ctrl.getWaveThumbnail);
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
router.patch('/:waveId/comments/:commentId', authenticateToken, ctrl.editComment);
router.delete('/:waveId/comments/:commentId', authenticateToken, ctrl.deleteComment);
router.get('/:waveId/comments/:commentId/replies', optionalAuth, ctrl.getReplies);
router.post('/:waveId/comments/:commentId/reaction', authenticateToken, ctrl.toggleCommentReaction);
// Channel-owner commenter moderation (ban/unban a user from commenting)
router.post('/:waveId/comment-bans/:userId', authenticateToken, ctrl.banCommenter);
router.delete('/:waveId/comment-bans/:userId', authenticateToken, ctrl.unbanCommenter);

// ─── Bookmarks ───────────────────────────────────────────────────────────────
router.get('/:waveId/bookmark', authenticateToken, ctrl.getBookmarkStatus);
router.post('/:waveId/bookmark', authenticateToken, ctrl.toggleBookmark);

// ─── Signals ─────────────────────────────────────────────────────────────────
router.post('/:waveId/interest', authenticateToken, ctrl.setInterest);
router.post('/:waveId/report', authenticateToken, ctrl.reportWave);
router.post('/:waveId/classification-report', authenticateToken, ctrl.reportWave);

// ─── Admin ─────────────────────────────────────────────────────────────────────
router.post('/admin/regenerate-thumbnails', authenticateToken, ctrl.regenerateMissingThumbnails);
router.post('/channel/:channelId/regenerate-thumbnails', authenticateToken, ctrl.regenerateChannelThumbnails);
router.post('/:waveId/thumbnail', authenticateToken, upload.single('thumbnail'), uploadSingleToGCS, ctrl.uploadWaveThumbnail);

module.exports = router;
