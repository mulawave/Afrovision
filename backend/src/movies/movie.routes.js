/**
 * Movie Routes
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../utils/jwt');

const creatorController = require('./movie-creator.controller');
const viewerController = require('./movie-viewer.controller');

const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── Public/global ────────────────────────────────────────
router.get('/movies', optionalAuth, viewerController.listPublicMovies);
router.get('/movies/:movieId', optionalAuth, viewerController.getMovieById);

// ── Channel-scoped viewer ────────────────────────────────
router.get('/channels/:channelId/movies', optionalAuth, viewerController.listChannelMovies);
router.get('/channels/:channelId/movies/:movieId', optionalAuth, viewerController.getMovieDetail);

// ── Creator/admin ────────────────────────────────────────
router.post('/creator/channels/:channelId/movies', authenticateToken, creatorController.createMovie);
router.get('/creator/channels/:channelId/movies', authenticateToken, creatorController.listCreatorMovies);
router.patch('/creator/channels/:channelId/movies/:movieId', authenticateToken, creatorController.updateMovie);
router.post('/creator/channels/:channelId/movies/:movieId/publish', authenticateToken, creatorController.publishMovie);
router.post('/creator/channels/:channelId/movies/:movieId/archive', authenticateToken, creatorController.archiveMovie);
router.delete('/creator/channels/:channelId/movies/:movieId', authenticateToken, creatorController.deleteMovie);

router.post(
  '/creator/channels/:channelId/movies/resumable-session',
  authenticateToken,
  creatorController.createResumableSession
);
router.post(
  '/creator/channels/:channelId/movies/resumable-complete',
  authenticateToken,
  creatorController.completeResumableSession
);
router.post(
  '/creator/channels/:channelId/movies/poster',
  authenticateToken,
  posterUpload.single('file'),
  creatorController.uploadPosterDirect
);

module.exports = router;
