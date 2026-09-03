/**
 * Library Service
 * Core CRUD operations for library items, series, progress, bookmarks, and favorites
 *
 * Dependencies: Firestore, GCS, entitlement checks
 */

const admin = require('firebase-admin');
const ExclusiveAccess = require('../channels/exclusive_access.model');
const NotificationService = require('../notifications/notification.service');
const {
  COLLECTION_PATHS,
  DocumentHelpers,
  ValidationRules,
} = require('./library.model');

const db = {
  collection: (...args) => admin.firestore().collection(...args),
};

async function notifyLibrarySubscribers(channelId, item, userId, action = 'published') {
  const activeAccesses = await ExclusiveAccess.listActiveAccesses();
  const targetUserIds = activeAccesses
    .filter((access) => String(access.channel_id) === String(channelId))
    .map((access) => access.user_uid)
    .filter(Boolean);

  if (targetUserIds.length === 0) {
    return { targeted: 0, successCount: 0, failureCount: 0, notifications: [] };
  }

  const title = `New Library Item: ${item.title}`;
  const body = `${item.author} just ${action === 'published' ? 'published' : 'added'} ${item.title}.`;
  const link = `/channel/${channelId}/library/${item.id}`;

  return NotificationService.notifyUsers(targetUserIds, {
    title,
    body,
    data: {
      channel_id: String(channelId),
      item_id: String(item.id),
      item_title: String(item.title || ''),
      content_type: String(item.contentType || ''),
      action,
    },
    type: 'library',
    link,
    source: 'library_publish',
    createdBy: userId,
  });
}

class LibraryService {
  /**
   * Create library item (creator/admin only)
   * @param {string} channelId
   * @param {object} itemPayload
   * @param {string} userId - creator user ID
   * @returns {Promise<object>} created item
   */
  async createLibraryItem(channelId, itemPayload, userId) {
    // Auto-compute seriesOrderIndex when a seriesId is provided but no index was supplied.
    // Place the new item at the end of the series (count of existing items in that series).
    let resolvedPayload = itemPayload;
    if (itemPayload.seriesId && itemPayload.seriesOrderIndex === undefined) {
      const existingSnap = await db
        .collection(COLLECTION_PATHS.LIBRARY_ITEMS)
        .where('channelId', '==', channelId)
        .where('seriesId', '==', itemPayload.seriesId)
        .get();
      resolvedPayload = { ...itemPayload, seriesOrderIndex: existingSnap.size };
    }

    const { valid, errors } = ValidationRules.validateItemPayload(resolvedPayload);
    if (!valid) {
      throw new Error(`Invalid item payload: ${errors.join(', ')}`);
    }

    const itemId = DocumentHelpers.generateItemId();
    const now = admin.firestore.Timestamp.now();

    const itemData = {
      id: itemId,
      channelId,
      seriesId: resolvedPayload.seriesId || null,
      seriesOrderIndex: resolvedPayload.seriesOrderIndex !== undefined ? resolvedPayload.seriesOrderIndex : 0,
      contentType: resolvedPayload.contentType,
      title: resolvedPayload.title.trim(),
      subtitle: resolvedPayload.subtitle || null,
      author: resolvedPayload.author.trim(),
      description: resolvedPayload.description || '',
      tags: Array.isArray(resolvedPayload.tags) ? resolvedPayload.tags : [],
      coverAssetUrl: resolvedPayload.coverAssetUrl || null,
      readerAssetManifestUrl: resolvedPayload.readerAssetManifestUrl || null,
      totalPages: resolvedPayload.totalPages,
      estimatedReadMinutes: resolvedPayload.estimatedReadMinutes || 0,
      status: resolvedPayload.status || 'draft', // default draft
      publishedAt: null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      isPublic: !!resolvedPayload.isPublic,
      // Engagement counters
      totalReads: 0,
      totalFavorites: 0,
      avgReadingDuration: 0,
      completionRate: 0,
    };

    await db.collection(COLLECTION_PATHS.LIBRARY_ITEMS).doc(itemId).set(itemData);

    // Audit log
    await this._auditLog('library_item_created', {
      channelId,
      itemId,
      userId,
      status: itemData.status,
    });

    if (itemData.status === 'published') {
      notifyLibrarySubscribers(channelId, itemData, userId, 'published').catch((error) => {
        console.warn('Library publish notification fanout failed after create:', error);
      });
    }

    return itemData;
  }

