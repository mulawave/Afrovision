const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_batches';

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
  return [];
}

function isInitialized() {
  return true;
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
  await persist(batch);
  return batch;
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function setSwapped(id, { totalBNB, totalVPT, totalVPTWei, txHash }) {
  const batch = await findById(id);
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
  const batch = await findById(id);
  if (!batch) return null;
  batch.status = 'distributed';
  batch.distributed_at = Date.now();
  await persist(batch);
  return batch;
}

async function setFailed(id) {
  const batch = await findById(id);
  if (!batch) return null;
  batch.status = 'failed';
  batch.retry_count += 1;
  await persist(batch);
  return batch;
}

async function canRetry(id) {
  const batch = await findById(id);
  return batch && batch.status === 'failed' && batch.retry_count < MAX_RETRIES;
}

async function resetForRetry(id) {
  const batch = await findById(id);
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

async function getActive() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  const batches = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  return batches.find((b) => b.status === 'pending' || b.status === 'swapped');
}

async function getPending() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getFailed() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'failed')
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function getRecent(limit = 20) {
  const all = await getAll();
  return all.slice(0, limit);
}

async function getStats() {
  const batches = await getAll();
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
