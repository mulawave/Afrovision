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
  await poolRef.set(
    { balance_ngn: FieldValue.increment(amountNGN), total_credited: FieldValue.increment(amountNGN), updated_at: Date.now() },
    { merge: true }
  );
  console.log(`[Pool] Credited ₦${amountNGN} from ${source}`);
  return { credited: amountNGN, source };
}

/**
 * Get current pool balance from Firestore.
 */
async function getPoolBalance() {
  const db = getFirestore();
  const doc = await db.doc(POOL_DOC).get();
  if (!doc.exists) return { balance_ngn: 0, total_credited: 0, total_distributed: 0 };
  return doc.data();
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
  if (pool.balance_ngn <= 0) {
    return { distributed: false, reason: 'Pool is empty', pool_balance: pool.balance_ngn };
  }

  // Get configurable reward percentage (default: 10% of pool per cycle)
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10) / 100;
  const distributionAmountNGN = Math.round(pool.balance_ngn * rewardPercent);

  if (distributionAmountNGN <= 0) {
    return { distributed: false, reason: 'Distribution amount too small', pool_balance: pool.balance_ngn };
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

  // Get vPT price for conversion
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;

  const distributionId = crypto.randomUUID();
  const results = [];
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
    const shareNGN = Math.round((viewer.multiplier / totalMultipliers) * distributionAmountNGN);
    if (shareNGN <= 0) continue;

    // Convert NGN → vPT units
    const vptAmount = parseFloat((shareNGN / vptPriceNGN).toFixed(4));
    if (vptAmount <= 0) continue;

    try {
      // Credit user's vPT balance
      const userBefore = User.findById(viewer.userId);
      const balanceBefore = userBefore?.vpt_balance || 0;
      await User.adjustVptBalance(viewer.userId, vptAmount);
      const balanceAfter = balanceBefore + vptAmount;

      // Create vPT transaction record
      await Vpt.create({
        userId: viewer.userId,
        type: 'viewer_reward',
        amount: vptAmount,
        description: `Community pool reward (${viewer.multiplier}x multiplier, ${viewer.planName} plan)`,
      });

      // Ledger entry for this credit
      await Ledger.create({
        uid: viewer.userId,
        type: 'VIEWER_REWARD',
        direction: 'credit',
        currency: 'vpt',
        amount_ngn: shareNGN,
        amount_vpt: vptAmount,
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

      totalDistributed += shareNGN;
      successCount++;
      results.push({ userId: viewer.userId, multiplier: viewer.multiplier, shareNGN, vptAmount, status: 'success' });

    } catch (err) {
      console.error(`[Pool] Reward failed for ${viewer.userId}:`, err.message);
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
  if (totalDistributed > 0) {
    const db = getFirestore();
    const poolRef = db.doc(POOL_DOC);
    await poolRef.set(
      {
        balance_ngn: FieldValue.increment(-totalDistributed),
        total_distributed: FieldValue.increment(totalDistributed),
        updated_at: Date.now(),
      },
      { merge: true }
    );
  }

  // Record distribution summary
  const summary = {
    id: distributionId,
    distributed_ngn: totalDistributed,
    eligible_viewers: eligible.length,
    success_count: successCount,
    failed_count: results.filter((r) => r.status === 'failed').length,
    total_multipliers: totalMultipliers,
    reward_percent: rewardPercent,
    vpt_price_ngn: vptPriceNGN,
    pool_balance_before: pool.balance_ngn,
    pool_balance_after: pool.balance_ngn - totalDistributed,
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

  console.log(`[Pool] Distributed ₦${totalDistributed} to ${successCount}/${eligible.length} viewers`);

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
  const pool = await getPoolBalance();
  const rewardPercent = ((await SettingsService.getNumber('VIEWER_REWARD_PERCENT')) || 10);
  const vptPriceNGN = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;

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

  const nextDistributionNGN = Math.round(pool.balance_ngn * (rewardPercent / 100));
  const nextDistributionVPT = vptPriceNGN > 0 ? parseFloat((nextDistributionNGN / vptPriceNGN).toFixed(4)) : 0;

  return {
    pool,
    eligible_viewers: eligibleCount,
    total_multipliers: totalMultipliers,
    tier_counts: tierCounts,
    reward_percent: rewardPercent,
    vpt_price_ngn: vptPriceNGN,
    next_distribution_ngn: nextDistributionNGN,
    next_distribution_vpt: nextDistributionVPT,
    recent_distributions: getDistributionHistory(5),
  };
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
    console.log('[Pool Cron] Starting viewer reward distribution...');
    try {
      const result = await distributeViewerRewards();
      console.log('[Pool Cron] Result:', JSON.stringify(result));
    } catch (err) {
      console.error('[Pool Cron] Distribution failed:', err.message);
    }
  }, intervalMs);

  console.log(`[Pool Cron] Viewer reward distribution scheduled every ${intervalHours}h`);
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
  distributeViewerRewards,
  getDistributionHistory,
  getDistributionById,
  getPoolStats,
  startCron,
  stopCron,
};
