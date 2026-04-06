const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'ledger';
let entries = [];
let initialized = false;

async function persist(entry) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(entry.id).set(entry);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  entries = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return entries;
}

function isInitialized() {
  return initialized;
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
  entries.push(entry);
  await persist(entry);
  return entry;
}

/**
 * Push an entry into the in-memory cache (used by LedgerService.record
 * to keep transactional writes visible without re-loading from Firestore).
 */
function _pushEntry(entry) {
  entries.push(entry);
}

function getByChannel(channelId) {
  return entries
    .filter((e) => e.channel_id === channelId)
    .sort((a, b) => b.created_at - a.created_at);
}

function findById(id) {
  return entries.find((e) => e.id === id);
}

async function updateStatus(id, status, updates = {}) {
  const entry = findById(id);
  if (!entry) return null;
  entry.status = status;
  Object.assign(entry, updates);
  await persist(entry);
  return entry;
}

function getByUser(uid) {
  return entries
    .filter((e) => e.uid === uid)
    .sort((a, b) => b.created_at - a.created_at);
}

function getByType(type) {
  return entries
    .filter((e) => e.type === type)
    .sort((a, b) => b.created_at - a.created_at);
}

function getByMeta(key, value) {
  return entries.filter((e) => e.meta && e.meta[key] === value);
}

function getAll() {
  return entries.sort((a, b) => b.created_at - a.created_at);
}

function getRecent(limit = 50) {
  return entries
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function getStats() {
  return {
    total_entries: entries.length,
    total_ngn_in: entries
      .filter((e) => e.type === 'PLAN_PAYMENT' && e.status === 'success')
      .reduce((sum, e) => sum + e.amount_ngn, 0),
    total_vpt_distributed: entries
      .filter((e) => e.type === 'VPT_DISTRIBUTION' && e.status === 'success')
      .reduce((sum, e) => sum + e.amount_vpt, 0),
    total_swaps: entries.filter((e) => e.type === 'VPT_SWAP' && e.status === 'success').length,
    total_failures: entries.filter((e) => e.status === 'failed').length,
  };
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
};
