const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'withdrawals';
let withdrawals = [];
let initialized = false;

async function persist(withdrawal) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(withdrawal.id).set(withdrawal);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  withdrawals = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return withdrawals;
}

function isInitialized() {
  return initialized;
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
  withdrawals.push(withdrawal);
  await persist(withdrawal);
  return withdrawal;
}

function findById(id) {
  return withdrawals.find((w) => w.id === id);
}

function findByUid(uid) {
  return withdrawals
    .filter((w) => w.uid === uid)
    .sort((a, b) => b.created_at - a.created_at);
}

function getPending() {
  return withdrawals
    .filter((w) => w.status === 'pending')
    .sort((a, b) => b.created_at - a.created_at);
}

function getAll() {
  return withdrawals.sort((a, b) => b.created_at - a.created_at);
}

async function updateStatus(id, status, extra = {}) {
  const w = findById(id);
  if (!w) return null;
  w.status = status;
  if (status === 'approved' || status === 'rejected' || status === 'paid') {
    w.processed_at = Date.now();
  }
  Object.assign(w, extra);
  await persist(w);
  return w;
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  findByUid,
  getPending,
  getAll,
  updateStatus,
};
