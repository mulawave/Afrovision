const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_transactions';
let transactions = [];
let initialized = false;

async function persist(transaction) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(transaction.id).set(transaction);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  transactions = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return transactions;
}

function isInitialized() {
  return initialized;
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
  transactions.push(txn);
  await persist(txn);
  return txn;
}

function getByUser(userId) {
  return transactions
    .filter((t) => t.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
  init,
  isInitialized,
  create,
  getByUser,
};
