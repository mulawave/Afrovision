const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'announcements';
const announcementsById = new Map();

function cacheAnnouncement(announcement) {
  if (!announcement || !announcement.id) return announcement;
  announcementsById.set(announcement.id, announcement);
  return announcement;
}

function removeCachedAnnouncement(announcement) {
  if (!announcement) return;
  announcementsById.delete(announcement.id);
}

async function init() {
  return getAll();
}

async function create({ title, body, icon, color, priority, createdBy }) {
  const db = getFirestore();
  const id = require('crypto').randomUUID();
  const announcement = {
    id,
    title,
    body,
    icon: icon || 'campaign',
    color: color || '#FF9800',
    priority: priority || 'normal', // normal | high | urgent
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: createdBy || null,
  };
  await db.collection(COLLECTION).doc(id).set(announcement);
  return cacheAnnouncement(announcement);
}

async function findById(id) {
  const cached = announcementsById.get(id);
  if (cached) return cached.is_active ? cached : null;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const announcement = cacheAnnouncement({ ...doc.data(), id: doc.id });
  return announcement.is_active ? announcement : null;
}

async function findAnyById(id) {
  const cached = announcementsById.get(id);
  if (cached) return cached;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return cacheAnnouncement({ ...doc.data(), id: doc.id });
}

async function getAll({ includeInactive = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  const announcements = snapshot.docs.map((doc) => cacheAnnouncement({ ...doc.data(), id: doc.id }));
  if (!includeInactive) {
    return announcements.filter((a) => a.is_active);
  }
  return announcements;
}

async function getActive(limit = 10) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('is_active', '==', true)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => cacheAnnouncement({ ...doc.data(), id: doc.id }));
}

async function update(id, fields) {
  const announcement = await findAnyById(id);
  if (!announcement) return null;
  const updates = {};
  if (fields.title !== undefined) { announcement.title = fields.title; updates.title = fields.title; }
  if (fields.body !== undefined) { announcement.body = fields.body; updates.body = fields.body; }
  if (fields.icon !== undefined) { announcement.icon = fields.icon; updates.icon = fields.icon; }
  if (fields.color !== undefined) { announcement.color = fields.color; updates.color = fields.color; }
  if (fields.priority !== undefined) { announcement.priority = fields.priority; updates.priority = fields.priority; }
  if (fields.is_active !== undefined) { announcement.is_active = !!fields.is_active; updates.is_active = announcement.is_active; }
  updates.updated_at = new Date().toISOString();
  announcement.updated_at = updates.updated_at;
  
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return cacheAnnouncement(announcement);
}

async function disable(id) {
  const announcement = announcementsById.get(id) || await findById(id);
  if (!announcement) return null;
  announcement.is_active = false;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ is_active: false, updated_at: new Date().toISOString() });
  return cacheAnnouncement(announcement);
}

async function enable(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const announcement = cacheAnnouncement({ ...doc.data(), id: doc.id, is_active: true, updated_at: new Date().toISOString() });
  await db.collection(COLLECTION).doc(id).update({ is_active: true, updated_at: new Date().toISOString() });
  return announcement;
}

module.exports = {
  init,
  create,
  findById,
  findAnyById,
  getAll,
  getActive,
  update,
  disable,
  enable,
  PRIORITIES: ['normal', 'high', 'urgent'],
};
