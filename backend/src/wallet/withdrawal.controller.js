const { getFirestore } = require('../utils/firestore');
const WithdrawalModel = require('./withdrawal.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const LedgerService = require('../vpt/ledger.service');
const LedgerModel = require('../vpt/ledger.model');
const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const { serializeWithdrawalForAdmin } = require('../admin/admin.presenter');

// ─── Request Withdrawal ──────────────────────────────────

async function requestWithdrawal(req, res) {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal is ₦100' });
    }
    if (amount > 5_000_000) {
      return res.status(400).json({ error: 'Maximum withdrawal is ₦5,000,000' });
    }
    // Enforce 2 decimal places
    const rounded = Math.round(amount * 100) / 100;
    if (rounded !== amount) {
      return res.status(400).json({ error: 'Amount must have at most 2 decimal places' });
    }

    const wallet = await GiftWallet.ensureWallet(req.userId);
    if ((wallet.ngn_balance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient NGN balance' });
    }

    const withdrawal = await WithdrawalModel.create({
      uid: req.userId,
      amount,
      currency: 'ngn',
    });

    res.status(201).json({ withdrawal });
  } catch (err) {
    console.error('[Withdrawal] request error:', err.message);
    res.status(500).json({ error: 'Failed to request withdrawal' });
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
    const withdrawal = WithdrawalModel.findById(id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Withdrawal already ${withdrawal.status}` });
    }

    const db = getFirestore();
    const walletRef = db.collection('gift_wallets').doc(withdrawal.uid);

    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists ? walletDoc.data() : { uid: withdrawal.uid, vpt_units: 0, ngn_balance: 0 };

      const before = walletData.ngn_balance || 0;
      if (before < withdrawal.amount) throw new Error('INSUFFICIENT_BALANCE');
      const after = before - withdrawal.amount;

      tx.update(walletRef, { ngn_balance: after, updated_at: Date.now() });

      LedgerService.record({
        type: 'WITHDRAWAL',
        uid: withdrawal.uid,
        direction: 'debit',
        currency: 'ngn',
        amount_ngn: withdrawal.amount,
        balance_before: before,
        balance_after: after,
        reference_id: withdrawal.id,
        status: 'success',
      }, tx);
    });

    // Reload wallet cache from Firestore (authoritative source)
    await GiftWallet.reloadFromFirestore(withdrawal.uid);

    const updated = await WithdrawalModel.updateStatus(id, 'approved', { handled_by: req.userId });
    await AuditService.logAction(req.userId, 'approve_withdrawal', updated.id, {
      withdrawal_id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      requester_uid: updated.uid,
    });
    res.json({ withdrawal: serializeWithdrawalForAdmin(updated) });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'User has insufficient balance' });
    }
    console.error('[Withdrawal] approve error:', err.message);
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
    const withdrawal = WithdrawalModel.findById(id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Withdrawal already ${withdrawal.status}` });
    }

    const updated = await WithdrawalModel.updateStatus(id, 'rejected', { handled_by: req.userId });
    await AuditService.logAction(req.userId, 'reject_withdrawal', updated.id, {
      withdrawal_id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      requester_uid: updated.uid,
    });
    res.json({ withdrawal: serializeWithdrawalForAdmin(updated) });
  } catch (err) {
    console.error('[Withdrawal] reject error:', err.message);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
}

// ─── My Withdrawals ──────────────────────────────────────

function getMyWithdrawals(req, res) {
  const withdrawals = WithdrawalModel.findByUid(req.userId);
  res.json({ withdrawals });
}

// ─── All Withdrawals (Admin) ─────────────────────────────

function getAllWithdrawals(req, res) {
  const user = User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  res.json({ withdrawals: WithdrawalModel.getAll().map((withdrawal) => serializeWithdrawalForAdmin(withdrawal)) });
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
    const walletRef = db.collection('gift_wallets').doc(uid);

    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists ? walletDoc.data() : { uid, vpt_units: 0, ngn_balance: 0 };

      if (amount_ngn && amount_ngn > 0) {
        const before = walletData.ngn_balance || 0;
        const after = before + amount_ngn;
        tx.set(walletRef, { ...walletData, ngn_balance: after, updated_at: Date.now() });

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
        const before = walletData.vpt_units || 0;
        const after = before + amount_vpt_units;
        tx.set(walletRef, { ...walletData, vpt_units: after, updated_at: Date.now() });

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
    console.error('[Withdrawal] fundWallet error:', err.message);
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
    const walletRef = db.collection('gift_wallets').doc(original.uid);

    await db.runTransaction(async (tx) => {
      const walletDoc = await tx.get(walletRef);
      const walletData = walletDoc.exists ? walletDoc.data() : { uid: original.uid, vpt_units: 0, ngn_balance: 0 };

      if (currency === 'ngn') {
        const before = walletData.ngn_balance || 0;
        const amount = original.amount_ngn || 0;
        const after = reverseDirection === 'credit' ? before + amount : before - amount;
        tx.set(walletRef, { ...walletData, ngn_balance: after, updated_at: Date.now() });

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
        const before = walletData.vpt_units || 0;
        const amount = original.amount_vpt_units || 0;
        const after = reverseDirection === 'credit' ? before + amount : before - amount;
        tx.set(walletRef, { ...walletData, vpt_units: after, updated_at: Date.now() });

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
    console.error('[Withdrawal] createReversal error:', err.message);
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
    const [opsDoc, commDoc] = await Promise.all([
      db.collection('pools').doc('operations').get(),
      db.collection('pools').doc('community').get(),
    ]);

    const ops = opsDoc.exists ? opsDoc.data() : { vpt_units: 0, naira: 0 };
    const comm = commDoc.exists ? commDoc.data() : { vpt_units: 0, naira: 0 };

    const ledgerStats = LedgerModel.getStats();
    const pendingWithdrawals = WithdrawalModel.getPending();
    const totalPendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    res.json({
      pools: { operations: ops, community: comm },
      ledger: ledgerStats,
      pending_withdrawals: {
        count: pendingWithdrawals.length,
        total_amount: totalPendingAmount,
      },
    });
  } catch (err) {
    console.error('[Withdrawal] getSystemTotals error:', err.message);
    res.status(500).json({ error: 'Failed to get system totals' });
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
};
