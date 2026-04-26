const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'gifts';
let gifts = [];
let initialized = false;

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
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function getActive() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('is_active', '==', true)
    .orderBy('sort_order')
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).orderBy('sort_order').get();
  return snapshot.docs.map((doc) => doc.data());
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
  getActive,
  getAll,
  update,
  remove,
};
