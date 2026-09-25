const ExclusiveAccess = require('../channels/exclusive_access.model');
const User = require('../users/user.model');
const { isAdultKycVerified } = require('../channels/exclusive_policy.service');

/**
 * The one definition of an exclusive channel: its type. Every exclusive
 * check on the platform goes through here. The monthly fee is a property
 * of an exclusive channel, not what makes it one (only exclusive channels
 * may carry a fee - see channel.model.js updateExclusiveSettings).
 */
function isExclusiveChannel(channel) {
  if (!channel) return false;
  return channel.type === 'exclusive';
}

/**
 * Evaluates whether a user can access content on a given channel.
 * For non-exclusive channels, always allowed.
 * For exclusive channels, requires authentication + KYC + active subscription
 * (or owner/admin bypass).
 *
 * @param {object} channel - channel document
 * @param {string|null} userId - authenticated user ID (or null)
 * @returns {Promise<{ allowed: boolean, status: number, message: string|null }>}
 */
async function checkChannelAccess(channel, userId) {
  if (!isExclusiveChannel(channel)) {
    return { allowed: true, status: 200, message: null };
  }

  if (!userId) {
    return { allowed: false, status: 401, message: 'Authentication required for exclusive channel content' };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, status: 404, message: 'User not found' };
  }

  const isOwnerOrAdmin = channel.owner_id === userId || user.role === 'admin';
  if (isOwnerOrAdmin) {
    return { allowed: true, status: 200, message: null };
  }

  const kycResult = await isAdultKycVerified(userId);
  if (!kycResult.isVerified) {
    return {
      allowed: false,
      status: 403,
      message: kycResult.isMinor
        ? 'Exclusive channels are not available for users under 18'
        : 'KYC verification is required for exclusive channels',
    };
  }

  const activeAccess = await ExclusiveAccess.findActiveByUserAndChannel(userId, channel.id);
  if (!activeAccess) {
    return {
      allowed: false,
      status: 403,
      message: 'Paid subscription required for exclusive channel content',
    };
  }

  return { allowed: true, status: 200, message: null };
}

module.exports = { isExclusiveChannel, checkChannelAccess };
