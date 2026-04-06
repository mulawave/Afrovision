const Channel = require('./channel.model');
const User = require('../users/user.model');
const CreatorSub = require('../subscriptions/creator_subscription.model');

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim();
}

async function createChannel(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or fewer' });
  if (description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });

  const channelType = type || 'public';
  if (!['public', 'private'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public or private' });
  }

  if (channelType === 'private' && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private channels' });
  }

  const channel = await Channel.create({
    ownerId: req.userId,
    name: sanitize(name),
    description: sanitize(description),
    category: sanitize(category),
    type: channelType,
  });

  res.status(201).json({ channel: enrichChannel(channel, user, req.userId) });
}

function getPublicChannels(req, res) {
  const channels = Channel.getPublicChannels();
  const enriched = channels.map((ch) => {
    const owner = User.findById(ch.owner_id);
    return enrichChannel(ch, owner, null);
  });
  res.json({ channels: enriched });
}

function getChannelById(req, res) {
  const channel = Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const owner = User.findById(channel.owner_id);
  res.json({ channel: enrichChannel(channel, owner, req.userId) });
}

function getChannelByNumber(req, res) {
  const channel = Channel.findByNumber(req.params.channelNumber);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const owner = User.findById(channel.owner_id);
  res.json({ channel: enrichChannel(channel, owner, req.userId) });
}

async function updateChannel(req, res) {
  const channel = Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  // vPT edit gating: creators need ≥500 vPT balance to edit
  const user = User.findById(req.userId);
  if (user && user.role === 'creator' && user.vpt_balance < 500) {
    return res.status(403).json({ error: 'Insufficient vPT balance. You need at least ₦500 vPT to edit a channel.' });
  }

  const { name, description, category } = req.body;
  const updated = await Channel.update(req.params.id, {
    name: name ? sanitize(name) : undefined,
    description: description ? sanitize(description) : undefined,
    category: category ? sanitize(category) : undefined,
  });
  const owner = User.findById(updated.owner_id);
  res.json({ channel: enrichChannel(updated, owner, req.userId) });
}

async function deleteChannel(req, res) {
  const channel = Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  await Channel.disable(req.params.id);
  res.json({ message: 'Channel disabled' });
}

function getMyChannels(req, res) {
  const channels = Channel.getAllByOwner(req.userId);
  const enriched = channels.map((ch) => {
    const owner = User.findById(ch.owner_id);
    return enrichChannel(ch, owner, req.userId);
  });
  res.json({ channels: enriched });
}

async function enableChannel(req, res) {
  const channel = Channel.findById(req.params.id) ||
    Channel.getAllByOwner(req.userId).find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  const enabled = await Channel.enable(req.params.id);
  const owner = User.findById(enabled.owner_id);
  res.json({ channel: enrichChannel(enabled, owner, req.userId) });
}

function enrichChannel(channel, owner, requesterId) {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    category: channel.category,
    type: channel.type,
    channel_number: channel.channel_number,
    logo_url: channel.logo_url,
    banner_url: channel.banner_url,
    is_active: channel.is_active,
    created_at: channel.created_at,
    owner_id: channel.owner_id,
    owner_name: owner?.name || owner?.email || 'Unknown',
    followers_count: User.countFollowers ? User.countFollowers(channel.owner_id) : 0,
  };
}

async function uploadMedia(req, res) {
  const channel = Channel.findById(req.params.id) ||
    Channel.getAllByOwner(req.userId).find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const mediaType = req.params.mediaType;
  if (!['logo', 'banner'].includes(mediaType)) {
    return res.status(400).json({ error: 'Media type must be logo or banner' });
  }

  const url = req.file.gcsUrl;
  const field = mediaType === 'logo' ? 'logo_url' : 'banner_url';
  await Channel.update(channel.id, { [field]: url });

  // Re-fetch to get updated data (handle disabled channels)
  const updated = Channel.getAllByOwner(req.userId).find((c) => c.id === channel.id);
  const owner = User.findById(updated.owner_id);
  res.json({ channel: enrichChannel(updated, owner, req.userId) });
}

async function createChannelWithMedia(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Channel name must be 100 characters or fewer' });
  if (description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });

  const channelType = type || 'public';
  if (!['public', 'private'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public or private' });
  }

  if (channelType === 'private' && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private channels' });
  }

  const channel = await Channel.create({
    ownerId: req.userId,
    name: sanitize(name),
    description: sanitize(description),
    category: sanitize(category),
    type: channelType,
  });

  // Attach uploaded files if present
  if (req.files) {
    if (req.files.logo && req.files.logo[0]) {
      await Channel.update(channel.id, { logo_url: req.files.logo[0].gcsUrl });
    }
    if (req.files.banner && req.files.banner[0]) {
      await Channel.update(channel.id, { banner_url: req.files.banner[0].gcsUrl });
    }
  }

  const updated = Channel.findById(channel.id);
  res.status(201).json({ channel: enrichChannel(updated, user, req.userId) });
}

/**
 * GET /channels/subscriber-feed
 * Returns channels owned by creators the authenticated user actively subscribes to.
 * Useful for "Subscriber-Only Live Now" section on home screen.
 */
function getSubscriberFeed(req, res) {
  // All active subscriptions where the caller is the subscriber
  const subs = CreatorSub.getBySubscriber(req.userId).filter((s) => s.status === 'active');
  const creatorUids = [...new Set(subs.map((s) => s.creator_uid))];

  const channels = Channel.getAll().filter(
    (c) => c.is_active && creatorUids.includes(c.owner_id)
  );

  res.json({ channels });
}

module.exports = {
  createChannel,
  createChannelWithMedia,
  getPublicChannels,
  getChannelById,
  getChannelByNumber,
  updateChannel,
  deleteChannel,
  getMyChannels,
  enableChannel,
  uploadMedia,
  getSubscriberFeed,
};
