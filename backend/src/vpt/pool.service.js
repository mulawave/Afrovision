const crypto = require('crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('../utils/firestore');
const Ledger = require('./ledger.model');
const FieldValue = admin.firestore.FieldValue;
const User = require('../users/user.model');
const Plan = require('../subscriptions/plan.model');
const Vpt = require('./vpt.model');
const SettingsService = require('../admin/settings.service');

const POOL_DOC = 'pools/community';
const RBD_POOL_DOC = 'pools/rbd'; // Referral Base Dump pool
const OPS_POOL_DOC = 'pools/operations'; // Operations pool (50% of subscriptions)
const DISTRIBUTIONS_COLLECTION = 'pool_distributions';

let distributions = [];
let initialized = false;

// ─── INIT ───────────────────────────────────────────────

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(DISTRIBUTIONS_COLLECTION).get();
  distributions = snapshot.docs.map((doc) => doc.data());
  initialized = true;

  // Ensure pools/community doc exists
  const poolRef = db.doc(POOL_DOC);
  const poolDoc = await poolRef.get();
  if (!poolDoc.exists) {
    await poolRef.set({ balance_ngn: 0, total_credited: 0, total_distributed: 0, updated_at: Date.now() });
  }

  // Ensure pools/rbd doc exists
  const rbdRef = db.doc(RBD_POOL_DOC);
  const rbdDoc = await rbdRef.get();
  if (!rbdDoc.exists) {
    await rbdRef.set({ balance_ngn: 0, balance_vpt: 0, total_credited_ngn: 0, total_credited_vpt: 0, updated_at: Date.now() });
  }

  // Ensure pools/transaction_charges doc exists
  const chargesRef = db.doc('pools/transaction_charges');
  const chargesDoc = await chargesRef.get();
  if (!chargesDoc.exists) {
    await chargesRef.set({
      balance_ngn: 0, total_collected: 0,
      total_transaction_fees: 0, total_service_charges: 0,
      total_refunded: 0, transaction_count: 0, updated_at: Date.now(),
    });
  }

  // Ensure pools/provider_fees doc exists
  const providerRef = db.doc('pools/provider_fees');
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    await providerRef.set({
      balance_ngn: 0, total_collected: 0,
      total_refunded: 0, transaction_count: 0, updated_at: Date.now(),
    });
  }

  // Ensure pools/vat doc exists (7.5% VAT collected for FIRS remittance)
  const vatRef = db.doc('pools/vat');
  const vatDocSnap = await vatRef.get();
  if (!vatDocSnap.exists) {
    await vatRef.set({
      balance_ngn: 0, total_collected: 0,
      total_refunded: 0, transaction_count: 0, updated_at: Date.now(),
    });
  }

  // Ensure pools/operations doc exists (50% operations pool)
  const opsRef = db.doc(OPS_POOL_DOC);
  const opsDoc = await opsRef.get();
  if (!opsDoc.exists) {
    await opsRef.set({ balance_ngn: 0, total_credited: 0, updated_at: Date.now() });
  }

  return distributions;
}

// ─── POOL BALANCE ───────────────────────────────────────

/**
 * Credit funds into the community pool.
 * Called by subscription controller and ad controller.
 */
async function creditPool(amountNGN, source, meta = {}) {
  const db = getFirestore();
  const poolRef = db.doc(POOL_DOC);
  // Get vPT price from settings
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const amountVPT = parseFloat((amountNGN / vptPriceNGN).toFixed(4));
  await poolRef.set(
    {
      balance_ngn: FieldValue.increment(amountNGN),
      total_credited: FieldValue.increment(amountNGN),
      balance_vpt: FieldValue.increment(amountVPT),
      total_credited_vpt: FieldValue.increment(amountVPT),
      updated_at: Date.now(),
    },
    { merge: true }
  );
  // Pool credit recorded
  return { credited_ngn: amountNGN, credited_vpt: amountVPT, source };
}

/**
 * Get current pool balance from Firestore.
 */
