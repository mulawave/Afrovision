const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channels';
const channels = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    data.id = doc.id;
    channels.push(data);
  });
  initialized = true;
  console.log(`[ChannelModel] Loaded ${channels.length} channels from Firestore`);
}

function generateChannelNumber() {
  let number;
  do {
    number = (100000 + parseInt(crypto.randomBytes(3).toString('hex'), 16) % 900000).toString();
  } while (channels.some((c) => c.channel_number === number));
  return number;
}

async function create({ ownerId, name, description, category, type }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const channel = {
    id,
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
    requires_payment: false,
    entry_fee_type: null,
    entry_fee_vpt_units: 0,
    entry_fee_ngn: 0,
    access_duration_minutes: 120,
    is_subscriber_only: false,
  };
  await db.collection(COLLECTION).doc(id).set(channel);
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

async function update(id, fields) {
  const channel = findById(id);
  if (!channel) return null;
  const updates = {};
  if (fields.name !== undefined) { channel.name = fields.name; updates.name = fields.name; }
  if (fields.description !== undefined) { channel.description = fields.description; updates.description = fields.description; }
  if (fields.category !== undefined) { channel.category = fields.category; updates.category = fields.category; }
  if (fields.logo_url !== undefined) { channel.logo_url = fields.logo_url; updates.logo_url = fields.logo_url; }
  if (fields.banner_url !== undefined) { channel.banner_url = fields.banner_url; updates.banner_url = fields.banner_url; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return channel;
}

async function disable(id) {
  const channel = channels.find((c) => c.id === id);
  if (!channel) return null;
  channel.is_active = false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ is_active: false });
  return channel;
}

async function enable(id) {
  const channel = channels.find((c) => c.id === id);
  if (!channel) return null;
  channel.is_active = true;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ is_active: true });
  return channel;
}

async function updatePremium(id, fields) {
  const channel = findById(id);
  if (!channel) return null;
  const updates = {};
  if (fields.requires_payment !== undefined) { channel.requires_payment = !!fields.requires_payment; updates.requires_payment = channel.requires_payment; }
  if (fields.entry_fee_type !== undefined) { channel.entry_fee_type = fields.entry_fee_type; updates.entry_fee_type = fields.entry_fee_type; }
  if (fields.entry_fee_vpt_units !== undefined) { channel.entry_fee_vpt_units = Number(fields.entry_fee_vpt_units) || 0; updates.entry_fee_vpt_units = channel.entry_fee_vpt_units; }
  if (fields.entry_fee_ngn !== undefined) { channel.entry_fee_ngn = Number(fields.entry_fee_ngn) || 0; updates.entry_fee_ngn = channel.entry_fee_ngn; }
  if (fields.access_duration_minutes !== undefined) { channel.access_duration_minutes = Number(fields.access_duration_minutes) || 120; updates.access_duration_minutes = channel.access_duration_minutes; }
  if (fields.is_subscriber_only !== undefined) { channel.is_subscriber_only = !!fields.is_subscriber_only; updates.is_subscriber_only = channel.is_subscriber_only; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
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
  init,
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
