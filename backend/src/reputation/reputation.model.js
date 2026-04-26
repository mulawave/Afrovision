const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'reputation';
const cache = new Map();
let initialized = false;

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRecord(data, userId) {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    total_reps: normalizeNumber(data.total_reps, 0),
    level: normalizeNumber(data.level, 0),
    total_gifting_ngn: normalizeNumber(data.total_gifting_ngn, 0),
    total_gifting_vpt: normalizeNumber(data.total_gifting_vpt, 0),
    community_pool_eligible: Boolean(data.community_pool_eligible),
    leaderboard_rank: data.leaderboard_rank == null ? null : normalizeNumber(data.leaderboard_rank, null),
    created_at: data.created_at || now,
    last_updated: data.last_updated || now,
  };
}

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.user_id).set(record);
}

async function init() {
  if (initialized) return;

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  cache.clear();

  snapshot.forEach((doc) => {
    const record = normalizeRecord(doc.data() || {}, doc.id);
    cache.set(record.user_id, record);
  });

  initialized = true;
}

function getByUserId(userId) {
  if (!userId) return null;
  const record = cache.get(userId);
  return record ? { ...record } : null;
}

function getAll() {
  return Array.from(cache.values()).map((record) => ({ ...record }));
}

function getLeaderboard(limit = 50, offset = 0) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const sorted = Array.from(cache.values())
    .sort((a, b) => {
      if (b.total_reps !== a.total_reps) {
        return b.total_reps - a.total_reps;
      }
      return a.user_id.localeCompare(b.user_id);
    })
    .slice(safeOffset, safeOffset + safeLimit);

  return sorted.map((record) => ({ ...record }));
}

async function upsert(data) {
  if (!data || !data.user_id) {
    throw new Error('user_id is required');
  }

  const existing = cache.get(data.user_id);
  const merged = normalizeRecord({
    ...(existing || {}),
    ...data,
    created_at: existing?.created_at || data.created_at,
    last_updated: data.last_updated || new Date().toISOString(),
  }, data.user_id);

  cache.set(merged.user_id, merged);
  await persist(merged);
  return { ...merged };
}

module.exports = {
  init,
  getByUserId,
  getAll,
  getLeaderboard,
  upsert,
};