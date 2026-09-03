const Plan = require('./plan.model');
const User = require('../users/user.model');
const Vpt = require('../vpt/vpt.model');
const Ledger = require('../vpt/ledger.model');
const Distribution = require('../vpt/distribution.service');
const PoolService = require('../vpt/pool.service');
const WalletService = require('../wallet/wallet.service');
const SettingsService = require('../admin/settings.service');
const ReferralModel = require('../referrals/referral.model');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const NotificationService = require('../notifications/notification.service');
const ReputationService = require('../reputation/reputation.service');
const { previewWalletPayment, chargeWallet } = require('./wallet_payment.helper');

async function getPlans(req, res) {
  const plans = await Plan.getAll();
  res.json({ plans });
}

function getPlanEligibilityError(user, plan) {
  if (!user) return 'User not found';
  if (!plan) return 'Plan not found';

  const isCreatorAccount = user.role === 'creator' || user.role === 'admin';
  if (plan.type === 'viewer' && isCreatorAccount) {
    return 'Creator accounts do not use viewer plans. You can still access public and private channels without a viewer plan, while exclusive premium channels remain pay-per-access.';
  }

  return null;
}

async function activatePlatformPlan({
  userId,
  planId,
  billingCycle = 'monthly',
  paymentMethod = 'fiat',
  amountNgn,
  referenceId = null,
}) {
  const plan = typeof planId === 'string' ? await Plan.findById(planId) : planId;
  if (!plan) {
    throw new Error('Plan not found');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const eligibilityError = getPlanEligibilityError(user, plan);
  if (eligibilityError) {
    throw new Error(eligibilityError);
  }

  const subscriptionAmount = Number(
    amountNgn ?? (billingCycle === 'yearly' ? plan.yearly_price || plan.price : plan.price),
  );
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (billingCycle === 'yearly' ? 365 : 30));

  await User.setSubscription(userId, {
    plan: plan.name,
    status: 'active',
    expiry: expiry.toISOString(),
  });

  if (!user.first_subscription_at) {
    await User.setFirstSubscriptionAt(userId, new Date().toISOString());
  }

  if (plan.type === 'creator') {
    if (user.role !== 'admin') {
      await User.setRole(userId, 'creator');
    }
    await User.setPremium(userId, plan.name === 'premium');
  } else if (user.role !== 'creator' && user.role !== 'admin') {
    await User.setRole(userId, 'viewer');
  }

  await Ledger.create({
    uid: userId,
    type: 'PLAN_PAYMENT',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: subscriptionAmount,
    status: 'success',
    reference_id: referenceId,
    meta: {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_type: plan.type,
      billing_cycle: billingCycle,
      method: paymentMethod,
    },
    description: `${plan.name} plan subscription via ${paymentMethod}`,
  });

  const subscriberVptRewardNgn = Math.floor(subscriptionAmount * 0.15);
  const subscriberVptRewardUnits = parseFloat(
    (subscriberVptRewardNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
  );
  const referralPool = Math.floor(subscriptionAmount * 0.15);
  const communityPool = Math.floor(subscriptionAmount * 0.20);

  if (subscriberVptRewardUnits > 0) {
    await Ledger.create({
      uid: userId,
      type: 'SUBSCRIBER_VPT_REWARD',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: subscriberVptRewardUnits,
      status: 'pending_distribution',
      reference_id: referenceId,
      meta: {
        plan_id: plan.id,
        plan_name: plan.name,
        plan_type: plan.type,
        billing_cycle: billingCycle,
        subscription_amount: subscriptionAmount,
        reward_value_ngn: subscriberVptRewardNgn,
        vpt_price: ReferralModel.VPT_PRICE_NGN,
      },
      description: `Subscriber vPT reward — ${subscriberVptRewardUnits} vPT (₦${subscriberVptRewardNgn}) — ${plan.name} plan`,
    });
  }

  if (referralPool > 0) {
    await distributeReferralEarnings({
      subscriberUid: userId,
      referralPoolAmount: referralPool,
      subscriptionId: `plan_${plan.id}_${userId}_${billingCycle}`,
      creatorUid: null,
    });
  }

  if (communityPool > 0) {
    await PoolService.creditPool(communityPool, 'subscription', {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_type: plan.type,
      billing_cycle: billingCycle,
      user_id: userId,
    });
  }

  // Credit operations pool (50%)
  const operationsPool = Math.floor(subscriptionAmount * 0.50);
  if (operationsPool > 0) {
    await PoolService.creditOperationsPool(operationsPool, 'subscription', {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_type: plan.type,
      billing_cycle: billingCycle,
      user_id: userId,
    });
  }

  let walletCreated = false;
  if (plan.type === 'creator') {
    try {
      await WalletService.createWallet(userId);
      walletCreated = true;
    } catch (err) {
      console.error('[Subscribe] Wallet creation failed:', err.message);
    }
  }

  const updated = await User.findById(userId);

  // Notify user about successful subscription
  NotificationService.notifyUser(userId, {
    title: '✅ Subscription Activated!',
    body: `Your ${plan.name} plan is now active. ${subscriberVptRewardUnits > 0 ? `You earned ${subscriberVptRewardUnits} vPT as a reward!` : 'Enjoy your premium access!'}`,
    type: 'subscription_activated',
    link: '/profile',
    data: {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_type: plan.type,
      billing_cycle: billingCycle,
      amount_ngn: String(subscriptionAmount),
      vpt_reward: String(subscriberVptRewardUnits),
    },
  }).catch((err) => console.error('[Subscribe] notification error:', err.message));

  return {
    user: User.toSafeUser(updated),
    plan,
    wallet_created: walletCreated,
    payout_structure: {
      subscription_amount: subscriptionAmount,
      operations_pool: Math.floor(subscriptionAmount * 0.50),
      subscriber_vpt_reward: subscriberVptRewardNgn,
      subscriber_vpt_reward_ngn: subscriberVptRewardNgn,
      subscriber_vpt_reward_vpt_units: subscriberVptRewardUnits,
      referral_pool: referralPool,
      community_pool: communityPool,
    },
  };
}

async function subscribe(req, res) {
  const { planId, paymentMethod } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required' });

  const plan = await Plan.findById(planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const eligibilityError = getPlanEligibilityError(user, plan);
  if (eligibilityError) {
    return res.status(400).json({ error: eligibilityError });
  }

  // Reputation gate: viewer plans above free tier require a minimum rep level
  if (plan.type === 'viewer' && plan.id !== 'plan_viewer_free') {
    if (!(await ReputationService.canSubscribeToPlan(req.userId, plan.id))) {
      return res.status(403).json({
        error: 'REPUTATION_GATE',
        message: 'Your reputation level is too low for this plan. Keep gifting to level up!',
      });
    }
  }

  const method = paymentMethod || 'fiat';

  if (method === 'wallet') {
    // Pay with internal cash + vPT wallets (mixed if necessary)
    try {
      const chargeResult = await chargeWallet(req.userId, plan.price, {
        type: 'PLAN_PAYMENT',
        description: `${plan.name} plan subscription via wallet`,
        meta: {
          plan_id: plan.id,
          plan_name: plan.name,
          plan_type: plan.type,
          method: 'wallet',
        },
      });

      const result = await activatePlatformPlan({
        userId: req.userId,
        planId: plan.id,
        billingCycle: 'monthly',
        paymentMethod: 'wallet',
        amountNgn: plan.price,
      });

      res.json({ ...result, wallet_payment: chargeResult });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({
          error: 'INSUFFICIENT_FUNDS',
          message: 'Your wallet balance is insufficient. Top up your wallet or pay with card.',
          details: err.details,
        });
      }
      return res.status(500).json({ error: err.message || 'Wallet payment failed' });
    }
    return;
  }

  if (method === 'vpt') {
    if (user.vpt < plan.price) {
      return res.status(400).json({ error: 'Insufficient vPT balance' });
    }
    // Deduct vPT
    await User.adjustVpt(req.userId, -plan.price);
    await Vpt.create({
      userId: req.userId,
      type: 'subscription_payment',
      amount: -plan.price,
      description: `${plan.name} plan subscription via vPT`,
    });

    const result = await activatePlatformPlan({
      userId: req.userId,
      planId: plan.id,
      billingCycle: 'monthly',
      paymentMethod: method,
      amountNgn: plan.price,
    });

    res.json(result);
    return;
  }

  // Fiat — redirect to checkout flow
  return res.status(400).json({
    error: 'Fiat subscriptions now require the checkout flow. Initialize payment from the client checkout screen.',
  });
}

async function getMySubscription(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const planDetails = user.subscription_plan
    ? await Plan.findByName(user.subscription_plan)
    : null;

  const isActive = User.hasActiveSubscription(user);

  res.json({
    subscription: {
      plan: user.subscription_plan,
      status: isActive ? user.subscription_status : 'expired',
      expiry: user.subscription_expiry,
    },
    plan: planDetails || null,
    user: User.toSafeUser(user),
  });
}

async function previewWallet(req, res) {
  try {
    const amountNgn = Number(req.query.amount);
    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      return res.status(400).json({ error: 'amount query parameter must be a positive number' });
    }

    const preview = await previewWalletPayment(req.userId, amountNgn);
    res.json({ preview });
  } catch (err) {
    console.error('[Subscriptions] previewWallet error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to preview wallet payment' });
  }
}

module.exports = {
  getPlans,
  subscribe,
  getMySubscription,
  activatePlatformPlan,
  getPlanEligibilityError,
  previewWallet,
};
