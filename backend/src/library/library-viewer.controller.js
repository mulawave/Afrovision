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
const { extractGCSPath, getPublicUrl, getGCSObjectMetadata } = require('../utils/gcs');
const Channel = require('../channels/channel.model');

const db = {
  collection: (...args) => admin.firestore().collection(...args),
};
const libraryService = new LibraryService();
const policyService = new LibraryPolicyService();

async function enforceLibraryRollout(userId, res, isChannelAdmin = false) {
  if (isChannelAdmin) return true;
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);
    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    const { seriesId, contentType, tags, page = 1, limit = 20 } = req.query;
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryList(userId, channelId, isChannelAdmin);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this channel library',
      });
    }

    const offset = (pageNumber - 1) * limitNumber;
    let items = [];
    let total = 0;

    const mapDoc = (doc) => ({
      ...doc.data(),
      id: doc.id,
    });

    // Display order follows the creator-defined sequence (seriesOrderIndex, set by
    // Seq Up/Down), with createdAt as a tiebreaker so it matches the reader's
    // next/previous navigation order.
    const sortBySequence = (list) =>
      list.sort((left, right) => {
        const leftIndex = Number(left.seriesOrderIndex ?? 0);
        const rightIndex = Number(right.seriesOrderIndex ?? 0);
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        const leftAt = new Date(left.createdAt || 0).getTime();
        const rightAt = new Date(right.createdAt || 0).getTime();
        return rightAt - leftAt;
      });

    try {
      // Preferred path: rely on the equality filters and order in memory by the
      // creator-defined sequence (avoids needing a composite ordering index).
      let query = db.collection('channel_library_items').where('channelId', '==', channelId);
      query = query.where('status', '==', 'published');

      if (seriesId) {
        query = query.where('seriesId', '==', seriesId);
      }

      if (contentType) {
        query = query.where('contentType', '==', contentType);
      }

      const snapshot = await query.get();
      const ordered = sortBySequence(snapshot.docs.map(mapDoc));
      total = ordered.length;
      items = ordered.slice(offset, offset + limitNumber);
    } catch (queryError) {
      console.warn('Library list index fallback:', queryError.message);

      // Fallback path: fetch by channel only, then filter/sort in memory.
      const fallbackSnap = await db
        .collection('channel_library_items')
        .where('channelId', '==', channelId)
        .get();

      const filtered = sortBySequence(
        fallbackSnap.docs
          .map(mapDoc)
          .filter((item) => item.status === 'published')
          .filter((item) => (seriesId ? item.seriesId === seriesId : true))
          .filter((item) => (contentType ? item.contentType === contentType : true))
      );

      total = filtered.length;
      items = filtered.slice(offset, offset + limitNumber);
    }

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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryItemDetail(userId, channelId, itemId, isChannelAdmin);
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

    // Progress and navigation are helpful, but they should never block the detail response.
    let progress = null;
    try {
      progress = await libraryService.getReaderProgress(userId, channelId, itemId);
    } catch (progressError) {
      console.warn('Error getting library reader progress:', progressError);
    }

    // Get all items in same series for next/previous navigation
    let previousItemId = null;
    let nextItemId = null;

    try {
      if (item.seriesId) {
        const loadSeriesItems = async (useFallback = false) => {
          if (!useFallback) {
            return db
              .collection('channel_library_items')
              .where('seriesId', '==', item.seriesId)
              .where('status', '==', 'published')
              .orderBy('seriesOrderIndex', 'asc')
              .get();
          }

          return db
            .collection('channel_library_items')
            .where('seriesId', '==', item.seriesId)
            .get();
        };

        let seriesItems;
        try {
          seriesItems = await loadSeriesItems(false);
        } catch (seriesError) {
          console.warn('Library series navigation index fallback:', seriesError.message);
          seriesItems = await loadSeriesItems(true);
        }

        const seriesEntries = seriesItems.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((entry) => entry.status === 'published')
          .sort((left, right) => {
            const leftIndex = Number(left.seriesOrderIndex ?? 0);
            const rightIndex = Number(right.seriesOrderIndex ?? 0);
            if (leftIndex !== rightIndex) return leftIndex - rightIndex;
            return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
          });

        const itemIds = seriesEntries.map((entry) => entry.id);
        const currentIndex = itemIds.indexOf(itemId);

        if (currentIndex > 0) {
          previousItemId = itemIds[currentIndex - 1];
        }
        if (currentIndex < itemIds.length - 1) {
          nextItemId = itemIds[currentIndex + 1];
        }
      } else {
        const loadSingleItems = async (useFallback = false) => {
          if (!useFallback) {
            return db
              .collection('channel_library_items')
              .where('channelId', '==', channelId)
              .where('status', '==', 'published')
              .where('seriesId', '==', null)
              .orderBy('createdAt', 'desc')
              .get();
          }

          return db
            .collection('channel_library_items')
            .where('channelId', '==', channelId)
            .get();
        };

        let nextQuery;
        try {
          nextQuery = await loadSingleItems(false);
        } catch (singleError) {
          console.warn('Library item navigation index fallback:', singleError.message);
          nextQuery = await loadSingleItems(true);
        }

        const items = nextQuery.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((entry) => entry.status === 'published')
          .filter((entry) => entry.seriesId == null)
          .sort((left, right) => {
            const leftAt = new Date(left.createdAt || 0).getTime();
            const rightAt = new Date(right.createdAt || 0).getTime();
            return rightAt - leftAt;
          })
          .map((entry) => entry.id);

        const currentIndex = items.indexOf(itemId);

        if (currentIndex > 0) {
          previousItemId = items[currentIndex - 1];
        }
        if (currentIndex < items.length - 1) {
          nextItemId = items[currentIndex + 1];
        }
      }
    } catch (navigationError) {
      console.warn('Error getting library item navigation:', navigationError);
    }

    libraryService.recordEngagementEvent(userId, channelId, itemId, 'item-opened', {
      itemId,
    }).catch((engagementError) => {
      console.warn('Error recording library item open:', engagementError);
    });

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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Strict entitlement check for reader access
    const canAccess = await policyService.canAccessReader(userId, channelId, itemId, isChannelAdmin);
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

    const objectPath = extractGCSPath(manifestPath)
      || (!/^https?:\/\//i.test(String(manifestPath || '')) ? String(manifestPath) : null);

    if (!objectPath) {
      return res.status(200).json({
        success: true,
        data: {
          manifestUrl: manifestPath,
          itemId,
          totalPages: item.totalPages,
        },
      });
    }

    const metadata = await getGCSObjectMetadata(objectPath);
    if (!metadata) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Reader manifest not found',
      });
    }

    // Return public GCS URL (bucket is public; no signing needed)
    const publicUrl = getPublicUrl(objectPath);

    // Record engagement event
    await libraryService.recordEngagementEvent(userId, channelId, itemId, 'read-start', {
      manifestFetched: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        manifestUrl: publicUrl,
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = isChannelAdmin || await policyService.hasLibraryAccess(userId, channelId);
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = isChannelAdmin || await policyService.hasLibraryAccess(userId, channelId);
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = isChannelAdmin || await policyService.hasLibraryAccess(userId, channelId);
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = isChannelAdmin || await policyService.hasLibraryAccess(userId, channelId);
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const canFav = isChannelAdmin || await policyService.canModifyFavorites(userId, channelId, itemId);
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
    const isChannelAdmin = await policyService.canManageLibrary(userId, channelId);

    if (!(await enforceLibraryRollout(userId, res, isChannelAdmin))) {
      return;
    }

    // Entitlement check
    const hasAccess = await policyService.canViewLibraryList(userId, channelId, isChannelAdmin);
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

/**
 * GET /library/feed
 * Global public library feed — aggregates published library items from:
 *  1. Public, non-exclusive channels (always implicitly public)
 *  2. Any channel where the item has isPublic=true (opt-in)
 * Supports pagination and optional contentType filter.
 */
/**
 * GET /me/library/continue-reading
 * "Continue reading" rail: this user's in-progress items across all
 * channels, most recently read first.
 */
exports.getContinueReading = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 12));
    const records = await libraryService.getContinueReadingForUser(userId, limit);
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Error getting continue-reading list:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

