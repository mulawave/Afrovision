const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_transactions';

async function persist(transaction) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(transaction.id).set(transaction);
}

async function init() {
  return [];
}

function isInitialized() {
  return true;
}

async function create({ userId, type, amount, amountWei, description }) {
  const txn = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    amount,
    amount_wei: amountWei || '0',
    description: description || null,
    created_at: new Date().toISOString(),
  };
  await persist(txn);
  return txn;
}

async function getByUser(userId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
  init,
  isInitialized,
  create,
  getByUser,
};
