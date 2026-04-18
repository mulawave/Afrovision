const crypto = require('crypto');
const User = require('../users/user.model');
const CreatorSubscription = require('../subscriptions/creator_subscription.model');

const anonCache = new Map();
const MIN_ALIAS_TTL_MS = 30_000;
const MAX_ALIAS_TTL_MS = 180_000;

function randomAliasTtl() {
  return MIN_ALIAS_TTL_MS + Math.floor(Math.random() * (MAX_ALIAS_TTL_MS - MIN_ALIAS_TTL_MS + 1));
}

function getAnonId(uid, channelId) {
  const key = `${uid}_${channelId || ''}`;
  const cached = anonCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.alias;

  const tag = crypto.randomBytes(4).toString('hex').toUpperCase();
  const alias = `Anon-${tag}`;
  anonCache.set(key, {
    alias,
    expiresAt: now + randomAliasTtl(),
  });
  return alias;
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
  if (channel.type === 'private') return null;

  const user = User.findById(uid);
  if (!user) return null;
  if (user.role === 'admin' || uid === channel.owner_id) return 'mod';
  if (CreatorSubscription.findActive(uid, channel.owner_id)) return 'sub';
  if (user.is_premium_creator) return 'vip';
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of anonCache) {
    if (!value || value.expiresAt <= now) {
      anonCache.delete(key);
    }
  }
}, 60_000).unref();

module.exports = {
  getAnonId,
  getSenderDisplayName,
  getSenderBadge,
};