async function getPoolBalance() {
  const db = getFirestore();
  const doc = await db.doc(POOL_DOC).get();
  if (!doc.exists) return { balance_ngn: 0, total_credited: 0, total_distributed: 0, balance_vpt: 0, total_credited_vpt: 0, total_distributed_vpt: 0 };
  // Always return both NGN and vPT fields for compatibility
  const data = doc.data();
  return {
    balance_ngn: data.balance_ngn || 0,
    total_credited: data.total_credited || 0,
    total_distributed: data.total_distributed || 0,
    balance_vpt: data.balance_vpt || 0,
    total_credited_vpt: data.total_credited_vpt || 0,
    total_distributed_vpt: data.total_distributed_vpt || 0,
    updated_at: data.updated_at || null,
  };
}

// ─── RBD POOL (Referral Base Dump) ──────────────────────

/**
 * Credit unclaimed referral earnings into the RBD pool.
 * Called when a referral tree level is empty (no referrer exists).
 */
async function creditRbdPool(cashNgn, vptUnits, meta = {}) {
  const db = getFirestore();
  const rbdRef = db.doc(RBD_POOL_DOC);
  await rbdRef.set(
    {
      balance_ngn: FieldValue.increment(cashNgn),
      balance_vpt: FieldValue.increment(vptUnits),
      total_credited_ngn: FieldValue.increment(cashNgn),
      total_credited_vpt: FieldValue.increment(vptUnits),
      updated_at: Date.now(),
    },
    { merge: true }
  );
  // RBD pool credit recorded
}

/**
 * Get current RBD pool balance.
 */
async function getRbdPoolBalance() {
  const db = getFirestore();
  const doc = await db.doc(RBD_POOL_DOC).get();
  if (!doc.exists) return { balance_ngn: 0, balance_vpt: 0, total_credited_ngn: 0, total_credited_vpt: 0 };
  const data = doc.data();
  return {
    balance_ngn: data.balance_ngn || 0,
    balance_vpt: data.balance_vpt || 0,
    total_credited_ngn: data.total_credited_ngn || 0,
    total_credited_vpt: data.total_credited_vpt || 0,
    updated_at: data.updated_at || null,
  };
}

// ─── OPERATIONS POOL ────────────────────────────────────

/**
 * Credit funds into the operations pool (50% of subscriptions).
 */
async function creditOperationsPool(amountNGN, source, meta = {}) {
  const db = getFirestore();
  const opsRef = db.doc(OPS_POOL_DOC);
  await opsRef.set(
    {
      balance_ngn: FieldValue.increment(amountNGN),
      total_credited: FieldValue.increment(amountNGN),
      updated_at: Date.now(),
    },
    { merge: true }
  );
  return { credited_ngn: amountNGN, source };
}

/**
 * Get current operations pool balance.
 */
async function getOperationsPoolBalance() {
  const db = getFirestore();
  const doc = await db.doc(OPS_POOL_DOC).get();
  if (!doc.exists) return { balance_ngn: 0, total_credited: 0 };
  const data = doc.data();
  return {
    balance_ngn: data.balance_ngn || 0,
    total_credited: data.total_credited || 0,
    updated_at: data.updated_at || null,
  };
}

// ─── VIEWER REWARD DISTRIBUTION ─────────────────────────

/**
 * Main distribution function: allocates community pool funds to eligible viewers
 * based on their plan's reward_multiplier.
 *
 * Formula:
 *   distributionAmount = poolBalance × VIEWER_REWARD_PERCENT / 100
 *   userShare = (userMultiplier / totalMultipliers) × distributionAmount
 *
 * Rules:
 * - Only viewers with active subscriptions and multiplier > 0 qualify
 * - Free plan (0x multiplier) earns nothing
 * - Distribution converts NGN → vPT units at configured VPT_PRICE_NGN rate
 * - Each user's vPT balance is credited directly
 * - Full ledger trail for every credit
 */
