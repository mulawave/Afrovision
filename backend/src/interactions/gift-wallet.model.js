const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'gift_wallets';
let wallets = [];
let initialized = false;

async function persist(wallet) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(wallet.uid).set(wallet);
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

function findByUid(uid) {
  return wallets.find((w) => w.uid === uid);
}

async function ensureWallet(uid) {
  let wallet = findByUid(uid);
  if (!wallet) {
    wallet = {
      uid,
      vpt_units: 0,
      ngn_balance: 0,
      updated_at: Date.now(),
    };
    wallets.push(wallet);
    await persist(wallet);
  }
  return wallet;
}

async function adjustVptUnits(uid, delta) {
  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(uid);
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    let data;
    if (snap.exists) {
      data = snap.data();
    } else {
      data = { uid, vpt_units: 0, ngn_balance: 0, updated_at: Date.now() };
    }
    data.vpt_units += delta;
    data.updated_at = Date.now();
    tx.set(docRef, data);
    return data;
  });
  // Sync in-memory cache
  const idx = wallets.findIndex((w) => w.uid === uid);
  if (idx >= 0) wallets[idx] = updated;
  else wallets.push(updated);
  return updated;
}

async function adjustNgnBalance(uid, delta) {
  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(uid);
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    let data;
    if (snap.exists) {
      data = snap.data();
    } else {
      data = { uid, vpt_units: 0, ngn_balance: 0, updated_at: Date.now() };
    }
    data.ngn_balance += delta;
    data.updated_at = Date.now();
    tx.set(docRef, data);
    return data;
  });
  // Sync in-memory cache
  const idx = wallets.findIndex((w) => w.uid === uid);
  if (idx >= 0) wallets[idx] = updated;
  else wallets.push(updated);
  return updated;
}

function getAll() {
  return wallets;
}

async function reloadFromFirestore(uid) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const idx = wallets.findIndex((w) => w.uid === uid);
  if (idx >= 0) wallets[idx] = data;
  else wallets.push(data);
  return data;
}

module.exports = {
  init,
  isInitialized,
  findByUid,
  ensureWallet,
  adjustVptUnits,
  adjustNgnBalance,
  getAll,
  reloadFromFirestore,
};
