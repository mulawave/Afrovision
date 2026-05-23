const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./broadcast.controller');
const { videoUpload, uploadVideoToGCS } = require('./video.upload');
const { upload, uploadSingleToGCS } = require('../utils/upload');

const router = Router();

// Server time (public — no auth needed for sync)
router.get('/time', ctrl.getServerTime);

// Flash screen TTS audio (public)
router.get('/flash-audio', ctrl.getFlashAudio);

// Upcoming shows across all channels (public)
router.get('/upcoming', ctrl.getUpcomingAll);

// Video management (creator)
router.post('/videos/upload-url', authenticateToken, ctrl.getVideoUploadUrl);
router.post('/videos/resumable-session', authenticateToken, ctrl.createVideoResumableSession);
router.patch('/videos/upload-sessions/:sessionId/progress', authenticateToken, ctrl.updateVideoUploadSessionProgress);
router.delete('/videos/upload-sessions/:sessionId', authenticateToken, ctrl.cancelVideoUploadSession);
router.post('/videos/resumable-complete', authenticateToken, ctrl.completeVideoResumableSession);
router.get('/videos/upload-sessions', authenticateToken, ctrl.getMyVideoUploadSessions);
router.post('/videos/register', authenticateToken, ctrl.registerUploadedVideo);
router.post('/videos', authenticateToken, videoUpload.single('video'), uploadVideoToGCS, ctrl.uploadVideo);
router.get('/videos/me', authenticateToken, ctrl.getMyVideos);
router.get('/videos/channel/:channelId', authenticateToken, ctrl.getChannelVideos);
router.post(
  '/videos/:videoId/thumbnail',
  authenticateToken,
  upload.single('file'),
  uploadSingleToGCS,
  ctrl.uploadThumbnail
);
router.delete('/videos/:videoId', authenticateToken, ctrl.deleteVideo);

// Schedule management (creator)
router.post('/schedule', authenticateToken, ctrl.scheduleProgram);
router.post('/schedule/sequential', authenticateToken, ctrl.scheduleSequential);
router.get('/schedule/:channelId', authenticateToken, ctrl.getChannelSchedule);
router.delete('/schedule/:programId', authenticateToken, ctrl.deleteProgram);

// Playback (viewer) — public for open channels, token is optional for user context
router.get('/now-playing/:channelId', optionalAuth, ctrl.getNowPlaying);

// Reminders (viewer)
router.get('/reminders/me', authenticateToken, ctrl.getMyReminders);
router.post('/reminders', authenticateToken, ctrl.createReminder);
router.delete('/reminders/:programId', authenticateToken, ctrl.removeReminder);

// Go-live notification trigger
router.post('/go-live', authenticateToken, ctrl.goLive);

module.exports = router;
