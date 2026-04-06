const crypto = require('crypto');

const channels = [];

function generateChannelNumber() {
  let number;
  do {
    number = (100000 + parseInt(crypto.randomBytes(3).toString('hex'), 16) % 900000).toString();
  } while (channels.some((c) => c.channel_number === number));
  return number;
}

function create({ ownerId, name, description, category, type }) {
  const channel = {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    name,
    description: description || null,
    category: category || null,
    type: type || 'public',
    channel_number: generateChannelNumber(),
    logo_url: null,
    banner_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    // Premium stream fields (Module 11)
    requires_payment: false,
    entry_fee_type: null,       // 'vpt' | 'ngn'
    entry_fee_vpt_units: 0,
    entry_fee_ngn: 0,
    access_duration_minutes: 120,
    // Retention fields (Module 12)
    is_subscriber_only: false,
  };
  channels.push(channel);
  return channel;
}

function findById(id) {
  return channels.find((c) => c.id === id && c.is_active);
}

function findByNumber(number) {
  return channels.find((c) => c.channel_number === number && c.is_active);
}

function getPublicChannels() {
  return channels.filter((c) => c.type === 'public' && c.is_active);
}

function getByOwner(ownerId) {
  return channels.filter((c) => c.owner_id === ownerId && c.is_active);
}

function getAllByOwner(ownerId) {
  return channels.filter((c) => c.owner_id === ownerId);
}

function update(id, fields) {
  const channel = findById(id);
  if (!channel) return null;
  if (fields.name !== undefined) channel.name = fields.name;
  if (fields.description !== undefined) channel.description = fields.description;
  if (fields.category !== undefined) channel.category = fields.category;
  if (fields.logo_url !== undefined) channel.logo_url = fields.logo_url;
  if (fields.banner_url !== undefined) channel.banner_url = fields.banner_url;
  return channel;
}

function disable(id) {
  const channel = channels.find((c) => c.id === id);
  if (!channel) return null;
  channel.is_active = false;
  return channel;
}

function enable(id) {
  const channel = channels.find((c) => c.id === id);
  if (!channel) return null;
  channel.is_active = true;
  return channel;
}

/**
 * Update premium stream settings on a channel.
 */
function updatePremium(id, fields) {
  const channel = findById(id);
  if (!channel) return null;
  if (fields.requires_payment !== undefined) channel.requires_payment = !!fields.requires_payment;
  if (fields.entry_fee_type !== undefined) channel.entry_fee_type = fields.entry_fee_type;
  if (fields.entry_fee_vpt_units !== undefined) channel.entry_fee_vpt_units = Number(fields.entry_fee_vpt_units) || 0;
  if (fields.entry_fee_ngn !== undefined) channel.entry_fee_ngn = Number(fields.entry_fee_ngn) || 0;
  if (fields.access_duration_minutes !== undefined) channel.access_duration_minutes = Number(fields.access_duration_minutes) || 120;
  if (fields.is_subscriber_only !== undefined) channel.is_subscriber_only = !!fields.is_subscriber_only;
  return channel;
}

function getRecentPublic(limit = 10) {
  return channels
    .filter((c) => c.type === 'public' && c.is_active)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

function getAll() {
  return channels.filter((c) => c.is_active);
}

function getEvery() {
  return channels;
}

module.exports = {
  create,
  findById,
  findByNumber,
  getPublicChannels,
  getRecentPublic,
  getAll,
  getByOwner,
  getAllByOwner,
  update,
  updatePremium,
  disable,
  enable,
  getEvery,
};
