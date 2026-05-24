/**
 * Library Policy Service
 * Enforces entitlement-based access control for library features
 * All access checks must go through this service
 */

const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const ExclusiveAccess = require('../channels/exclusive_access.model');
const { isAdultKycVerified } = require('../channels/exclusive_policy.service');

class LibraryPolicyService {
  /**
   * Check if user has active entitlement for accessing library content
   * User must have:
   * 1. Active authentication
   * 2. KYC-approved adult status
   * 3. Active PIC (Personal Identifier Code) for the channel
   *
   * @param {string} userId
   * @param {string} channelId
   * @returns {Promise<boolean>} true if entitled
   */
  async hasLibraryAccess(userId, channelId) {
    if (!userId) return false;

    // KYC policy follows existing exclusive policy source of truth.
    const isKycAllowed = await isAdultKycVerified(userId);
    if (!isKycAllowed) {
      // Log denial for audit
      await this._logPolicyDenial(userId, channelId, 'kyc_not_verified_adult', {});
      return false;
    }

    // PIC entitlement follows existing exclusive access model.
    const activeAccess = await ExclusiveAccess.findActiveByUserAndChannel(userId, channelId);
    const hasActivePic = Boolean(activeAccess);

    if (!hasActivePic) {
      await this._logPolicyDenial(userId, channelId, 'no_active_pic', {});
    }

    return hasActivePic;
  }

  /**
   * Check if user can list and view library items for a channel
   * Same as hasLibraryAccess but can be overridden for admin
   *
   * @param {string} userId
   * @param {string} channelId
   * @param {boolean} isChannelAdmin - optional admin override
   * @returns {Promise<boolean>}
   */
  async canViewLibraryList(userId, channelId, isChannelAdmin = false) {
    if (isChannelAdmin) return true;
    return this.hasLibraryAccess(userId, channelId);
  }

  /**
   * Check if user can view library item details
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @param {boolean} isChannelAdmin
   * @returns {Promise<boolean>}
   */
  async canViewLibraryItemDetail(userId, channelId, itemId, isChannelAdmin = false) {
    if (isChannelAdmin) return true;
    return this.hasLibraryAccess(userId, channelId);
  }

  /**
   * Check if user can access reader assets (manifest + page images)
   * Most restrictive: requires active entitlement at read time
   *
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @param {boolean} isChannelAdmin
   * @returns {Promise<boolean>}
   */
  async canAccessReader(userId, channelId, itemId, isChannelAdmin = false) {
    if (isChannelAdmin) return true;
    // Enforce strict entitlement check for reader access
    return this.hasLibraryAccess(userId, channelId);
  }

  /**
   * Check if user can add/remove favorites
   * @param {string} userId
   * @param {string} channelId
   * @param {string} itemId
   * @returns {Promise<boolean>}
   */
  async canModifyFavorites(userId, channelId, itemId) {
    // User must have entitlement to favorite an item
    return this.hasLibraryAccess(userId, channelId);
  }

  /**
   * Filter favorites list by active entitlement
   * User can favorite items while entitled, but favorites are hidden when entitlement expires
   * This is the crucial "read-time filtering" behavior
   *
   * @param {string} userId
   * @param {object[]} favorites - array of favorite documents from Firestore
   * @returns {Promise<object[]>} filtered favorites (only items with active entitlement)
   */
  async filterFavoritesByEntitlement(userId, favorites) {
    if (!favorites || favorites.length === 0) return [];

    // Batch check all unique channels
    const uniqueChannels = [...new Set(favorites.map((f) => f.channelId))];
    const entitlementMap = {};

    for (const channelId of uniqueChannels) {
      const hasAccess = await this.hasLibraryAccess(userId, channelId);
      entitlementMap[channelId] = hasAccess;
    }

    // Return only items where user has active entitlement
    return favorites.filter((fav) => entitlementMap[fav.channelId]);
  }

  /**
   * Check if user can manage library content (creator/admin)
   * User must be channel owner or platform admin
   *
   * @param {string} userId
   * @param {string} channelId
   * @returns {Promise<boolean>}
   */
  async canManageLibrary(userId, channelId) {
    const channel = await Channel.findById(channelId);
    if (!channel) return false;

    const isOwner = channel.owner_id === userId;

    if (isOwner) return true;

    // Check if user is platform admin.
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    return isAdmin;
  }

  /**
   * Check if user can publish/archive items
   * @param {string} userId
   * @param {string} channelId
   * @returns {Promise<boolean>}
   */
  async canPublishLibraryItems(userId, channelId) {
    return this.canManageLibrary(userId, channelId);
  }

  /**
   * Log policy denial for audit trail
   * @private
   */
  async _logPolicyDenial(userId, channelId, reason, context) {
    // Non-blocking structured log to avoid write path latency.
    console.warn('[LibraryPolicy] access denied', {
      userId,
      channelId,
      reason,
      context,
      at: Date.now(),
    });
  }
}

module.exports = LibraryPolicyService;
