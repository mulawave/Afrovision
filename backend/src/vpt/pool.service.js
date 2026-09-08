const crypto = require('crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('../utils/firestore');
const Ledger = require('./ledger.model');
const FieldValue = admin.firestore.FieldValue;
const User = require('../users/user.model');
const Plan = require('../subscriptions/plan.model');
const Vpt = require('./vpt.model');
const SettingsService = require('../admin/settings.service');

function _toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Produce canonical pool stats object consumers should read directly.
 * Accepts a pool Firestore object and an authoritative vptPrice (NGN per vPT).
 */
function canonicalPoolStats(pool = {}, vptPriceNGN = 750) {
  const balanceVpt = _toNumber(pool.balance_vpt ?? pool.balanceVpt ?? pool.vpt ?? 0, 0);
  const balanceNgn = Math.round(balanceVpt * vptPriceNGN);
  const nextDistributionVpt = _toNumber(pool.next_distribution_vpt ?? pool.nextDistributionVpt ?? 0, 0);
  const nextDistributionNgn = Math.round(nextDistributionVpt * vptPriceNGN);

  return {
    balance_vpt: Number(balanceVpt.toFixed(2)),
    balance_ngn: balanceNgn,
    vpt_price_ngn: Number(vptPriceNGN),
    next_distribution_vpt: Number(nextDistributionVpt.toFixed(4)),
    next_distribution_ngn: nextDistributionNgn,
    _raw: pool,
  };
}

const POOL_DOC = 'pools/community';
const RBD_POOL_DOC = 'pools/rbd'; // Referral Base Dump pool
const OPS_POOL_DOC = 'pools/operations'; // Operations pool (50% of subscriptions)
const DISTRIBUTIONS_COLLECTION = 'pool_distributions';
const POOL_STATS_CACHE_TTL_MS = 60_000;

let initialized = false;
let poolStatsCache = null;
let poolStatsCacheUpdatedAt = 0;
let poolStatsRequestInFlight = null;

function invalidatePoolStatsCache() {
  poolStatsCache = null;
  poolStatsCacheUpdatedAt = 0;
}

// ─── INIT ───────────────────────────────────────────────

async function init() {
  const db = getFirestore();
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
}

// ─── POOL BALANCE ───────────────────────────────────────

/**
 * Credit funds into the community pool.
 * Called by subscription controller and ad controller.
 */
async function creditPool(amountNGN, source, meta = {}) {
  const db = getFirestore();
  const poolRef = db.doc(POOL_DOC);
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const isVptCurrency = meta.currency === 'vpt';
  const creditedNgn = isVptCurrency ? Math.round(amountNGN * vptPriceNGN) : amountNGN;
  const creditedVpt = isVptCurrency ? Number(amountNGN) : parseFloat((creditedNgn / vptPriceNGN).toFixed(4));

  await poolRef.set(
    {
      balance_ngn: FieldValue.increment(creditedNgn),
      total_credited: FieldValue.increment(creditedNgn),
      balance_vpt: FieldValue.increment(creditedVpt),
      total_credited_vpt: FieldValue.increment(creditedVpt),
      updated_at: Date.now(),
    },
    { merge: true }
  );

  invalidatePoolStatsCache();
  return { credited_ngn: creditedNgn, credited_vpt: creditedVpt, source };
}

/**
 * Get current pool balance from Firestore.
 */
async function getPoolBalance() {
  const db = getFirestore();
  const doc = await db.doc(POOL_DOC).get();
  if (!doc.exists) return { balance_ngn: 0, total_credited: 0, total_distributed: 0, balance_vpt: 0, total_credited_vpt: 0, total_distributed_vpt: 0, total_beneficiaries: 0 };
  // Always return both NGN and vPT fields for compatibility
  const data = doc.data();
  return {
    balance_ngn: data.balance_ngn || 0,
    total_credited: data.total_credited || 0,
    total_distributed: data.total_distributed || 0,
    balance_vpt: data.balance_vpt || 0,
    total_credited_vpt: data.total_credited_vpt || 0,
    total_distributed_vpt: data.total_distributed_vpt || 0,
    total_beneficiaries: data.total_beneficiaries || 0,
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
  const isVptCurrency = meta.currency === 'vpt';
  const vptPriceNGN = isVptCurrency ? (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750 : null;
  const creditedNgn = isVptCurrency ? Math.round(amountNGN * vptPriceNGN) : amountNGN;
  await opsRef.set(
    {
      balance_ngn: FieldValue.increment(creditedNgn),
      total_credited: FieldValue.increment(creditedNgn),
      updated_at: Date.now(),
    },
    { merge: true }
  );
  return { credited_ngn: creditedNgn, source };
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

  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;

  // Get configurable reward percentage (default: 10% of pool per cycle)
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10) / 100;
  const distributionAmountVPT = parseFloat((pool.balance_vpt * rewardPercent).toFixed(4));
  const distributionAmountNGN = Math.round(distributionAmountVPT * vptPriceNGN);

  if (distributionAmountVPT <= 0) {
    return { distributed: false, reason: 'Distribution amount too small', pool_balance_vpt: pool.balance_vpt };
  }

  // Query only reward-eligible viewer plans instead of hydrating the full user base.
  const rewardableViewerPlans = (await Plan.getByType('viewer'))
    .filter((plan) => (plan.reward_multiplier || 0) > 0);
  const db = getFirestore();
  const eligible = (await Promise.all(
    rewardableViewerPlans.map(async (plan) => {
      const snapshot = await db.collection('users')
        .where('subscription_status', '==', 'active')
        .where('subscription_plan', '==', plan.name)
        .get();

      return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user) => User.hasActiveSubscription(user))
        .map((user) => ({
          userId: user.id,
          email: user.email || null,
          multiplier: plan.reward_multiplier || 0,
          planName: plan.name,
        }));
    })
  )).flat();

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
    const shareNGN = Math.round(shareVPT * vptPriceNGN);
    const vptAmount = shareVPT;

    try {
      // Credit user's vPT balance
      const userBefore = await User.findById(viewer.userId);
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
      totalDistributed += shareNGN;
      successCount++;
      results.push({ userId: viewer.userId, multiplier: viewer.multiplier, shareVPT, shareNGN, status: 'success' });

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
        total_beneficiaries: FieldValue.increment(successCount),
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

  await db.collection(DISTRIBUTIONS_COLLECTION).doc(distributionId).set(summary);
  invalidatePoolStatsCache();

  // Update batch ledger entry to success
  const batchLedger = (await Ledger.getByMeta('distribution_id', distributionId))
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

async function getDistributionHistory(limit = 20) {
  const db = getFirestore();
  const snapshot = await db.collection(DISTRIBUTIONS_COLLECTION)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function getDistributionById(id) {
  const db = getFirestore();
  const doc = await db.collection(DISTRIBUTIONS_COLLECTION).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function getPoolStats() {
  // Read authoritative vPT price and reward percent (settings may be async)
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10);

  // Base pool and viewer plan metrics
  const pool = await getPoolBalance();
  const viewerPlans = (await Plan.getByType('viewer'))
    .filter((plan) => (plan.reward_multiplier || 0) > 0);
  const db = getFirestore();
  const eligibleSnapshots = await Promise.all(
    viewerPlans.map((plan) => db.collection('users')
      .where('subscription_status', '==', 'active')
      .where('subscription_plan', '==', plan.name)
      .get())
  );

  let eligibleCount = 0;
  let totalMultipliers = 0;
  const tierCounts = {};

  for (let index = 0; index < viewerPlans.length; index += 1) {
    const plan = viewerPlans[index];
    const count = eligibleSnapshots[index].docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((user) => User.hasActiveSubscription(user))
      .length;
    if (count <= 0) continue;
    eligibleCount += count;
    totalMultipliers += count * (plan.reward_multiplier || 0);
    tierCounts[plan.name] = count;
  }

  const nextDistributionVPT = Number(pool.balance_vpt || 0) * (rewardPercent / 100);

  // Canonical fields for direct consumption
  const canonical = canonicalPoolStats(pool, vptPriceNGN);

  return Object.assign({}, canonical, {
    // preserve legacy `pool` object for existing callers
    pool: {
      balance_ngn: Number(pool.balance_ngn || 0),
      balance_vpt: Number(pool.balance_vpt || 0),
      total_credited: Number(pool.total_credited || 0),
      total_credited_vpt: Number(pool.total_credited_vpt || 0),
      total_distributed: Number(pool.total_distributed || 0),
      total_distributed_vpt: Number(pool.total_distributed_vpt || 0),
      total_beneficiaries: Number(pool.total_beneficiaries || 0),
    },
    eligible_viewers: eligibleCount,
    total_multipliers: totalMultipliers,
    tier_counts: tierCounts,
    reward_percent: rewardPercent,
    next_distribution_vpt: parseFloat(nextDistributionVPT.toFixed(4)),
    next_distribution_ngn: Math.round(nextDistributionVPT * vptPriceNGN),
    recent_distributions: await getDistributionHistory(5),
  });
}

/**
 * Recalculate operations pool balance from confirmed subscription ledger entries.
 * 50% of every subscription amount.
 */
async function getRecalculatedOperationsPool() {
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
  const subTypes = ['PLAN_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'SUBSCRIPTION_RENEWAL'];
  const allEntries = (await Promise.all(subTypes.map((type) => Ledger.getByType(type)))).flat();
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

const POOL_LOCK_COLLECTION = 'ops_locks';
const POOL_LOCK_DOC = 'viewer_reward_distribution';
const POOL_LOCK_TTL_MS = 55 * 60 * 1000;

let activeDistributionPromise = null;

function stopCron() {
  return null;
}

async function acquireDistributionLease({ holder, trigger, force = false }) {
  const db = getFirestore();
  const leaseRef = db.collection(POOL_LOCK_COLLECTION).doc(POOL_LOCK_DOC);
  const now = Date.now();
  const intervalHours = (await SettingsService.getNumber('VIEWER_REWARD_INTERVAL_HOURS')) || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  let acquired = false;
  let result = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(leaseRef);
    const lease = snapshot.exists ? snapshot.data() : null;
    const activeLease = lease
      && lease.status === 'running'
      && typeof lease.expires_at === 'number'
      && lease.expires_at > now;
    const lastFinishedAt = typeof lease?.last_finished_at === 'number' ? lease.last_finished_at : 0;
    const nextDueAt = lastFinishedAt ? lastFinishedAt + intervalMs : now;

    if (activeLease && !force) {
      result = { acquired: false, reason: 'lease-held', lease };
      return;
    }

    if (!force && lastFinishedAt && nextDueAt > now) {
      result = { acquired: false, reason: 'not-due', lease, next_due_at: nextDueAt };
      return;
    }

    const nextLease = {
      status: 'running',
      trigger,
      holder,
      started_at: now,
      updated_at: now,
      expires_at: now + POOL_LOCK_TTL_MS,
    };

    tx.set(leaseRef, nextLease, { merge: true });
    acquired = true;
    result = { acquired: true, lease: nextLease };
  });

  return result;
}

async function releaseDistributionLease({ holder, summary, status, errorMessage = null }) {
  const db = getFirestore();
  const leaseRef = db.collection(POOL_LOCK_COLLECTION).doc(POOL_LOCK_DOC);
  const finishedAt = Date.now();

  await leaseRef.set({
    status,
    holder,
    updated_at: finishedAt,
    expires_at: finishedAt,
    last_finished_at: finishedAt,
    last_error: errorMessage,
    last_summary: summary,
  }, { merge: true });
}

/**
 * Start hook retained for compatibility; scheduling is externally owned.
 */
async function startCron() {
  console.log('[Pool Cron] In-process scheduler disabled; use an external trigger for viewer reward runs');
}

async function runScheduledDistribution({ trigger = 'manual', force = false } = {}) {
  if (activeDistributionPromise) {
    return activeDistributionPromise;
  }

  const holder = `${trigger}:${process.pid}:${Date.now()}`;

  activeDistributionPromise = (async () => {
    const leaseResult = await acquireDistributionLease({ holder, trigger, force });
    if (!leaseResult.acquired) {
      return {
        skipped: true,
        reason: leaseResult.reason,
        lease: leaseResult.lease || null,
        next_due_at: leaseResult.next_due_at || null,
      };
    }

    try {
      const result = await distributeViewerRewards();
      const summary = {
        trigger,
        finished_at: Date.now(),
        result,
      };
      await releaseDistributionLease({ holder, summary, status: 'idle' });
      return {
        skipped: false,
        summary,
      };
    } catch (error) {
      await releaseDistributionLease({
        holder,
        summary: null,
        status: 'failed',
        errorMessage: error.message,
      });
      throw error;
    }
  })();

  try {
    return await activeDistributionPromise;
  } finally {
    activeDistributionPromise = null;
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
  canonicalPoolStats,
  invalidatePoolStatsCache,
  runScheduledDistribution,
  startCron,
  stopCron,
};
