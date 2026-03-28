const crypto = require('crypto');

const categories = [
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

function getActive() {
  return categories.filter((c) => c.is_active);
}

function getAll(includeInactive) {
  return includeInactive ? [...categories] : getActive();
}

function findById(id) {
  return categories.find((c) => c.id === id);
}

function create({ name }) {
  const category = {
    id: `cat_${crypto.randomUUID().slice(0, 8)}`,
    name,
    is_active: true,
  };
  categories.push(category);
  return category;
}

function update(id, fields) {
  const cat = findById(id);
  if (!cat) return null;
  if (fields.name !== undefined) cat.name = fields.name;
  if (fields.is_active !== undefined) cat.is_active = fields.is_active;
  return cat;
}

function remove(id) {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  categories.splice(idx, 1);
  return true;
}

module.exports = { getActive, getAll, findById, create, update, remove };
