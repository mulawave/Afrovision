const crypto = require('crypto');
const User = require('../users/user.model');
const CreatorSubscription = require('../subscriptions/creator_subscription.model');

const anonCache = new Map();

function getAnonId(uid, channelId) {
  const key = `${uid}_${channelId || ''}`;
  if (anonCache.has(key)) return anonCache.get(key);
  const tag = crypto.randomBytes(4).toString('hex').toUpperCase();
  const anonId = `Anon-${tag}`;
  anonCache.set(key, anonId);
  return anonId;
}

function getSenderDisplayName(uid, channel) {
  if (!channel) return 'Anonymous';
  if (channel.type === 'private') {
    return getAnonId(uid, channel.id);
  }

  const user = User.findById(uid);
  return user?.name || user?.email || 'Anonymous';
}

function getSenderBadge(uid, channel) {
  if (!channel) return null;

  const user = User.findById(uid);
  if (!user) return null;
  if (user.role === 'admin' || uid === channel.owner_id) return 'mod';
  if (CreatorSubscription.findActive(uid, channel.owner_id)) return 'sub';
  if (user.is_premium_creator) return 'vip';
  return null;
}

module.exports = {
  getAnonId,
  getSenderDisplayName,
  getSenderBadge,
};