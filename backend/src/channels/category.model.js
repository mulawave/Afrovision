const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'categories';

const DEFAULTS = [
  { id: 'cat_entertainment', name: 'Entertainment', is_active: true },
  { id: 'cat_sports', name: 'Sports', is_active: true },
  { id: 'cat_news', name: 'News', is_active: true },
  { id: 'cat_education', name: 'Education', is_active: true },
  { id: 'cat_music', name: 'Music', is_active: true },
  { id: 'cat_gaming', name: 'Gaming', is_active: true },
  { id: 'cat_lifestyle', name: 'Lifestyle', is_active: true },
  { id: 'cat_technology', name: 'Technology', is_active: true },
  { id: 'cat_comedy', name: 'Comedy', is_active: true },
  { id: 'cat_documentary', name: 'Documentary', is_active: true },
];

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) {
    // Seed defaults into Firestore
    const batch = db.batch();
    for (const cat of DEFAULTS) {
      batch.set(db.collection(COLLECTION).doc(cat.id), cat);
    }
    await batch.commit();
    console.log(`[CategoryModel] Seeded ${DEFAULTS.length} default categories`);
    return DEFAULTS.map((cat) => ({ ...cat }));
  } else {
    const categories = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    console.log(`[CategoryModel] Loaded ${categories.length} categories from Firestore`);
    return categories;
  }
}

async function getActive() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('is_active', '==', true)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getAll(includeInactive) {
  if (!includeInactive) return getActive();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function create({ name }) {
  const db = getFirestore();
  const category = {
    id: `cat_${crypto.randomUUID().slice(0, 8)}`,
    name,
    is_active: true,
  };
  await db.collection(COLLECTION).doc(category.id).set(category);
  return category;
}

async function update(id, fields) {
  const cat = await findById(id);
  if (!cat) return null;
  const updates = {};
  if (fields.name !== undefined) { cat.name = fields.name; updates.name = fields.name; }
  if (fields.is_active !== undefined) { cat.is_active = fields.is_active; updates.is_active = fields.is_active; }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return cat;
}

async function remove(id) {
  const existing = await findById(id);
  if (!existing) return false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = { init, getActive, getAll, findById, create, update, remove };
