const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channels';
const channelsById = new Map();
const channelsByNumber = new Map();
const RESERVED_CHANNEL_NUMBERS = new Set([
  ...Array.from({ length: 10 }, (_, index) => index + 1),
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]);

const DEV_HLS_CHANNEL = {
  id: 'dev-hls-576',
  owner_id: 'dev-seed-owner',
  name: 'Dev HLS Seed 576',
  description: 'Local development seeded HLS channel',
  category: 'Live TV',
  type: 'public',
  channel_number: '576000',
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
  subscription_price_ngn: 0,
  subscription_interval_count: 1,
  subscription_interval_unit: 'month',
  is_premium_channel: false,
  premium_elevation_status: 'none',
  stream_source_mode: 'external_hls',
  external_provider: 'direct_hls',
  external_url: 'https://live.15plusmg.ru/memfs/b389173a-df4e-4171-8904-e249893e71eb.m3u8',
  resolved_playback_url: 'https://live.15plusmg.ru/memfs/b389173a-df4e-4171-8904-e249893e71eb.m3u8',
  stream_status: 'live',
  last_checked_at: new Date().toISOString(),
  provider_metadata: { seeded: true, source: 'local-dev-fallback' },
  owner_display_mode: 'show_owner',
  owner_brand_name: null,
};

function isLocalDevSeedEnabled() {
  const env = String(process.env.ENVIRONMENT || process.env.NODE_ENV || '').toLowerCase();
  return ['development', 'dev', 'local', 'test'].includes(env);
}

function getLocalDevSeedChannels() {
  if (!isLocalDevSeedEnabled()) return [];
  return [cacheChannel({ ...DEV_HLS_CHANNEL })];
}

function cacheChannel(channel) {
  if (!channel || !channel.id) return channel;
  const normalized = { ...channel };
  channelsById.set(normalized.id, normalized);
  if (normalized.channel_number) {
    channelsByNumber.set(String(normalized.channel_number), normalized);
  }
  return normalized;
}

function removeCachedChannel(channel) {
  if (!channel) return;
  channelsById.delete(channel.id);
  if (channel.channel_number) {
    channelsByNumber.delete(String(channel.channel_number));
  }
}

async function init() {
  return getEvery();
}

async function generateChannelNumber() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  const usedNumbers = new Set();

  snapshot.docs.forEach((doc) => {
    const raw = doc.data().channel_number;
    if (raw === undefined || raw === null) return;
    usedNumbers.add(String(raw));
  });

  for (let candidate = 11; candidate <= 99999; candidate += 1) {
    const number = String(candidate);
    if (RESERVED_CHANNEL_NUMBERS.has(candidate)) continue;
    if (usedNumbers.has(number) || channelsByNumber.has(number)) continue;
    return number;
  }
  throw new Error('Unable to generate unique channel number');
}

function normalizeChannelNumberInput(value) {
  if (value === undefined || value === null) {
    throw new Error('channel_number is required');
  }

  const number = Number(String(value).trim());
  if (!Number.isInteger(number) || number < 1) {
    throw new Error('channel_number must be a positive integer');
  }

  return String(number);
}

async function updateChannelNumber(id, channelNumber) {
  const channel = await findAnyById(id);
  if (!channel) return null;

  const nextNumber = normalizeChannelNumberInput(channelNumber);
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_number', '==', nextNumber)
    .limit(1)
    .get();

  if (!snapshot.empty && snapshot.docs[0].id !== id) {
    throw new Error(`Channel number ${nextNumber} is already in use`);
  }

  const previousNumber = channel.channel_number ? String(channel.channel_number) : null;
  if (previousNumber && previousNumber !== nextNumber) {
    channelsByNumber.delete(previousNumber);
  }

  channel.channel_number = nextNumber;
  await db.collection(COLLECTION).doc(id).update({ channel_number: nextNumber });
  return cacheChannel(channel);
}

// Allowed external stream source modes
const ALLOWED_SOURCE_MODES = ['native', 'external_url', 'external_youtube', 'external_hls', 'external_dash'];

