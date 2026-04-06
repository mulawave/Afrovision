const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');
const LedgerModel = require('./ledger.model');

const COLLECTION = 'ledger';

/**
 * LedgerService — single authoritative entry point for all ledger writes.
 *
 * record(entry, tx)      — write inside a Firestore transaction (gift sends, withdrawals)
 * recordAsync(entry)     — standalone write via LedgerModel.create (subscriptions, admin ops)
 * calculateBalance(uid, currency) — verify balance by aggregating ledger entries
 */

/**
 * Write a ledger entry inside an existing Firestore transaction.
 * MUST be called within db.runTransaction() for atomic financial ops.
 */
function record(entry, tx) {
  const db = getFirestore();
  const id = entry.id || crypto.randomUUID();
  const ref = db.collection(COLLECTION).doc(id);

  const doc = {
    id,
    uid: entry.uid || null,
    type: entry.type,
    direction: entry.direction || null,
    currency: entry.currency || null,
    amount_vpt_units: entry.amount_vpt_units || 0,
    amount_ngn: entry.amount_ngn || 0,
    balance_before: entry.balance_before ?? null,
    balance_after: entry.balance_after ?? null,
    reference_id: entry.reference_id || null,
    channel_id: entry.channel_id || null,
    status: entry.status || 'success',
    meta: entry.meta || {},
    // Backward-compat fields (existing LedgerModel queries use these)
    amount_vpt: entry.amount_vpt_units || entry.amount_vpt || 0,
    amount_vpt_wei: entry.amount_vpt_wei || '0',
    tx_hash: entry.tx_hash || null,
    description: entry.description || _autoDescription(entry.type, entry.direction),
    created_at: entry.created_at || Date.now(),
  };

  tx.set(ref, doc);

  // Sync to in-memory cache so LedgerModel queries reflect immediately
  if (LedgerModel.isInitialized()) {
    LedgerModel._pushEntry(doc);
  }

  return doc;
}

/**
 * Write a standalone ledger entry (not inside a transaction).
 * Uses LedgerModel.create() for backward compatibility.
 */
async function recordAsync(entry) {
  return LedgerModel.create({
    uid: entry.uid,
    type: entry.type,
    direction: entry.direction || null,
    currency: entry.currency || null,
    amount_vpt_units: entry.amount_vpt_units || 0,
    amount_ngn: entry.amount_ngn || 0,
    amount_vpt: entry.amount_vpt_units || entry.amount_vpt || 0,
    amount_vpt_wei: entry.amount_vpt_wei || '0',
    balance_before: entry.balance_before ?? null,
    balance_after: entry.balance_after ?? null,
    reference_id: entry.reference_id || null,
    channel_id: entry.channel_id || null,
    tx_hash: entry.tx_hash || null,
    status: entry.status || 'success',
    meta: entry.meta || {},
    description: entry.description || _autoDescription(entry.type, entry.direction),
  });
}

/**
 * Calculate a user's balance from ledger entries (verification utility).
 * This is the source-of-truth calculation — wallet balances should match.
 */
async function calculateBalance(uid, currency) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('uid', '==', uid)
    .where('currency', '==', currency)
    .where('status', '==', 'success')
    .get();

  let balance = 0;
  snapshot.forEach((doc) => {
    const d = doc.data();
    const amount = currency === 'vpt'
      ? (d.amount_vpt_units || 0)
      : (d.amount_ngn || 0);

    if (d.direction === 'credit') {
      balance += amount;
    } else if (d.direction === 'debit') {
      balance -= amount;
    }
  });

  return balance;
}

function _autoDescription(type, direction) {
  const labels = {
    PLAN_PAYMENT: 'Subscription payment',
    SPLIT: 'Community pool split',
    VPT_QUEUE: 'vPT conversion queued',
    VPT_SWAP: 'vPT market swap',
    VPT_DISTRIBUTION: 'vPT distributed',
    WALLET_CREATED: 'Wallet created',
    SWAP_FAILED: 'Swap failed',
    DISTRIBUTION_FAILED: 'Distribution failed',
    GIFT_SENT_VPT: 'Gift sent (vPT)',
    GIFT_RECEIVED_VPT: 'Gift received (vPT)',
    GIFT_SENT_NGN: 'Gift sent (NGN)',
    GIFT_RECEIVED_NGN: 'Gift received (NGN)',
    WALLET_FUND: 'Wallet funded',
    WITHDRAWAL: 'Withdrawal',
    REVERSAL: 'Reversal',
  };
  return labels[type] || type;
}

module.exports = {
  record,
  recordAsync,
  calculateBalance,
};
