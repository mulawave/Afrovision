/**
 * Library Favorites Service
 * Handles entitlement-aware favorites retrieval
 * Core behavior: favorites are saved when entitled, but filtered on retrieval if entitlement expires
 */

const admin = require('firebase-admin');
const LibraryPolicyService = require('./library-policy.service');

const db = {
  collection: (...args) => admin.firestore().collection(...args),
};
const policyService = new LibraryPolicyService();

class LibraryFavoritesService {
  /**
   * Get all favorites for user, filtered by active entitlements
   * This is the key entitlement gate for favorites visibility
   *
   * @param {string} userId
   * @returns {Promise<object[]>} filtered favorites (only items with active entitlements)
   */
  async getFavoritesByEntitlement(userId) {
    // Get all favorite records for user
    const favDocs = await db
      .collection('user_favorite_library_items')
      .where('userId', '==', userId)
      .get();

    const favorites = favDocs.docs.map((doc) => doc.data());

    // Filter by active entitlements (the crucial behavior)
    const filtered = await policyService.filterFavoritesByEntitlement(userId, favorites);

    // Enrich with item metadata
    const enriched = await Promise.all(
      filtered.map(async (fav) => {
        const itemDoc = await db.collection('channel_library_items').doc(fav.itemId).get();
        const item = itemDoc.exists ? itemDoc.data() : null;

        return {
          id: fav.id,
          itemId: fav.itemId,
          channelId: fav.channelId,
          addedAt: fav.addedAt,
          item, // include item metadata for display
        };
      })
    );

    return enriched;
  }

  /**
   * Get favorites for a specific channel
   * @param {string} userId
   * @param {string} channelId
   * @returns {Promise<object[]>}
   */
  async getFavoritesByChannel(userId, channelId) {
    // Check user has entitlement for this channel
    const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
    if (!hasAccess) {
      return []; // Return empty list instead of error
    }

    // Get favorites for this channel
    const favDocs = await db
      .collection('user_favorite_library_items')
      .where('userId', '==', userId)
      .where('channelId', '==', channelId)
      .get();

    const favorites = favDocs.docs.map((doc) => doc.data());

    // Enrich with item metadata
    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const itemDoc = await db.collection('channel_library_items').doc(fav.itemId).get();
        const item = itemDoc.exists ? itemDoc.data() : null;

        return {
          id: fav.id,
          itemId: fav.itemId,
          channelId: fav.channelId,
          addedAt: fav.addedAt,
          item,
        };
      })
    );

    return enriched;
  }

  /**
   * Get user's reading stats across all accessible library content
   * @param {string} userId
   * @returns {Promise<object>} reading stats
   */
  async getUserReadingStats(userId) {
    // Get all progress records for user
    const progressDocs = await db
      .collection('library_reader_progress')
      .where('userId', '==', userId)
      .get();

    const progressRecords = progressDocs.docs.map((doc) => doc.data());

    // Filter by active entitlements
    const uniqueChannels = [...new Set(progressRecords.map((p) => p.channelId))];
    const accessMap = {};

    for (const channelId of uniqueChannels) {
      const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
      accessMap[channelId] = hasAccess;
    }

    const accessibleProgress = progressRecords.filter((p) => accessMap[p.channelId]);

    // Calculate stats
    const totalItemsRead = accessibleProgress.length;
    const totalCompleted = accessibleProgress.filter((p) => p.isCompleted).length;
    const totalBookmarks = await db
      .collection('library_bookmarks')
      .where('userId', '==', userId)
      .get()
      .then((snap) => snap.size);

    // Get all favorites with filtering
    const allFavorites = await this.getFavoritesByEntitlement(userId);

    return {
      totalItemsRead,
      totalCompleted,
      completionRate: totalItemsRead > 0 ? (totalCompleted / totalItemsRead) * 100 : 0,
      totalBookmarks,
      totalFavorites: allFavorites.length,
      accessibleChannels: Object.keys(accessMap).filter((ch) => accessMap[ch]).length,
    };
  }

  /**
   * Pre-cache entitlement decisions for batch operations
   * Reduces repeated entitlement checks
   *
   * @param {string} userId
   * @returns {Promise<Map>} channelId -> hasAccess boolean
   */
  async cacheEntitlementDecisions(userId) {
    // Get all unique channels with library content
    const itemsSnap = await db.collection('channel_library_items').select('channelId').get();
    const uniqueChannels = [...new Set(itemsSnap.docs.map((d) => d.data().channelId))];

    const cache = new Map();

    for (const channelId of uniqueChannels) {
      const hasAccess = await policyService.hasLibraryAccess(userId, channelId);
      cache.set(channelId, hasAccess);
    }

    return cache;
  }
}

module.exports = LibraryFavoritesService;
