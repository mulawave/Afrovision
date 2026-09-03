const admin = require('firebase-admin');
const { getFirestore } = require('../utils/firestore');
const WithdrawalModel = require('./withdrawal.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const LedgerService = require('../vpt/ledger.service');
const LedgerModel = require('../vpt/ledger.model');
const PoolService = require('../vpt/pool.service');
const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const { serializeWithdrawalForAdmin } = require('../admin/admin.presenter');
const NotificationService = require('../notifications/notification.service');
const SmtpService = require('../admin/smtp.service');

const FieldValue = admin.firestore.FieldValue;

// ─── Withdrawal Fee Constants ────────────────────────────
const TRANSACTION_FEE_NGN = 50;   // Payment-provider processing fee
const SERVICE_CHARGE_NGN = 50;    // AfroVision service charge
const TOTAL_FEE_NGN = TRANSACTION_FEE_NGN + SERVICE_CHARGE_NGN; // ₦100

// VAT Constants (Nigeria — 7.5%)
const VAT_RATE = 0.075;
const VAT_ON_FEES_NGN = Math.round(TOTAL_FEE_NGN * VAT_RATE * 100) / 100; // ₦7.50
const TOTAL_CHARGES_WITH_VAT = TOTAL_FEE_NGN + VAT_ON_FEES_NGN; // ₦107.50

// Firestore doc that accumulates all withdrawal charges
const CHARGES_POOL_DOC = 'pools/transaction_charges';
// Sub-pool for provider fees only (Paystack / Flutterwave)
const PROVIDER_FEES_DOC = 'pools/provider_fees';
// VAT pool — collects all VAT for FIRS remittance
const VAT_POOL_DOC = 'pools/vat';

// ─── Request Withdrawal ──────────────────────────────────

async function requestWithdrawal(req, res) {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid withdrawal amount.' });
    }
    if (amount < 100) {
      return res.status(400).json({ error: 'The minimum withdrawal amount is ₦100.' });
    }
    if (amount > 5_000_000) {
      return res.status(400).json({ error: 'The maximum withdrawal amount is ₦5,000,000.' });
    }
    // Enforce 2 decimal places
    const rounded = Math.round(amount * 100) / 100;
    if (rounded !== amount) {
      return res.status(400).json({ error: 'Amount must have at most 2 decimal places.' });
    }

    const totalDebit = amount + TOTAL_CHARGES_WITH_VAT; // amount user receives + fees + VAT

    const user = User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Your account could not be found. Please sign in again.' });
    }

    if (user.wallet_frozen) {
      return res.status(403).json({ error: 'WALLET_FROZEN', message: 'Your wallet has been frozen by admin. Contact support.' });
    }

    if (user.withdrawal_banned) {
      return res.status(403).json({ error: 'WITHDRAWAL_BANNED', message: 'Withdrawals on your account have been disabled. Contact support.' });
    }

    let withdrawalsDisabled = false;
    try {
      const SettingsService = require('../admin/settings.service');
      const raw = await SettingsService.get('withdrawals_disabled');
      withdrawalsDisabled = raw === true || raw === 'true';
    } catch {}
    if (withdrawalsDisabled) {
      return res.status(403).json({ error: 'WITHDRAWALS_DISABLED', message: 'Withdrawals are temporarily disabled. Please try again later.' });
    }

    if (!user.bank_details) {
      return res.status(400).json({
        error: 'Please add your bank account details before requesting a withdrawal.',
        code: 'BANK_DETAILS_REQUIRED',
      });
    }

    // Deduct balance immediately inside a Firestore transaction
    const db = getFirestore();
    const walletRef = db.collection('users').doc(req.userId);
    const chargesPoolRef = db.doc(CHARGES_POOL_DOC);
    const providerFeesRef = db.doc(PROVIDER_FEES_DOC);

    let withdrawal;
    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists
        ? walletDoc.data()
        : { id: req.userId, vpt: 0, cash: 0 };

      const before = walletData.cash || 0;
      if (before < totalDebit) throw new Error('INSUFFICIENT_BALANCE');
      const after = before - totalDebit;

      tx.update(walletRef, { cash: after });

      // Credit the Transaction Charges pool (₦100 total)
      tx.set(chargesPoolRef, {
        balance_ngn: FieldValue.increment(TOTAL_FEE_NGN),
        total_collected: FieldValue.increment(TOTAL_FEE_NGN),
        total_transaction_fees: FieldValue.increment(TRANSACTION_FEE_NGN),
        total_service_charges: FieldValue.increment(SERVICE_CHARGE_NGN),
        transaction_count: FieldValue.increment(1),
        updated_at: Date.now(),
      }, { merge: true });

      // Credit the Provider Fees sub-pool (₦50 earmarked for Paystack/Flutterwave)
      tx.set(providerFeesRef, {
        balance_ngn: FieldValue.increment(TRANSACTION_FEE_NGN),
        total_collected: FieldValue.increment(TRANSACTION_FEE_NGN),
        transaction_count: FieldValue.increment(1),
        updated_at: Date.now(),
      }, { merge: true });

      // Credit the VAT pool (7.5% on total fees — for FIRS remittance)
      const vatPoolRef = db.doc(VAT_POOL_DOC);
      tx.set(vatPoolRef, {
        balance_ngn: FieldValue.increment(VAT_ON_FEES_NGN),
        total_collected: FieldValue.increment(VAT_ON_FEES_NGN),
        transaction_count: FieldValue.increment(1),
        updated_at: Date.now(),
      }, { merge: true });

      // Record ledger for the withdrawal hold (full debit including fees + VAT)
      LedgerService.record({
        type: 'WITHDRAWAL_HOLD',
        uid: req.userId,
        direction: 'debit',
        currency: 'ngn',
        amount_ngn: totalDebit,
        balance_before: before,
        balance_after: after,
        reference_id: null,
        status: 'success',
        meta: {
          payout_amount: amount,
          transaction_fee: TRANSACTION_FEE_NGN,
          service_charge: SERVICE_CHARGE_NGN,
          total_fees: TOTAL_FEE_NGN,
          vat_amount: VAT_ON_FEES_NGN,
          vat_rate: VAT_RATE,
          total_charges_with_vat: TOTAL_CHARGES_WITH_VAT,
        },
      }, tx);

      withdrawal = {
        uid: req.userId,
        amount,                          // what user receives
        transaction_fee: TRANSACTION_FEE_NGN,
        service_charge: SERVICE_CHARGE_NGN,
        total_fees: TOTAL_FEE_NGN,
        vat_amount: VAT_ON_FEES_NGN,
        vat_rate: VAT_RATE,
        total_debit: totalDebit,         // total taken from wallet (amount + fees + VAT)
        currency: 'ngn',
        bank_details: user.bank_details,
        balance_before: before,
        balance_after: after,
      };
    });

    // Persist withdrawal record after successful deduction
    const saved = await WithdrawalModel.create(withdrawal);

    // Record separate ledger entry for the fee portion (audit trail)
    await LedgerService.recordAsync({
      type: 'WITHDRAWAL_FEE',
      uid: req.userId,
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: TOTAL_FEE_NGN,
      reference_id: saved.id,
      status: 'success',
      meta: {
        transaction_fee: TRANSACTION_FEE_NGN,
        service_charge: SERVICE_CHARGE_NGN,
        description: 'Withdrawal processing fees',
      },
    });

    // Record separate ledger entry for VAT (per-user audit trail for FIRS)
    await LedgerService.recordAsync({
      type: 'VAT_COLLECTED',
      uid: req.userId,
      direction: 'debit',
      currency: 'ngn',
      amount_ngn: VAT_ON_FEES_NGN,
      reference_id: saved.id,
      status: 'success',
      meta: {
        vat_rate: VAT_RATE,
        taxable_amount: TOTAL_FEE_NGN,
        vat_amount: VAT_ON_FEES_NGN,
        source: 'withdrawal_fee',
        description: `7.5% VAT on ₦${TOTAL_FEE_NGN} withdrawal charges`,
      },
    });

    // Sync in-memory cache so subsequent balance reads reflect the deduction immediately.
    // GiftWallet.reloadFromFirestore is a bridge shim — update the User model directly.
    const cachedUser = User.findById(req.userId);
    if (cachedUser) cachedUser.cash = withdrawal.balance_after;

    res.status(201).json({ withdrawal: saved });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      const amt = parseFloat(req.body.amount) || 0;
      return res.status(400).json({
        error: `Insufficient balance. You need ₦${(amt + TOTAL_CHARGES_WITH_VAT).toLocaleString()} (₦${amt.toLocaleString()} + ₦${TOTAL_FEE_NGN} fees + ₦${VAT_ON_FEES_NGN} VAT) but your available balance is lower.`,
      });
    }
    console.error('[Withdrawal] request error');
    res.status(500).json({ error: 'Something went wrong while processing your withdrawal. Please try again or contact support.' });
  }
}