// Allowed external stream status values
const ALLOWED_STREAM_STATUSES = ['unknown', 'valid', 'live', 'scheduled', 'offline', 'invalid', 'access_denied'];

// Channel owner display policy for public channel pages
const ALLOWED_OWNER_DISPLAY_MODES = ['show_owner', 'hide_owner', 'brand_only'];

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
    channel_number: await generateChannelNumber(),
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
    subscription_price_ngn: 0,
    subscription_interval_count: 1,
    subscription_interval_unit: 'month',
    is_premium_channel: false,
    premium_elevation_status: 'none',
    // External source fields — defaults to native (no external source)
    stream_source_mode: 'native',
    external_provider: null,
    external_url: null,
    resolved_playback_url: null,
    stream_status: 'unknown',
    last_checked_at: null,
    provider_metadata: null,
    // Public owner display policy fields
    owner_display_mode: 'show_owner',
    owner_brand_name: null,
    // Featured/promoted channels for homepage
    is_featured: false,
    featured_at: null,
    featured_by: null,
    exclusive_monthly_fee_ngn: 0,
    exclusive_fee_currency: 'NGN',
    exclusive_fee_last_updated_at: null,
    exclusive_fee_last_updated_by: null,
  };
  await db.collection(COLLECTION).doc(id).set(channel);
  return cacheChannel(channel);
}

function findCachedById(id) {
  if (!id) return null;
  const channel = channelsById.get(id);
  return channel && channel.is_active ? channel : null;
}

async function findById(id) {
  const seeded = getLocalDevSeedChannels().find((channel) => channel.id === id) || null;
  if (seeded) return seeded;

  const cached = channelsById.get(id);
  if (cached) return cached.is_active ? cached : null;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const channel = cacheChannel({ ...doc.data(), id: doc.id });
  return channel.is_active ? channel : null;
}

/** Admin-only: find a channel regardless of active state. */
async function findAnyById(id) {
  const cached = channelsById.get(id);
  if (cached) return cached;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return cacheChannel({ ...doc.data(), id: doc.id });
}

async function findByNumber(number) {
  const key = String(number);
  const seeded = getLocalDevSeedChannels().find((channel) => String(channel.channel_number) === key) || null;
  if (seeded) return seeded;

  const cached = channelsByNumber.get(key);
  if (cached) return cached.is_active ? cached : null;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_number', '==', key)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const channel = cacheChannel({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id });
  return channel.is_active ? channel : null;
}

async function getPublicChannels() {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION)
      .where('type', '==', 'public')
      .where('is_active', '==', true)
      .get();
    return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
  } catch (error) {
    if (!isLocalDevSeedEnabled()) throw error;
    console.warn('[ChannelModel] Firestore unavailable; serving local seeded public channels for development.');
    return getLocalDevSeedChannels();
  }
}

