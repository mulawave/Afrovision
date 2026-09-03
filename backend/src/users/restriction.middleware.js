/**
 * Minor restriction middleware.
 *
 * Blocks minors from certain operations:
 * - Channel creation
 * - Creator subscription
 * - Withdrawal requests
 * - Exclusive channel subscription
 */
const UserModel = require('../users/user.model');

async function blockMinors(req, res, next) {
  try {
    if (!req.userId) return next();

    const user = await UserModel.findById(req.userId);
    if (!user) return next();

    if (user.is_minor === true) {
      return res.status(403).json({
        error: 'MINOR_RESTRICTED',
        message: 'This action is not available for users under 18.',
      });
    }

    return next();
  } catch (err) {
    console.error('[Restriction] blockMinors error:', err);
    return next();
  }
}

async function blockChannelCreationBan(req, res, next) {
  try {
    if (!req.userId) return next();

    const user = await UserModel.findById(req.userId);
    if (!user) return next();

    if (user.channel_creation_banned === true) {
      return res.status(403).json({
        error: 'CHANNEL_CREATION_BANNED',
        message: 'You have been restricted from creating channels. Contact support.',
      });
    }

    return next();
  } catch (err) {
    console.error('[Restriction] blockChannelCreationBan error:', err);
    return next();
  }
}

module.exports = { blockMinors, blockChannelCreationBan };