// ─── Approve Withdrawal (Admin) ──────────────────────────

async function approveWithdrawal(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { id } = req.params;
    const withdrawal = await WithdrawalModel.findById(id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Withdrawal already ${withdrawal.status}` });
    }

    // Balance was already deducted at request time — just approve
    const updated = await WithdrawalModel.updateStatus(id, 'approved', { handled_by: req.userId });
    await AuditService.logAction(req.userId, 'approve_withdrawal', updated.id, {
      withdrawal_id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      requester_uid: updated.uid,
    });

    // ── Send notifications to the requester ──────────────────────────
    const requester = await User.findById(withdrawal.uid);
    const payoutAmount = withdrawal.amount;
    const totalFees = withdrawal.total_fees || TOTAL_FEE_NGN;
    const vatAmount = withdrawal.vat_amount || VAT_ON_FEES_NGN;
    const totalDebit = withdrawal.total_debit || (payoutAmount + TOTAL_CHARGES_WITH_VAT);

    // Push notification (FCM + in-app DB record)
    NotificationService.notifyUser(withdrawal.uid, {
      title: 'Withdrawal Approved ✅',
      body: `Your withdrawal of ₦${Number(payoutAmount).toLocaleString()} has been approved and is being processed.`,
      type: 'withdrawal_approved',
      data: { withdrawal_id: id, amount: String(payoutAmount), priority: 'high' },
    }).then(result => {
      // approval notification sent
    }).catch(err => console.error('[Withdrawal] push notification failed'));

    // Email notification
    if (requester && requester.email) {
      SmtpService.sendWithdrawalStatusEmail({
        toEmail: requester.email,
        status: 'approved',
        amount: payoutAmount,
        totalDebit,
        totalFees,
        vatAmount,
        bankDetails: withdrawal.bank_details,
        displayName: requester.display_name || requester.username,
      }).then(() => { /* email sent */ })
        .catch(err => console.error('[Withdrawal] email notification failed'));
    } else {
      // No email on file — skipping email notification
    }

    res.json({ withdrawal: serializeWithdrawalForAdmin(updated) });
  } catch (err) {
    console.error('[Withdrawal] approve error');
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
}

// ─── Reject Withdrawal (Admin) ───────────────────────────

async function rejectWithdrawal(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { id } = req.params;
    const withdrawal = await WithdrawalModel.findById(id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Withdrawal already ${withdrawal.status}` });
    }

    // Refund the full debited amount (payout + fees) back to the user's wallet
    const db = getFirestore();
    const walletRef = db.collection('users').doc(withdrawal.uid);
    const chargesPoolRef = db.doc(CHARGES_POOL_DOC);
    const providerFeesRef = db.doc(PROVIDER_FEES_DOC);

    // Use the stored total_debit if available, otherwise fall back to amount (legacy records)
    const refundAmount = withdrawal.total_debit || withdrawal.amount;
    const feeRefund = withdrawal.total_fees || 0;
    const txFeeRefund = withdrawal.transaction_fee || 0;
    const svcChargeRefund = withdrawal.service_charge || 0;
    const vatRefund = withdrawal.vat_amount || 0;

    let refundedCash = null; // captured inside transaction for in-memory sync
    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists
        ? walletDoc.data()
        : { id: withdrawal.uid, vpt: 0, cash: 0 };

      const before = walletData.cash || 0;
      const after = before + refundAmount;
      refundedCash = after;

      tx.update(walletRef, { cash: after });

      // Reverse charges pool entries
      if (feeRefund > 0) {
        tx.set(chargesPoolRef, {
          balance_ngn: FieldValue.increment(-feeRefund),
          total_refunded: FieldValue.increment(feeRefund),
          updated_at: Date.now(),
        }, { merge: true });

        tx.set(providerFeesRef, {
          balance_ngn: FieldValue.increment(-txFeeRefund),
          total_refunded: FieldValue.increment(txFeeRefund),
          updated_at: Date.now(),
        }, { merge: true });
      }

      // Reverse VAT pool entry
      if (vatRefund > 0) {
        const vatPoolRef = db.doc(VAT_POOL_DOC);
        tx.set(vatPoolRef, {
          balance_ngn: FieldValue.increment(-vatRefund),
          total_refunded: FieldValue.increment(vatRefund),
          updated_at: Date.now(),
        }, { merge: true });
      }

      LedgerService.record({
        type: 'WITHDRAWAL_REFUND',
        uid: withdrawal.uid,
        direction: 'credit',
        currency: 'ngn',
        amount_ngn: refundAmount,
        balance_before: before,
        balance_after: after,
        reference_id: withdrawal.id,
        status: 'success',
        meta: {
          payout_amount: withdrawal.amount,
          fees_refunded: feeRefund,
          transaction_fee_refunded: txFeeRefund,
          service_charge_refunded: svcChargeRefund,
          vat_refunded: vatRefund,
        },
      }, tx);
    });

    // Sync in-memory cache so the refunded balance is visible immediately.
    const rejectedUserCache = User.findCachedById(withdrawal.uid);
    if (rejectedUserCache && refundedCash !== null) rejectedUserCache.cash = refundedCash;

    const updated = await WithdrawalModel.updateStatus(id, 'rejected', { handled_by: req.userId });
    await AuditService.logAction(req.userId, 'reject_withdrawal', updated.id, {
      withdrawal_id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      requester_uid: updated.uid,
    });

    // ── Send notifications to the requester ──────────────────────────
    const requester = await User.findById(withdrawal.uid);
    const payoutAmount = withdrawal.amount;
    const totalFees = withdrawal.total_fees || TOTAL_FEE_NGN;
    const vatAmount = withdrawal.vat_amount || VAT_ON_FEES_NGN;
    const totalDebit = refundAmount;

    // Push notification (FCM + in-app DB record)
    NotificationService.notifyUser(withdrawal.uid, {
      title: 'Withdrawal Declined ❌',
      body: `Your withdrawal of ₦${Number(payoutAmount).toLocaleString()} was declined. ₦${Number(totalDebit).toLocaleString()} has been refunded to your wallet.`,
      type: 'withdrawal_rejected',
      data: { withdrawal_id: id, amount: String(payoutAmount), refund: String(totalDebit), priority: 'high' },
    }).then(result => {
      // rejection notification sent
    }).catch(err => console.error('[Withdrawal] push notification failed'));

    // Email notification
    if (requester && requester.email) {
      SmtpService.sendWithdrawalStatusEmail({
        toEmail: requester.email,
        status: 'rejected',
        amount: payoutAmount,
        totalDebit,
        totalFees,
        vatAmount,
        bankDetails: withdrawal.bank_details,
        displayName: requester.display_name || requester.username,
      }).then(() => { /* rejection email sent */ })
        .catch(err => console.error('[Withdrawal] email notification failed'));
    } else {
      // No email on file — skipping email notification
    }

    res.json({ withdrawal: serializeWithdrawalForAdmin(updated) });
  } catch (err) {
    console.error('[Withdrawal] reject error');
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
}

