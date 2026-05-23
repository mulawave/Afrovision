const ChannelSub = require('./channel_subscription.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const Channel = require('../channels/channel.model');
const ChannelStats = require('../channels/channel_stats.model');
const AuditService = require('../admin/audit.service');
const ReferralModel = require('../referrals/referral.model');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const NotificationService = require('../notifications/notification.service');
const PoolService = require('../vpt/pool.service');

/**
 * POST /subscriptions/channel/subscribe
 */
async function subscribe(req, res) {
  try {
    const subscriberUid = req.userId;
    const { channelId } = req.body;

    if (!channelId) return res.status(400).json({ error: 'channelId is required' });

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!channel.is_active) return res.status(400).json({ error: 'Channel is not active' });

    const subscriber = await User.findById(subscriberUid);
    if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });

    if (channel.owner_id === subscriberUid) {
      return res.status(400).json({ error: 'Cannot subscribe to your own channel' });
    }

    const existing = await ChannelSub.findActive(subscriberUid, channelId);
    if (existing) {
      return res.status(409).json({
        error: 'Already subscribed to this channel',
        subscription: existing,
      });
    }

    const isPremium = !!channel.is_premium_channel && (channel.subscription_price_ngn || 0) > 0;
    let amount = 0;
    let currency = null;
    let vptEquivalent = 0;
    let nextBilling = null;

    if (isPremium) {
      amount = Number(channel.subscription_price_ngn) || 0;
      currency = 'ngn';

      // Compute vPT equivalent
      vptEquivalent = parseFloat(
        (amount / ReferralModel.VPT_PRICE_NGN).toFixed(4),
      );

      const wallet = await GiftWallet.ensureWallet(subscriberUid);
      if (wallet.ngn_balance < amount) {
        return res.status(402).json({
          error: 'INSUFFICIENT_NGN',
          required: amount,
          available: wallet.ngn_balance,
        });
      }

      // Deduct full amount from subscriber
      await GiftWallet.adjustNgnBalance(subscriberUid, -amount);

      // ── Payout Split ──
      const opsPool = Math.floor(amount * 0.50);
      const subscriberVptNgn = Math.floor(amount * 0.15);
      const subscriberVptUnits = parseFloat(
        (subscriberVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
      );
      const referralPool = Math.floor(amount * 0.15);
      const communityPool = amount - opsPool - subscriberVptNgn - referralPool;

      // Credit subscriber vPT reward
      if (subscriberVptUnits > 0) {
        await Ledger.create({
          uid: subscriberUid,
          type: 'SUBSCRIBER_VPT_REWARD',
          direction: 'credit',
          currency: 'vpt',
          amount_vpt_units: subscriberVptUnits,
          status: 'pending_distribution',
          meta: {
            channel_id: channelId,
            channel_name: channel.name,
            subscription_amount: amount,
            payment_currency: currency,
            reward_value_ngn: subscriberVptNgn,
            vpt_price: ReferralModel.VPT_PRICE_NGN,
          },
          description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — subscription to ${channel.name || channelId.slice(0, 8)}`,
        });
      }

      // Distribute referral rewards (async, non-blocking)
      if (referralPool > 0) {
        distributeReferralEarnings({
          subscriberUid,
          referralPoolAmount: referralPool,
          subscriptionId: null, // will be set after sub creation
          creatorUid: channel.owner_id,
        }).catch((err) => console.error('[ChannelSub] referral distribution error:', err.message));
      }

      // Credit community pool
      if (communityPool > 0) {
        PoolService.creditPool(communityPool, 'channel_subscription', {
          channel_id: channelId,
          channel_name: channel.name,
          subscriber_uid: subscriberUid,
          currency,
          amount,
        }).catch((err) => console.error('[ChannelSub] community pool credit error:', err.message));
      }

      // Credit operations pool
      if (opsPool > 0) {
        PoolService.creditOperationsPool(opsPool, 'channel_subscription', {
          channel_id: channelId,
          channel_name: channel.name,
          subscriber_uid: subscriberUid,
          currency,
          amount,
        }).catch((err) => console.error('[ChannelSub] operations pool credit error:', err.message));
      }

      // Compute next billing
      const msMap = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      const intervalMs = msMap[channel.subscription_interval_unit || 'month'] || msMap.month;
      nextBilling = Date.now() + intervalMs * (channel.subscription_interval_count || 1);
    }

    const sub = await ChannelSub.create({
      subscriberUid,
      channelId,
      channelName: channel.name,
      ownerId: channel.owner_id,
      plan: 'channel_subscription',
      currency,
      amount,
      vptEquivalent,
      isPremium,
      intervalCount: channel.subscription_interval_count || 1,
      intervalUnit: channel.subscription_interval_unit || 'month',
      nextBilling,
    });

    // If premium, fix subscriptionId in referral distribution meta
    if (isPremium && amount > 0) {
      // The referral distribution was already triggered above; ledger meta will have channel info instead
    }

    // Update social proof counter (non-blocking — don't fail the whole request)
    try {
      await ChannelStats.incrementSubscribers(channelId);
    } catch (statsErr) {
      console.error('[ChannelSub] incrementSubscribers error:', statsErr.message);
    }

    // Update analytics (only for premium subscriptions)
    if (isPremium && amount > 0) {
      try {
        await CreatorDailyStats.incrementSubscription(channel.owner_id, {
          ngn: currency === 'ngn' ? amount : 0,
          vpt: currency === 'vpt' ? amount : 0,
        });
        const activeStream = await StreamStats.getActiveByCreator(channel.owner_id);
        if (activeStream) {
          await StreamStats.addSubscriber(activeStream.id);
        }
      } catch (analyticsError) {
        console.error('[ChannelSub] analytics update error:', analyticsError.message);
      }
    }

    // Audit log
    AuditService.logAction(
      subscriberUid,
      'CHANNEL_SUBSCRIPTION_CREATED',
      sub.id,
      { channel_id: channelId, plan: 'channel_subscription' },
    ).catch(() => {});

    res.status(201).json({ subscription: sub });

    // ── Notifications (fire-and-forget, never crash the response) ──
    try {
      const subscriberName = subscriber.name || subscriber.email || 'A user';

      NotificationService.notifyUser(channel.owner_id, {
        title: '🎉 New Channel Subscriber!',
        body: `${subscriberName} just subscribed to ${channel.name || 'your channel'}!`,
        type: 'new_channel_subscriber',
        link: `/channel/${channelId}`,
        data: {
          subscriber_uid: subscriberUid,
          subscription_id: sub.id,
          channel_id: channelId,
        },
      }).catch((err) => console.error('[ChannelSub] owner notification error:', err.message));

      const subscriberBody = isPremium && amount > 0
        ? `You subscribed to ${channel.name || 'a channel'}. You earned ${sub.vpt_equivalent || 0} vPT!`
        : `You subscribed to ${channel.name || 'a channel'}`;

      NotificationService.notifyUser(subscriberUid, {
        title: '✅ Subscription Confirmed!',
        body: subscriberBody,
        type: 'channel_subscription_activated',
        link: '/my-subscriptions',
        data: {
          channel_id: channelId,
          channel_name: channel.name,
          subscription_id: sub.id,
          is_premium: isPremium,
          amount: String(amount),
          vpt_reward: String(sub.vpt_equivalent || 0),
        },
      }).catch((err) => console.error('[ChannelSub] subscriber notification error:', err.message));
    } catch (notifyErr) {
      console.error('[ChannelSub] notification block error:', notifyErr.message);
    }
  } catch (err) {
    console.error('[ChannelSub] subscribe error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * DELETE /subscriptions/channel/:id/cancel
 */
async function cancel(req, res) {
  try {
    const { id } = req.params;
    const subscriberUid = req.userId;

    const subscriberSubscriptions = await ChannelSub.getBySubscriber(subscriberUid);
    const sub = subscriberSubscriptions.find((s) => s.id === id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    await ChannelSub.markCancelled(id, 'user_cancelled');

    // Decrement counter
    if (sub.channel_id) {
      await ChannelStats.decrementSubscribers(sub.channel_id);
    }

    AuditService.logAction(
      subscriberUid,
      'CHANNEL_SUBSCRIPTION_CANCELLED',
      id,
      { channel_id: sub.channel_id },
    ).catch(() => {});

    res.json({ subscription: { ...sub, status: 'cancelled' } });
  } catch (err) {
    console.error('[ChannelSub] cancel error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /subscriptions/channel/mine
 */
async function getMine(req, res) {
  try {
    const subscriptions = await ChannelSub.getBySubscriber(req.userId);
    const enriched = await Promise.all(subscriptions.map(async (s) => {
      const ch = Channel.findCachedById(s.channel_id) || await Channel.findById(s.channel_id);
      return {
        ...s,
        channel_logo_url: ch?.logo_url || null,
        channel_banner_url: ch?.banner_url || null,
        channel_category: ch?.category || null,
        channel_description: ch?.description || null,
      };
    }));
    res.json({ subscriptions: enriched });
  } catch (err) {
    console.error('[ChannelSub] getMine:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /subscriptions/channel/check/:channelId
 */
async function check(req, res) {
  try {
    const { channelId } = req.params;
    const subscription = await ChannelSub.findActive(req.userId, channelId);
    res.json({
      subscribed: !!subscription,
      subscription: subscription || null,
    });
  } catch (err) {
    console.error('[ChannelSub] check:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /subscriptions/channel/subscribers/:channelId
 */
async function getSubscribers(req, res) {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Only owner or admin can view subscribers
    if (req.userId !== channel.owner_id && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const subscribers = await ChannelSub.getByChannel(channelId);
    res.json({ subscribers });
  } catch (err) {
    console.error('[ChannelSub] getSubscribers:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  subscribe,
  cancel,
  getMine,
  check,
  getSubscribers,
};
