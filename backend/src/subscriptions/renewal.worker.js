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
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');

const RENEWAL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function processRenewals() {
  const due = CreatorSub.getActiveDue();
  if (!due.length) return;

  console.log(`[RenewalWorker] Processing ${due.length} due subscription(s)`);

  for (const sub of due) {
    try {
      const wallet = await GiftWallet.ensureWallet(sub.subscriber_uid);

      if (sub.currency === 'vpt') {
        if (wallet.vpt_units < sub.amount) {
          await CreatorSub.markCancelledOnFailure(sub.id, 'insufficient_vpt');
          console.log(`[RenewalWorker] Cancelled ${sub.id} — insufficient vPT`);
          continue;
        }
        const creatorShare = Math.floor(sub.amount * 0.7);
        await GiftWallet.adjustVptUnits(sub.subscriber_uid, -sub.amount);
        await GiftWallet.adjustVptUnits(sub.creator_uid, creatorShare);
      } else {
        if (wallet.ngn_balance < sub.amount) {
          await CreatorSub.markCancelledOnFailure(sub.id, 'insufficient_ngn');
          console.log(`[RenewalWorker] Cancelled ${sub.id} — insufficient NGN`);
          continue;
        }
        const creatorShare = Math.floor(sub.amount * 0.7);
        await GiftWallet.adjustNgnBalance(sub.subscriber_uid, -sub.amount);
        await GiftWallet.adjustNgnBalance(sub.creator_uid, creatorShare);
      }

      await CreatorSub.markRenewed(sub.id);

      const creator = User.findById(sub.creator_uid);
      await Ledger.create({
        uid: sub.subscriber_uid,
        type: 'SUBSCRIPTION_RENEWAL',
        direction: 'debit',
        currency: sub.currency,
        amount_ngn: sub.currency === 'ngn' ? sub.amount : 0,
        amount_vpt_units: sub.currency === 'vpt' ? sub.amount : 0,
        status: 'success',
        meta: {
          creator_uid: sub.creator_uid,
          creator_name: creator ? creator.name : sub.creator_uid,
          subscription_id: sub.id,
          renewal_count: sub.renewal_count,
        },
        description: `Creator subscription renewal — ${creator ? creator.name : sub.creator_uid}`,
      });

      console.log(`[RenewalWorker] Renewed ${sub.id} (renewal #${(sub.renewal_count || 0) + 1})`);
    } catch (err) {
      console.error(`[RenewalWorker] Error renewing ${sub.id}:`, err.message);
    }
  }
}

function start() {
  // Run once immediately to catch anything due from before this server start
  processRenewals().catch((err) =>
    console.error('[RenewalWorker] Initial run error:', err.message),
  );

  setInterval(
    () => processRenewals().catch((err) =>
      console.error('[RenewalWorker] Interval error:', err.message),
    ),
    RENEWAL_INTERVAL_MS,
  );

  console.log('[RenewalWorker] Started — billing checks every 60 min');
}

module.exports = { start, processRenewals };