// ─── My Withdrawals ──────────────────────────────────────

async function getMyWithdrawals(req, res) {
  const withdrawals = await WithdrawalModel.findByUid(req.userId);
  res.json({ withdrawals });
}

// ─── All Withdrawals (Admin) ─────────────────────────────

async function getAllWithdrawals(req, res) {
  const user = User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const cursorCreatedAt = req.query.cursor_created_at != null ? Number(req.query.cursor_created_at) : null;
  const cursorId = String(req.query.cursor_id || '').trim() || null;
  const status = String(req.query.status || '').trim() || null;

  const page = await WithdrawalModel.listPage({
    limit,
    startAfterCreatedAt: Number.isFinite(cursorCreatedAt) ? cursorCreatedAt : null,
    startAfterId: cursorId,
    status,
  });

  res.json({
    withdrawals: page.withdrawals.map((withdrawal) => serializeWithdrawalForAdmin(withdrawal)),
    limit,
    next_cursor: page.nextCursor,
    has_more: Boolean(page.nextCursor),
  });
}

// ─── Fund Wallet (Admin) ─────────────────────────────────

async function fundWallet(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { uid, amount_ngn, amount_vpt_units } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    if (!amount_ngn && !amount_vpt_units) {
      return res.status(400).json({ error: 'amount_ngn or amount_vpt_units is required' });
    }

    const db = getFirestore();
    const walletRef = db.collection('users').doc(uid);

    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists ? walletDoc.data() : { id: uid, vpt: 0, cash: 0 };

      if (amount_ngn && amount_ngn > 0) {
        const before = walletData.cash || 0;
        const after = before + amount_ngn;
        tx.update(walletRef, { cash: after });

        LedgerService.record({
          type: 'WALLET_FUND',
          uid,
          direction: 'credit',
          currency: 'ngn',
          amount_ngn,
          balance_before: before,
          balance_after: after,
          status: 'success',
          meta: { funded_by: req.userId },
        }, tx);
      }

      if (amount_vpt_units && amount_vpt_units > 0) {
        const before = walletData.vpt || 0;
        const after = before + amount_vpt_units;
        tx.update(walletRef, { vpt: after });

        LedgerService.record({
          type: 'WALLET_FUND',
          uid,
          direction: 'credit',
          currency: 'vpt',
          amount_vpt_units,
          balance_before: before,
          balance_after: after,
          status: 'success',
          meta: { funded_by: req.userId },
        }, tx);
      }
    });

    // Reload wallet cache from Firestore (authoritative source)
    await GiftWallet.reloadFromFirestore(uid);

    await AuditService.logAction(req.userId, 'fund_wallet', uid, {
      recipient_uid: uid,
      amount_ngn: amount_ngn || 0,
      amount_vpt_units: amount_vpt_units || 0,
    });

    res.json({ message: 'Wallet funded', uid, amount_ngn, amount_vpt_units });
  } catch (err) {
    console.error('[Withdrawal] fundWallet error');
    res.status(500).json({ error: 'Failed to fund wallet' });
  }
}

