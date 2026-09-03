/**
 * Series Routes
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../utils/jwt');

const creatorController = require('./series-creator.controller');
const viewerController = require('./series-viewer.controller');

const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── Public/global ────────────────────────────────────────
router.get('/series', optionalAuth, viewerController.listPublicSeries);

// ── Channel-scoped viewer ────────────────────────────────
router.get('/channels/:channelId/series', optionalAuth, viewerController.listChannelSeries);
router.get('/channels/:channelId/series/:seriesId', optionalAuth, viewerController.getSeriesDetail);
router.get(
  '/channels/:channelId/series/:seriesId/episodes/:episodeId',
  optionalAuth,
  viewerController.getEpisodeDetail
);

// ── Creator/admin: Series ────────────────────────────────
router.post('/creator/channels/:channelId/series', authenticateToken, creatorController.createSeries);
router.get('/creator/channels/:channelId/series', authenticateToken, creatorController.listCreatorSeries);
router.patch('/creator/channels/:channelId/series/:seriesId', authenticateToken, creatorController.updateSeries);
router.post('/creator/channels/:channelId/series/:seriesId/publish', authenticateToken, creatorController.publishSeries);
router.post('/creator/channels/:channelId/series/:seriesId/archive', authenticateToken, creatorController.archiveSeries);
router.delete('/creator/channels/:channelId/series/:seriesId', authenticateToken, creatorController.deleteSeries);

// ── Creator/admin: Seasons ────────────────────────────────
router.post(
  '/creator/channels/:channelId/series/:seriesId/seasons',
  authenticateToken,
  creatorController.createSeason
);
router.patch(
  '/creator/channels/:channelId/series/:seriesId/seasons/:seasonId',
  authenticateToken,
  creatorController.updateSeason
);
router.delete(
  '/creator/channels/:channelId/series/:seriesId/seasons/:seasonId',
  authenticateToken,
  creatorController.deleteSeason
);

// ── Creator/admin: Episodes ────────────────────────────────
router.post(
  '/creator/channels/:channelId/series/:seriesId/seasons/:seasonId/episodes',
  authenticateToken,
  creatorController.createEpisode
);
router.patch(
  '/creator/channels/:channelId/series/:seriesId/episodes/:episodeId',
  authenticateToken,
  creatorController.updateEpisode
);
router.post(
  '/creator/channels/:channelId/series/:seriesId/episodes/:episodeId/publish',
  authenticateToken,
  creatorController.publishEpisode
);
router.post(
  '/creator/channels/:channelId/series/:seriesId/episodes/:episodeId/archive',
  authenticateToken,
  creatorController.archiveEpisode
);
router.delete(
  '/creator/channels/:channelId/series/:seriesId/episodes/:episodeId',
  authenticateToken,
  creatorController.deleteEpisode
);

// ── Creator/admin: Upload helpers ────────────────────────────────
router.post(
  '/creator/channels/:channelId/series/resumable-session',
  authenticateToken,
  creatorController.createResumableSession
);
router.post(
  '/creator/channels/:channelId/series/resumable-complete',
  authenticateToken,
  creatorController.completeResumableSession
);
router.post(
  '/creator/channels/:channelId/series/poster',
  authenticateToken,
  posterUpload.single('file'),
  creatorController.uploadPosterDirect
);

module.exports = router;
