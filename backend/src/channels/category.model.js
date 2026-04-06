const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'categories';
const categories = [];
let initialized = false;

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
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) {
    // Seed defaults into Firestore
    const batch = db.batch();
    for (const cat of DEFAULTS) {
      batch.set(db.collection(COLLECTION).doc(cat.id), cat);
      categories.push({ ...cat });
    }
    await batch.commit();
    console.log(`[CategoryModel] Seeded ${DEFAULTS.length} default categories`);
  } else {
    snapshot.forEach((doc) => {
      const data = doc.data();
      data.id = doc.id;
      categories.push(data);
    });
    console.log(`[CategoryModel] Loaded ${categories.length} categories from Firestore`);
  }
  initialized = true;
}

function getActive() {
  return categories.filter((c) => c.is_active);
}

function getAll(includeInactive) {
  return includeInactive ? [...categories] : getActive();
}

function findById(id) {
  return categories.find((c) => c.id === id);
}

async function create({ name }) {
  const db = getFirestore();
  const category = {
    id: `cat_${crypto.randomUUID().slice(0, 8)}`,
    name,
    is_active: true,
  };
  await db.collection(COLLECTION).doc(category.id).set(category);
  categories.push(category);
  return category;
}

async function update(id, fields) {
  const cat = findById(id);
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
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  categories.splice(idx, 1);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = { init, getActive, getAll, findById, create, update, remove };