async function distributeViewerRewards() {
  const pool = await getPoolBalance();
  if (pool.balance_vpt <= 0) {
    return { distributed: false, reason: 'Pool is empty', pool_balance_vpt: pool.balance_vpt };
  }

  // Get configurable reward percentage (default: 10% of pool per cycle)
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10) / 100;
  const distributionAmountVPT = parseFloat((pool.balance_vpt * rewardPercent).toFixed(4));

  if (distributionAmountVPT <= 0) {
    return { distributed: false, reason: 'Distribution amount too small', pool_balance_vpt: pool.balance_vpt };
  }

  // Find all eligible viewers: active subscription + multiplier > 0
  const allUsers = User.getAll();
  const eligible = [];

  for (const user of allUsers) {
    if (user.subscription_status !== 'active') continue;

    // Find user's plan to get multiplier
    const plan = user.subscription_plan ? Plan.findByName(user.subscription_plan) : null;
    if (!plan || plan.type !== 'viewer') continue;

    const multiplier = plan.reward_multiplier || 0;
    if (multiplier <= 0) continue;

    eligible.push({ userId: user.id, email: user.email, multiplier, planName: plan.name });
  }

  if (eligible.length === 0) {
    return { distributed: false, reason: 'No eligible viewers', pool_balance: pool.balance_ngn };
  }

  // Calculate weighted shares
  const totalMultipliers = eligible.reduce((sum, v) => sum + v.multiplier, 0);

  const distributionId = crypto.randomUUID();
  const results = [];
  let totalDistributedVPT = 0;
  let totalDistributed = 0;
  let successCount = 0;

  // Log distribution start
  await Ledger.create({
    uid: null,
    type: 'VIEWER_REWARD_BATCH',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: distributionAmountNGN,
    status: 'pending',
    meta: {
      distribution_id: distributionId,
      eligible_viewers: eligible.length,
      total_multipliers: totalMultipliers,
      reward_percent: rewardPercent,
      pool_balance_before: pool.balance_ngn,
    },
    description: `Viewer reward distribution: ₦${distributionAmountNGN} to ${eligible.length} viewers`,
  });

  for (const viewer of eligible) {
    // Calculate share: proportional to multiplier
    const shareVPT = parseFloat(((viewer.multiplier / totalMultipliers) * distributionAmountVPT).toFixed(4));
    if (shareVPT <= 0) continue;

    try {
      // Credit user's vPT balance
      const userBefore = User.findById(viewer.userId);
      const balanceBefore = userBefore?.vpt || 0;
      await User.adjustVpt(viewer.userId, shareVPT);
      const balanceAfter = balanceBefore + shareVPT;

      // Create vPT transaction record
      await Vpt.create({
        userId: viewer.userId,
        type: 'viewer_reward',
        amount: shareVPT,
        description: `Community pool reward (${viewer.multiplier}x multiplier, ${viewer.planName} plan)`,
      });

      // Ledger entry for this credit
      await Ledger.create({
        uid: viewer.userId,
        type: 'VIEWER_REWARD',
        direction: 'credit',
        currency: 'vpt',
        amount_vpt: shareVPT,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'success',
        meta: {
          distribution_id: distributionId,
          multiplier: viewer.multiplier,
          plan_name: viewer.planName,
          share_pct: ((viewer.multiplier / totalMultipliers) * 100).toFixed(2),
          vpt_price_ngn: vptPriceNGN,
        },
        description: `Viewer reward: ${vptAmount} vPT (₦${shareNGN}, ${viewer.multiplier}x)`,
      });

      totalDistributedVPT += shareVPT;
      successCount++;
      results.push({ userId: viewer.userId, multiplier: viewer.multiplier, shareVPT, status: 'success' });

    } catch (err) {
      console.error('[Pool] Reward failed for viewer');
      await Ledger.create({
        uid: viewer.userId,
        type: 'VIEWER_REWARD_FAILED',
        direction: 'credit',
        currency: 'vpt',
        amount_ngn: shareNGN,
        status: 'failed',
        meta: { distribution_id: distributionId, error: err.message },
        description: `Viewer reward failed: ${err.message}`,
      });
      results.push({ userId: viewer.userId, multiplier: viewer.multiplier, shareNGN, status: 'failed', error: err.message });
    }
  }

  // Debit pool
  if (totalDistributedVPT > 0) {
    const db = getFirestore();
    const poolRef = db.doc(POOL_DOC);
    await poolRef.set(
      {
        balance_vpt: FieldValue.increment(-totalDistributedVPT),
        total_distributed_vpt: FieldValue.increment(totalDistributedVPT),
        updated_at: Date.now(),
      },
      { merge: true }
    );
  }

  // Record distribution summary
  const summary = {
    id: distributionId,
    distributed_vpt: totalDistributedVPT,
    eligible_viewers: eligible.length,
    success_count: successCount,
    failed_count: results.filter((r) => r.status === 'failed').length,
    total_multipliers: totalMultipliers,
    reward_percent: rewardPercent,
    pool_balance_before_vpt: pool.balance_vpt,
    pool_balance_after_vpt: pool.balance_vpt - totalDistributedVPT,
    results,
    created_at: Date.now(),
  };

  const db = getFirestore();
  await db.collection(DISTRIBUTIONS_COLLECTION).doc(distributionId).set(summary);
  distributions.push(summary);

  // Update batch ledger entry to success
  const batchLedger = Ledger.getByMeta('distribution_id', distributionId)
    .find((e) => e.type === 'VIEWER_REWARD_BATCH');
  if (batchLedger) {
    await Ledger.updateStatus(batchLedger.id, 'success', {
      meta: { ...batchLedger.meta, distributed_ngn: totalDistributed, success_count: successCount },
    });
  }

  // Distribution cycle complete

  return {
    distributed: true,
    distribution_id: distributionId,
    distributed_ngn: totalDistributed,
    eligible_viewers: eligible.length,
    success_count: successCount,
    pool_balance_after: pool.balance_ngn - totalDistributed,
  };
}

