const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'payments';
const paymentsById = new Map();

function syncCache(payment) {
  if (payment && payment.id) {
    paymentsById.set(payment.id, payment);
  }
  return payment;
}

async function persist(payment) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(payment.id).set(payment);
}

async function init() {
  return [];
}

function isInitialized() {
  return true;
}

async function findById(id) {
  if (paymentsById.has(id)) {
    return paymentsById.get(id);
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return syncCache({ id: doc.id, ...doc.data() });
}

async function findByReference(reference) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('reference', '==', reference)
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return syncCache({ id: doc.id, ...doc.data() });
}

async function getByUser(uid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('uid', '==', uid)
    .get();
  return snapshot.docs
    .map((doc) => syncCache({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function findByProviderPurchaseToken(provider, purchaseToken) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('provider', '==', provider)
    .where('provider_payment_id', '==', purchaseToken)
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return syncCache({ id: doc.id, ...doc.data() });
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
  await persist(payment);
  return syncCache(payment);
}

async function update(id, fields) {
  const payment = await findById(id);
  if (!payment) return null;
  Object.assign(payment, fields, { updated_at: Date.now() });
  await persist(payment);
  return syncCache(payment);
}

module.exports = {
  init,
  isInitialized,
  findById,
  findByReference,
  getByUser,
  findByProviderPurchaseToken,
  create,
  update,
};