exports.listPublicLibrary = async (req, res) => {
  try {
    const { page = 1, limit = 24, contentType } = req.query;
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));

    // 1. Get all public non-exclusive channels
    const publicChannels = await Channel.getPublicChannels();
    const publicNonExclusiveIds = publicChannels
      .filter((ch) => ch.type === 'public' && Number(ch.exclusive_monthly_fee_ngn || 0) === 0)
      .map((ch) => ch.id);

    const mapDoc = (doc) => ({ ...doc.data(), id: doc.id });
    const seenIds = new Set();
    let allItems = [];

    // 2. Fetch items from public non-exclusive channels (chunked for Firestore 'in' limit of 30)
    for (let i = 0; i < publicNonExclusiveIds.length; i += 30) {
      const chunk = publicNonExclusiveIds.slice(i, i + 30);
      let q = db
        .collection('channel_library_items')
        .where('channelId', 'in', chunk)
        .where('status', '==', 'published');

      if (contentType) {
        q = q.where('contentType', '==', contentType);
      }

      const snap = await q.get();
      for (const doc of snap.docs) {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          allItems.push(mapDoc(doc));
        }
      }
    }

    // 3. Fetch items opted-in via isPublic=true from any channel (including exclusive/private)
    let optInQuery = db
      .collection('channel_library_items')
      .where('isPublic', '==', true)
      .where('status', '==', 'published');

    if (contentType) {
      optInQuery = optInQuery.where('contentType', '==', contentType);
    }

    const optInSnap = await optInQuery.get();
    for (const doc of optInSnap.docs) {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        allItems.push(mapDoc(doc));
      }
    }

    // 4. Sort by publishedAt desc (fallback to createdAt)
    allItems.sort((a, b) => {
      const aMs = a.publishedAt && typeof a.publishedAt.toMillis === 'function'
        ? a.publishedAt.toMillis()
        : new Date(a.createdAt || 0).getTime();
      const bMs = b.publishedAt && typeof b.publishedAt.toMillis === 'function'
        ? b.publishedAt.toMillis()
        : new Date(b.createdAt || 0).getTime();
      return bMs - aMs;
    });

    // 5. Paginate
    const total = allItems.length;
    const offset = (pageNumber - 1) * limitNumber;
    const items = allItems.slice(offset, offset + limitNumber);

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
    console.error('Error listing public library feed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