async function getByOwner(ownerId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('owner_id', '==', ownerId)
    .where('is_active', '==', true)
    .get();
  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

async function getAllByOwner(ownerId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('owner_id', '==', ownerId)
    .get();
  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

async function update(id, fields) {
  const channel = await findById(id);
  if (!channel) return null;
  const updates = {};
  if (fields.name !== undefined) { channel.name = fields.name; updates.name = fields.name; }
  if (fields.description !== undefined) { channel.description = fields.description; updates.description = fields.description; }
  if (fields.category !== undefined) { channel.category = fields.category; updates.category = fields.category; }
  if (fields.logo_url !== undefined) { channel.logo_url = fields.logo_url; updates.logo_url = fields.logo_url; }
  if (fields.banner_url !== undefined) { channel.banner_url = fields.banner_url; updates.banner_url = fields.banner_url; }
  if (fields.type !== undefined) { channel.type = fields.type; updates.type = fields.type; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return cacheChannel(channel);
}

async function updateExclusiveSettings(id, fields) {
  const channel = await findAnyById(id);
  if (!channel) return null;

  const updates = {};
  if (fields.exclusive_monthly_fee_ngn !== undefined) {
    const fee = Math.max(0, Number(fields.exclusive_monthly_fee_ngn) || 0);
    // Type is what makes a channel exclusive; a fee on any other type
    // would bring back the ambiguity of "public but paid".
    if (fee > 0 && channel.type !== 'exclusive') {
      throw new Error('Only exclusive channels can have an exclusive membership fee');
    }
    channel.exclusive_monthly_fee_ngn = fee;
    updates.exclusive_monthly_fee_ngn = channel.exclusive_monthly_fee_ngn;
  }
  if (fields.exclusive_fee_currency !== undefined) {
    channel.exclusive_fee_currency = fields.exclusive_fee_currency || 'NGN';
    updates.exclusive_fee_currency = channel.exclusive_fee_currency;
  }
  if (fields.exclusive_fee_last_updated_at !== undefined) {
    channel.exclusive_fee_last_updated_at = fields.exclusive_fee_last_updated_at || null;
    updates.exclusive_fee_last_updated_at = channel.exclusive_fee_last_updated_at;
  }
  if (fields.exclusive_fee_last_updated_by !== undefined) {
    channel.exclusive_fee_last_updated_by = fields.exclusive_fee_last_updated_by || null;
    updates.exclusive_fee_last_updated_by = channel.exclusive_fee_last_updated_by;
  }

  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }

  return cacheChannel(channel);
}

async function disable(id) {
  const channel = channelsById.get(id) || await findById(id);
  if (!channel) return null;
  channel.is_active = false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ is_active: false });
  return cacheChannel(channel);
}

async function enable(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const channel = cacheChannel({ ...doc.data(), id: doc.id, is_active: true });
  await db.collection(COLLECTION).doc(id).update({ is_active: true });
  return channel;
}

