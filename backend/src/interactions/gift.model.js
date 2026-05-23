const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'gifts';
let gifts = [];
let initialized = false;

function cacheGift(gift) {
  if (!gift) return null;
  const idx = gifts.findIndex((entry) => entry.id === gift.id);
  if (idx !== -1) gifts[idx] = gift;
  else gifts.push(gift);
  return gift;
}

async function persist(gift) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(gift.id).set(gift);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  gifts = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return gifts;
}

function isInitialized() {
  return initialized;
}

async function create({ name, icon, imageUrl, animation, currency, vptUnits, nairaValue, sortOrder }) {
  const gift = {
    id: crypto.randomUUID(),
    name,
    icon,
    image_url: imageUrl || null,
    animation: animation || null,
    currency, // 'vpt' | 'ngn'
    vpt_units: currency === 'vpt' ? (vptUnits || 0) : 0,
    naira_value: currency === 'ngn' ? (nairaValue || 0) : 0,
    is_active: true,
    sort_order: sortOrder || 0,
    created_at: Date.now(),
  };
  gifts.push(gift);
  await persist(gift);
  return gift;
}

async function findById(id) {
  const cached = gifts.find((gift) => gift.id === id) || null;
  if (cached) return cached;

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return cacheGift({ id: doc.id, ...doc.data() });
}

async function findManyByIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const results = new Map();
  if (uniqueIds.length === 0) return results;

  const missingIds = [];
  for (const id of uniqueIds) {
    const cached = gifts.find((gift) => gift.id === id) || null;
    if (cached) {
      results.set(id, cached);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return results;

  const db = getFirestore();
  const refs = missingIds.map((id) => db.collection(COLLECTION).doc(id));
  const docs = await db.getAll(...refs);
  docs.forEach((doc, idx) => {
    const id = missingIds[idx];
    if (!doc.exists) {
      results.set(id, null);
      return;
    }

    const gift = cacheGift({ id: doc.id, ...doc.data() });
    results.set(id, gift);
  });

  return results;
}

async function getActive() {
  if (initialized) {
    return gifts
      .filter((gift) => gift.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('is_active', '==', true)
    .orderBy('sort_order')
    .get();

  gifts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  initialized = true;
  return [...gifts];
}

async function getAll() {
  if (initialized) {
    return [...gifts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).orderBy('sort_order').get();

  gifts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  initialized = true;
  return [...gifts];
}

async function update(id, fields) {
  const gift = await findById(id);
  if (!gift) return null;
  if (fields.name !== undefined) gift.name = fields.name;
  if (fields.icon !== undefined) gift.icon = fields.icon;
  if (fields.image_url !== undefined) gift.image_url = fields.image_url;
  if (fields.animation !== undefined) gift.animation = fields.animation;
  if (fields.currency !== undefined) gift.currency = fields.currency;
  if (fields.vpt_units !== undefined) gift.vpt_units = fields.vpt_units;
  if (fields.naira_value !== undefined) gift.naira_value = fields.naira_value;
  if (fields.sort_order !== undefined) gift.sort_order = fields.sort_order;
  if (fields.is_active !== undefined) gift.is_active = fields.is_active;
  await persist(gift);

  // sync in-memory cache
  const idx = gifts.findIndex((g) => g.id === id);
  if (idx !== -1) gifts[idx] = gift;
  else gifts.push(gift);

  return gift;
}

async function remove(id) {
  const gift = await findById(id);
  if (!gift) return false;
  const idx = gifts.findIndex((g) => g.id === id);
  if (idx !== -1) gifts.splice(idx, 1);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  findManyByIds,
  getActive,
  getAll,
  update,
  remove,
};