// ─── Create Reversal (Admin) ─────────────────────────────

async function createReversal(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { original_entry_id } = req.body;
    if (!original_entry_id) {
      return res.status(400).json({ error: 'original_entry_id is required' });
    }

    const original = LedgerModel.findById(original_entry_id);
    if (!original) return res.status(404).json({ error: 'Original ledger entry not found' });
    if (original.status !== 'success') {
      return res.status(400).json({ error: 'Can only reverse successful entries' });
    }

    const reverseDirection = original.direction === 'debit' ? 'credit' : 'debit';
    const currency = original.currency || (original.amount_vpt_units > 0 ? 'vpt' : 'ngn');

    const db = getFirestore();
    const walletRef = db.collection('users').doc(original.uid);

    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists ? walletDoc.data() : { id: original.uid, vpt: 0, cash: 0 };

      if (currency === 'ngn') {
        const before = walletData.cash || 0;
        const amount = original.amount_ngn || 0;
        const after = reverseDirection === 'credit' ? before + amount : before - amount;
        tx.update(walletRef, { cash: after });

        LedgerService.record({
          type: 'REVERSAL',
          uid: original.uid,
          direction: reverseDirection,
          currency: 'ngn',
          amount_ngn: amount,
          balance_before: before,
          balance_after: after,
          reference_id: original_entry_id,
          channel_id: original.channel_id || null,
          status: 'success',
          meta: { reversed_type: original.type, reversed_by: req.userId },
        }, tx);
      } else {
        const before = walletData.vpt || 0;
        const amount = original.amount_vpt_units || 0;
        const after = reverseDirection === 'credit' ? before + amount : before - amount;
        tx.update(walletRef, { vpt: after });

        LedgerService.record({
          type: 'REVERSAL',
          uid: original.uid,
          direction: reverseDirection,
          currency: 'vpt',
          amount_vpt_units: amount,
          balance_before: before,
          balance_after: after,
          reference_id: original_entry_id,
          channel_id: original.channel_id || null,
          status: 'success',
          meta: { reversed_type: original.type, reversed_by: req.userId },
        }, tx);
      }
    });

    // Reload wallet cache from Firestore (authoritative source)
    await GiftWallet.reloadFromFirestore(original.uid);

    await AuditService.logAction(req.userId, 'create_ledger_reversal', original.uid, {
      original_entry_id,
      original_type: original.type,
      direction: reverseDirection,
      currency,
      amount_ngn: original.amount_ngn || 0,
      amount_vpt_units: original.amount_vpt_units || 0,
    });

    res.json({ message: 'Reversal created', original_type: original.type, direction: reverseDirection });
  } catch (err) {
    console.error('[Withdrawal] createReversal error');
    res.status(500).json({ error: 'Failed to create reversal' });
  }
}

