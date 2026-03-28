const Channel = require('./channel.model');
const User = require('../users/user.model');

function createChannel(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });

  const channelType = type || 'public';
  if (!['public', 'private'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public or private' });
  }

  if (channelType === 'private' && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private channels' });
  }

  const channel = Channel.create({
    ownerId: req.userId,
    name,
    description,
    category,
    type: channelType,
  });

  res.status(201).json({ channel: enrichChannel(channel, user) });
}

function getPublicChannels(req, res) {
  const channels = Channel.getPublicChannels();
  const enriched = channels.map((ch) => {
    const owner = User.findById(ch.owner_id);
    return enrichChannel(ch, owner);
  });
  res.json({ channels: enriched });
}

function getChannelById(req, res) {
  const channel = Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const owner = User.findById(channel.owner_id);
  res.json({ channel: enrichChannel(channel, owner) });
}

function getChannelByNumber(req, res) {
  const channel = Channel.findByNumber(req.params.channelNumber);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const owner = User.findById(channel.owner_id);
  res.json({ channel: enrichChannel(channel, owner) });
}

function updateChannel(req, res) {
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
  const updated = Channel.update(req.params.id, { name, description, category });
  const owner = User.findById(updated.owner_id);
  res.json({ channel: enrichChannel(updated, owner) });
}

function deleteChannel(req, res) {
  const channel = Channel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  Channel.disable(req.params.id);
  res.json({ message: 'Channel disabled' });
}

function getMyChannels(req, res) {
  const channels = Channel.getAllByOwner(req.userId);
  const enriched = channels.map((ch) => {
    const owner = User.findById(ch.owner_id);
    return enrichChannel(ch, owner);
  });
  res.json({ channels: enriched });
}

function enableChannel(req, res) {
  const channel = Channel.findById(req.params.id) ||
    Channel.getAllByOwner(req.userId).find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Not channel owner' });
  }

  const enabled = Channel.enable(req.params.id);
  const owner = User.findById(enabled.owner_id);
  res.json({ channel: enrichChannel(enabled, owner) });
}

function enrichChannel(channel, owner) {
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
    owner_name: channel.type === 'private' ? 'No information available' : (owner?.name || owner?.email || 'Unknown'),
  };
}

function uploadMedia(req, res) {
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

  const url = `/uploads/${req.file.filename}`;
  const field = mediaType === 'logo' ? 'logo_url' : 'banner_url';
  Channel.update(channel.id, { [field]: url });

  // Re-fetch to get updated data (handle disabled channels)
  const updated = Channel.getAllByOwner(req.userId).find((c) => c.id === channel.id);
  const owner = User.findById(updated.owner_id);
  res.json({ channel: enrichChannel(updated, owner) });
}

function createChannelWithMedia(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'creator' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only creators can create channels' });
  }

  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Channel name is required' });
  if (!description) return res.status(400).json({ error: 'Description is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });

  const channelType = type || 'public';
  if (!['public', 'private'].includes(channelType)) {
    return res.status(400).json({ error: 'Type must be public or private' });
  }

  if (channelType === 'private' && !user.is_premium_creator) {
    return res.status(403).json({ error: 'Only premium creators can create private channels' });
  }

  const channel = Channel.create({
    ownerId: req.userId,
    name,
    description,
    category,
    type: channelType,
  });

  // Attach uploaded files if present
  if (req.files) {
    if (req.files.logo && req.files.logo[0]) {
      Channel.update(channel.id, { logo_url: `/uploads/${req.files.logo[0].filename}` });
    }
    if (req.files.banner && req.files.banner[0]) {
      Channel.update(channel.id, { banner_url: `/uploads/${req.files.banner[0].filename}` });
    }
  }

  const updated = Channel.findById(channel.id);
  res.status(201).json({ channel: enrichChannel(updated, user) });
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
};