  /**
   * Update library item metadata
   * @param {string} channelId
   * @param {string} itemId
   * @param {object} updates
   * @param {string} userId - editor user ID
   * @returns {Promise<object>} updated item
   */
  async updateLibraryItem(channelId, itemId, updates, userId) {
    // Verify item exists and belongs to channel
    const itemRef = db.collection(COLLECTION_PATHS.LIBRARY_ITEMS).doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists || itemSnap.data().channelId !== channelId) {
      throw new Error(`Library item not found: ${itemId}`);
    }

    const allowedFields = [
      'title',
      'subtitle',
      'author',
      'description',
      'tags',
      'estimatedReadMinutes',
      'contentType',
      'totalPages',
      'seriesId',
      'seriesOrderIndex',
      'coverAssetUrl',
      'readerAssetManifestUrl',
      'status',
      'isPublic',
    ];
    const sanitizedUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    sanitizedUpdates.updatedBy = userId;
    sanitizedUpdates.updatedAt = admin.firestore.Timestamp.now();

    await itemRef.update(sanitizedUpdates);

    // Audit log
    await this._auditLog('library_item_updated', {
      channelId,
      itemId,
      userId,
      fields: Object.keys(sanitizedUpdates),
    });

    // Return updated document
    const updated = await itemRef.get();
    return updated.data();
  }

  /**
   * Publish library item (make visible to users)
   * @param {string} channelId
   * @param {string} itemId
   * @param {string} userId
   * @returns {Promise<object>} published item
   */
  async publishLibraryItem(channelId, itemId, userId) {
    const itemRef = db.collection(COLLECTION_PATHS.LIBRARY_ITEMS).doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists || itemSnap.data().channelId !== channelId) {
      throw new Error(`Library item not found: ${itemId}`);
    }

    const wasAlreadyPublished = itemSnap.data().status === 'published';

    const now = admin.firestore.Timestamp.now();
    await itemRef.update({
      status: 'published',
      publishedAt: now,
      updatedBy: userId,
      updatedAt: now,
    });

    await this._auditLog('library_item_published', {
      channelId,
      itemId,
      userId,
    });

    if (!wasAlreadyPublished) {
      const updatedItem = await itemRef.get();
      notifyLibrarySubscribers(channelId, updatedItem.data(), userId, 'published').catch((error) => {
        console.warn('Library publish notification fanout failed:', error);
      });
    }

    const updated = await itemRef.get();
    return updated.data();
  }

  /**
   * Archive library item (hide from viewers)
   * @param {string} channelId
   * @param {string} itemId
   * @param {string} userId
   * @returns {Promise<object>} archived item
   */
  async archiveLibraryItem(channelId, itemId, userId) {
    const itemRef = db.collection(COLLECTION_PATHS.LIBRARY_ITEMS).doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists || itemSnap.data().channelId !== channelId) {
      throw new Error(`Library item not found: ${itemId}`);
    }

    const now = admin.firestore.Timestamp.now();
    await itemRef.update({
      status: 'archived',
      updatedBy: userId,
      updatedAt: now,
    });

    await this._auditLog('library_item_archived', {
      channelId,
      itemId,
      userId,
    });

    const updated = await itemRef.get();
    return updated.data();
  }

  /**
   * Delete library item (and all associated data)
   * @param {string} channelId
   * @param {string} itemId
   * @param {string} userId
   */
  async deleteLibraryItem(channelId, itemId, userId) {
    const itemRef = db.collection(COLLECTION_PATHS.LIBRARY_ITEMS).doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists || itemSnap.data().channelId !== channelId) {
      throw new Error(`Library item not found: ${itemId}`);
    }

    // Delete item
    await itemRef.delete();

    // Delete associated progress records
    const progressDocs = await db
      .collection(COLLECTION_PATHS.READER_PROGRESS)
      .where('itemId', '==', itemId)
      .get();
    for (const doc of progressDocs.docs) {
      await doc.ref.delete();
    }

    // Delete associated bookmarks
    const bookmarkDocs = await db
      .collection(COLLECTION_PATHS.BOOKMARKS)
      .where('itemId', '==', itemId)
      .get();
    for (const doc of bookmarkDocs.docs) {
      await doc.ref.delete();
    }

    // Delete associated favorites
    const favDocs = await db
      .collection(COLLECTION_PATHS.FAVORITE_ITEMS)
      .where('itemId', '==', itemId)
      .get();
    for (const doc of favDocs.docs) {
      await doc.ref.delete();
    }

    await this._auditLog('library_item_deleted', {
      channelId,
      itemId,
      userId,
    });
  }

  /**
   * Create or update reader progress
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @param {object} progressData - { currentSpreadIndex, currentPageLeft, currentPageRight, isCompleted }
   * @returns {Promise<object>} progress record
   */
  async upsertReaderProgress(userId, channelId, itemId, progressData) {
    const { valid, errors } = ValidationRules.validateProgressPayload(progressData);
    if (!valid) {
      throw new Error(`Invalid progress payload: ${errors.join(', ')}`);
    }

    const progressId = DocumentHelpers.generateProgressId(userId, channelId, itemId);
    const now = admin.firestore.Timestamp.now();

    const progress = {
      id: progressId,
      userId,
      channelId,
      itemId,
      currentSpreadIndex: progressData.currentSpreadIndex,
      currentPageLeft: progressData.currentPageLeft || null,
      currentPageRight: progressData.currentPageRight || null,
      isCompleted: progressData.isCompleted || false,
      lastReadAt: now,
      updatedAt: now,
    };

    // Set create timestamp only on first write
    const existingRef = db.collection(COLLECTION_PATHS.READER_PROGRESS).doc(progressId);
    const existing = await existingRef.get();
    if (!existing.exists) {
      progress.createdAt = now;
    }

    await existingRef.set(progress, { merge: true });
    return progress;
  }

  /**
   * Get reader progress
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @returns {Promise<object|null>} progress or null if not found
   */
  async getReaderProgress(userId, channelId, itemId) {
    const progressId = DocumentHelpers.generateProgressId(userId, channelId, itemId);
    const doc = await db.collection(COLLECTION_PATHS.READER_PROGRESS).doc(progressId).get();
    return doc.exists ? doc.data() : null;
  }

  /**
   * Create bookmark
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @param {object} bookmarkData - { spreadIndex, page, note }
   * @returns {Promise<object>} bookmark
   */
  async createBookmark(userId, channelId, itemId, bookmarkData) {
    const bookmarkId = DocumentHelpers.generateBookmarkId();
    const now = admin.firestore.Timestamp.now();

    const bookmark = {
      id: bookmarkId,
      userId,
      channelId,
      itemId,
      spreadIndex: bookmarkData.spreadIndex,
      page: bookmarkData.page || null,
      note: bookmarkData.note || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(COLLECTION_PATHS.BOOKMARKS).doc(bookmarkId).set(bookmark);

    // Record engagement event
    await this.recordEngagementEvent(userId, channelId, itemId, 'bookmark-created', {
      bookmarkId,
      spreadIndex: bookmarkData.spreadIndex,
    });

    return bookmark;
  }

  /**
   * Delete bookmark
   * @param {string} userId
   * @param {string} bookmarkId
   */
  async deleteBookmark(userId, bookmarkId) {
    const bookmarkRef = db.collection(COLLECTION_PATHS.BOOKMARKS).doc(bookmarkId);
    const bookmarkSnap = await bookmarkRef.get();
    if (!bookmarkSnap.exists || bookmarkSnap.data().userId !== userId) {
      throw new Error(`Bookmark not found or unauthorized: ${bookmarkId}`);
    }

    await bookmarkRef.delete();
  }

  /**
   * Get bookmarks for item
   * @param {string} userId
   * @param {string} itemId
   * @returns {Promise<object[]>} bookmarks
   */
  async getBookmarksForItem(userId, itemId) {
    const docs = await db
      .collection(COLLECTION_PATHS.BOOKMARKS)
      .where('userId', '==', userId)
      .where('itemId', '==', itemId)
      .orderBy('spreadIndex', 'asc')
      .get();
    return docs.docs.map((d) => d.data());
  }

  /**
   * Add item to favorites
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @returns {Promise<object>} favorite record
   */
  async addToFavorites(userId, channelId, itemId) {
    const favoriteId = DocumentHelpers.generateFavoriteId(userId, channelId, itemId);
    const now = admin.firestore.Timestamp.now();

    const favorite = {
      id: favoriteId,
      userId,
      channelId,
      itemId,
      addedAt: now,
      createdAt: now,
    };

    await db.collection(COLLECTION_PATHS.FAVORITE_ITEMS).doc(favoriteId).set(favorite);

    // Update item's favorite count
    await db
      .collection(COLLECTION_PATHS.LIBRARY_ITEMS)
      .doc(itemId)
      .update({
        totalFavorites: admin.firestore.FieldValue.increment(1),
      });

    // Record engagement event
    await this.recordEngagementEvent(userId, channelId, itemId, 'favorite-added', {
      itemId,
    });

    return favorite;
  }

  /**
   * Remove item from favorites
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   */
  async removeFromFavorites(userId, channelId, itemId) {
    const favoriteId = DocumentHelpers.generateFavoriteId(userId, channelId, itemId);
    const favoriteRef = db.collection(COLLECTION_PATHS.FAVORITE_ITEMS).doc(favoriteId);

    const fav = await favoriteRef.get();
    if (!fav.exists) {
      throw new Error(`Favorite not found: ${favoriteId}`);
    }

    await favoriteRef.delete();

    // Update item's favorite count
    await db
      .collection(COLLECTION_PATHS.LIBRARY_ITEMS)
      .doc(itemId)
      .update({
        totalFavorites: admin.firestore.FieldValue.increment(-1),
      });

    // Record engagement event
    await this.recordEngagementEvent(userId, channelId, itemId, 'favorite-removed', {
      itemId,
    });
  }

  /**
   * Check if item is in favorites
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @returns {Promise<boolean>}
   */
  async isInFavorites(userId, channelId, itemId) {
    const favoriteId = DocumentHelpers.generateFavoriteId(userId, channelId, itemId);
    const doc = await db.collection(COLLECTION_PATHS.FAVORITE_ITEMS).doc(favoriteId).get();
    return doc.exists;
  }

  /**
   * Record engagement event for analytics
   * @param {string} userId
   * @param {string} channelId
   * @param {string|null} itemId
   * @param {string} eventType - from ValidationRules.eventTypes
   * @param {object} metadata
   */
  async recordEngagementEvent(userId, channelId, itemId, eventType, metadata = {}) {
    if (!ValidationRules.eventTypes.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }

    const eventId = DocumentHelpers.generateEventId();
    const event = {
      id: eventId,
      userId,
      channelId,
      itemId: itemId || null,
      eventType,
      metadata,
      timestamp: admin.firestore.Timestamp.now(),
    };

    await db.collection(COLLECTION_PATHS.ENGAGEMENT_EVENTS).doc(eventId).set(event);
  }

  /**
   * Create library series
   * @param {string} channelId
   * @param {object} seriesPayload
   * @param {string} userId
   * @returns {Promise<object>} created series
   */
  async createLibrarySeries(channelId, seriesPayload, userId) {
    const { valid, errors } = ValidationRules.validateSeriesPayload(seriesPayload);
    if (!valid) {
      throw new Error(`Invalid series payload: ${errors.join(', ')}`);
    }

    const seriesId = DocumentHelpers.generateSeriesId();
    const now = admin.firestore.Timestamp.now();

    // Avoid requiring composite indexes for creator setup paths.
    const existingSeries = await db
      .collection(COLLECTION_PATHS.LIBRARY_SERIES)
      .where('channelId', '==', channelId)
      .get();

    const maxSortIndex = existingSeries.docs.reduce((max, doc) => {
      const sortIndex = Number(doc.data()?.sortIndex);
      if (!Number.isFinite(sortIndex)) return max;
      return Math.max(max, sortIndex);
    }, -1);

    const series = {
      id: seriesId,
      channelId,
      title: seriesPayload.title.trim(),
      description: seriesPayload.description || null,
      coverAssetUrl: seriesPayload.coverAssetUrl || null,
      sortIndex: maxSortIndex + 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(COLLECTION_PATHS.LIBRARY_SERIES).doc(seriesId).set(series);

    await this._auditLog('library_series_created', {
      channelId,
      seriesId,
      userId,
    });

    return series;
  }

  /**
   * Update library series
   * @param {string} channelId
   * @param {string} seriesId
   * @param {object} updates
   * @param {string} userId
   * @returns {Promise<object>} updated series
   */
  async updateLibrarySeries(channelId, seriesId, updates, userId) {
    const seriesRef = db.collection(COLLECTION_PATHS.LIBRARY_SERIES).doc(seriesId);
    const seriesSnap = await seriesRef.get();
    if (!seriesSnap.exists || seriesSnap.data().channelId !== channelId) {
      throw new Error(`Library series not found: ${seriesId}`);
    }

    const allowedFields = ['title', 'description', 'coverAssetUrl', 'sortIndex', 'status'];
    const sanitizedUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    sanitizedUpdates.updatedAt = admin.firestore.Timestamp.now();

    await seriesRef.update(sanitizedUpdates);

    await this._auditLog('library_series_updated', {
      channelId,
      seriesId,
      userId,
      fields: Object.keys(sanitizedUpdates),
    });

    const updated = await seriesRef.get();
    return updated.data();
  }

  /**
   * List creator items for a channel (all statuses)
   * @param {string} channelId
   * @returns {Promise<object[]>}
   */
  async listCreatorItems(channelId, { page, limit } = {}) {
    const snapshot = await db
      .collection(COLLECTION_PATHS.LIBRARY_ITEMS)
      .where('channelId', '==', channelId)
      .get();

    const all = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aMs = a?.updatedAt && typeof a.updatedAt.toMillis === 'function' ? a.updatedAt.toMillis() : 0;
        const bMs = b?.updatedAt && typeof b.updatedAt.toMillis === 'function' ? b.updatedAt.toMillis() : 0;
        return bMs - aMs;
      });

    if (page && limit) {
      const total = all.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const start = (page - 1) * limit;
      return { items: all.slice(start, start + limit), pagination: { page, limit, total, totalPages } };
    }
    return { items: all, pagination: null };
  }

  /**
   * List creator series for a channel (all statuses)
   * @param {string} channelId
   * @returns {Promise<object[]>}
   */
  async listCreatorSeries(channelId) {
    const snapshot = await db
      .collection(COLLECTION_PATHS.LIBRARY_SERIES)
      .where('channelId', '==', channelId)
      .get();

    return snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aIndex = Number(a?.sortIndex);
        const bIndex = Number(b?.sortIndex);
        const left = Number.isFinite(aIndex) ? aIndex : Number.MAX_SAFE_INTEGER;
        const right = Number.isFinite(bIndex) ? bIndex : Number.MAX_SAFE_INTEGER;
        return left - right;
      });
  }

  /**
   * Audit log helper
   * @private
   */
  async _auditLog(action, context) {
    const auditRecord = {
      action,
      context,
      timestamp: admin.firestore.Timestamp.now(),
    };
    // Log to Firestore audit collection (or structured logging service)
    await db.collection('audit_logs').add(auditRecord);
  }
}

module.exports = LibraryService;