// ─── Admin Financial Queries ─────────────────────────────

function getUserTransactions(req, res) {
  const admin = User.findById(req.userId);
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { uid } = req.params;
  const entries = LedgerModel.getByUser(uid);
  res.json({ entries });
}

function getChannelEarnings(req, res) {
  const admin = User.findById(req.userId);
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { channelId } = req.params;
  const all = LedgerModel.getByChannel(channelId);
  const earnings = all.filter((e) =>
    ['GIFT_RECEIVED_VPT', 'GIFT_RECEIVED_NGN'].includes(e.type) && e.status === 'success'
  );

  const total_vpt = earnings
    .filter((e) => e.type === 'GIFT_RECEIVED_VPT')
    .reduce((sum, e) => sum + (e.amount_vpt_units || 0), 0);
  const total_ngn = earnings
    .filter((e) => e.type === 'GIFT_RECEIVED_NGN')
    .reduce((sum, e) => sum + (e.amount_ngn || 0), 0);

  res.json({ channel_id: channelId, total_vpt, total_ngn, entries: earnings });
}

async function getSystemTotals(req, res) {
  const admin = User.findById(req.userId);
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const db = getFirestore();
    const [communityStats, operationsPool, chargesDoc, providerDoc, vatDoc] = await Promise.all([
      PoolService.getPoolStats(),
      PoolService.getOperationsPoolBalance(),
      db.doc(CHARGES_POOL_DOC).get(),
      db.doc(PROVIDER_FEES_DOC).get(),
      db.doc(VAT_POOL_DOC).get(),
    ]);

    const comm = {
      balance_ngn: communityStats?.pool?.balance_ngn || 0,
      balance_vpt: communityStats?.pool?.balance_vpt || 0,
      total_credited: communityStats?.pool?.total_credited || 0,
      total_credited_vpt: communityStats?.pool?.total_credited_vpt || 0,
      total_distributed: communityStats?.pool?.total_distributed || 0,
      total_distributed_vpt: communityStats?.pool?.total_distributed_vpt || 0,
    };
    const ops = {
      balance_ngn: operationsPool?.balance_ngn || 0,
      total_credited: operationsPool?.total_credited || 0,
    };
    const charges = chargesDoc.exists ? chargesDoc.data() : {
      balance_ngn: 0, total_collected: 0, total_transaction_fees: 0,
      total_service_charges: 0, total_refunded: 0, transaction_count: 0,
    };
    const providerFees = providerDoc.exists ? providerDoc.data() : {
      balance_ngn: 0, total_collected: 0, total_refunded: 0, transaction_count: 0,
    };
    const vat = vatDoc.exists ? vatDoc.data() : {
      balance_ngn: 0, total_collected: 0, total_refunded: 0, transaction_count: 0,
    };

    const ledgerStats = LedgerModel.getStats();
    const pendingWithdrawals = await WithdrawalModel.getPending();
    const totalPendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    res.json({
      pools: { operations: ops, community: comm },
      transaction_charges: charges,
      provider_fees: providerFees,
      vat: vat,
      ledger: ledgerStats,
      pending_withdrawals: {
        count: pendingWithdrawals.length,
        total_amount: totalPendingAmount,
      },
    });
  } catch (err) {
    console.error('[Withdrawal] getSystemTotals error');
    res.status(500).json({ error: 'Failed to get system totals' });
  }
}

