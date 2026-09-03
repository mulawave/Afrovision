const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ledger';

async function persist(entry) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(entry.id).set(entry);
}

async function init() {
  return [];
}

function isInitialized() {
  return false;
}

/**
 * Ledger = source of truth. Every financial event MUST have a ledger entry.
 *
 * Entry types:
 * - PLAN_PAYMENT         — Fiat/vPT subscription payment
 * - SPLIT                — Community pool allocation
 * - VPT_QUEUE            — vPT conversion queued
 * - VPT_SWAP             — BNB→vPT swap on PancakeSwap
 * - VPT_DISTRIBUTION     — vPT sent to creator wallet
 * - WALLET_CREATED       — New BSC wallet generated
 * - SWAP_FAILED          — Swap attempt failed
 * - DISTRIBUTION_FAILED  — Token transfer failed
 *
 * Status: pending | success | failed
 */

async function create({ uid, type, amount_ngn, amount_vpt, amount_vpt_wei, tx_hash, status, meta, description,
  direction, currency, amount_vpt_units, balance_before, balance_after, reference_id, channel_id }) {
  const entry = {
    id: crypto.randomUUID(),
    uid: uid || null,
    type,
    direction: direction || null,
    currency: currency || null,
    amount_vpt_units: amount_vpt_units || 0,
    amount_ngn: amount_ngn || 0,
    amount_vpt: amount_vpt || amount_vpt_units || 0,
    amount_vpt_wei: amount_vpt_wei || '0',
    balance_before: balance_before ?? null,
    balance_after: balance_after ?? null,
    reference_id: reference_id || null,
    channel_id: channel_id || null,
    tx_hash: tx_hash || null,
    status: status || 'success',
    meta: meta || {},
    description: description || null,
    created_at: Date.now(),
  };
  await persist(entry);
  return entry;
}

/**
 * Push an entry into the in-memory cache (used by LedgerService.record
 * to keep transactional writes visible without re-loading from Firestore).
 */
function _pushEntry(entry) {
  return entry;
}

async function getByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.created_at - a.created_at);
}

async function findById(id) {
  if (!id) return null;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function updateStatus(id, status, updates = {}) {
  const entry = await findById(id);
  if (!entry) return null;
  entry.status = status;
  Object.assign(entry, updates);
  await persist(entry);
  return entry;
}

async function getByUser(uid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('uid', '==', uid)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.created_at - a.created_at);
}

async function getByType(type) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', type)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.created_at - a.created_at);
}

async function getByMeta(key, value) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where(`meta.${key}`, '==', value)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.created_at - a.created_at);
}

async function getRecent(limit = 50) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function getStats() {
  const db = getFirestore();
  const [
    totalEntriesSnap,
    planPaymentsSnap,
    vptDistributionsSnap,
    totalSwapsSnap,
    totalFailuresSnap,
  ] = await Promise.all([
    db.collection(COLLECTION).count().get(),
    db.collection(COLLECTION)
      .where('type', '==', 'PLAN_PAYMENT')
      .where('status', '==', 'success')
      .get(),
    db.collection(COLLECTION)
      .where('type', '==', 'VPT_DISTRIBUTION')
      .where('status', '==', 'success')
      .get(),
    db.collection(COLLECTION)
      .where('type', '==', 'VPT_SWAP')
      .where('status', '==', 'success')
      .count()
      .get(),
    db.collection(COLLECTION)
      .where('status', '==', 'failed')
      .count()
      .get(),
  ]);

  const totalNgnIn = planPaymentsSnap.docs.reduce((sum, doc) => {
    const entry = doc.data();
    return sum + Number(entry.amount_ngn || 0);
  }, 0);

  const totalVptDistributed = vptDistributionsSnap.docs.reduce((sum, doc) => {
    const entry = doc.data();
    return sum + Number(entry.amount_vpt || 0);
  }, 0);

  return {
    total_entries: totalEntriesSnap.data().count || 0,
    total_ngn_in: totalNgnIn,
    total_vpt_distributed: totalVptDistributed,
    total_swaps: totalSwapsSnap.data().count || 0,
    total_failures: totalFailuresSnap.data().count || 0,
  };
}

async function getSuccessfulDebitsInRange({ currency = 'ngn', startMs = 0, endMs = Date.now() } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'success')
    .where('direction', '==', 'debit')
    .where('currency', '==', currency)
    .where('created_at', '>=', startMs)
    .where('created_at', '<=', endMs)
    .get();

  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.created_at - a.created_at);
}

async function getPlanRevenueInRange({ startMs = 0, endMs = Date.now() } = {}) {
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('type', '==', 'PLAN_PAYMENT')
      .where('status', '==', 'success')
      .where('direction', '==', 'debit')
      .where('currency', '==', 'ngn')
      .where('created_at', '>=', startMs)
      .where('created_at', '<=', endMs)
      .get();

    return snapshot.docs.reduce((sum, doc) => sum + Number(doc.data().amount_ngn || 0), 0);
  } catch (err) {
    if (_isIndexError(err)) {
      const snapshot = await db.collection(COLLECTION)
        .where('type', '==', 'PLAN_PAYMENT')
        .where('status', '==', 'success')
        .where('created_at', '>=', startMs)
        .where('created_at', '<=', endMs)
        .get();
      return snapshot.docs
        .filter((d) => d.data().direction === 'debit' && d.data().currency === 'ngn')
        .reduce((sum, doc) => sum + Number(doc.data().amount_ngn || 0), 0);
    }
    throw err;
  }
}

function _isIndexError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('index') || msg.includes('Index') || msg.includes('FAILED_PRECONDITION');
}

function removeFromCache(id) {
  return id;
}

module.exports = {
  init,
  isInitialized,
  create,
  _pushEntry,
  findById,
  updateStatus,
  getByUser,
  getByType,
  getByMeta,
  getByChannel,
  getAll,
  getRecent,
  getStats,
  getSuccessfulDebitsInRange,
  getPlanRevenueInRange,
  removeFromCache,
};
