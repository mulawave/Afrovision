const User = require('./user.model');
const { uploadSingleToGCS, upload } = require('../utils/upload');

function getProfile(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function resolveCreator(creatorId) {
  const creator = User.findById(creatorId);
  if (!creator) return { error: 'Creator not found', status: 404 };
  if (!['creator', 'admin'].includes(creator.role)) {
    return { error: 'Target user is not a creator', status: 400 };
  }
  return { creator };
}

async function updateProfile(req, res) {
  const { name, email } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (email !== undefined) {
    const emailStr = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const existing = User.findByEmail(emailStr);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    fields.email = emailStr;
  }
  const user = await User.updateProfile(req.userId, fields);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function uploadAvatar(req, res) {
  if (!req.file || !req.file.gcsUrl) {
    return res.status(400).json({ error: 'Avatar image is required' });
  }
  const user = await User.updateProfile(req.userId, { avatar_url: req.file.gcsUrl });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

async function updateCurrency(req, res) {
  const { currency } = req.body;
  if (!currency) return res.status(400).json({ error: 'Currency code is required' });
  const Currency = require('../currencies/currency.model');
  if (!Currency.findByCode(currency.toUpperCase())) {
    return res.status(400).json({ error: 'Unsupported currency' });
  }
  const user = await User.updateProfile(req.userId, { preferred_currency: currency.toUpperCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: User.toSafeUser(user) });
}

function requestCreator(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'creator' || user.role === 'admin') {
    return res.status(400).json({ error: 'Already a creator or admin' });
  }
  return res.status(400).json({ error: 'Subscribe to a plan to become a creator' });
}

async function registerFcmToken(req, res) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'FCM token is required' });
  }
  const user = await User.addFcmToken(req.userId, token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
}

async function unregisterFcmToken(req, res) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'FCM token is required' });
  }
  const user = await User.removeFcmToken(req.userId, token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
}

function getFollowStatus(req, res) {
  const { creatorId } = req.params;
  const resolved = resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  res.json({
    followed: User.isFollowing(req.userId, creatorId),
    followers_count: User.countFollowers(creatorId),
  });
}

async function followCreator(req, res) {
  const { creatorId } = req.params;
  if (creatorId === req.userId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  const resolved = resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  const user = await User.followCreator(req.userId, creatorId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: true,
    followers_count: User.countFollowers(creatorId),
  });
}

async function unfollowCreator(req, res) {
  const { creatorId } = req.params;
  const resolved = resolveCreator(creatorId);
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  const user = await User.unfollowCreator(req.userId, creatorId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    followed: false,
    followers_count: User.countFollowers(creatorId),
  });
}

function getFollowingCreators(req, res) {
  const creators = User.getFollowingCreatorIds(req.userId)
    .map((creatorId) => User.findById(creatorId))
    .filter(Boolean)
    .map((creator) => User.toSafeUser(creator));

  res.json({ creators });
}

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  updateCurrency,
  requestCreator,
  registerFcmToken,
  unregisterFcmToken,
  getFollowStatus,
  followCreator,
  unfollowCreator,
  getFollowingCreators,
};
