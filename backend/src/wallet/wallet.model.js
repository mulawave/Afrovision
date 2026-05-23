const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wallets';
const walletsByUserId = new Map();
const walletsByAddress = new Map();
const walletsByConnectedAddress = new Map();

function normalizeAddress(address) {
  return address ? String(address).trim().toLowerCase() : null;
}

function cacheWallet(wallet) {
  if (!wallet || !wallet.user_id) return wallet;
  const normalized = { ...wallet };
  walletsByUserId.set(normalized.user_id, normalized);
  const bscAddress = normalizeAddress(normalized.bsc_address || normalized.bsc_address_lower);
  if (bscAddress) walletsByAddress.set(bscAddress, normalized);
  const connectedAddress = normalizeAddress(normalized.connected_wallet_address || normalized.connected_wallet_address_lower);
  if (connectedAddress) walletsByConnectedAddress.set(connectedAddress, normalized);
  return normalized;
}

function removeCachedWallet(wallet) {
  if (!wallet) return;
  walletsByUserId.delete(wallet.user_id);
  const bscAddress = normalizeAddress(wallet.bsc_address || wallet.bsc_address_lower);
  if (bscAddress) walletsByAddress.delete(bscAddress);
  const connectedAddress = normalizeAddress(wallet.connected_wallet_address || wallet.connected_wallet_address_lower);
  if (connectedAddress) walletsByConnectedAddress.delete(connectedAddress);
}

async function persist(wallet) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(wallet.user_id).set(wallet);
}

async function init() {
  return getAll();
}

function isInitialized() {
  return walletsByUserId.size > 0;
}

async function loadAllWallets() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => cacheWallet(doc.data()));
}

async function create({ userId, bscAddress, encryptedPrivateKey }) {
  const wallet = {
    id: crypto.randomUUID(),
    user_id: userId,
    bsc_address: bscAddress,
    bsc_address_lower: normalizeAddress(bscAddress),
    encrypted_private_key: encryptedPrivateKey,
    status: 'active',
    created_at: Date.now(),
    last_used_at: null,
  };
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
}

function findCachedByUserId(userId) {
  return walletsByUserId.get(userId) || null;
}

async function findByUserId(userId) {
  const cached = findCachedByUserId(userId);
  if (cached) return cached;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(userId).get();
  if (!doc.exists) return null;
  return cacheWallet(doc.data());
}

async function findByAddress(address) {
  const lower = normalizeAddress(address);
  if (!lower) return null;
  const cached = walletsByAddress.get(lower);
  if (cached) return cached;
  const db = getFirestore();
  let snapshot = await db.collection(COLLECTION)
    .where('bsc_address_lower', '==', lower)
    .limit(1)
    .get();
  if (snapshot.empty) {
    snapshot = await db.collection(COLLECTION)
      .where('bsc_address', '==', address)
      .limit(1)
      .get();
  }
  if (snapshot.empty) return null;
  return cacheWallet(snapshot.docs[0].data());
}

async function findByConnectedWalletAddress(address) {
  const lower = normalizeAddress(address);
  if (!lower) return null;
  const cached = walletsByConnectedAddress.get(lower);
  if (cached) return cached;
  const db = getFirestore();
  let snapshot = await db.collection(COLLECTION)
    .where('connected_wallet_address_lower', '==', lower)
    .limit(1)
    .get();
  if (snapshot.empty) {
    snapshot = await db.collection(COLLECTION)
      .where('connected_wallet_address', '==', address)
      .limit(1)
      .get();
  }
  if (snapshot.empty) return null;
  return cacheWallet(snapshot.docs[0].data());
}

async function setStatus(userId, status) {
  const wallet = await findByUserId(userId);
  if (!wallet) return null;
  wallet.status = status;
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
}

async function touchLastUsed(userId) {
  const wallet = await findByUserId(userId);
  if (!wallet) return null;
  wallet.last_used_at = Date.now();
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
}

async function getAll() {
  return loadAllWallets();
}

async function updateBscAddress(userId, newAddress) {
  const wallet = await findByUserId(userId);
  if (!wallet) return null;
  removeCachedWallet(wallet);
  wallet.bsc_address = newAddress;
  wallet.bsc_address_lower = normalizeAddress(newAddress);
  wallet.last_used_at = Date.now();
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
}

async function setConnectedWallet(userId, { address, type }) {
  const wallet = await findByUserId(userId);
  if (!wallet) return null;
  removeCachedWallet(wallet);
  wallet.connected_wallet_address = address;
  wallet.connected_wallet_address_lower = normalizeAddress(address);
  wallet.connected_wallet_type = type || 'manual';
  wallet.connected_wallet_at = Date.now();
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
}

async function clearConnectedWallet(userId) {
  const wallet = await findByUserId(userId);
  if (!wallet) return null;
  removeCachedWallet(wallet);
  wallet.connected_wallet_address = null;
  wallet.connected_wallet_address_lower = null;
  wallet.connected_wallet_type = null;
  wallet.connected_wallet_at = null;
  cacheWallet(wallet);
  await persist(wallet);
  return wallet;
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
    connected_wallet_address: wallet.connected_wallet_address || null,
    connected_wallet_type: wallet.connected_wallet_type || null,
    connected_wallet_at: wallet.connected_wallet_at || null,
  };
}

module.exports = {
  init,
  isInitialized,
  create,
  findCachedByUserId,
  findByUserId,
  findByAddress,
  findByConnectedWalletAddress,
  setStatus,
  touchLastUsed,
  updateBscAddress,
  setConnectedWallet,
  clearConnectedWallet,
  getAll,
  toSafe,
};
