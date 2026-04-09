const Plan = require('./plan.model');
const User = require('../users/user.model');
const Vpt = require('../vpt/vpt.model');
const Ledger = require('../vpt/ledger.model');
const Distribution = require('../vpt/distribution.service');
const PoolService = require('../vpt/pool.service');
const WalletService = require('../wallet/wallet.service');
const SettingsService = require('../admin/settings.service');

function getPlans(req, res) {
  const plans = Plan.getAll();
  res.json({ plans });
}

async function subscribe(req, res) {
  const { planId, paymentMethod } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required' });

  const plan = Plan.findById(planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Payment rules: first subscription = fiat only, renewals for creators can use vPT
  const isRenewal = user.first_subscription_at !== null;
  const method = paymentMethod || 'fiat';

  if (method === 'vpt') {
    if (!isRenewal) {
      return res.status(400).json({ error: 'First subscription must be paid with fiat' });
    }
    if (user.vpt_balance < plan.price) {
      return res.status(400).json({ error: 'Insufficient vPT balance' });
    }
    // Deduct vPT
    await User.adjustVptBalance(req.userId, -plan.price);
    await Vpt.create({
      userId: req.userId,
      type: 'subscription_payment',
      amount: -plan.price,
      description: `${plan.name} plan subscription via vPT`,
    });
  }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  await User.setSubscription(req.userId, {
    plan: plan.name,
    status: 'active',
    expiry: expiry.toISOString(),
  });

  // Track first subscription
  if (!user.first_subscription_at) {
    await User.setFirstSubscriptionAt(req.userId, new Date().toISOString());
  }

  // Auto-set role to creator
  await User.setRole(req.userId, 'creator');

  // Premium plan grants premium creator status
  if (plan.name === 'premium') {
    await User.setPremium(req.userId, true);
  } else {
    await User.setPremium(req.userId, false);
  }

  // --- ECONOMIC ENGINE: Ledger + Split + Queue ---

  // 1. Log the plan payment (ledger = source of truth)
  await Ledger.create({
    uid: req.userId,
    type: 'PLAN_PAYMENT',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: plan.price,
    status: 'success',
    meta: { plan_id: plan.id, plan_name: plan.name, method },
    description: `${plan.name} plan subscription via ${method}`,
  });

  // 2. Split: community pool = 20% of plan price
  const communityPoolRate = ((await SettingsService.getNumber('COMMUNITY_POOL_PERCENT')) || 20) / 100;
  const communityPool = Math.round(plan.price * communityPoolRate);

  // 3. Extract: configurable % of community pool → vPT conversion
  const vptExtractionRate = ((await SettingsService.getNumber('VPT_EXTRACTION_PERCENT')) || 30) / 100;
  const vptPortion = Math.round(communityPool * vptExtractionRate);

  await Ledger.create({
    uid: req.userId,
    type: 'SPLIT',
    direction: 'credit',
    currency: 'ngn',
    amount_ngn: vptPortion,
    status: 'success',
    meta: {
      plan_price: plan.price,
      community_pool: communityPool,
      community_pool_rate: communityPoolRate,
      vpt_extraction_rate: vptExtractionRate,
    },
    description: `Split: ₦${plan.price} → ${communityPoolRate * 100}% pool (₦${communityPool}) → 30% vPT (₦${vptPortion})`,
  });

  // 3b. Credit community pool balance (Firestore pools/community doc)
  await PoolService.creditPool(communityPool, 'subscription', {
    plan_id: plan.id,
    plan_name: plan.name,
    user_id: req.userId,
  });

  // 4. Queue vPT conversion
  const queueItem = await Distribution.queueVPT(req.userId, vptPortion, plan.id);

  // 5. Auto-create BSC wallet for creator (blocking — needed for distribution)
  let walletCreated = false;
  try {
    await WalletService.createWallet(req.userId);
    walletCreated = true;
  } catch (err) {
    console.error('[Subscribe] Wallet creation failed:', err.message);
  }

  // 6. Auto-process batch: queue → swap → distribute (instant economy)
  let batchResult = null;
  try {
    batchResult = await Distribution.processBatch();
    console.log('[Subscribe] Auto-batch:', JSON.stringify(batchResult));
  } catch (err) {
    console.error('[Subscribe] Auto-batch failed:', err.message);
  }

  const updated = User.findById(req.userId);
  res.json({
    user: User.toSafeUser(updated),
    plan,
    vpt_queue: {
      id: queueItem.id,
      ngn_value: queueItem.ngn_value,
      status: queueItem.status,
    },
    batch: batchResult,
  });
}

function getMySubscription(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const planDetails = user.subscription_plan
    ? Plan.findByName(user.subscription_plan)
    : null;

  res.json({
    subscription: {
      plan: user.subscription_plan,
      status: user.subscription_status,
      expiry: user.subscription_expiry,
    },
    plan: planDetails || null,
    user: User.toSafeUser(user),
  });
}

module.exports = { getPlans, subscribe, getMySubscription };
