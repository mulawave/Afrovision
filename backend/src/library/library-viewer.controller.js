/**
 * Library Viewer Controller
 * Handles viewer operations: list, detail, reader, progress, bookmarks, favorites
 *
 * All endpoints enforce entitlement gating via LibraryPolicyService
 */

const admin = require('firebase-admin');
const LibraryService = require('./library.service');
const LibraryPolicyService = require('./library-policy.service');
const { isLibraryRolloutEnabledForUser } = require('./library-rollout.service');

const db = {
  collection: (...args) => admin.firestore().collection(...args),
};
const libraryService = new LibraryService();
const policyService = new LibraryPolicyService();

async function enforceLibraryRollout(userId, res) {
  const enabled = await isLibraryRolloutEnabledForUser(userId);
  if (!enabled) {
    res.status(403).json({
      error: 'Feature unavailable',
      message: 'Library is not enabled for this account yet',
    });
    return false;
  }
  return true;
}

/**
 * List library items for a channel
 * GET /channels/:channelId/library?seriesId=xxx&contentType=book&tags=xxx&page=1&limit=20
 */
exports.listItems = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
        if (!(await enforceLibraryRollout(userId, res))) {
          return;
        }

    const { seriesId, contentType, tags, page = 1, limit = 20 } = req.query;
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryList(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this channel library',
      });
    }

    // Build query
    let query = db.collection('channel_library_items').where('channelId', '==', channelId);
    query = query.where('status', '==', 'published');

    if (seriesId) {
      query = query.where('seriesId', '==', seriesId);
    }

    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }

    // Fetch with pagination
    const offset = (pageNumber - 1) * limitNumber;
    const snapshot = await query.orderBy('createdAt', 'desc').offset(offset).limit(limitNumber).get();

    const items = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Get total count for pagination
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // Record engagement event
    await libraryService.recordEngagementEvent(userId, channelId, null, 'item-opened', {
      itemCount: items.length,
      seriesFilter: seriesId || null,
      contentTypeFilter: contentType || null,
    });

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          pages: Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error('Error listing library items:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get library item detail with full metadata
 * GET /channels/:channelId/library/:itemId
 * Returns: item metadata + previousItemId + nextItemId in filtered order
 */
exports.getItemDetail = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryItemDetail(userId, channelId, itemId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this content',
      });
    }

    // Get item
    const itemDoc = await db.collection('channel_library_items').doc(itemId).get();
    if (!itemDoc.exists || itemDoc.data().channelId !== channelId) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Library item not found',
      });
    }

    const item = { ...itemDoc.data(), id: itemDoc.id };

    // Get current reading progress
    const progress = await libraryService.getReaderProgress(userId, channelId, itemId);

    // Get all items in same series for next/previous navigation
    let previousItemId = null;
    let nextItemId = null;

    if (item.seriesId) {
      const seriesItems = await db
        .collection('channel_library_items')
        .where('seriesId', '==', item.seriesId)
        .where('status', '==', 'published')
        .orderBy('seriesOrderIndex', 'asc')
        .get();

      const items = seriesItems.docs.map((doc) => doc.id);
      const currentIndex = items.indexOf(itemId);

      if (currentIndex > 0) {
        previousItemId = items[currentIndex - 1];
      }
      if (currentIndex < items.length - 1) {
        nextItemId = items[currentIndex + 1];
      }
    } else {
      // Single items: get next by creation order
      const nextQuery = await db
        .collection('channel_library_items')
        .where('channelId', '==', channelId)
        .where('status', '==', 'published')
        .where('seriesId', '==', null)
        .orderBy('createdAt', 'desc')
        .get();

      const items = nextQuery.docs.map((doc) => doc.id);
      const currentIndex = items.indexOf(itemId);

      if (currentIndex > 0) {
        previousItemId = items[currentIndex - 1];
      }
      if (currentIndex < items.length - 1) {
        nextItemId = items[currentIndex + 1];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        item,
        progress,
        navigation: {
          previousItemId,
          nextItemId,
        },
      },
    });
  } catch (error) {
    console.error('Error getting library item detail:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get reader asset manifest with signed URLs
 * GET /channels/:channelId/library/:itemId/reader-manifest
 */
exports.getReaderManifest = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Strict entitlement check for reader access
    const canAccess = await policyService.canAccessReader(userId, channelId, itemId);
    if (!canAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to read this content',
      });
    }

    // Get item to find manifest path
    const itemDoc = await db.collection('channel_library_items').doc(itemId).get();
    if (!itemDoc.exists) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Library item not found',
      });
    }

    const item = itemDoc.data();
    const manifestPath = item.readerAssetManifestUrl;

    if (!manifestPath) {
      return res.status(400).json({
        error: 'Not available',
        message: 'Reader assets not yet available for this item',
      });
    }

    // Read manifest from GCS (or return signed URL to it)
    // For now, return manifest path for client to fetch
    const bucket = admin.storage().bucket();
    const file = bucket.file(manifestPath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Reader manifest not found',
      });
    }

    // Get signed URL with 1-hour expiry
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    // Record engagement event
    await libraryService.recordEngagementEvent(userId, channelId, itemId, 'read-start', {
      manifestFetched: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        manifestUrl: signedUrl,
        itemId,
        totalPages: item.totalPages,
      },
    });
  } catch (error) {
    console.error('Error getting reader manifest:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get or create reader progress
 * GET /channels/:channelId/library/:itemId/progress
 */
exports.getProgress = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this content',
      });
    }

    const progress = await libraryService.getReaderProgress(userId, channelId, itemId);

    return res.status(200).json({
      success: true,
      data: progress || {
        currentSpreadIndex: 0,
        currentPageLeft: null,
        currentPageRight: null,
        isCompleted: false,
      },
    });
  } catch (error) {
    console.error('Error getting reader progress:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Update reader progress (autosave on page flip)
 * PUT /channels/:channelId/library/:itemId/progress
 */
exports.updateProgress = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this content',
      });
    }

    const { currentSpreadIndex, currentPageLeft, currentPageRight, isCompleted } = req.body;

    const progress = await libraryService.upsertReaderProgress(userId, channelId, itemId, {
      currentSpreadIndex,
      currentPageLeft,
      currentPageRight,
      isCompleted,
    });

    // If completed, record completion event
    if (isCompleted) {
      await libraryService.recordEngagementEvent(userId, channelId, itemId, 'read-finish', {
        completedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Error updating reader progress:', error);
    return res.status(500).json({
      error: 'Invalid payload',
      message: error.message,
    });
  }
};

/**
 * Create bookmark
 * POST /channels/:channelId/library/:itemId/bookmarks
 */
exports.createBookmark = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this content',
      });
    }

    const { spreadIndex, page, note } = req.body;

    const bookmark = await libraryService.createBookmark(userId, channelId, itemId, {
      spreadIndex,
      page,
      note,
    });

    return res.status(201).json({
      success: true,
      data: bookmark,
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * List bookmarks for item
 * GET /channels/:channelId/library/:itemId/bookmarks
 */
exports.listBookmarks = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this content',
      });
    }

    const bookmarks = await libraryService.getBookmarksForItem(userId, itemId);

    return res.status(200).json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    console.error('Error listing bookmarks:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Delete bookmark
 * DELETE /channels/:channelId/library/:itemId/bookmarks/:bookmarkId
 */
exports.deleteBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const userId = req.userId;

    await libraryService.deleteBookmark(userId, bookmarkId);

    return res.status(200).json({
      success: true,
      message: 'Bookmark deleted',
    });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Add item to favorites
 * POST /channels/:channelId/library/:itemId/favorite
 */
exports.addToFavorites = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const canFav = await policyService.canModifyFavorites(userId, channelId, itemId);
    if (!canFav) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You cannot favorite this content',
      });
    }

    const favorite = await libraryService.addToFavorites(userId, channelId, itemId);

    return res.status(201).json({
      success: true,
      data: favorite,
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Remove item from favorites
 * DELETE /channels/:channelId/library/:itemId/favorite
 */
exports.removeFromFavorites = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    await libraryService.removeFromFavorites(userId, channelId, itemId);

    return res.status(200).json({
      success: true,
      message: 'Removed from favorites',
    });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get personalized recommendations
 * GET /channels/:channelId/library/recommendations
 */
exports.getRecommendations = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
    const { limit = 5 } = req.query;

    if (!(await enforceLibraryRollout(userId, res))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryList(userId, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this channel library',
      });
    }

    // Candidate pool: published items in channel
    const allItems = await db
      .collection('channel_library_items')
      .where('channelId', '==', channelId)
      .where('status', '==', 'published')
      .limit(Math.max(limit * 6, 20))
      .get();

    const candidates = allItems.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

    // Recent user reading context for relevance (last 30 reads)
    const progressSnap = await db
      .collection('library_reader_progress')
      .where('userId', '==', userId)
      .where('channelId', '==', channelId)
      .get();

    const progressByItem = new Map();
    const recentItemIds = [];
    progressSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aMs = a.lastReadAt && typeof a.lastReadAt.toMillis === 'function' ? a.lastReadAt.toMillis() : 0;
        const bMs = b.lastReadAt && typeof b.lastReadAt.toMillis === 'function' ? b.lastReadAt.toMillis() : 0;
        return bMs - aMs;
      })
      .slice(0, 30)
      .forEach((progress) => {
        progressByItem.set(progress.itemId, progress);
        recentItemIds.push(progress.itemId);
      });

    const recentItemSet = new Set(recentItemIds);

    const recentItems = candidates.filter((item) => recentItemSet.has(item.id));
    const preferredTags = new Set();
    const preferredTypes = new Set();
    recentItems.forEach((item) => {
      (item.tags || []).forEach((tag) => preferredTags.add(tag));
      if (item.contentType) preferredTypes.add(item.contentType);
    });

    const scored = candidates
      .filter((item) => {
        const progress = progressByItem.get(item.id);
        return !progress || progress.isCompleted !== true;
      })
      .map((item) => {
        let score = 0;
        const tagMatches = (item.tags || []).filter((tag) => preferredTags.has(tag)).length;
        if (tagMatches > 0) score += tagMatches * 5;
        if (preferredTypes.has(item.contentType)) score += 4;

        const progress = progressByItem.get(item.id);
        if (progress) {
          // Encourage resume for in-progress items.
          score += 8;
        }

        const publishedAt = item.publishedAt && typeof item.publishedAt.toMillis === 'function'
          ? item.publishedAt.toMillis()
          : 0;
        if (publishedAt > 0) {
          // Slight recency bonus.
          const ageDays = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
          score += Math.max(0, 3 - ageDays / 10);
        }

        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.item);

    const recommendations = scored;

    return res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
