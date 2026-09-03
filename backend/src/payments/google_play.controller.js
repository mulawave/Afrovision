const Payment = require('./payment.model');
const PaymentService = require('./payment.service');
const GooglePlayService = require('./google_play.service');
const Plan = require('../subscriptions/plan.model');
const User = require('../users/user.model');
const Channel = require('../channels/channel.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const ReferralModel = require('../referrals/referral.model');
const { activatePlatformPlan } = require('../subscriptions/subscription.controller');
const CreatorSub = require('../subscriptions/creator_subscription.model');
const ChannelSub = require('../subscriptions/channel_subscription.model');
const CreatorStats = require('../channels/creator_stats.model');
const ChannelStats = require('../channels/channel_stats.model');
const NotificationService = require('../notifications/notification.service');
const PoolService = require('../vpt/pool.service');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');

const DEFAULT_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.afrovision.app';

async function resolvePackageName() {
  try {
    const SettingsService = require('../admin/settings.service');
    const value = await SettingsService.get('GOOGLE_PLAY_PACKAGE_NAME');
    if (value) return value;
  } catch (_) {}
  return DEFAULT_PACKAGE_NAME;
}

const PRODUCT_MAP = {
  // Wallet top-ups (consumable products)
  wallet_topup_500: { purpose: 'wallet_topup', amountNgn: 500, balanceType: 'ngn' },
  wallet_topup_1000: { purpose: 'wallet_topup', amountNgn: 1000, balanceType: 'ngn' },
  wallet_topup_2000: { purpose: 'wallet_topup', amountNgn: 2000, balanceType: 'ngn' },
  wallet_topup_5000: { purpose: 'wallet_topup', amountNgn: 5000, balanceType: 'ngn' },
  wallet_topup_10000: { purpose: 'wallet_topup', amountNgn: 10000, balanceType: 'ngn' },

  // Viewer platform plan subscriptions
  viewer_basic_monthly: { purpose: 'platform_plan', planId: 'plan_viewer_basic', billingCycle: 'monthly' },
  viewer_basic_yearly: { purpose: 'platform_plan', planId: 'plan_viewer_basic', billingCycle: 'yearly' },
  viewer_pro_monthly: { purpose: 'platform_plan', planId: 'plan_viewer_pro', billingCycle: 'monthly' },
  viewer_pro_yearly: { purpose: 'platform_plan', planId: 'plan_viewer_pro', billingCycle: 'yearly' },
  viewer_premium_monthly: { purpose: 'platform_plan', planId: 'plan_viewer_premium', billingCycle: 'monthly' },
  viewer_premium_yearly: { purpose: 'platform_plan', planId: 'plan_viewer_premium', billingCycle: 'yearly' },

  // Creator platform plan subscriptions
  creator_basic_monthly: { purpose: 'platform_plan', planId: 'plan_basic', billingCycle: 'monthly' },
  creator_pro_monthly: { purpose: 'platform_plan', planId: 'plan_pro', billingCycle: 'monthly' },
  creator_premium_monthly: { purpose: 'platform_plan', planId: 'plan_premium', billingCycle: 'monthly' },
};

async function verifyGooglePlayPurchase(req, res) {
  try {
    const {
      productId,
      purchaseToken,
      isSubscription = false,
      channelId,
      creatorUid,
    } = req.body;
    const packageName = req.body.packageName || await resolvePackageName();

    if (!productId || !purchaseToken) {
      return res.status(400).json({ error: 'productId and purchaseToken are required' });
    }

    // Idempotency: check if this purchase token was already processed
    const existingPayment = await Payment.findByProviderPurchaseToken('google_play', purchaseToken);
    if (existingPayment && existingPayment.applied_at) {
      const payload = await PaymentService.getVerificationPayload(existingPayment);
      return res.json({
        payment: serializePayment(existingPayment),
        user: payload.user,
        wallet: payload.wallet,
        plan: payload.plan,
        already_verified: true,
      });
    }

    // Determine product mapping
    const productMapping = PRODUCT_MAP[productId];

    // For creator subscriptions and channel subscriptions, the productId encodes the target
    const isCreatorSub = productId.startsWith('creator_sub_');
    const isChannelSub = productId.startsWith('channel_sub_');

    // Verify with Google Play
    let verification;
    if (isSubscription || isCreatorSub || isChannelSub) {
      verification = await GooglePlayService.verifySubscriptionPurchase({
        packageName,
        productId,
        purchaseToken,
      });
    } else {
      verification = await GooglePlayService.verifyProductPurchase({
        packageName,
        productId,
        purchaseToken,
      });
    }

    if (!verification.valid) {
      return res.status(402).json({
        error: 'Google Play purchase verification failed',
        raw_status: verification.purchase?.purchaseState ?? verification.purchase?.paymentState,
      });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create or update payment record
    let payment = existingPayment;
    if (!payment) {
      let purpose = 'wallet_topup';
      let amountNgn = 0;
      let planId = null;
      let billingCycle = 'monthly';
      let balanceType = 'ngn';
      let meta = { google_play_product_id: productId };

      if (isCreatorSub) {
        purpose = 'creator_subscription';
        amountNgn = 2000;
        meta.creatorUid = creatorUid;
      } else if (isChannelSub) {
        purpose = 'channel_subscription';
        const channel = await Channel.findById(channelId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        amountNgn = Number(channel.subscription_price_ngn) || 0;
        meta.channelId = channelId;
        meta.channelName = channel.name;
        meta.channelOwnerId = channel.owner_id;
      } else if (productMapping) {
        purpose = productMapping.purpose;
        if (purpose === 'wallet_topup') {
          amountNgn = productMapping.amountNgn;
          balanceType = productMapping.balanceType;
        } else if (purpose === 'platform_plan') {
          planId = productMapping.planId;
          billingCycle = productMapping.billingCycle;
          const plan = await Plan.findById(planId);
          if (!plan) return res.status(404).json({ error: 'Plan not found' });
          amountNgn = billingCycle === 'yearly' ? (plan.yearly_price || plan.price) : plan.price;
          meta.plan_name = plan.name;
          meta.plan_type = plan.type;
        }
      } else {
        return res.status(400).json({ error: `Unknown Google Play product ID: ${productId}` });
      }

      payment = await Payment.create({
        uid: req.userId,
        purpose,
        provider: 'google_play',
        amount_ngn: amountNgn,
        currency: 'NGN',
        balance_type: balanceType,
        plan_id: planId,
        billing_cycle: billingCycle,
        provider_payment_id: purchaseToken,
        reference: `gplay_${productId}_${Date.now()}`,
        status: 'initialized',
        meta,
      });
    }

    // Mark as verified
    payment = await Payment.update(payment.id, {
      status: 'paid',
      verified_at: Date.now(),
      raw_status: 'verified',
      error: null,
    });

    // Apply entitlement based on purpose
    if (payment.purpose === 'wallet_topup') {
      await applyWalletTopupGooglePlay(payment);
    } else if (payment.purpose === 'platform_plan') {
      await activatePlatformPlan({
        userId: req.userId,
        planId: payment.plan_id,
        billingCycle: payment.billing_cycle || 'monthly',
        paymentMethod: 'google_play',
        amountNgn: payment.amount_ngn,
        referenceId: payment.id,
      });
    } else if (payment.purpose === 'creator_subscription') {
      await applyCreatorSubscriptionGooglePlay(payment, user);
    } else if (payment.purpose === 'channel_subscription') {
      await applyChannelSubscriptionGooglePlay(payment, user);
    }

    // Mark as applied
    payment = await Payment.update(payment.id, {
      applied_at: Date.now(),
      status: 'paid',
    });

    const payload = await PaymentService.getVerificationPayload(payment);
    res.json({
      payment: serializePayment(payment),
      user: payload.user,
      wallet: payload.wallet,
      plan: payload.plan,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[GooglePlay] verifyPurchase error:', err.message);
    res.status(statusCode).json({ error: err.message || 'Failed to verify Google Play purchase' });
  }
}

function serializePayment(payment) {
  return {
    id: payment.id,
    purpose: payment.purpose,
    provider: payment.provider,
    status: payment.status,
    amount_ngn: payment.amount_ngn,
    balance_type: payment.balance_type,
    plan_id: payment.plan_id,
    billing_cycle: payment.billing_cycle,
    reference: payment.reference,
    raw_status: payment.raw_status,
    error: payment.error,
    verified_at: payment.verified_at,
    applied_at: payment.applied_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

async function applyWalletTopupGooglePlay(payment) {
  const SettingsService = require('../admin/settings.service');
  if (payment.balance_type === 'vpt') {
    const vptPrice = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
    const units = parseFloat((payment.amount_ngn / vptPrice).toFixed(4));
    await GiftWallet.ensureWallet(payment.uid);
    await GiftWallet.adjustVptUnits(payment.uid, units);
    await Ledger.create({
      uid: payment.uid,
      type: 'WALLET_TOPUP',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: units,
      amount_ngn: payment.amount_ngn,
      status: 'success',
      reference_id: payment.id,
      meta: { provider: 'google_play', balance_type: 'vpt', vpt_price_ngn: vptPrice },
      description: `Gift wallet vPT top-up via Google Play`,
    });
    return;
  }

  await GiftWallet.ensureWallet(payment.uid);
  await GiftWallet.adjustNgnBalance(payment.uid, payment.amount_ngn);
  await Ledger.create({
    uid: payment.uid,
    type: 'WALLET_TOPUP',
    direction: 'credit',
    currency: 'ngn',
    amount_ngn: payment.amount_ngn,
    status: 'success',
    reference_id: payment.id,
    meta: { provider: 'google_play', balance_type: 'ngn' },
    description: `Gift wallet NGN top-up via Google Play`,
  });
}

async function applyCreatorSubscriptionGooglePlay(payment, user) {
  const creatorUid = payment.meta?.creatorUid;
  if (!creatorUid) throw new Error('creatorUid missing from payment meta');

  const existing = await CreatorSub.findActive(payment.uid, creatorUid);
  if (existing) return;

  const amount = payment.amount_ngn;
  const opsPool = Math.floor(amount * 0.50);
  const subscriberVptNgn = Math.floor(amount * 0.15);
  const subscriberVptUnits = parseFloat(
    (subscriberVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
  );
  const referralPool = Math.floor(amount * 0.15);
  const communityPool = amount - opsPool - subscriberVptNgn - referralPool;

  if (subscriberVptUnits > 0) {
    await Ledger.create({
      uid: payment.uid,
      type: 'SUBSCRIBER_VPT_REWARD',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: subscriberVptUnits,
      status: 'pending_distribution',
      meta: {
        creator_uid: creatorUid,
        subscription_amount: amount,
        payment_currency: 'ngn',
        reward_value_ngn: subscriberVptNgn,
        vpt_price: ReferralModel.VPT_PRICE_NGN,
      },
      description: `Subscriber vPT reward — ${subscriberVptUnits} vPT — Google Play creator subscription`,
    });
  }

  const sub = await CreatorSub.create({
    subscriberUid: payment.uid,
    creatorUid,
    plan: 'monthly',
    currency: 'ngn',
    amount,
  });

  if (referralPool > 0) {
    distributeReferralEarnings({
      subscriberUid: payment.uid,
      referralPoolAmount: referralPool,
      subscriptionId: sub.id,
      creatorUid,
    }).catch((err) => console.error('[GooglePlay CreatorSub] referral error:', err.message));
  }

  if (communityPool > 0) {
    PoolService.creditPool(communityPool, 'creator_subscription', {
      creator_uid: creatorUid, subscriber_uid: payment.uid, subscription_id: sub.id, currency: 'ngn', amount,
    }).catch((err) => console.error('[GooglePlay CreatorSub] community pool error:', err.message));
  }

  if (opsPool > 0) {
    PoolService.creditOperationsPool(opsPool, 'creator_subscription', {
      creator_uid: creatorUid, subscriber_uid: payment.uid, subscription_id: sub.id, currency: 'ngn', amount,
    }).catch((err) => console.error('[GooglePlay CreatorSub] ops pool error:', err.message));
  }

  await Ledger.create({
    uid: payment.uid,
    type: 'SUBSCRIPTION_PAYMENT',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: amount,
    status: 'success',
    reference_id: payment.id,
    meta: { creator_uid: creatorUid, subscription_id: sub.id, method: 'google_play' },
    description: `Creator subscription via Google Play`,
  });

  await CreatorStats.incrementSubscribers(creatorUid);

  try {
    await CreatorDailyStats.incrementSubscription(creatorUid, { ngn: amount, vpt: 0 });
    const activeStream = await StreamStats.getActiveByCreator(creatorUid);
    if (activeStream) await StreamStats.addSubscriber(activeStream.id);
  } catch (e) {
    console.error('[GooglePlay CreatorSub] analytics error:', e.message);
  }

  NotificationService.notifyUser(creatorUid, {
    title: '🎉 New Subscriber!',
    body: `${user.name || user.email || 'A user'} just subscribed to your channel!`,
    type: 'new_subscriber',
    link: '/creator-studio',
    data: { subscriber_uid: payment.uid, subscription_id: sub.id, currency: 'ngn', amount: String(amount) },
  }).catch(() => {});

  NotificationService.notifyUser(payment.uid, {
    title: '✅ Subscription Confirmed!',
    body: `You subscribed via Google Play. ${subscriberVptUnits > 0 ? `You earned ${subscriberVptUnits} vPT!` : ''}`,
    type: 'subscription_activated',
    link: '/my-subscriptions',
    data: { creator_uid: creatorUid, subscription_id: sub.id, amount: String(amount) },
  }).catch(() => {});
}

async function applyChannelSubscriptionGooglePlay(payment, user) {
  const channelId = payment.meta?.channelId;
  if (!channelId) throw new Error('channelId missing from payment meta');

  const channel = await Channel.findById(channelId);
  if (!channel) throw new Error('Channel not found');

  const existing = await ChannelSub.findActive(payment.uid, channelId);
  if (existing) return;

  const amount = payment.amount_ngn;
  const opsPool = Math.floor(amount * 0.50);
  const subscriberVptNgn = Math.floor(amount * 0.15);
  const subscriberVptUnits = parseFloat(
    (subscriberVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
  );
  const referralPool = Math.floor(amount * 0.15);
  const communityPool = amount - opsPool - subscriberVptNgn - referralPool;

  if (subscriberVptUnits > 0) {
    await Ledger.create({
      uid: payment.uid,
      type: 'SUBSCRIBER_VPT_REWARD',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: subscriberVptUnits,
      status: 'pending_distribution',
      meta: {
        channel_id: channelId,
        channel_name: channel.name,
        subscription_amount: amount,
        payment_currency: 'ngn',
        reward_value_ngn: subscriberVptNgn,
        vpt_price: ReferralModel.VPT_PRICE_NGN,
      },
      description: `Subscriber vPT reward — Google Play channel subscription to ${channel.name}`,
    }).catch((err) => console.error('[GooglePlay ChannelSub] ledger credit error:', err.message));
  }

  const msMap = {
    day: 86400000, week: 604800000, month: 2592000000, year: 31536000000,
  };
  const intervalMs = msMap[channel.subscription_interval_unit || 'month'] || msMap.month;
  const nextBilling = Date.now() + intervalMs * (channel.subscription_interval_count || 1);

  const sub = await ChannelSub.create({
    subscriberUid: payment.uid,
    channelId,
    channelName: channel.name,
    ownerId: channel.owner_id,
    plan: 'channel_subscription',
    currency: 'ngn',
    amount,
    vptEquivalent: subscriberVptUnits,
    isPremium: true,
    intervalCount: channel.subscription_interval_count || 1,
    intervalUnit: channel.subscription_interval_unit || 'month',
    nextBilling,
  });

  if (referralPool > 0) {
    distributeReferralEarnings({
      subscriberUid: payment.uid,
      referralPoolAmount: referralPool,
      subscriptionId: sub.id,
      creatorUid: channel.owner_id,
    }).catch((err) => console.error('[GooglePlay ChannelSub] referral error:', err.message));
  }

  if (communityPool > 0) {
    PoolService.creditPool(communityPool, 'channel_subscription', {
      channel_id: channelId, channel_name: channel.name, subscriber_uid: payment.uid, currency: 'ngn', amount,
    }).catch((err) => console.error('[GooglePlay ChannelSub] community pool error:', err.message));
  }

  if (opsPool > 0) {
    PoolService.creditOperationsPool(opsPool, 'channel_subscription', {
      channel_id: channelId, channel_name: channel.name, subscriber_uid: payment.uid, currency: 'ngn', amount,
    }).catch((err) => console.error('[GooglePlay ChannelSub] ops pool error:', err.message));
  }

  await Ledger.create({
    uid: payment.uid,
    type: 'SUBSCRIPTION_PAYMENT',
    direction: 'debit',
    currency: 'ngn',
    amount_ngn: amount,
    status: 'success',
    reference_id: payment.id,
    meta: { channel_id: channelId, channel_name: channel.name, subscription_id: sub.id, method: 'google_play' },
    description: `Channel subscription via Google Play — ${channel.name}`,
  }).catch((err) => console.error('[GooglePlay ChannelSub] ledger debit error:', err.message));

  try { await ChannelStats.incrementSubscribers(channelId); } catch (e) { console.error('[GooglePlay ChannelSub] stats error:', e.message); }

  try {
    await CreatorDailyStats.incrementSubscription(channel.owner_id, { ngn: amount, vpt: 0 });
    const activeStream = await StreamStats.getActiveByCreator(channel.owner_id);
    if (activeStream) await StreamStats.addSubscriber(activeStream.id);
  } catch (e) {
    console.error('[GooglePlay ChannelSub] analytics error:', e.message);
  }

  NotificationService.notifyUser(channel.owner_id, {
    title: '🎉 New Channel Subscriber!',
    body: `${user.name || user.email || 'A user'} just subscribed to ${channel.name || 'your channel'}!`,
    type: 'new_channel_subscriber',
    link: `/channel/${channelId}`,
    data: { subscriber_uid: payment.uid, subscription_id: sub.id, channel_id: channelId },
  }).catch(() => {});

  NotificationService.notifyUser(payment.uid, {
    title: '✅ Subscription Confirmed!',
    body: `You subscribed to ${channel.name || 'a channel'} via Google Play. You earned ${subscriberVptUnits} vPT!`,
    type: 'channel_subscription_activated',
    link: '/my-subscriptions',
    data: { channel_id: channelId, channel_name: channel.name, subscription_id: sub.id, is_premium: true, amount: String(amount) },
  }).catch(() => {});
}

module.exports = {
  verifyGooglePlayPurchase,
};
