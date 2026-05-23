const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'withdrawals';
const withdrawalsById = new Map();

function syncCache(withdrawal) {
  if (withdrawal && withdrawal.id) {
    withdrawalsById.set(withdrawal.id, withdrawal);
  }
  return withdrawal;
}

async function persist(withdrawal) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(withdrawal.id).set(withdrawal);
}

async function init() {
  return [];
}

function isInitialized() {
  return true;
}

async function create({ uid, amount, currency, bank_details, transaction_fee, service_charge, total_fees, total_debit, vat_amount, vat_rate }) {
  const withdrawal = {
    id: crypto.randomUUID(),
    uid,
    amount,                                  // payout amount (what user receives)
    transaction_fee: transaction_fee || 0,   // provider processing fee
    service_charge: service_charge || 0,     // AfroVision service charge
    total_fees: total_fees || 0,             // transaction_fee + service_charge
    vat_amount: vat_amount || 0,             // 7.5% VAT on fees
    vat_rate: vat_rate || 0,                 // VAT rate (0.075)
    total_debit: total_debit || amount,      // total taken from wallet (amount + fees + VAT)
    currency: currency || 'ngn',
    bank_details: bank_details || null,
    status: 'pending',
    created_at: Date.now(),
    processed_at: null,
  };
  await persist(withdrawal);
  return syncCache(withdrawal);
}

async function findById(id) {
  if (withdrawalsById.has(id)) {
    return withdrawalsById.get(id);
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return syncCache({ id: doc.id, ...doc.data() });
}

async function findByUid(uid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('uid', '==', uid)
    .get();
  return snapshot.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function getPending() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .get();
  return snapshot.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function listPage({ limit = 100, startAfterCreatedAt = null, startAfterId = null, status = null } = {}) {
  const db = getFirestore();
  let query = db.collection(COLLECTION);
  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('created_at', 'desc').orderBy('__name__', 'desc').limit(Math.max(1, Math.min(limit, 500)));

  if (startAfterCreatedAt != null && startAfterId) {
    query = query.startAfter(startAfterCreatedAt, startAfterId);
  }

  const snapshot = await query.get();
  const withdrawals = snapshot.docs.map((doc) => syncCache({ id: doc.id, ...doc.data() }));
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return {
    withdrawals,
    nextCursor: lastDoc
      ? {
        created_at: Number(lastDoc.data().created_at || 0),
        id: lastDoc.id,
      }
      : null,
  };
}

async function updateStatus(id, status, extra = {}) {
  const w = await findById(id);
  if (!w) return null;
  w.status = status;
  if (status === 'approved' || status === 'rejected' || status === 'paid') {
    w.processed_at = Date.now();
  }
  Object.assign(w, extra);
  await persist(w);
  return syncCache(w);
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  findByUid,
  getPending,
  getAll,
  listPage,
  updateStatus,
};
