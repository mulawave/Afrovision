const { getFirestore } = require('../utils/firestore');
const crypto = require('crypto');

const COLLECTION = 'media_center_heroes';
const ALLOWED_LINK_TYPES = new Set(['movie', 'series', 'channel', 'url']);

function sanitizeLink(raw) {
  const link = (raw || '').toString().trim();
  if (!link) return '';
  // Allow raw entity ids (channel/movie/series) or a safe URL/relative path.
  if (link.startsWith('/')) return link;
  try {
    const url = new URL(link);
    if (['http:', 'https:'].includes(url.protocol)) return link;
  } catch (_) { /* fallthrough */ }
  // Fallback: treat as an id (letters, digits, `_`, `-`, `.`, `:` allowed).
  if (/^[A-Za-z0-9_\-.:]{1,200}$/.test(link)) return link;
  return '';
}

function normalize(input, { existingId } = {}) {
  const now = Date.now();
  const linkType = ALLOWED_LINK_TYPES.has((input.link_type || '').toString())
    ? input.link_type
    : 'url';
  return {
    id: existingId || (input.id && String(input.id).trim()) || crypto.randomUUID(),
    title: (input.title || '').toString().trim().slice(0, 120),
    subtitle: (input.subtitle || '').toString().trim().slice(0, 200),
    image_url: (input.image_url || '').toString().trim().slice(0, 2000),
    link_type: linkType,
    link_target: sanitizeLink(input.link_target),
    priority: Number.isFinite(Number(input.priority))
      ? Math.max(0, Math.min(1000, Math.trunc(Number(input.priority))))
      : 0,
    is_active: typeof input.is_active === 'boolean' ? input.is_active : true,
    starts_at: Number.isFinite(Number(input.starts_at))
      ? Number(input.starts_at)
      : null,
    ends_at: Number.isFinite(Number(input.ends_at))
      ? Number(input.ends_at)
      : null,
    created_at: input.created_at || now,
    created_by: input.created_by || null,
    updated_at: now,
    updated_by: input.updated_by || null,
  };
}

async function listPublicActive({ limit = 6 } = {}) {
  const db = getFirestore();
  const now = Date.now();
  // The composite index used here is added to firestore.indexes.json.
  const snapshot = await db.collection(COLLECTION)
    .where('is_active', '==', true)
    .orderBy('priority', 'desc')
    .limit(Math.max(1, Math.min(50, limit)))
    .get();

  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((h) => {
      if (h.starts_at != null && now < h.starts_at) return false;
      if (h.ends_at != null && now > h.ends_at) return false;
      return true;
    });
}

async function listAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .orderBy('priority', 'desc')
    .limit(200)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function create(input, { adminId }) {
  const db = getFirestore();
  const hero = normalize({
    ...input,
    created_by: adminId,
    updated_by: adminId,
  });
  await db.collection(COLLECTION).doc(hero.id).set(hero);
  return hero;
}

async function update(id, input, { adminId }) {
  const db = getFirestore();
  const existing = await findById(id);
  if (!existing) return null;
  const merged = normalize({
    ...existing,
    ...input,
    updated_by: adminId,
  }, { existingId: id });
  await db.collection(COLLECTION).doc(id).set(merged, { merge: true });
  return merged;
}

async function remove(id) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = {
  COLLECTION,
  listPublicActive,
  listAll,
  findById,
  create,
  update,
  remove,
};