// ─── QUERIES ────────────────────────────────────────────

function getDistributionHistory(limit = 20) {
  return distributions
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function getDistributionById(id) {
  return distributions.find((d) => d.id === id) || null;
}

async function getPoolStats() {
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10);

  // ── Recalculate from actual ledger entries (source of truth) ──
  const allEntries = Ledger.getAll();

  // Sum 20% community share from every confirmed subscription payment
  const subTypes = ['PLAN_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'SUBSCRIPTION_RENEWAL'];
  let totalCreditedNgn = 0;
  let totalCreditedVptDirect = 0; // vPT-paid creator subs contribute vPT directly

  for (const e of allEntries) {
    if (!subTypes.includes(e.type) || e.status !== 'success') continue;

    const ngnAmt = e.amount_ngn || 0;
    const vptAmt = e.amount_vpt_units || 0;

    if (ngnAmt > 0) {
      // NGN-paid subscription: take 20% community share in NGN
      const share = (e.meta && e.meta.split && e.meta.split.community_pool != null)
        ? e.meta.split.community_pool
        : Math.floor(ngnAmt * 0.20);
      totalCreditedNgn += share;
    } else if (vptAmt > 0) {
      // vPT-paid subscription: take 20% community share in vPT units
      const share = (e.meta && e.meta.split && e.meta.split.community_pool != null)
        ? e.meta.split.community_pool
        : Math.floor(vptAmt * 0.20);
      totalCreditedVptDirect += share;
    }
  }

  // Convert NGN credits to vPT and combine with direct vPT credits
  const totalCreditedVptFromNgn = parseFloat((totalCreditedNgn / vptPriceNGN).toFixed(4));
  const totalCreditedVpt = parseFloat((totalCreditedVptFromNgn + totalCreditedVptDirect).toFixed(4));
  const totalCreditedNgnEquiv = totalCreditedNgn + Math.round(totalCreditedVptDirect * vptPriceNGN);

  // Sum total distributed to viewers (VIEWER_REWARD entries)
  const distributed = allEntries.filter((e) => e.type === 'VIEWER_REWARD' && e.status === 'success');
  const totalDistributedVpt = distributed.reduce((sum, e) => sum + (e.amount_vpt || e.amount_vpt_units || 0), 0);
  const totalDistributedNgn = Math.round(totalDistributedVpt * vptPriceNGN);

  const balanceVpt = parseFloat((totalCreditedVpt - totalDistributedVpt).toFixed(4));
  const balanceNgn = Math.round(balanceVpt * vptPriceNGN);

  // Beneficiaries
  const beneficiarySet = new Set(distributed.map((e) => e.uid).filter(Boolean));

  // Count eligible viewers
  const allUsers = User.getAll();
  let eligibleCount = 0;
  let totalMultipliers = 0;
  const tierCounts = {};

  for (const user of allUsers) {
    if (user.subscription_status !== 'active') continue;
    const plan = user.subscription_plan ? Plan.findByName(user.subscription_plan) : null;
    if (!plan || plan.type !== 'viewer') continue;
    const multiplier = plan.reward_multiplier || 0;
    if (multiplier <= 0) continue;
    eligibleCount++;
    totalMultipliers += multiplier;
    tierCounts[plan.name] = (tierCounts[plan.name] || 0) + 1;
  }

  const nextDistributionVPT = balanceVpt * (rewardPercent / 100);

  return {
    pool: {
      balance_ngn: balanceNgn,
      balance_vpt: balanceVpt,
      total_credited: totalCreditedNgnEquiv,
      total_credited_vpt: totalCreditedVpt,
      total_distributed: totalDistributedNgn,
      total_distributed_vpt: Math.round(totalDistributedVpt * 100) / 100,
      total_beneficiaries: beneficiarySet.size,
    },
    vpt_price_ngn: vptPriceNGN,
    eligible_viewers: eligibleCount,
    total_multipliers: totalMultipliers,
    tier_counts: tierCounts,
    reward_percent: rewardPercent,
    next_distribution_vpt: parseFloat(nextDistributionVPT.toFixed(4)),
    next_distribution_ngn: Math.round(nextDistributionVPT * vptPriceNGN),
    recent_distributions: getDistributionHistory(5),
  };
}

/**
 * Recalculate operations pool balance from confirmed subscription ledger entries.
 * 50% of every subscription amount.
 */
async function getRecalculatedOperationsPool() {
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const allEntries = Ledger.getAll();
  const subTypes = ['PLAN_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'SUBSCRIPTION_RENEWAL'];
  let totalNgn = 0;
  let totalVptDirect = 0;

  for (const e of allEntries) {
    if (!subTypes.includes(e.type) || e.status !== 'success') continue;
    const ngnAmt = e.amount_ngn || 0;
    const vptAmt = e.amount_vpt_units || 0;

    if (ngnAmt > 0) {
      const share = (e.meta && e.meta.split && e.meta.split.ops_pool != null)
        ? e.meta.split.ops_pool
        : Math.floor(ngnAmt * 0.50);
      totalNgn += share;
    } else if (vptAmt > 0) {
      const share = (e.meta && e.meta.split && e.meta.split.ops_pool != null)
        ? e.meta.split.ops_pool
        : Math.floor(vptAmt * 0.50);
      totalVptDirect += share;
    }
  }

  const totalNgnEquiv = totalNgn + Math.round(totalVptDirect * vptPriceNGN);
  return { balance_ngn: totalNgnEquiv, total_credited: totalNgnEquiv };
}

// ─── CRON ───────────────────────────────────────────────

let cronInterval = null;

/**
 * Start the daily viewer reward distribution cron.
 * Runs every VIEWER_REWARD_INTERVAL_HOURS (default: 24).
 */
async function startCron() {
  const intervalHours = (await SettingsService.getNumber('VIEWER_REWARD_INTERVAL_HOURS')) || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  if (cronInterval) clearInterval(cronInterval);

  cronInterval = setInterval(async () => {
    try {
      await distributeViewerRewards();
    } catch (err) {
      console.error('[Pool Cron] Distribution failed');
    }
  }, intervalMs);

  console.log('[Pool Cron] Viewer reward distribution scheduled');
}

function stopCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}

module.exports = {
  init,
  creditPool,
  getPoolBalance,
  creditRbdPool,
  getRbdPoolBalance,
  creditOperationsPool,
  getOperationsPoolBalance,
  getRecalculatedOperationsPool,
  distributeViewerRewards,
  getDistributionHistory,
  getDistributionById,
  getPoolStats,
  startCron,
  stopCron,
};
