/**
 * KYC model — Firestore-backed.
 *
 * Manages identity verification records with government ID tracking,
 * biometric capture, and expiry-based renewal.
 */
const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'kyc_records';
const FIRESTORE_IN_LIMIT = 30;

/* ── Status values ────────────────────────────────────────────── */
const KYC_STATUSES = ['none', 'pending', 'under_review', 'verified', 'rejected', 'expired', 'minor_pending'];

const ID_TYPES = [
  'national_id',
  'international_passport',
  'drivers_license',
  'voters_card',
  'nin_slip',
  'residence_permit',
];

/* ── In-memory cache ──────────────────────────────────────────── */
const recordsById = new Map();
const latestRecordIdByUser = new Map();

function syncCache(record) {
  if (!record || !record.id) return record;

  recordsById.set(record.id, record);

  const existingId = latestRecordIdByUser.get(record.user_id);
  const existing = existingId ? recordsById.get(existingId) : null;
  if (!existing || new Date(record.created_at) >= new Date(existing.created_at)) {
    latestRecordIdByUser.set(record.user_id, record.id);
  }

  return record;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.id).set(record);
}

async function init() {
  return [];
}

/* ── CRUD ─────────────────────────────────────────────────────── */
async function submit(data) {
  const record = {
    id: `kyc_${crypto.randomUUID().split('-')[0]}`,
    user_id: data.user_id,
    status: 'pending',

    // Personal info
    full_name: data.full_name,
    gender: data.gender || null,
    date_of_birth: data.date_of_birth || null,
    nationality: data.nationality || 'NG',
    phone: data.phone || null,
    address: data.address || null,

    // Government ID
    id_type: data.id_type,           // one of ID_TYPES
    id_number: data.id_number,
    id_front_url: data.id_front_url || null,
    id_back_url: data.id_back_url || null,
    id_expiry_date: data.id_expiry_date || null,

    // Biometric
    selfie_url: data.selfie_url || null,
    biometric_hash: data.biometric_hash || null,

    // Review
    reviewer_id: null,
    review_notes: null,
    reviewed_at: null,
    rejection_reason: null,

    // Renewal tracking
    renewal_requested_at: null,
    previous_kyc_id: data.previous_kyc_id || null,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await persist(record);
  return syncCache(record);
}

async function update(id, fields) {
  const rec = await findById(id);
  if (!rec) return null;
  const allowed = [
    'status', 'full_name', 'gender', 'date_of_birth', 'nationality', 'phone', 'address',
    'id_type', 'id_number', 'id_front_url', 'id_back_url', 'id_expiry_date',
    'selfie_url', 'biometric_hash',
    'reviewer_id', 'review_notes', 'reviewed_at', 'rejection_reason',
    'renewal_requested_at',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) rec[key] = fields[key];
  }
  rec.updated_at = new Date().toISOString();
  await persist(rec);
  return syncCache(rec);
}

/**
 * Update only the gender field on an existing KYC record.
 */
async function updateGender(userId, gender) {
  const rec = await findByUserId(userId);
  if (!rec) return null;
  rec.gender = gender;
  rec.updated_at = new Date().toISOString();
  await persist(rec);
  return syncCache(rec);
}

async function findByUserId(userId) {
  const cachedId = latestRecordIdByUser.get(userId);
  if (cachedId) {
    return recordsById.get(cachedId) || null;
  }

  const db = getFirestore();
  const snap = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .get();
  if (snap.empty) return null;

  const latest = snap.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  return latest || null;
}

async function findById(id) {
  if (recordsById.has(id)) {
    return recordsById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return syncCache({ id: doc.id, ...doc.data() });
}

async function list({ status, limit = 50, offset = 0 }) {
  const db = getFirestore();
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  const filtered = snap.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

async function getExpiringSoon(daysAhead = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const db = getFirestore();
  const snap = await db.collection(COLLECTION)
    .where('status', '==', 'verified')
    .get();

  return snap.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .filter((r) => {
    if (r.status !== 'verified' || !r.id_expiry_date) return false;
    return new Date(r.id_expiry_date) <= cutoff;
  });
}

async function getExpired() {
  const now = new Date();
  const db = getFirestore();
  const snap = await db.collection(COLLECTION)
    .where('status', '==', 'verified')
    .get();

  return snap.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .filter((r) => {
    if (r.status !== 'verified' || !r.id_expiry_date) return false;
    return new Date(r.id_expiry_date) < now;
  });
}

async function findManyByUserIds(userIds) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const db = getFirestore();
  const records = [];
  for (const batch of chunkArray(uniqueIds, FIRESTORE_IN_LIMIT)) {
    const snap = await db.collection(COLLECTION)
      .where('user_id', 'in', batch)
      .get();
    records.push(...snap.docs.map((doc) => syncCache({ id: doc.id, ...doc.data() })));
  }

  const latestByUser = new Map();
  for (const record of records) {
    const existing = latestByUser.get(record.user_id);
    if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
      latestByUser.set(record.user_id, record);
    }
  }

  return latestByUser;
}

async function deleteRecord(id) {
  const removed = await findById(id);
  if (!removed) return null;
  recordsById.delete(id);
  if (latestRecordIdByUser.get(removed.user_id) === id) {
    latestRecordIdByUser.delete(removed.user_id);
  }
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return removed;
}

async function countByStatus() {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).get();
  const counts = {};
  for (const doc of snap.docs) {
    const status = doc.data().status || 'pending';
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

module.exports = {
  KYC_STATUSES,
  ID_TYPES,
  init,
  submit,
  update,
  updateGender,
  findByUserId,
  findManyByUserIds,
  findById,
  list,
  getExpiringSoon,
  getExpired,
  deleteRecord,
  countByStatus,
};
