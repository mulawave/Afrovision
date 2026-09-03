/**
 * Library Routes
 * Wires up all library endpoints: creator, admin, and viewer APIs
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../utils/jwt');

const creatorController = require('./library-creator.controller');
const viewerController = require('./library-viewer.controller');

// ============================================
// CREATOR/ADMIN ROUTES
// ============================================

/**
 * Series Management
 */

// Create series
router.post('/creator/channels/:channelId/library/series', authenticateToken, creatorController.createSeries);

// List series
router.get('/creator/channels/:channelId/library/series', authenticateToken, creatorController.listSeries);

// Update series
router.patch(
  '/creator/channels/:channelId/library/series/:seriesId',
  authenticateToken,
  creatorController.updateSeries
);

/**
 * Item Management
 */

// Create item
router.post('/creator/channels/:channelId/library/items', authenticateToken, creatorController.createItem);

// Create signed upload URL for library assets (cover image or reader manifest)
router.post('/creator/channels/:channelId/library/upload-url', authenticateToken, creatorController.createAssetUploadUrl);

// Direct server-side upload for library assets (covers, page images).
// File flows browser -> backend -> GCS, avoiding all browser-to-GCS CORS issues.
const libraryAssetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
router.post(
  '/creator/channels/:channelId/library/assets',
  authenticateToken,
  libraryAssetUpload.single('file'),
  creatorController.uploadAssetDirect
);

// Auto-generate reader manifest from uploaded PDF/pages
router.post('/creator/channels/:channelId/library/reader-assets/manifest', authenticateToken, creatorController.generateReaderManifest);

// List items
router.get('/creator/channels/:channelId/library/items', authenticateToken, creatorController.listItems);

// Update item metadata
router.patch(
  '/creator/channels/:channelId/library/items/:itemId',
  authenticateToken,
  creatorController.updateItem
);

// Publish item
router.post(
  '/creator/channels/:channelId/library/items/:itemId/publish',
  authenticateToken,
  creatorController.publishItem
);

// Archive item
router.post(
  '/creator/channels/:channelId/library/items/:itemId/archive',
  authenticateToken,
  creatorController.archiveItem
);

// Delete item
router.delete(
  '/creator/channels/:channelId/library/items/:itemId',
  authenticateToken,
  creatorController.deleteItem
);

/**
 * Reordering & Metrics
 */

// Reorder items and series
router.patch(
  '/creator/channels/:channelId/library/order',
  authenticateToken,
  creatorController.reorderContent
);

// Get library metrics
router.get(
  '/creator/channels/:channelId/library/metrics',
  authenticateToken,
  creatorController.getMetrics
);

// ============================================
// VIEWER ROUTES
// ============================================

/**
 * Public Library Feed (global)
 */

// Global public library feed — no auth required
router.get('/library/feed', optionalAuth, viewerController.listPublicLibrary);

/**
 * Library Listing & Detail
 */

// List library items with filters
router.get('/channels/:channelId/library', authenticateToken, viewerController.listItems);

// Get recommendations (must be before :itemId route)
router.get(
  '/channels/:channelId/library/recommendations',
  authenticateToken,
  viewerController.getRecommendations
);

// Get item detail with navigation
router.get('/channels/:channelId/library/:itemId', authenticateToken, viewerController.getItemDetail);

/**
 * Reader Access
 */

// Get reader manifest (signed URLs)
router.get(
  '/channels/:channelId/library/:itemId/reader-manifest',
  authenticateToken,
  viewerController.getReaderManifest
);

/**
 * Reading Progress
 */

// Get reading progress
router.get(
  '/channels/:channelId/library/:itemId/progress',
  authenticateToken,
  viewerController.getProgress
);

// Update reading progress (autosave)
router.put(
  '/channels/:channelId/library/:itemId/progress',
  authenticateToken,
  viewerController.updateProgress
);

/**
 * Bookmarks
 */

// Create bookmark
router.post(
  '/channels/:channelId/library/:itemId/bookmarks',
  authenticateToken,
  viewerController.createBookmark
);

// List bookmarks for item
router.get(
  '/channels/:channelId/library/:itemId/bookmarks',
  authenticateToken,
  viewerController.listBookmarks
);

// Delete bookmark
router.delete(
  '/channels/:channelId/library/:itemId/bookmarks/:bookmarkId',
  authenticateToken,
  viewerController.deleteBookmark
);

/**
 * Favorites
 */

// Add to favorites
router.post(
  '/channels/:channelId/library/:itemId/favorite',
  authenticateToken,
  viewerController.addToFavorites
);

// Remove from favorites
router.delete(
  '/channels/:channelId/library/:itemId/favorite',
  authenticateToken,
  viewerController.removeFromFavorites
);

// ============================================
// USER ACCOUNT ROUTES
// ============================================

/**
 * GET /me/favorites/library
 * Get user's favorites across all channels (filtered by entitlement)
 */
router.get('/me/favorites/library', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const LibraryFavoritesService = require('./library-favorites.service');
    const favService = new LibraryFavoritesService();

    const favorites = await favService.getFavoritesByEntitlement(userId);

    return res.status(200).json({
      success: true,
      data: favorites,
    });
  } catch (error) {
    console.error('Error getting user favorites:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /me/library/stats
 * Get user's reading statistics
 */
router.get('/me/library/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const LibraryFavoritesService = require('./library-favorites.service');
    const favService = new LibraryFavoritesService();

    const stats = await favService.getUserReadingStats(userId);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting reading stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
