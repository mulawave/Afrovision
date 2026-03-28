const crypto = require('crypto');

const entries = [];

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

function create({ uid, type, amount_ngn, amount_vpt, tx_hash, status, meta, description }) {
  const entry = {
    id: crypto.randomUUID(),
    uid: uid || null,
    type,
    amount_ngn: amount_ngn || 0,
    amount_vpt: amount_vpt || 0,
    tx_hash: tx_hash || null,
    status: status || 'success',
    meta: meta || {},
    description: description || null,
    created_at: Date.now(),
  };
  entries.push(entry);
  return entry;
}

function findById(id) {
  return entries.find((e) => e.id === id);
}

function updateStatus(id, status, updates = {}) {
  const entry = findById(id);
  if (!entry) return null;
  entry.status = status;
  Object.assign(entry, updates);
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
  create,
  findById,
  updateStatus,
  getByUser,
  getByType,
  getByMeta,
  getAll,
  getRecent,
  getStats,
};
