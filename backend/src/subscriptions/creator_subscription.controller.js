const CreatorSub = require('./creator_subscription.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const CreatorStats = require('../channels/creator_stats.model');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const { serializeCreatorSubscriptionForAdmin } = require('../admin/admin.presenter');

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
    let creatorShareNgn = 0;
    let creatorShareVpt = 0;

    const wallet = await GiftWallet.ensureWallet(subscriberUid);

    if (selectedCurrency === 'vpt') {
      if (wallet.vpt_units < amount) {
        return res.status(402).json({
          error: 'INSUFFICIENT_VPT',
          required: amount,
          available: wallet.vpt_units,
        });
      }
      // Creator gets 70 %, community/ops 30 %
      const creatorShare = Math.floor(amount * 0.7);
      creatorShareVpt = creatorShare;
      const communityPool = amount - creatorShare;
      await GiftWallet.adjustVptUnits(subscriberUid, -amount);
      await GiftWallet.adjustVptUnits(creatorUid, creatorShare);

      // Distribute referral earnings from community pool (async, non-blocking)
      distributeReferralEarnings({
        subscriberUid,
        communityPoolAmount: communityPool,
        currency: 'vpt',
        subscriptionId: null, // Will be set after sub creation
        creatorUid,
      }).catch((err) => console.error('[CreatorSub] referral distribution error:', err.message));
    } else {
      if (wallet.ngn_balance < amount) {
        return res.status(402).json({
          error: 'INSUFFICIENT_NGN',
          required: amount,
          available: wallet.ngn_balance,
        });
      }
      const creatorShare = Math.floor(amount * 0.7);
      creatorShareNgn = creatorShare;
      const communityPool = amount - creatorShare;
      await GiftWallet.adjustNgnBalance(subscriberUid, -amount);
      await GiftWallet.adjustNgnBalance(creatorUid, creatorShare);

      // Distribute referral earnings from community pool (async, non-blocking)
      distributeReferralEarnings({
        subscriberUid,
        communityPoolAmount: communityPool,
        currency: 'ngn',
        subscriptionId: null,
        creatorUid,
      }).catch((err) => console.error('[CreatorSub] referral distribution error:', err.message));
    }

    const sub = await CreatorSub.create({
      subscriberUid,
      creatorUid,
      plan: 'monthly',
      currency: selectedCurrency,
      amount,
    });

    await Ledger.create({
      uid: subscriberUid,
      type: 'SUBSCRIPTION_PAYMENT',
      direction: 'debit',
      currency: selectedCurrency,
      amount_ngn: selectedCurrency === 'ngn' ? amount : 0,
      amount_vpt_units: selectedCurrency === 'vpt' ? amount : 0,
      status: 'success',
      meta: { creator_uid: creatorUid, creator_name: creator.name, subscription_id: sub.id },
      description: `Creator subscription — ${creator.name}`,
    });

    // Update social proof counter
    await CreatorStats.incrementSubscribers(creatorUid);

    try {
      await CreatorDailyStats.incrementSubscription(creatorUid, {
        ngn: creatorShareNgn,
        vpt: creatorShareVpt,
      });
      const activeStream = StreamStats.getActiveByCreator(creatorUid);
      if (activeStream) {
        await StreamStats.addSubscriber(activeStream.id);
      }
    } catch (analyticsError) {
      console.error('[CreatorSub] analytics update error:', analyticsError.message);
    }

    res.status(201).json({ subscription: sub });
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
