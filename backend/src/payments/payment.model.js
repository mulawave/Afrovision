const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'payments';
let payments = [];
let initialized = false;

async function persist(payment) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(payment.id).set(payment);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  payments = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return payments;
}

function isInitialized() {
  return initialized;
}

function findById(id) {
  return payments.find((payment) => payment.id === id) || null;
}

function findByReference(reference) {
  return payments.find((payment) => payment.reference === reference) || null;
}

function getByUser(uid) {
  return payments
    .filter((payment) => payment.uid === uid)
    .sort((a, b) => b.created_at - a.created_at);
}

async function create(input) {
  const timestamp = Date.now();
  const payment = {
    id: crypto.randomUUID(),
    uid: input.uid,
    purpose: input.purpose,
    provider: input.provider,
    status: input.status || 'pending',
    currency: input.currency || 'NGN',
    amount_ngn: Number(input.amount_ngn || 0),
    balance_type: input.balance_type || null,
    plan_id: input.plan_id || null,
    billing_cycle: input.billing_cycle || 'monthly',
    reference: input.reference || null,
    checkout_url: input.checkout_url || null,
    provider_payment_id: input.provider_payment_id || null,
    raw_status: input.raw_status || null,
    error: input.error || null,
    meta: input.meta || {},
    verified_at: input.verified_at || null,
    applied_at: input.applied_at || null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  payments.push(payment);
  await persist(payment);
  return payment;
}

async function update(id, fields) {
  const payment = findById(id);
  if (!payment) return null;
  Object.assign(payment, fields, { updated_at: Date.now() });
  await persist(payment);
  return payment;
}

module.exports = {
  init,
  isInitialized,
  findById,
  findByReference,
  getByUser,
  create,
  update,
};