// ─── Channel Owner Transactions ─────────────────────────

async function getMyChannelTransactions(req, res) {
  try {
    const { channelId } = req.params;
    const caller = User.findById(req.userId);
    if (!caller) {
      return res.status(404).json({ error: 'User not found' });
    }

    const Channel = require('../channels/channel.model');
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Only channel owner or admin can view transactions
    if (channel.owner_id !== req.userId && caller.role !== 'admin') {
      return res.status(403).json({ error: 'Only the channel owner or admin can view transactions' });
    }

    // Fetch all ledger entries for the channel
    const entries = await LedgerModel.getByChannel(channelId);

    // Fetch exclusive channel subscribers
    const ExclusiveAccess = require('../channels/exclusive_access.model');
    const ChannelAccess = require('../channels/channel_access.model');

    const [exclusiveAccesses, regularAccesses] = await Promise.all([
      ExclusiveAccess.listActiveAccesses(),
      ChannelAccess.getByChannel(channelId),
    ]);

    const exclusiveSubs = exclusiveAccesses.filter(
      (a) => String(a.channel_id) === String(channelId)
    );
    const regularSubs = regularAccesses;

    // Collect all user UIDs to enrich
    const subscriberUids = new Set();
    for (const sub of [...exclusiveSubs, ...regularSubs]) {
      if (sub.user_uid) subscriberUids.add(sub.user_uid);
    }

    // Enrich subscriber user info
    const userMap = {};
    for (const uid of subscriberUids) {
      try {
        const u = await User.findById(uid);
        if (u) {
          userMap[uid] = {
            id: u.id,
            display_name: u.display_name || u.username || 'Unknown',
            avatar_url: u.avatar_url || null,
          };
        }
      } catch {}
    }

    // Build subscribers list
    const subscribers = [];
    for (const sub of exclusiveSubs) {
      const u = userMap[sub.user_uid] || { display_name: 'Unknown', avatar_url: null };
      subscribers.push({
        id: sub.id,
        user_uid: sub.user_uid,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        type: 'exclusive',
        status: sub.status || 'active',
        issued_at: sub.issued_at || null,
        expires_at: sub.expires_at || null,
        monthly_fee_ngn: sub.monthly_fee_ngn || 0,
      });
    }
    for (const sub of regularSubs) {
      const u = userMap[sub.user_uid] || { display_name: 'Unknown', avatar_url: null };
      subscribers.push({
        id: sub.id,
        user_uid: sub.user_uid,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        type: 'regular',
        status: 'active',
        issued_at: sub.granted_at || null,
        expires_at: sub.expires_at || null,
        monthly_fee_ngn: 0,
      });
    }

    // Build summary
    const giftEntries = entries.filter(
      (e) => ['GIFT_RECEIVED_VPT', 'GIFT_RECEIVED_NGN'].includes(e.type) && e.status === 'success'
    );
    const totalGiftsVpt = giftEntries
      .filter((e) => e.type === 'GIFT_RECEIVED_VPT')
      .reduce((sum, e) => sum + (e.amount_vpt_units || 0), 0);
    const totalGiftsNgn = giftEntries
      .filter((e) => e.type === 'GIFT_RECEIVED_NGN')
      .reduce((sum, e) => sum + (e.amount_ngn || 0), 0);
    const settlementEntries = entries.filter(
      (e) => ['VPT_DISTRIBUTION', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_FEE'].includes(e.type) && e.status === 'success'
    );
    const totalSettlements = settlementEntries.reduce((sum, e) => sum + (e.amount_ngn || e.amount_vpt_units || 0), 0);

    // Build transactions list
    const transactions = entries.map((e) => ({
      id: e.id,
      type: e.type,
      direction: e.direction,
      currency: e.currency,
      amount_ngn: e.amount_ngn || 0,
      amount_vpt_units: e.amount_vpt_units || 0,
      status: e.status,
      description: e.description || e.meta?.description || null,
      created_at: e.created_at,
      reference_id: e.reference_id || null,
    }));

    res.json({
      transactions,
      subscribers,
      summary: {
        totalGiftsVpt,
        totalGiftsNgn,
        totalSubscriptions: subscribers.length,
        totalSettlements,
      },
    });
  } catch (err) {
    console.error('[Withdrawal] getMyChannelTransactions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch channel transactions' });
  }
}

module.exports = {
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  fundWallet,
  createReversal,
  getUserTransactions,
  getChannelEarnings,
  getSystemTotals,
  getMyChannelTransactions,
};
