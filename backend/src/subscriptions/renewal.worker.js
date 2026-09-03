/**
 * Renewal Worker — processes due creator subscriptions every hour.
 *
 * On each tick:
 * - Find all active subscriptions where next_billing <= now
 * - Attempt to charge the subscriber's gift wallet
 * - On success: advance next_billing by 30 days + log ledger SUBSCRIPTION_RENEWAL
 * - On insufficient funds: cancel the subscription + log reason
 */

const CreatorSub = require('./creator_subscription.model');
const ChannelSub = require('./channel_subscription.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const Channel = require('../channels/channel.model');
const ReferralModel = require('../referrals/referral.model');
const { distributeReferralEarnings } = require('../referrals/referral.controller');
const PoolService = require('../vpt/pool.service');
const { getFirestore } = require('../utils/firestore');
const { chargeWallet } = require('./wallet_payment.helper');

const RENEWAL_LOCK_COLLECTION = 'ops_locks';
const RENEWAL_LOCK_DOC = 'subscription_renewals';
const RENEWAL_LOCK_TTL_MS = 55 * 60 * 1000;

let activeRunPromise = null;

function createSummary(trigger) {
  return {
    trigger,
    started_at: Date.now(),
    creator_due: 0,
    channel_due: 0,
    creator_renewed: 0,
    channel_renewed: 0,
    creator_cancelled: 0,
    channel_cancelled: 0,
    creator_errors: 0,
    channel_errors: 0,
  };
}

async function acquireRenewalLease({ holder, trigger, force = false }) {
  const db = getFirestore();
  const leaseRef = db.collection(RENEWAL_LOCK_COLLECTION).doc(RENEWAL_LOCK_DOC);
  const now = Date.now();
  let acquired = false;
  let currentLease = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(leaseRef);
    const lease = snapshot.exists ? snapshot.data() : null;
    const activeLease = lease
      && lease.status === 'running'
      && typeof lease.expires_at === 'number'
      && lease.expires_at > now;

    if (activeLease && !force) {
      currentLease = lease;
      return;
    }

    const nextLease = {
      status: 'running',
      trigger,
      holder,
      started_at: now,
      updated_at: now,
      expires_at: now + RENEWAL_LOCK_TTL_MS,
    };

    tx.set(leaseRef, nextLease, { merge: true });
    acquired = true;
    currentLease = nextLease;
  });

  return { acquired, lease: currentLease };
}