async function updatePremium(id, fields) {
  const channel = await findById(id);
  if (!channel) return null;
  const updates = {};
  if (fields.requires_payment !== undefined) { channel.requires_payment = !!fields.requires_payment; updates.requires_payment = channel.requires_payment; }
  if (fields.entry_fee_type !== undefined) { channel.entry_fee_type = fields.entry_fee_type; updates.entry_fee_type = fields.entry_fee_type; }
  if (fields.entry_fee_vpt_units !== undefined) { channel.entry_fee_vpt_units = Number(fields.entry_fee_vpt_units) || 0; updates.entry_fee_vpt_units = channel.entry_fee_vpt_units; }
  if (fields.entry_fee_ngn !== undefined) { channel.entry_fee_ngn = Number(fields.entry_fee_ngn) || 0; updates.entry_fee_ngn = channel.entry_fee_ngn; }
  if (fields.access_duration_minutes !== undefined) { channel.access_duration_minutes = Number(fields.access_duration_minutes) || 120; updates.access_duration_minutes = channel.access_duration_minutes; }
  if (fields.is_subscriber_only !== undefined) { channel.is_subscriber_only = !!fields.is_subscriber_only; updates.is_subscriber_only = channel.is_subscriber_only; }
  if (fields.subscription_price_ngn !== undefined) { channel.subscription_price_ngn = Math.max(0, Number(fields.subscription_price_ngn) || 0); updates.subscription_price_ngn = channel.subscription_price_ngn; }
  if (fields.subscription_interval_count !== undefined) { channel.subscription_interval_count = Math.max(1, Number(fields.subscription_interval_count) || 1); updates.subscription_interval_count = channel.subscription_interval_count; }
  if (fields.subscription_interval_unit !== undefined) { channel.subscription_interval_unit = fields.subscription_interval_unit || 'month'; updates.subscription_interval_unit = channel.subscription_interval_unit; }
  if (fields.is_premium_channel !== undefined) { channel.is_premium_channel = !!fields.is_premium_channel; updates.is_premium_channel = channel.is_premium_channel; }
  if (fields.premium_elevation_status !== undefined) { channel.premium_elevation_status = fields.premium_elevation_status || 'none'; updates.premium_elevation_status = channel.premium_elevation_status; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return cacheChannel(channel);
}

/**
 * Update the external stream source configuration for a channel.
 * Accepted stream_source_mode values: 'native' | 'external_url' | 'external_youtube' | 'external_hls' | 'external_dash'
 * Accepted stream_status values: 'unknown' | 'valid' | 'live' | 'scheduled' | 'offline' | 'invalid' | 'access_denied'
 */
async function updateExternalSource(id, fields) {
  const channel = await findById(id);
  if (!channel) return null;
  const updates = {};

  if (fields.stream_source_mode !== undefined) {
    if (!ALLOWED_SOURCE_MODES.includes(fields.stream_source_mode)) {
      throw new Error(`Invalid stream_source_mode: ${fields.stream_source_mode}`);
    }
    channel.stream_source_mode = fields.stream_source_mode;
    updates.stream_source_mode = channel.stream_source_mode;
  }

  if (fields.external_provider !== undefined) {
    channel.external_provider = fields.external_provider || null;
    updates.external_provider = channel.external_provider;
  }

  if (fields.external_url !== undefined) {
    channel.external_url = fields.external_url || null;
    updates.external_url = channel.external_url;
  }

  if (fields.resolved_playback_url !== undefined) {
    channel.resolved_playback_url = fields.resolved_playback_url || null;
    updates.resolved_playback_url = channel.resolved_playback_url;
  }

  if (fields.stream_status !== undefined) {
    if (!ALLOWED_STREAM_STATUSES.includes(fields.stream_status)) {
      throw new Error(`Invalid stream_status: ${fields.stream_status}`);
    }
    channel.stream_status = fields.stream_status;
    updates.stream_status = channel.stream_status;
  }

  if (fields.last_checked_at !== undefined) {
    channel.last_checked_at = fields.last_checked_at || null;
    updates.last_checked_at = channel.last_checked_at;
  }

  if (fields.provider_metadata !== undefined) {
    channel.provider_metadata = fields.provider_metadata || null;
    updates.provider_metadata = channel.provider_metadata;
  }

  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return cacheChannel(channel);
}

/**
 * Update public owner display policy for a channel.
 * owner_display_mode: show_owner | hide_owner | brand_only
 * owner_brand_name: optional, required when mode is brand_only
 */
async function updateOwnerDisplay(id, fields) {
  const channel = await findAnyById(id);
  if (!channel) return null;

  const updates = {};

  if (fields.owner_display_mode !== undefined) {
    if (!ALLOWED_OWNER_DISPLAY_MODES.includes(fields.owner_display_mode)) {
      throw new Error(`Invalid owner_display_mode: ${fields.owner_display_mode}`);
    }
    channel.owner_display_mode = fields.owner_display_mode;
    updates.owner_display_mode = channel.owner_display_mode;
  }

  if (fields.owner_brand_name !== undefined) {
    const normalized = typeof fields.owner_brand_name === 'string'
      ? fields.owner_brand_name.trim()
      : '';
    channel.owner_brand_name = normalized || null;
    updates.owner_brand_name = channel.owner_brand_name;
  }

  if ((updates.owner_display_mode || channel.owner_display_mode) === 'brand_only') {
    const brand = updates.owner_brand_name !== undefined
      ? updates.owner_brand_name
      : channel.owner_brand_name;
    if (!brand) {
      throw new Error('owner_brand_name is required when owner_display_mode is brand_only');
    }
  }

  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }

  return cacheChannel(channel);
}

async function getRecentPublic(limit = 10) {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION)
      .where('type', '==', 'public')
      .where('is_active', '==', true)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
  } catch (error) {
    if (!isLocalDevSeedEnabled()) throw error;
    return getLocalDevSeedChannels().slice(0, limit);
  }
}

async function getRecentPublicWithBanner(limit = 5, scanLimit = 20) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', 'public')
    .where('is_active', '==', true)
    .orderBy('created_at', 'desc')
    .limit(Math.max(limit, scanLimit))
    .get();

  return snapshot.docs
    .map((doc) => cacheChannel({ ...doc.data(), id: doc.id }))
    .filter((channel) => Boolean(channel.banner_url))
    .slice(0, limit);
}

