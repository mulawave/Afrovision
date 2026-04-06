const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wallets';
let wallets = [];
let initialized = false;

async function persist(wallet) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(wallet.user_id).set(wallet);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  wallets = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return wallets;
}

function isInitialized() {
  return initialized;
}

async function create({ userId, bscAddress, encryptedPrivateKey }) {
  const wallet = {
    id: crypto.randomUUID(),
    user_id: userId,
    bsc_address: bscAddress,
    encrypted_private_key: encryptedPrivateKey,
    status: 'active',
    created_at: Date.now(),
    last_used_at: null,
  };
  wallets.push(wallet);
  await persist(wallet);
  return wallet;
}

function findByUserId(userId) {
  return wallets.find((w) => w.user_id === userId);
}

function findByAddress(address) {
  return wallets.find((w) => w.bsc_address === address);
}

async function setStatus(userId, status) {
  const wallet = findByUserId(userId);
  if (!wallet) return null;
  wallet.status = status;
  await persist(wallet);
  return wallet;
}

async function touchLastUsed(userId) {
  const wallet = findByUserId(userId);
  if (!wallet) return null;
  wallet.last_used_at = Date.now();
  await persist(wallet);
  return wallet;
}

function getAll() {
  return wallets;
}

function toSafe(wallet) {
  if (!wallet) return null;
  return {
    id: wallet.id,
    user_id: wallet.user_id,
    bsc_address: wallet.bsc_address,
    status: wallet.status,
    created_at: wallet.created_at,
    last_used_at: wallet.last_used_at,
  };
}

module.exports = {
  init,
  isInitialized,
  create,
  findByUserId,
  findByAddress,
  setStatus,
  touchLastUsed,
  getAll,
  toSafe,
};