async function releaseRenewalLease({ holder, summary, status, errorMessage = null }) {
  const db = getFirestore();
  const leaseRef = db.collection(RENEWAL_LOCK_COLLECTION).doc(RENEWAL_LOCK_DOC);
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

async function processRenewals() {
  const summary = createSummary('direct');
  const due = await CreatorSub.getActiveDue();
  const channelDue = await ChannelSub.getActiveDue();

  summary.creator_due = due.length;
  summary.channel_due = channelDue.length;

  if (!due.length && !channelDue.length) {
    summary.finished_at = Date.now();
    return summary;
  }

  if (due.length) {
    console.log(`[RenewalWorker] Processing ${due.length} due creator subscription(s)`);
  }
  if (channelDue.length) {
    console.log(`[RenewalWorker] Processing ${channelDue.length} due channel subscription(s)`);
  }

  for (const sub of due) {
    try {
      const amount = sub.amount || 0;

      // Try mixed wallet payment (cash first, vPT for remainder)
      try {
        await chargeWallet(sub.subscriber_uid, amount, {
          type: 'SUBSCRIPTION_RENEWAL',
          description: `Creator subscription renewal — ${sub.creator_uid}`,
          meta: {
            creator_uid: sub.creator_uid,
            subscription_id: sub.id,
            renewal: true,
            renewal_count: sub.renewal_count,
          },
        });
      } catch (chargeErr) {
        if (chargeErr.code === 'INSUFFICIENT_FUNDS') {
          await CreatorSub.markCancelledOnFailure(sub.id, 'insufficient_wallet');
          summary.creator_cancelled += 1;
          console.log(`[RenewalWorker] Cancelled ${sub.id} — insufficient wallet balance`);
          continue;
        }
        throw chargeErr;
      }

      // Correct payout split: 50% ops, 15% subscriber vPT, 15% referral, 20% community
      const opsPool = Math.floor(amount * 0.50);
      const subscriberVptNgn = Math.floor(amount * 0.15);
      const subscriberVptUnits = parseFloat(
        (subscriberVptNgn / ReferralModel.VPT_PRICE_NGN).toFixed(4),
      );
      const referralPool = Math.floor(amount * 0.15);
      const communityPool = amount - opsPool - subscriberVptNgn - referralPool; // remainder ≈ 20%

      // Credit subscriber vPT reward
      if (subscriberVptUnits > 0) {
        await Ledger.create({
          uid: sub.subscriber_uid,
          type: 'SUBSCRIBER_VPT_REWARD',
          direction: 'credit',
          currency: 'vpt',
          amount_vpt_units: subscriberVptUnits,
          status: 'pending_distribution',
          meta: {
            creator_uid: sub.creator_uid,
            subscription_id: sub.id,
            renewal: true,
            reward_value_ngn: subscriberVptNgn,
            vpt_price: ReferralModel.VPT_PRICE_NGN,
          },
          description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — renewal`,
        });
      }

      // Distribute referral rewards (async, non-blocking)
      if (referralPool > 0) {
        distributeReferralEarnings({
          subscriberUid: sub.subscriber_uid,
          referralPoolAmount: referralPool,
          subscriptionId: sub.id,
          creatorUid: sub.creator_uid,
        }).catch((err) => console.error('[RenewalWorker] referral distribution error:', err.message));
      }

      // Credit community pool (20%)
      if (communityPool > 0) {
        PoolService.creditPool(communityPool, 'creator_subscription_renewal', {
          creator_uid: sub.creator_uid,
          subscriber_uid: sub.subscriber_uid,
          subscription_id: sub.id,
          currency: sub.currency,
          amount,
          renewal_count: sub.renewal_count,
        }).catch((err) => console.error('[RenewalWorker] community pool credit error:', err.message));
      }

      // Credit operations pool (50%)
      if (opsPool > 0) {
        PoolService.creditOperationsPool(opsPool, 'creator_subscription_renewal', {
          creator_uid: sub.creator_uid,
          subscriber_uid: sub.subscriber_uid,
          subscription_id: sub.id,
          currency: sub.currency,
          amount,
          renewal_count: sub.renewal_count,
        }).catch((err) => console.error('[RenewalWorker] operations pool credit error:', err.message));
      }

      await CreatorSub.markRenewed(sub.id);

      const creator = await User.findById(sub.creator_uid);
      // chargeWallet already recorded the debit ledger entries.
      // Record a summary SUBSCRIPTION_RENEWAL entry for tracking.
      await Ledger.create({
        uid: sub.subscriber_uid,
        type: 'SUBSCRIPTION_RENEWAL',
        direction: 'debit',
        currency: 'ngn',
        amount_ngn: amount,
        amount_vpt_units: 0,
        status: 'success',
        meta: {
          creator_uid: sub.creator_uid,
          creator_name: creator ? creator.name : sub.creator_uid,
          subscription_id: sub.id,
          renewal_count: sub.renewal_count,
          payment_method: 'wallet',
        },
        description: `Creator subscription renewal — ${creator ? creator.name : sub.creator_uid}`,
      });

      console.log(`[RenewalWorker] Renewed ${sub.id} (renewal #${(sub.renewal_count || 0) + 1})`);
      summary.creator_renewed += 1;
    } catch (err) {
      summary.creator_errors += 1;
      console.error(`[RenewalWorker] Error renewing ${sub.id}:`, err.message);
    }
  }

  for (const sub of channelDue) {
    try {
      // Skip free or mis-configured channel subscriptions
      if (!sub.is_premium || sub.amount === 0 || !sub.currency) {
        await ChannelSub.markRenewed(sub.id);
        continue;
      }

      const amount = sub.amount || 0;

      // Try mixed wallet payment (cash first, vPT for remainder)
      try {
        await chargeWallet(sub.subscriber_uid, amount, {
          type: 'CHANNEL_SUBSCRIPTION_RENEWAL',
          description: `Channel subscription renewal — ${sub.channel_name || sub.channel_id}`,
          meta: {
            channel_id: sub.channel_id,
            channel_name: sub.channel_name,
            subscription_id: sub.id,
            renewal: true,
            renewal_count: sub.renewal_count,
          },
        });
      } catch (chargeErr) {
        if (chargeErr.code === 'INSUFFICIENT_FUNDS') {
          await ChannelSub.markCancelledOnFailure(sub.id, 'insufficient_wallet');
          summary.channel_cancelled += 1;
          console.log(`[RenewalWorker] Cancelled channel sub ${sub.id} — insufficient wallet balance`);
          continue;
        }
        throw chargeErr;
      }

      // Correct payout split: 50% ops, 15% subscriber vPT, 15% referral, 20% community
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
          uid: sub.subscriber_uid,
          type: 'SUBSCRIBER_VPT_REWARD',
          direction: 'credit',
          currency: 'vpt',
          amount_vpt_units: subscriberVptUnits,
          status: 'pending_distribution',
          meta: {
            channel_id: sub.channel_id,
            channel_name: sub.channel_name,
            subscription_id: sub.id,
            renewal: true,
            reward_value_ngn: subscriberVptNgn,
            vpt_price: ReferralModel.VPT_PRICE_NGN,
          },
          description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — channel subscription renewal`,
        });
      }

      // Distribute referral rewards (async, non-blocking)
      if (referralPool > 0) {
        distributeReferralEarnings({
          subscriberUid: sub.subscriber_uid,
          referralPoolAmount: referralPool,
          subscriptionId: sub.id,
          creatorUid: sub.owner_id,
        }).catch((err) => console.error('[RenewalWorker] channel referral distribution error:', err.message));
      }

      // Credit community pool (20%)
      if (communityPool > 0) {
        PoolService.creditPool(communityPool, 'channel_subscription_renewal', {
          channel_id: sub.channel_id,
          channel_name: sub.channel_name,
          subscriber_uid: sub.subscriber_uid,
          subscription_id: sub.id,
          currency: sub.currency,
          amount,
          renewal_count: sub.renewal_count,
        }).catch((err) => console.error('[RenewalWorker] channel community pool credit error:', err.message));
      }

      // Credit operations pool (50%)
      if (opsPool > 0) {
        PoolService.creditOperationsPool(opsPool, 'channel_subscription_renewal', {
          channel_id: sub.channel_id,
          channel_name: sub.channel_name,
          subscriber_uid: sub.subscriber_uid,
          subscription_id: sub.id,
          currency: sub.currency,
          amount,
          renewal_count: sub.renewal_count,
        }).catch((err) => console.error('[RenewalWorker] channel operations pool credit error:', err.message));
      }

      await ChannelSub.markRenewed(sub.id);

      const channel = await Channel.findById(sub.channel_id);
      // chargeWallet already recorded the debit ledger entries.
      // Record a summary CHANNEL_SUBSCRIPTION_RENEWAL entry for tracking.
      await Ledger.create({
        uid: sub.subscriber_uid,
        type: 'CHANNEL_SUBSCRIPTION_RENEWAL',
        direction: 'debit',
        currency: 'ngn',
        amount_ngn: amount,
        amount_vpt_units: 0,
        status: 'success',
        meta: {
          channel_id: sub.channel_id,
          channel_name: channel ? channel.name : sub.channel_name,
          subscription_id: sub.id,
          renewal_count: sub.renewal_count,
          payment_method: 'wallet',
        },
        description: `Channel subscription renewal — ${channel ? channel.name : sub.channel_name || sub.channel_id}`,
      });

      console.log(`[RenewalWorker] Renewed channel sub ${sub.id} (renewal #${(sub.renewal_count || 0) + 1})`);
      summary.channel_renewed += 1;
    } catch (err) {
      summary.channel_errors += 1;
      console.error(`[RenewalWorker] Error renewing channel sub ${sub.id}:`, err.message);
    }
  }

  summary.finished_at = Date.now();
  return summary;
}

function start() {
  console.log('[RenewalWorker] In-process scheduler disabled; use an external trigger for renewal runs');
}

async function runScheduledRenewals({ trigger = 'manual', force = false } = {}) {
  if (activeRunPromise) {
    return activeRunPromise;
  }

  const holder = `${trigger}:${process.pid}:${Date.now()}`;

  activeRunPromise = (async () => {
    const { acquired, lease } = await acquireRenewalLease({ holder, trigger, force });
    if (!acquired) {
      return {
        skipped: true,
        reason: 'lease-held',
        lease,
      };
    }

    try {
      const summary = await processRenewals();
      summary.trigger = trigger;
      await releaseRenewalLease({ holder, summary, status: 'idle' });
      return {
        skipped: false,
        summary,
      };
    } catch (error) {
      await releaseRenewalLease({
        holder,
        summary: null,
        status: 'failed',
        errorMessage: error.message,
      });
      throw error;
    }
  })();

  try {
    return await activeRunPromise;
  } finally {
    activeRunPromise = null;
  }
}

module.exports = { start, processRenewals, runScheduledRenewals };
