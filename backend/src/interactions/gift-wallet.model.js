const { getFirestore } = require('../utils/firestore');
const User = require('../users/user.model');

// ── Migration bridge ─────────────────────────────────────
// Balances now live on the user document (users/{uid}.vpt, .cash).
// GiftWallet functions translate to user-model operations and return
// the old shape { uid, vpt_units, ngn_balance } for backward compat.
// The old 'gift_wallets' Firestore collection is no longer written to.

const USERS_COLLECTION = 'users';

function _toWalletShape(user) {
  return {
    uid: user.id,
    vpt_units: user.vpt || 0,
    ngn_balance: user.cash || 0,
    updated_at: Date.now(),
  };
}

async function init() {
  // No-op — balances live on user docs loaded by User.init()
  return [];
}

function isInitialized() {
  return User.isInitialized();
}

function findByUid(uid) {
  const user = User.findCachedById(uid);
  if (!user) return undefined;
  return _toWalletShape(user);
}

async function ensureWallet(uid) {
  let user = await User.findById(uid);
  if (!user) return { uid, vpt_units: 0, ngn_balance: 0, updated_at: Date.now() };
  return _toWalletShape(user);
}

async function adjustVptUnits(uid, delta) {
  const updated = await User.adjustVpt(uid, delta);
  if (!updated) return { uid, vpt_units: 0, ngn_balance: 0, updated_at: Date.now() };
  return _toWalletShape(updated);
}

async function adjustNgnBalance(uid, delta) {
  const updated = await User.adjustCash(uid, delta);
  if (!updated) return { uid, vpt_units: 0, ngn_balance: 0, updated_at: Date.now() };
  return _toWalletShape(updated);
}

function getAll() {
  return User.getCachedAll().map(_toWalletShape);
}

async function reloadFromFirestore(uid) {
  const user = await User.reloadFromFirestore(uid);
  if (!user) return null;
  return _toWalletShape(user);
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
