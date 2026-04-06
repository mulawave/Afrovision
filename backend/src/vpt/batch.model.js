const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_batches';
let batches = [];
let initialized = false;

/**
 * vPT Batches — groups queue items into a single swap operation.
 *
 * Statuses:
 * - pending      — Batch created, awaiting swap
 * - swapped      — PancakeSwap executed, vPT received
 * - distributed  — All items distributed to creator wallets
 * - failed       — Swap or distribution failed
 *
 * Retry: batch-level, max 3 attempts.
 */

const MAX_RETRIES = 3;

async function persist(batch) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(batch.id).set(batch);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  batches = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return batches;
}

function isInitialized() {
  return initialized;
}

async function create({ totalNGN, itemIds }) {
  const batch = {
    id: crypto.randomUUID(),
    total_ngn: totalNGN,
    total_bnb: 0,
    total_vpt: 0,
    total_vpt_wei: '0',
    tx_hash: null,
    status: 'pending',
    item_ids: itemIds || [],
    item_count: itemIds ? itemIds.length : 0,
    retry_count: 0,
    created_at: Date.now(),
    swapped_at: null,
    distributed_at: null,
  };
  batches.push(batch);
  await persist(batch);
  return batch;
}

function findById(id) {
  return batches.find((b) => b.id === id);
}

async function setSwapped(id, { totalBNB, totalVPT, totalVPTWei, txHash }) {
  const batch = findById(id);
  if (!batch) return null;
  batch.status = 'swapped';
  batch.total_bnb = totalBNB;
  batch.total_vpt = totalVPT;
  batch.total_vpt_wei = totalVPTWei || '0';
  batch.tx_hash = txHash;
  batch.swapped_at = Date.now();
  await persist(batch);
  return batch;
}

async function setDistributed(id) {
  const batch = findById(id);
  if (!batch) return null;
  batch.status = 'distributed';
  batch.distributed_at = Date.now();
  await persist(batch);
  return batch;
}

async function setFailed(id) {
  const batch = findById(id);
  if (!batch) return null;
  batch.status = 'failed';
  batch.retry_count += 1;
  await persist(batch);
  return batch;
}

function canRetry(id) {
  const batch = findById(id);
  return batch && batch.status === 'failed' && batch.retry_count < MAX_RETRIES;
}

async function resetForRetry(id) {
  const batch = findById(id);
  if (!batch || batch.retry_count >= MAX_RETRIES) return null;
  batch.status = 'pending';
  batch.tx_hash = null;
  batch.total_bnb = 0;
  batch.total_vpt = 0;
  batch.total_vpt_wei = '0';
  batch.swapped_at = null;
  batch.distributed_at = null;
  await persist(batch);
  return batch;
}

function getActive() {
  return batches.find((b) => b.status === 'pending' || b.status === 'swapped');
}

function getPending() {
  return batches.filter((b) => b.status === 'pending');
}

function getFailed() {
  return batches.filter((b) => b.status === 'failed');
}

function getAll() {
  return batches.sort((a, b) => b.created_at - a.created_at);
}

function getRecent(limit = 20) {
  return batches
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function getStats() {
  return {
    total: batches.length,
    pending: batches.filter((b) => b.status === 'pending').length,
    swapped: batches.filter((b) => b.status === 'swapped').length,
    distributed: batches.filter((b) => b.status === 'distributed').length,
    failed: batches.filter((b) => b.status === 'failed').length,
    permanently_failed: batches.filter((b) => b.status === 'failed' && b.retry_count >= MAX_RETRIES).length,
    total_ngn_processed: batches
      .filter((b) => b.status === 'distributed')
      .reduce((sum, b) => sum + b.total_ngn, 0),
    total_vpt_swapped: batches
      .filter((b) => b.status === 'distributed' || b.status === 'swapped')
      .reduce((sum, b) => sum + b.total_vpt, 0),
  };
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  setSwapped,
  setDistributed,
  setFailed,
  canRetry,
  resetForRetry,
  getActive,
  getPending,
  getFailed,
  getAll,
  getRecent,
  getStats,
};
