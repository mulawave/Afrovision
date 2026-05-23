const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'vpt_queue';

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
  return [];
}

function isInitialized() {
  return true;
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
  await persist(item);
  return item;
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function getPending() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getRetryable() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('status', '==', 'failed')
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((q) => q.retry_count < MAX_RETRIES);
}

async function getByBatch(batchId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('batch_id', '==', batchId)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getByCreator(creatorUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function assignToBatch(id, batchId) {
  const item = await findById(id);
  if (!item) return null;
  item.batch_id = batchId;
  item.status = 'processing';
  await persist(item);
  return item;
}

async function setCompleted(id, txHash, vptAmount, vptAmountWei) {
  const item = await findById(id);
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
  const item = await findById(id);
  if (!item) return null;
  item.status = 'failed';
  item.retry_count += 1;
  await persist(item);
  return item;
}

async function resetForRetry(id) {
  const item = await findById(id);
  if (!item || item.retry_count >= MAX_RETRIES) return null;
  item.status = 'pending';
  item.batch_id = null;
  await persist(item);
  return item;
}

async function getStats() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  const queue = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
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
