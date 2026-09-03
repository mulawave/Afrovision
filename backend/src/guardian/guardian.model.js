/**
 * Guardian model — Firestore-backed.
 *
 * Manages guardian/guarantor records for minor users.
 * Collection: guardian_records
 */
const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'guardian_records';

const GUARDIAN_STATUSES = ['pending', 'verified', 'rejected'];

const RELATIONSHIPS = ['parent', 'legal_guardian', 'sibling', 'relative', 'other'];

const recordsById = new Map();
const latestRecordIdByUser = new Map();

function syncCache(record) {
  if (!record || !record.id) return record;
  recordsById.set(record.id, record);

  const existingId = latestRecordIdByUser.get(record.minor_user_id);
  const existing = existingId ? recordsById.get(existingId) : null;
  if (!existing || new Date(record.created_at) >= new Date(existing.created_at)) {
    latestRecordIdByUser.set(record.minor_user_id, record.id);
  }

  return record;
}

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.id).set(record);
}

async function init() {
  return [];
}

async function submit(data) {
  const record = {
    id: `guard_${crypto.randomUUID().split('-')[0]}`,
    minor_user_id: data.minor_user_id,
    status: 'pending',

    // Guardian personal info
    guardian_full_name: data.guardian_full_name,
    guardian_email: data.guardian_email,
    guardian_phone: data.guardian_phone,
    guardian_relationship: data.guardian_relationship,
    guardian_address: data.guardian_address,

    // Guardian KYC documents (if no existing account)
    guardian_id_type: data.guardian_id_type || null,
    guardian_id_number: data.guardian_id_number || null,
    guardian_id_front_url: data.guardian_id_front_url || null,
    guardian_id_back_url: data.guardian_id_back_url || null,
    guardian_selfie_url: data.guardian_selfie_url || null,

    // If guardian has existing AfroVision account
    guardian_account_uid: data.guardian_account_uid || null,

    // Consent
    consent_declaration: data.consent_declaration,
    consent_signature: data.consent_signature,
    consent_date: data.consent_date,

    // Review
    reviewer_id: null,
    review_notes: null,
    reviewed_at: null,
    rejection_reason: null,

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
    'status', 'reviewer_id', 'review_notes', 'reviewed_at', 'rejection_reason',
    'guardian_full_name', 'guardian_email', 'guardian_phone', 'guardian_relationship',
    'guardian_address', 'guardian_id_type', 'guardian_id_number',
    'guardian_id_front_url', 'guardian_id_back_url', 'guardian_selfie_url',
    'guardian_account_uid', 'consent_declaration', 'consent_signature', 'consent_date',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) rec[key] = fields[key];
  }
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
    .where('minor_user_id', '==', userId)
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

async function deleteRecord(id) {
  const removed = await findById(id);
  if (!removed) return null;
  recordsById.delete(id);
  if (latestRecordIdByUser.get(removed.minor_user_id) === id) {
    latestRecordIdByUser.delete(removed.minor_user_id);
  }
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return removed;
}

module.exports = {
  GUARDIAN_STATUSES,
  RELATIONSHIPS,
  init,
  submit,
  update,
  findByUserId,
  findById,
  list,
  deleteRecord,
};