async function getFeaturedChannels(limit = 5) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', 'public')
    .where('is_active', '==', true)
    .where('is_featured', '==', true)
    .orderBy('featured_at', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

async function setFeatured(id, featured, adminId) {
  const channel = await findAnyById(id);
  if (!channel) return null;

  const updates = {
    is_featured: !!featured,
    featured_at: featured ? new Date().toISOString() : null,
    featured_by: featured ? adminId : null,
  };

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update(updates);

  Object.assign(channel, updates);
  return cacheChannel(channel);
}

async function getAll() {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION)
      .where('is_active', '==', true)
      .get();
    return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
  } catch (error) {
    if (!isLocalDevSeedEnabled()) throw error;
    return getLocalDevSeedChannels();
  }
}

/** Admin: active channels that require payment. */
async function getPremiumChannels() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('requires_payment', '==', true)
    .where('is_active', '==', true)
    .get();
  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

/** Admin: channels with a pending premium-elevation request. */
async function getPendingPremiumRequests() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('premium_elevation_status', '==', 'pending')
    .get();
  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

async function getActiveByOwnerIds(ownerIds) {
  const uniqueOwnerIds = [...new Set((ownerIds || []).filter(Boolean))];
  if (uniqueOwnerIds.length === 0) return [];

  const db = getFirestore();
  const channels = [];

  for (let index = 0; index < uniqueOwnerIds.length; index += 10) {
    const batch = uniqueOwnerIds.slice(index, index + 10);
    const snapshot = await db.collection(COLLECTION)
      .where('owner_id', 'in', batch)
      .where('is_active', '==', true)
      .get();

    snapshot.docs.forEach((doc) => {
      channels.push(cacheChannel({ ...doc.data(), id: doc.id }));
    });
  }

  const ownerOrder = new Map(uniqueOwnerIds.map((ownerId, position) => [ownerId, position]));
  return channels.sort((left, right) => {
    const ownerPosition = (ownerOrder.get(left.owner_id) ?? 0) - (ownerOrder.get(right.owner_id) ?? 0);
    if (ownerPosition !== 0) return ownerPosition;
    return new Date(right.created_at || 0) - new Date(left.created_at || 0);
  });
}

async function getEvery() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => cacheChannel({ ...doc.data(), id: doc.id }));
}

/**
 * Backfill legacy channel documents with external-source field defaults.
 * Only channels missing `stream_source_mode` are updated; already-migrated
 * channels are skipped.  Uses Firestore batched writes (max 500 per batch).
 * Returns { total, updated, skipped }.
 */
async function backfillNativeDefaults() {
  const EXTERNAL_SOURCE_DEFAULTS = {
    stream_source_mode: 'native',
    external_provider: null,
    external_url: null,
    resolved_playback_url: null,
    stream_status: 'unknown',
    last_checked_at: null,
    provider_metadata: null,
  };

  const OWNER_DISPLAY_DEFAULTS = {
    owner_display_mode: 'show_owner',
    owner_brand_name: null,
  };

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  const toUpdate = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const patch = {};

      if (data.stream_source_mode === undefined) {
        Object.assign(patch, EXTERNAL_SOURCE_DEFAULTS);
      }

      if (data.owner_display_mode === undefined) {
        Object.assign(patch, OWNER_DISPLAY_DEFAULTS);
      }

      return { doc, patch };
    })
    .filter(({ patch }) => Object.keys(patch).length > 0);

  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.update(item.doc.ref, item.patch);
      // Sync in-memory cache
      const cached = channelsById.get(item.doc.id);
      if (cached) cacheChannel({ ...cached, ...item.patch });
    }
    await batch.commit();
    updated += chunk.length;
  }

  return { total: snapshot.size, updated, skipped: snapshot.size - toUpdate.length };
}

