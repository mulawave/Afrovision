'use strict';

const crypto = require('crypto');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const NotificationService = require('../notifications/notification.service');
const { getFirestore } = require('../utils/firestore');
const { buildExclusiveLifecycleMessage } = require('./exclusive_lifecycle.messages');

const EXCLUSIVE_SPLIT_EXCEPTIONS_COLLECTION = 'exclusive_split_exceptions';
const OPS_SUMMARIES_COLLECTION = 'ops_summaries';
const EXCLUSIVE_RECON_SUMMARY_DOC = 'exclusive_reconciliation';
const DEFAULT_LOOKBACK_HOURS = Math.max(1, Number(process.env.EXCLUSIVE_RECON_LOOKBACK_HOURS || 72));
const STALE_EXCEPTION_MS = Math.max(5 * 60 * 1000, Number(process.env.EXCLUSIVE_RECON_STALE_EXCEPTION_MS || (30 * 60 * 1000)));

function parseOpsAlertRecipients() {
  const raw = String(process.env.EXCLUSIVE_OPS_ALERT_USER_IDS || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function expectedSplitFromAmount(amountNgn) {
  const amount = Math.max(0, Number(amountNgn || 0));
  const creatorCash = Math.floor(amount * 0.50);
  const communityPoolNgn = Math.floor(amount * 0.10);
  const operationsPoolNgn = Math.floor(amount * 0.20);
  const referralPoolNgn = Math.floor(amount * 0.10);
  const creatorVptNgn = amount - creatorCash - communityPoolNgn - operationsPoolNgn - referralPoolNgn;

  return {
    amount,
    creator_cash: creatorCash,
    community_pool_ngn: communityPoolNgn,
    operations_pool_ngn: operationsPoolNgn,
    referral_pool_ngn: referralPoolNgn,
    creator_vpt_ngn: creatorVptNgn,
  };
}

function extractActualSplit(meta = {}) {
  return {
    creator_cash: Number(meta.creator_cash || 0),
    community_pool_ngn: Number(meta.community_pool_ngn || 0),
    operations_pool_ngn: Number(meta.operations_pool_ngn || 0),
    referral_pool_ngn: Number(meta.referral_pool_ngn || 0),
    creator_vpt_ngn: Number(meta.creator_vpt_ngn || 0),
  };
}

function evaluateExclusivePaymentEntry(entry) {
  const expected = expectedSplitFromAmount(entry.amount_ngn || 0);
  const actual = extractActualSplit(entry.meta || {});

  const mismatches = [];
  for (const key of Object.keys(actual)) {
    if (Number(actual[key]) !== Number(expected[key])) {
      mismatches.push({
        field: key,
        expected: Number(expected[key]),
        actual: Number(actual[key]),
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    expected,
    actual,
  };
}

async function listOpsAlertRecipients() {
  const admins = (await User.getAll(true))
    .filter((user) => user && user.role === 'admin' && !user.deleted_at)
    .map((user) => user.id);

  return [...new Set([...admins, ...parseOpsAlertRecipients()])];
}

async function dispatchReconciliationAlert({ mismatchCount, pendingExceptions, staleExceptions }) {
  const recipients = await listOpsAlertRecipients();
  if (!recipients.length) return 0;

  let sent = 0;
  await Promise.all(recipients.map(async (userId) => {
    try {
      const recipient = await User.findById(userId);
      const msg = buildExclusiveLifecycleMessage('ops.alert', {
        user: recipient,
        errorCount: mismatchCount,
        anomalyCount: pendingExceptions,
      });

      await NotificationService.notifyUser(userId, {
        title: msg.title,
        body: `${msg.body} Pending exceptions: ${pendingExceptions}. Stale: ${staleExceptions}.`,
        type: msg.type || 'exclusive_ops_alert',
        link: '/admin',
        data: {
          mismatch_count: String(mismatchCount),
          pending_exceptions: String(pendingExceptions),
          stale_exceptions: String(staleExceptions),
        },
      });

      sent += 1;
    } catch (error) {
      console.error('[ExclusiveReconciliation] Alert dispatch failed:', error.message);
    }
  }));

  return sent;
}

async function queueExclusiveSplitException({
  referenceId,
  channelId,
  userUid,
  ownerUid,
  amountNgn,
  split,
  reason,
  failedStep,
  errorMessage,
  context = {},
}) {
  const now = Date.now();
  const db = getFirestore();
  const docId = crypto.randomUUID();

  const payload = {
    id: docId,
    status: 'pending',
    reference_id: referenceId || null,
    channel_id: channelId || null,
    user_uid: userUid || null,
    owner_uid: ownerUid || null,
    amount_ngn: Number(amountNgn || 0),
    split: split || {},
    reason: reason || 'SPLIT_EXCEPTION',
    failed_step: failedStep || 'unknown',
    error_message: String(errorMessage || 'unknown error'),
    context,
    created_at: now,
    updated_at: now,
    resolved_at: null,
  };

  await db.collection(EXCLUSIVE_SPLIT_EXCEPTIONS_COLLECTION).doc(docId).set(payload);
  return payload;
}

async function listPendingSplitExceptions() {
  const db = getFirestore();
  const snapshot = await db.collection(EXCLUSIVE_SPLIT_EXCEPTIONS_COLLECTION)
    .where('status', '==', 'pending')
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function persistSummary(summary) {
  const db = getFirestore();
  await db.collection(OPS_SUMMARIES_COLLECTION).doc(EXCLUSIVE_RECON_SUMMARY_DOC).set({
    ...summary,
    updated_at: Date.now(),
  }, { merge: true });
}

async function runScheduledExclusiveReconciliation({ trigger = 'direct', lookbackHours = DEFAULT_LOOKBACK_HOURS } = {}) {
  const now = Date.now();
  const lookbackMs = Math.max(1, Number(lookbackHours || DEFAULT_LOOKBACK_HOURS)) * 60 * 60 * 1000;
  const startMs = now - lookbackMs;

  const summary = {
    trigger,
    started_at: now,
    lookback_hours: Math.max(1, Number(lookbackHours || DEFAULT_LOOKBACK_HOURS)),
    scanned_payments: 0,
    mismatch_count: 0,
    pending_exceptions: 0,
    stale_exceptions: 0,
    error_count: 0,
    ops_alerts_sent: 0,
    mismatches: [],
  };

  try {
    const allDebits = await Ledger.getSuccessfulDebitsInRange({
      currency: 'ngn',
      startMs,
      endMs: now,
    });

    const exclusivePayments = allDebits.filter((entry) => entry.type === 'EXCLUSIVE_CHANNEL_ACCESS_PAYMENT');
    summary.scanned_payments = exclusivePayments.length;

    for (const entry of exclusivePayments) {
      const result = evaluateExclusivePaymentEntry(entry);
      if (!result.ok) {
        summary.mismatch_count += 1;
        if (summary.mismatches.length < 25) {
          summary.mismatches.push({
            ledger_id: entry.id || null,
            reference_id: entry.reference_id || null,
            channel_id: entry.channel_id || null,
            mismatches: result.mismatches,
          });
        }
      }
    }

    const pending = await listPendingSplitExceptions();
    summary.pending_exceptions = pending.length;
    summary.stale_exceptions = pending.filter((item) => (now - Number(item.created_at || now)) >= STALE_EXCEPTION_MS).length;

    if (summary.mismatch_count > 0 || summary.stale_exceptions > 0) {
      summary.ops_alerts_sent = await dispatchReconciliationAlert({
        mismatchCount: summary.mismatch_count,
        pendingExceptions: summary.pending_exceptions,
        staleExceptions: summary.stale_exceptions,
      });
    }
  } catch (error) {
    summary.error_count += 1;
    summary.error_message = error.message;
  }

  summary.finished_at = Date.now();
  await persistSummary(summary);
  return summary;
}

module.exports = {
  expectedSplitFromAmount,
  evaluateExclusivePaymentEntry,
  queueExclusiveSplitException,
  runScheduledExclusiveReconciliation,
};
