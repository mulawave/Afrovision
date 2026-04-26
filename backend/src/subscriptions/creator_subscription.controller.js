const CreatorSub = require('./creator_subscription.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const CreatorStats = require('../channels/creator_stats.model');
const ReferralModel = require('../referrals/referral.model');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const { serializeCreatorSubscriptionForAdmin } = require('../admin/admin.presenter');
const NotificationService = require('../notifications/notification.service');
const PoolService = require('../vpt/pool.service');

// Default creator subscription prices (configurable per-creator in future)
const DEFAULT_NGN_PRICE = 2000; // ₦2,000 / month
const DEFAULT_VPT_PRICE = 500; // 500 vPT units / month

/**
 * POST /subscriptions/creator/subscribe
 * Subscribe to a creator. Charges the subscriber's gift wallet immediately.
 */
async function subscribe(req, res) {
  try {
    const subscriberUid = req.userId;
    const { creatorUid, currency } = req.body;

    if (!creatorUid) return res.status(400).json({ error: 'creatorUid is required' });

    const creator = User.findById(creatorUid);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });
    if (creator.role !== 'creator' && creator.role !== 'admin') {
      return res.status(400).json({ error: 'User is not a creator' });
    }
    if (subscriberUid === creatorUid) {
      return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    }

    // Prevent duplicate active subscriptions
    const existing = CreatorSub.findActive(subscriberUid, creatorUid);
    if (existing) {
      return res.status(409).json({
        error: 'Already subscribed to this creator',
        subscription: existing,
      });
    }

    const selectedCurrency = currency === 'vpt' ? 'vpt' : 'ngn';
    const amount = selectedCurrency === 'vpt' ? DEFAULT_VPT_PRICE : DEFAULT_NGN_PRICE;

    const wallet = await GiftWallet.ensureWallet(subscriberUid);

    if (selectedCurrency === 'vpt') {
      if (wallet.vpt_units < amount) {
        return res.status(402).json({
          error: 'INSUFFICIENT_VPT',
          required: amount,
          available: wallet.vpt_units,
        });
      }
      // Deduct full amount from subscriber
      await GiftWallet.adjustVptUnits(subscriberUid, -amount);
    } else {
      if (wallet.ngn_balance < amount) {
        return res.status(402).json({
          error: 'INSUFFICIENT_NGN',
          required: amount,
          available: wallet.ngn_balance,
        });
      }
      // Deduct full amount from subscriber
      await GiftWallet.adjustNgnBalance(subscriberUid, -amount);
    }

    // ── Payout Split (applies identically to NGN and vPT subscriptions) ──
    // 50% → Operations pool (platform keeps — no transfer needed)
    // 15% → Subscriber vPT reward (always credited as vPT)
    // 15% → 5-level referral reward (50% cash / 50% vPT per level)
    // 20% → Community pool (retained by platform for future use)
    const opsPool = Math.floor(amount * 0.50);
    const subscriberVptNgn = Math.floor(amount * 0.15);
    const subscriberVptUnits = parseFloat(
      (subscriberVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
    );
    const referralPool = Math.floor(amount * 0.15);
    const communityPool = amount - opsPool - subscriberVptNgn - referralPool; // remainder ≈ 20%

    // Credit subscriber vPT reward (always as vPT units regardless of payment currency)
    if (subscriberVptUnits > 0) {
      await Ledger.create({
        uid: subscriberUid,
        type: 'SUBSCRIBER_VPT_REWARD',
        direction: 'credit',
        currency: 'vpt',
        amount_vpt_units: subscriberVptUnits,
        status: 'pending_distribution',
        meta: {
          creator_uid: creatorUid,
          subscription_amount: amount,
          payment_currency: selectedCurrency,
          reward_value_ngn: subscriberVptNgn,
          vpt_price: ReferralModel.VPT_PRICE_NGN,
        },
        description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — subscription to ${creator.name || creatorUid.slice(0, 8)}`,
      });
    }

    const sub = await CreatorSub.create({
      subscriberUid,
      creatorUid,
      plan: 'monthly',
      currency: selectedCurrency,
      amount,
    });

    // Distribute 5-level referral rewards from the 15% referral pool (async, non-blocking)
    if (referralPool > 0) {
      distributeReferralEarnings({
        subscriberUid,
        referralPoolAmount: referralPool,
        subscriptionId: sub.id,
        creatorUid,
      }).catch((err) => console.error('[CreatorSub] referral distribution error:', err.message));
    }

    // Credit community pool (20%)
    if (communityPool > 0) {
      PoolService.creditPool(communityPool, 'creator_subscription', {
        creator_uid: creatorUid,
        subscriber_uid: subscriberUid,
        subscription_id: sub.id,
        currency: selectedCurrency,
        amount,
      }).catch((err) => console.error('[CreatorSub] community pool credit error:', err.message));
    }

    // Credit operations pool (50%)
    if (opsPool > 0) {
      PoolService.creditOperationsPool(opsPool, 'creator_subscription', {
        creator_uid: creatorUid,
        subscriber_uid: subscriberUid,
        subscription_id: sub.id,
        currency: selectedCurrency,
        amount,
      }).catch((err) => console.error('[CreatorSub] operations pool credit error:', err.message));
    }

    await Ledger.create({
      uid: subscriberUid,
      type: 'SUBSCRIPTION_PAYMENT',
      direction: 'debit',
      currency: selectedCurrency,
      amount_ngn: selectedCurrency === 'ngn' ? amount : 0,
      amount_vpt_units: selectedCurrency === 'vpt' ? amount : 0,
      status: 'success',
      meta: {
        creator_uid: creatorUid,
        creator_name: creator.name,
        subscription_id: sub.id,
        split: { ops_pool: opsPool, subscriber_vpt_ngn: subscriberVptNgn, subscriber_vpt_units: subscriberVptUnits, referral_pool: referralPool, community_pool: communityPool },
      },
      description: `Creator subscription — ${creator.name}`,
    });

    // Update social proof counter
    await CreatorStats.incrementSubscribers(creatorUid);

    try {
      await CreatorDailyStats.incrementSubscription(creatorUid, {
        ngn: selectedCurrency === 'ngn' ? amount : 0,
        vpt: selectedCurrency === 'vpt' ? amount : 0,
      });
      const activeStream = StreamStats.getActiveByCreator(creatorUid);
      if (activeStream) {
        await StreamStats.addSubscriber(activeStream.id);
      }
    } catch (analyticsError) {
      console.error('[CreatorSub] analytics update error:', analyticsError.message);
    }

    res.status(201).json({ subscription: sub });

    // Notify creator about new subscriber (non-blocking)
    const subscriber = User.findById(subscriberUid);
    const subscriberName = subscriber ? (subscriber.name || subscriber.email || 'A user') : 'A user';
    NotificationService.notifyUser(creatorUid, {
      title: '🎉 New Subscriber!',
      body: `${subscriberName} just subscribed to your channel!`,
      type: 'new_subscriber',
      link: '/dashboard',
      data: {
        subscriber_uid: subscriberUid,
        subscription_id: sub.id,
        currency: selectedCurrency,
        amount: String(amount),
      },
    }).catch((err) => console.error('[CreatorSub] creator notification error:', err.message));

    // Notify subscriber about subscription confirmation
    NotificationService.notifyUser(subscriberUid, {
      title: '✅ Subscription Confirmed!',
      body: `You subscribed to ${creator.name || 'a creator'}. ${subscriberVptUnits > 0 ? `You earned ${subscriberVptUnits} vPT!` : ''}`,
      type: 'subscription_activated',
      link: '/subscriptions',
      data: {
        creator_uid: creatorUid,
        subscription_id: sub.id,
        currency: selectedCurrency,
        amount: String(amount),
        vpt_reward: String(subscriberVptUnits),
      },
    }).catch((err) => console.error('[CreatorSub] subscriber notification error:', err.message));
  } catch (err) {
    console.error('[CreatorSub] subscribe:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /subscriptions/creator/:id/cancel
 * Cancel a subscription. Subscriber or admin only.
 */
async function cancelSubscription(req, res) {
  try {
    const sub = CreatorSub.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const caller = User.findById(req.userId);
    const isOwner = sub.subscriber_uid === req.userId;
    const isAdmin = caller && caller.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const cancelled = await CreatorSub.cancel(sub.id);
    // Decrement social proof counter (best-effort)
    CreatorStats.decrementSubscribers(sub.creator_uid).catch(() => {});
    if (isAdmin) {
      await AuditService.logAction(req.userId, 'cancel_creator_subscription', sub.id, {
        subscriber_uid: sub.subscriber_uid,
        creator_uid: sub.creator_uid,
      });
    }
    res.json({ subscription: cancelled });
  } catch (err) {
    console.error('[CreatorSub] cancel:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /subscriptions/creator/mine
 * All subscriptions (active + cancelled) for the current user as subscriber.
 */
async function getMySubscriptions(req, res) {
  try {
    const subs = CreatorSub.getBySubscriber(req.userId);
    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('[CreatorSub] getMySubscriptions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /subscriptions/creator/subscribers
 * All active subscribers for the current creator.
 */
async function getCreatorSubscribers(req, res) {
  try {
    const subs = CreatorSub.getByCreator(req.userId);
    res.json({ subscriptions: subs, count: subs.length });
  } catch (err) {
    console.error('[CreatorSub] getCreatorSubscribers:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /subscriptions/creator/check/:creatorUid
 * Check if the current user is actively subscribed to a given creator.
 */
async function checkSubscription(req, res) {
  try {
    const sub = CreatorSub.findActive(req.userId, req.params.creatorUid);
    res.json({ subscribed: !!sub, subscription: sub || null });
  } catch (err) {
    console.error('[CreatorSub] checkSubscription:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /admin/creator-subscriptions
 * List all creator subscriptions with optional status filter.
 */
async function adminListSubscriptions(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let all = CreatorSub.getAll();
    if (req.query.status) {
      all = all.filter((s) => s.status === req.query.status);
    }
    if (req.query.creator_uid) {
      all = all.filter((s) => s.creator_uid === req.query.creator_uid);
    }
    res.json({
      subscriptions: all.map((subscription) => serializeCreatorSubscriptionForAdmin(subscription)),
      stats: CreatorSub.getStats(),
    });
  } catch (err) {
    console.error('[CreatorSub] adminListSubscriptions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /admin/creator-subscriptions/:id/cancel
 * Admin force-cancel any creator subscription.
 */
async function adminCancelSubscription(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const sub = CreatorSub.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const cancelled = await CreatorSub.cancel(sub.id);
    CreatorStats.decrementSubscribers(sub.creator_uid).catch(() => {});
    await AuditService.logAction(caller.id, 'admin_cancel_creator_subscription', sub.id, {
      subscriber_uid: sub.subscriber_uid,
      creator_uid: sub.creator_uid,
    });
    res.json({ subscription: serializeCreatorSubscriptionForAdmin(cancelled) });
  } catch (err) {
    console.error('[CreatorSub] adminCancelSubscription:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  subscribe,
  cancelSubscription,
  getMySubscriptions,
  getCreatorSubscribers,
  checkSubscription,
  adminListSubscriptions,
  adminCancelSubscription,
};