async function hardDelete(id) {
  const channel = channelsById.get(id) || await findById(id);
  if (!channel) return null;
  const db = getFirestore();

  const [statsSnap, eventsSnap, streamStatsSnap, chatMsgsSnap] = await Promise.all([
    db.collection('channel_stats').where('channel_id', '==', id).get(),
    db.collection('channel_events').where('channel_id', '==', id).limit(450).get(),
    db.collection('stream_stats').where('channel_id', '==', id).limit(450).get(),
    db.collection('channel_chats').doc(id).collection('messages').limit(450).get().catch(() => ({ docs: [] })),
  ]);

  const batch = db.batch();
  batch.delete(db.collection(COLLECTION).doc(id));
  for (const doc of statsSnap.docs) batch.delete(doc.ref);
  for (const doc of eventsSnap.docs) batch.delete(doc.ref);
  for (const doc of streamStatsSnap.docs) batch.delete(doc.ref);
  for (const doc of chatMsgsSnap.docs) batch.delete(doc.ref);
  await batch.commit();

  // Paginate remaining events if more than 450
  if (eventsSnap.size === 450) {
    const remaining = await db.collection('channel_events').where('channel_id', '==', id).get();
    for (let i = 0; i < remaining.docs.length; i += 450) {
      const b = db.batch();
      for (const doc of remaining.docs.slice(i, i + 450)) b.delete(doc.ref);
      await b.commit();
    }
  }

  // Paginate remaining stream_stats if more than 450
  if (streamStatsSnap.size === 450) {
    const remaining = await db.collection('stream_stats').where('channel_id', '==', id).get();
    for (let i = 0; i < remaining.docs.length; i += 450) {
      const b = db.batch();
      for (const doc of remaining.docs.slice(i, i + 450)) b.delete(doc.ref);
      await b.commit();
    }
  }

  // Paginate remaining chat messages if more than 450
  if (chatMsgsSnap.size === 450) {
    const remaining = await db.collection('channel_chats').doc(id).collection('messages').get().catch(() => ({ docs: [] }));
    for (let i = 0; i < remaining.docs.length; i += 450) {
      const b = db.batch();
      for (const doc of remaining.docs.slice(i, i + 450)) b.delete(doc.ref);
      await b.commit();
    }
  }

  // Delete the channel_chats document itself
  await db.collection('channel_chats').doc(id).delete().catch(() => {});

  removeCachedChannel(channel);
  return channel;
}

async function banChannel(id, reason) {
  const channel = channelsById.get(id) || await findById(id);
  if (!channel) return null;
  channel.is_banned = true;
  channel.ban_reason = reason || null;
  channel.banned_at = new Date().toISOString();
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).set({
    is_banned: true,
    ban_reason: reason || null,
    banned_at: channel.banned_at,
  }, { merge: true });
  return cacheChannel(channel);
}

async function unbanChannel(id) {
  const channel = channelsById.get(id) || await findById(id);
  if (!channel) return null;
  channel.is_banned = false;
  channel.ban_reason = null;
  channel.banned_at = null;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).set({
    is_banned: false,
    ban_reason: null,
    banned_at: null,
  }, { merge: true });
  return cacheChannel(channel);
}

module.exports = {
  init,
  create,
  findCachedById,
  findById,
  findAnyById,
  findByNumber,
  getPublicChannels,
  getRecentPublic,
  getRecentPublicWithBanner,
  getFeaturedChannels,
  setFeatured,
  getAll,
  getPremiumChannels,
  getPendingPremiumRequests,
  getActiveByOwnerIds,
  getByOwner,
  getAllByOwner,
  update,
  updateExclusiveSettings,
  updatePremium,
  updateChannelNumber,
  updateExternalSource,
  updateOwnerDisplay,
  backfillNativeDefaults,
  ALLOWED_SOURCE_MODES,
  ALLOWED_STREAM_STATUSES,
  ALLOWED_OWNER_DISPLAY_MODES,
  RESERVED_CHANNEL_NUMBERS,
  disable,
  enable,
  getEvery,
  hardDelete,
  banChannel,
  unbanChannel,
};
