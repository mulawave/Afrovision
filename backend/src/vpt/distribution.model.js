const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_queue';
let queue = [];
let initialized = false;

/**
 * vPT Conversion Queue — tracks individual creator queue items.
 *
 * Statuses:
 * - pending    — Awaiting batch pickup
 * - processing — Assigned to a batch, swap in progress
 * - completed  — vPT distributed to wallet
 * - failed     — Failed (eligible for retry if retry_count < max)
 */

const MAX_RETRIES = 3;

async function persist(item) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(item.id).set(item);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  queue = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return queue;
}

function isInitialized() {
  return initialized;
}

async function create({ creatorUid, ngnValue, referenceId }) {
  const item = {
    id: crypto.randomUUID(),
    creator_uid: creatorUid,
    ngn_value: ngnValue,
    status: 'pending',
    reference_id: referenceId || null,
    batch_id: null,
    tx_hash: null,
    vpt_amount: null,
    vpt_amount_wei: null,
    retry_count: 0,
    created_at: Date.now(),
    processed_at: null,
  };
  queue.push(item);
  await persist(item);
  return item;
}

function findById(id) {
  return queue.find((q) => q.id === id);
}

function getPending() {
  return queue.filter((q) => q.status === 'pending');
}

function getRetryable() {
  return queue.filter((q) => q.status === 'failed' && q.retry_count < MAX_RETRIES);
}

function getByBatch(batchId) {
  return queue.filter((q) => q.batch_id === batchId);
}

function getByCreator(creatorUid) {
  return queue
    .filter((q) => q.creator_uid === creatorUid)
    .sort((a, b) => b.created_at - a.created_at);
}

async function assignToBatch(id, batchId) {
  const item = findById(id);
  if (!item) return null;
  item.batch_id = batchId;
  item.status = 'processing';
  await persist(item);
  return item;
}

async function setCompleted(id, txHash, vptAmount, vptAmountWei) {
  const item = findById(id);
  if (!item) return null;
  item.status = 'completed';
  item.tx_hash = txHash;
  item.vpt_amount = vptAmount;
  item.vpt_amount_wei = vptAmountWei || null;
  item.processed_at = Date.now();
  await persist(item);
  return item;
}

async function setFailed(id) {
  const item = findById(id);
  if (!item) return null;
  item.status = 'failed';
  item.retry_count += 1;
  await persist(item);
  return item;
}

async function resetForRetry(id) {
  const item = findById(id);
  if (!item || item.retry_count >= MAX_RETRIES) return null;
  item.status = 'pending';
  item.batch_id = null;
  await persist(item);
  return item;
}

function getStats() {
  return {
    pending: queue.filter((q) => q.status === 'pending').length,
    processing: queue.filter((q) => q.status === 'processing').length,
    completed: queue.filter((q) => q.status === 'completed').length,
    failed: queue.filter((q) => q.status === 'failed').length,
    permanently_failed: queue.filter((q) => q.status === 'failed' && q.retry_count >= MAX_RETRIES).length,
    total_ngn_pending: queue
      .filter((q) => q.status === 'pending')
      .reduce((sum, q) => sum + q.ngn_value, 0),
    total_vpt_distributed: queue
      .filter((q) => q.status === 'completed')
      .reduce((sum, q) => sum + (q.vpt_amount || 0), 0),
  };
}

module.exports = {
  init,
  isInitialized,
  create,
  findById,
  getPending,
  getRetryable,
  getByBatch,
  getByCreator,
  assignToBatch,
  setCompleted,
  setFailed,
  resetForRetry,
  getStats,
};
