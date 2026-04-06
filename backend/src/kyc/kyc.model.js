/**
 * KYC model — Firestore-backed.
 *
 * Manages identity verification records with government ID tracking,
 * biometric capture, and expiry-based renewal.
 */
const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'kyc_records';

/* ── Status values ────────────────────────────────────────────── */
const KYC_STATUSES = ['none', 'pending', 'under_review', 'verified', 'rejected', 'expired'];

const ID_TYPES = [
  'national_id',
  'international_passport',
  'drivers_license',
  'voters_card',
  'nin_slip',
  'residence_permit',
];

/* ── In-memory cache ──────────────────────────────────────────── */
let records = [];
let initialized = false;

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.id).set(record);
}

async function init() {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).get();
  records = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  initialized = true;
}

/* ── CRUD ─────────────────────────────────────────────────────── */
async function submit(data) {
  const record = {
    id: `kyc_${crypto.randomUUID().split('-')[0]}`,
    user_id: data.user_id,
    status: 'pending',

    // Personal info
    full_name: data.full_name,
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
  records.push(record);
  await persist(record);
  return record;
}

async function update(id, fields) {
  const rec = records.find((r) => r.id === id);
  if (!rec) return null;
  const allowed = [
    'status', 'full_name', 'date_of_birth', 'nationality', 'phone', 'address',
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
  return rec;
}

function findByUserId(userId) {
  return records
    .filter((r) => r.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function findById(id) {
  return records.find((r) => r.id === id) || null;
}

function list({ status, limit = 50, offset = 0 }) {
  let filtered = [...records];
  if (status) filtered = filtered.filter((r) => r.status === status);
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

function getExpiringSoon(daysAhead = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return records.filter((r) => {
    if (r.status !== 'verified' || !r.id_expiry_date) return false;
    return new Date(r.id_expiry_date) <= cutoff;
  });
}

function getExpired() {
  const now = new Date();
  return records.filter((r) => {
    if (r.status !== 'verified' || !r.id_expiry_date) return false;
    return new Date(r.id_expiry_date) < now;
  });
}

async function deleteRecord(id) {
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const removed = records.splice(idx, 1)[0];
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return removed;
}

module.exports = {
  KYC_STATUSES,
  ID_TYPES,
  init,
  submit,
  update,
  findByUserId,
  findById,
  list,
  getExpiringSoon,
  getExpired,
  deleteRecord,
};
