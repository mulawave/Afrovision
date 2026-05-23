const ReferralModel = require('./referral.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');
const PoolService = require('../vpt/pool.service');
const NotificationService = require('../notifications/notification.service');
const {
  parseMaintenanceRequest,
  getMaintenanceConfirmationMessage,
} = require('../utils/maintenance');

/**
 * GET /referrals/my-code
 * Returns the authenticated user's referral code + stats + tree info.
 */
async function getMyCode(req, res) {
  try {
    const referral = await ReferralModel.ensureReferral(req.userId);
    res.json({
      referral_code: referral.referral_code,
      invited_count: referral.invited_count,
      referred_by: referral.referred_by || null,
      total_earnings_ngn: referral.total_earnings_ngn || 0,
      total_earnings_vpt_units: referral.total_earnings_vpt_units || 0,
    });
  } catch (err) {
    console.error('[Referral] getMyCode:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /referrals/apply
 * Body: { referral_code }
 * Called right after registration, to attribute the new user to the code owner.
 */
async function applyReferral(req, res) {
  try {
    const { referral_code } = req.body;
    if (!referral_code) {
      return res.status(400).json({ error: 'referral_code is required' });
    }

    const referralRecord = await ReferralModel.findByCode(referral_code);
    if (!referralRecord) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const referrerUid = referralRecord.uid;
    if (referrerUid === req.userId) {
      return res.status(400).json({ error: 'Cannot apply your own referral code' });
    }

    await ReferralModel.recordInvite(referrerUid, req.userId);

    const updated = await ReferralModel.findByUid(referrerUid);
    res.json({
      success: true,
      invited_count: updated?.invited_count ?? 0,
    });
  } catch (err) {
    console.error('[Referral] applyReferral:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /referrals/dashboard
 * Full referral dashboard: code, tree, earnings history, stats.
 */
async function getDashboard(req, res) {
  try {
    const referral = await ReferralModel.ensureReferral(req.userId);
    const earnings = await ReferralModel.getEarnings(req.userId);
    const directReferrals = await ReferralModel.getDirectReferrals(req.userId);

    // Resolve names for direct referrals
    const referralUsers = await Promise.all(directReferrals.map(async (uid) => {
      const u = await User.findById(uid);
      let joinedAt = null;
      if (u?.created_at) {
        joinedAt = typeof u.created_at === 'number' ? u.created_at : new Date(u.created_at).getTime();
        if (isNaN(joinedAt)) joinedAt = null;
      }
      return {
        uid,
        name: u?.name || null,
        email: u ? _maskEmail(u.email) : null,
        joined_at: joinedAt,
      };
    }));

    // Resolve referrer chain (who referred me, who referred them, etc.)
    const upline = [];
    let currentUid = req.userId;
    for (let i = 0; i < 5; i++) {
      const rec = await ReferralModel.findByUid(currentUid);
      if (!rec || !rec.referred_by) break;
      const referrer = await User.findById(rec.referred_by);
      upline.push({
        level: i + 1,
        uid: rec.referred_by,
        name: referrer?.name || null,
        email: referrer ? _maskEmail(referrer.email) : null,
      });
      currentUid = rec.referred_by;
    }

    // Enrich earnings with names and status
    const enrichedEarnings = await Promise.all(earnings.map(async (e) => {
      const source = await User.findById(e.source_uid);
      return {
        ...e,
        status: e.status || 'pending_ledger',
        source_name: source?.name || null,
        source_email: source ? _maskEmail(source.email) : null,
      };
    }));

    // Get ledger balance summary
    const ledgerSummary = await ReferralModel.getLedgerSummary(req.userId);

    res.json({
      referral_code: referral.referral_code,
      invited_count: referral.invited_count,
      total_earnings_ngn: referral.total_earnings_ngn || 0,
      total_earnings_vpt_units: referral.total_earnings_vpt_units || 0,
      ledger_summary: ledgerSummary,
      direct_referrals: referralUsers,
      upline,
      earnings: enrichedEarnings,
      level_distribution: ReferralModel.LEVEL_DISTRIBUTION.map((pct, i) => ({
        level: i + 1,
        percentage: Math.round(pct * 100),
      })),
    });
  } catch (err) {
    console.error('[Referral] getDashboard:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Distribute referral earnings from a subscription.
 * Called internally from subscription controllers.
 *
 * The referral pool is exactly 15% of the subscription amount (NGN).
 * Each level's payout is split 50% cash (NGN) / 50% vPT.
 * vPT portion is CONVERTED: cashHalf / 750 = vPT units.
 * Empty levels (no referrer) → funds go to RBD Pool.
 *
 * @param {string} subscriberUid - Who made the subscription
 * @param {number} referralPoolAmount - The 15% referral pool amount (NGN)
 * @param {string} subscriptionId - Subscription record ID
 * @param {string|null} creatorUid - Creator who received the subscription (null for plan subs)
 */
async function distributeReferralEarnings({
  subscriberUid,
  referralPoolAmount,
  subscriptionId,
  creatorUid,
}) {
  try {
    if (referralPoolAmount <= 0) return;

    const VPT_PRICE = ReferralModel.VPT_PRICE_NGN; // 750
    const tree = await ReferralModel.resolveTree(subscriberUid);

    for (let i = 0; i < 5; i++) {
      const recipientUid = tree[i];
      const levelAmount = Math.floor(referralPoolAmount * ReferralModel.LEVEL_DISTRIBUTION[i]);
      if (levelAmount <= 0) continue;

      // 50/50 split
      const cashAmount = Math.floor(levelAmount / 2);
      const vptNgnHalf = levelAmount - cashAmount;
      const vptUnits = parseFloat((vptNgnHalf / VPT_PRICE).toFixed(4));

      if (!recipientUid) {
        // Empty level → credit RBD Pool
        await PoolService.creditRbdPool(cashAmount, vptUnits, {
          reason: `empty_L${i + 1}`,
          subscriber_uid: subscriberUid,
          subscription_id: subscriptionId,
        });
        continue;
      }

      // Credit cash wallet instantly
      if (cashAmount > 0) {
        await GiftWallet.adjustNgnBalance(recipientUid, cashAmount);
      }

      // Record earning (cash is instant, vPT is ledger balance)
      await ReferralModel.recordEarning({
        recipientUid,
        sourceUid: subscriberUid,
        level: i + 1,
        amountNgn: cashAmount,
        amountVptUnits: vptUnits,
        subscriptionId,
        creatorUid,
      });

      // Ledger entry for cash (instant credit)
      if (cashAmount > 0) {
        await Ledger.create({
          uid: recipientUid,
          type: 'REFERRAL_EARNING',
          direction: 'credit',
          currency: 'ngn',
          amount_ngn: cashAmount,
          amount_vpt_units: 0,
          status: 'success',
          meta: {
            level: i + 1,
            source_uid: subscriberUid,
            subscription_id: subscriptionId,
            creator_uid: creatorUid,
            split: 'cash_50pct',
            referral_pool: referralPoolAmount,
          },
          description: `Referral L${i + 1} cash earning — subscription by ${subscriberUid.slice(0, 8)}`,
        });
      }

      // Ledger entry for vPT (ledger balance — awaiting blockchain distribution)
      if (vptUnits > 0) {
        await Ledger.create({
          uid: recipientUid,
          type: 'REFERRAL_EARNING',
          direction: 'credit',
          currency: 'vpt',
          amount_ngn: 0,
          amount_vpt_units: vptUnits,
          status: 'pending_distribution',
          meta: {
            level: i + 1,
            source_uid: subscriberUid,
            subscription_id: subscriptionId,
            creator_uid: creatorUid,
            split: 'vpt_50pct',
            vpt_ngn_value: vptNgnHalf,
            vpt_price: VPT_PRICE,
            referral_pool: referralPoolAmount,
          },
          description: `Referral L${i + 1} vPT ledger — ${vptUnits} vPT (₦${vptNgnHalf}) — subscription by ${subscriberUid.slice(0, 8)}`,
        });
      }

      // Notify referral earning recipient
      const totalEarned = [];
      if (cashAmount > 0) totalEarned.push(`₦${cashAmount}`);
      if (vptUnits > 0) totalEarned.push(`${vptUnits} vPT`);
      NotificationService.notifyUser(recipientUid, {
        title: '💰 Referral Reward Earned!',
        body: `Level ${i + 1} reward: ${totalEarned.join(' + ')} from a new subscription`,
        type: 'referral_earning',
        link: '/wallet',
        data: {
          level: String(i + 1),
          cash_amount: String(cashAmount),
          vpt_units: String(vptUnits),
          source_uid: subscriberUid,
          subscription_id: subscriptionId,
        },
      }).catch((err) => console.error('[Referral] notification error:', err.message));
    }
  } catch (err) {
    console.error('[Referral] distributeReferralEarnings error:', err.message);
  }
}

/** Mask email for privacy: j***@gmail.com */
function _maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

// ─── Admin endpoints ──────────────────────────────────────────

/**
 * GET /admin/referrals
 * Lists all referral records with user info, earnings summary, and upline status.
 */
async function adminListReferrals(req, res) {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
    const cursor = String(req.query.cursor || '').trim() || null;
    const { referrals, nextCursor } = await ReferralModel.listPage({ limit, startAfterUid: cursor });

    const enriched = await Promise.all(referrals.map(async (r) => {
      const u = await User.findById(r.uid);
      const referrer = r.referred_by ? await User.findById(r.referred_by) : null;
      const summary = await ReferralModel.getLedgerSummary(r.uid);
      return {
        uid: r.uid,
        email: u?.email || null,
        name: u?.name || null,
        referral_code: r.referral_code,
        referred_by: r.referred_by || null,
        referred_by_email: referrer?.email || null,
        referred_by_name: referrer?.name || null,
        invited_count: r.invited_count || 0,
        total_earnings_ngn: r.total_earnings_ngn || 0,
        total_earnings_vpt_units: r.total_earnings_vpt_units || 0,
        ledger_summary: summary,
        has_upline: !!r.referred_by,
        created_at: r.created_at,
      };
    }));

    const db = require('../utils/firestore').getFirestore();
    const [totalSnap, withUplineSnap] = await Promise.all([
      db.collection('referrals').count().get(),
      db.collection('referrals').where('referred_by', '>=', '').count().get(),
    ]);

    const total = totalSnap.data().count || 0;
    const withUpline = withUplineSnap.data().count || 0;

    const stats = {
      total,
      with_upline: withUpline,
      without_upline: Math.max(0, total - withUpline),
      page_total_earnings_ngn: enriched.reduce((s, r) => s + r.total_earnings_ngn, 0),
      page_total_pending_ngn: enriched.reduce((s, r) => s + r.ledger_summary.pending_ngn, 0),
    };

    res.json({ referrals: enriched, stats, limit, next_cursor: nextCursor, has_more: Boolean(nextCursor) });
  } catch (err) {
    console.error('[Referral] adminListReferrals:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /admin/referrals/assign-upline
 * Body: { uid, referrer_uid }
 * Assigns an upline to a user and retroactively creates earnings for existing subscriptions.
 */
async function adminAssignUpline(req, res) {
  try {
    const { uid, referrer_uid } = req.body;
    if (!uid || !referrer_uid) {
      return res.status(400).json({ error: 'uid and referrer_uid are required' });
    }
    if (uid === referrer_uid) {
      return res.status(400).json({ error: 'Cannot assign user as their own upline' });
    }

    // Ensure both users have referral records
    await ReferralModel.ensureReferral(uid);
    await ReferralModel.ensureReferral(referrer_uid);

    // Check user doesn't already have an upline
    const existing = await ReferralModel.findByUid(uid);
    if (existing?.referred_by) {
      return res.status(400).json({ error: 'User already has an upline assigned' });
    }

    // Assign upline
    await ReferralModel.assignUpline(uid, referrer_uid);

    // Retroactively generate earnings for this user's existing subscriptions
    const CreatorSubscription = require('../subscriptions/creator_subscription.model');
    const subs = CreatorSubscription.getBySubscriber ? await CreatorSubscription.getBySubscriber(uid) : [];
    let earningsCreated = 0;

    for (const sub of subs) {
      if (sub.status !== 'active') continue;
      const amount = sub.amount || sub.price || 0;
      if (amount <= 0) continue;

      // 15% of subscription amount goes to referral pool
      const referralPool = Math.floor(amount * 0.15);
      if (referralPool <= 0) continue;

      const tree = await ReferralModel.resolveTree(uid);

      for (let i = 0; i < 5; i++) {
        const recipientUid = tree[i];
        if (!recipientUid) continue;

        const levelAmount = Math.floor(referralPool * ReferralModel.LEVEL_DISTRIBUTION[i]);
        if (levelAmount <= 0) continue;

        // Split 50/50: cash (NGN) + vPT
        const cashAmount = Math.floor(levelAmount / 2);
        const vptAmount = levelAmount - cashAmount;

        await ReferralModel.recordEarning({
          recipientUid,
          sourceUid: uid,
          level: i + 1,
          amountNgn: cashAmount,
          amountVptUnits: vptAmount,
          subscriptionId: sub.id || null,
          creatorUid: sub.creator_uid || null,
        });

        // Ledger entry for NGN credit
        await Ledger.create({
          uid: recipientUid,
          type: 'REFERRAL_EARNING',
          direction: 'credit',
          currency: 'ngn',
          amount_ngn: cashAmount,
          amount_vpt_units: 0,
          status: 'pending',
          meta: {
            level: i + 1,
            source_uid: uid,
            subscription_id: sub.id || null,
            creator_uid: sub.creator_uid || null,
            retroactive: true,
            split: 'cash_50pct',
          },
          description: `Retroactive referral L${i + 1} cash earning — upline assignment`,
        });

        // Ledger entry for vPT credit
        await Ledger.create({
          uid: recipientUid,
          type: 'REFERRAL_EARNING',
          direction: 'credit',
          currency: 'vpt',
          amount_ngn: 0,
          amount_vpt_units: vptAmount,
          status: 'pending',
          meta: {
            level: i + 1,
            source_uid: uid,
            subscription_id: sub.id || null,
            creator_uid: sub.creator_uid || null,
            retroactive: true,
            split: 'vpt_50pct',
          },
          description: `Retroactive referral L${i + 1} vPT earning — upline assignment`,
        });

        earningsCreated++;
      }
    }

    const updated = await ReferralModel.findByUid(uid);
    const referrerUser = await User.findById(referrer_uid);

    res.json({
      success: true,
      uid,
      referred_by: referrer_uid,
      referred_by_email: referrerUser?.email || null,
      earnings_created: earningsCreated,
      message: `Upline assigned. ${earningsCreated} earnings records created retroactively.`,
    });
  } catch (err) {
    console.error('[Referral] adminAssignUpline:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /admin/referrals/recalculate
 * Recalculate ALL subscription payouts using the correct structure:
 *   50% operations pool (platform keeps)
 *   15% subscriber vPT reward
 *   15% 5-level referral reward (50% cash / 50% vPT)
 *   20% community pool (platform keeps)
 *
 * Steps:
 * 1. Reverse all old REFERRAL_EARNING entries from wallets + referral totals
 * 2. Reverse all old SUBSCRIBER_VPT_REWARD entries (if any)
 * 3. Reverse old creator 70% share from creator wallets
 * 4. Re-apply correct 15% subscriber vPT reward
 * 5. Re-distribute 15% referral pool across 5 levels (50/50 cash+vPT)
 * 6. Rebuild referral earnings data from scratch
 */
async function adminRecalculatePayouts(req, res) {
  try {
    if (!req._opsAuth) {
      const caller = User.findById(req.userId);
      if (!caller || caller.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const maintenance = parseMaintenanceRequest(req, {
      confirmationToken: 'RECALCULATE_REFERRALS',
      defaultLimit: 100,
      maxLimit: 500,
    });
    if (maintenance.error) {
      return res.status(400).json({ error: maintenance.error });
    }
    if (!req._opsAuth && !maintenance.dryRun && !maintenance.confirmed) {
      return res.status(400).json({
        error: getMaintenanceConfirmationMessage(maintenance.confirmationToken),
      });
    }

    const CreatorSubscription = require('../subscriptions/creator_subscription.model');
    const Plan = require('../subscriptions/plan.model');
    const creatorCursorSubscribedAt = req.query.cursor_subscribed_at != null
      ? Number(req.query.cursor_subscribed_at)
      : null;
    const creatorCursorId = String(req.query.cursor_id || '').trim() || null;
    const creatorSubPage = CreatorSubscription.listPage
      ? await CreatorSubscription.listPage({
        limit: maintenance.limit,
        startAfterSubscribedAt: Number.isFinite(creatorCursorSubscribedAt) ? creatorCursorSubscribedAt : null,
        startAfterId: creatorCursorId,
      })
      : { subscriptions: [], nextCursor: null };
    const allCreatorSubs = creatorSubPage.subscriptions;
    const db = require('../utils/firestore').getFirestore();
    const activeUsersSnapshot = await db.collection('users')
      .where('subscription_status', '==', 'active')
      .get();
    const usersWithPlans = activeUsersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) =>
      u.subscription_plan && u.subscription_plan !== 'free' && u.subscription_status === 'active'
    );
    const VPT_PRICE = ReferralModel.VPT_PRICE_NGN; // 750
    const legacySubscriberRewardCleanupRef = db.doc('ops_migrations/subscriber_reward_wallet_cleanup_v1');
    const legacySubscriberRewardCleanupSnap = await legacySubscriberRewardCleanupRef.get();
    const shouldRunLegacySubscriberRewardCleanup = !legacySubscriberRewardCleanupSnap.exists;
    const allOldEarnings = await ReferralModel.getAllEarnings();
    const referralRecordsCountSnap = await db.collection('referrals').count().get();
    const referralRecordsFound = referralRecordsCountSnap.data().count || 0;
    const oldSubscriberRewards = (await Ledger.getByType('SUBSCRIBER_VPT_REWARD')).filter(
      (entry) => entry.type === 'SUBSCRIBER_VPT_REWARD' && entry.status === 'success',
    );
    const oldReferralEarningsLedger = await Ledger.getByType('REFERRAL_EARNING');

    if (!req._opsAuth && maintenance.dryRun) {
      return res.json({
        success: true,
        maintenance: true,
        dry_run: true,
        confirmation_token: maintenance.confirmationToken,
        preview: {
          plan_subscriptions_found: usersWithPlans.length,
          creator_subscriptions_found: allCreatorSubs.length,
          creator_subscriptions_has_more: Boolean(creatorSubPage.nextCursor),
          creator_subscriptions_next_cursor: creatorSubPage.nextCursor,
          old_referral_earnings_found: allOldEarnings.length,
          old_subscriber_rewards_found: oldSubscriberRewards.length,
          referral_records_found: referralRecordsFound,
          legacy_subscriber_wallet_cleanup_pending: shouldRunLegacySubscriberRewardCleanup,
        },
        message: 'Dry run only. Re-send this request with confirmation=RECALCULATE_REFERRALS to execute the recalculation.',
      });
    }

    const report = {
      plan_subscriptions_found: usersWithPlans.length,
      creator_subscriptions_found: allCreatorSubs.length,
      creator_subscriptions_has_more: Boolean(creatorSubPage.nextCursor),
      creator_subscriptions_next_cursor: creatorSubPage.nextCursor,
      subscriptions_processed: 0,
      old_referral_earnings_reversed: 0,
      old_subscriber_rewards_reversed: 0,
      legacy_subscriber_wallet_vpt_reversed: 0,
      new_subscriber_vpt_rewards: 0,
      new_referral_earnings_created: 0,
      rbd_pool_dumps: 0,
      wallet_adjustments: 0,
      ledger_entries_created: 0,
      errors: [],
    };

    // ── Phase 1: Reverse ALL old referral earnings from wallets ──────
    for (const earning of allOldEarnings) {
      try {
        const ngnAmount = earning.amount_ngn || 0;
        const vptAmount = earning.amount_vpt_units || 0;

        if (ngnAmount > 0) {
          await GiftWallet.adjustNgnBalance(earning.recipient_uid, -ngnAmount);
          report.wallet_adjustments++;
        }
        // Only reverse vPT from wallet if it was credited there (old logic)
        if (vptAmount > 0) {
          await GiftWallet.adjustVptUnits(earning.recipient_uid, -vptAmount);
          report.wallet_adjustments++;
        }

        const refRec = await ReferralModel.findByUid(earning.recipient_uid);
        if (refRec) {
          refRec.total_earnings_ngn = Math.max(0, (refRec.total_earnings_ngn || 0) - ngnAmount);
          refRec.total_earnings_vpt_units = Math.max(0, (refRec.total_earnings_vpt_units || 0) - vptAmount);
        }

        report.old_referral_earnings_reversed++;
      } catch (err) {
        report.errors.push(`Reverse earning ${earning.id}: ${err.message}`);
      }
    }

    // Delete all old earnings from Firestore
    const earningsSnap = await db.collection(ReferralModel.EARNINGS_COLLECTION).get();
    const batch1 = db.batch();
    let batchCount = 0;
    for (const doc of earningsSnap.docs) {
      batch1.delete(doc.ref);
      batchCount++;
      if (batchCount >= 450) { await batch1.commit(); batchCount = 0; }
    }
    if (batchCount > 0) await batch1.commit();

    // Delete old REFERRAL_EARNING and SUBSCRIBER_VPT_REWARD ledger entries
    for (const entry of oldSubscriberRewards) {
      try {
        const vptUnits = entry.amount_vpt_units || entry.amount_vpt || 0;
        if (vptUnits > 0 && entry.uid) {
          await GiftWallet.adjustVptUnits(entry.uid, -vptUnits);
          report.wallet_adjustments++;
          report.old_subscriber_rewards_reversed++;
        }
      } catch (err) {
        report.errors.push(`Reverse subscriber reward ${entry.id}: ${err.message}`);
      }
    }

    const toDeleteIds = [...oldReferralEarningsLedger, ...oldSubscriberRewards].map((e) => e.id);

    const batch2 = db.batch();
    let batch2Count = 0;
    for (const id of toDeleteIds) {
      batch2.delete(db.collection('ledger').doc(id));
      batch2Count++;
      if (batch2Count >= 450) { await batch2.commit(); batch2Count = 0; }
    }
    if (batch2Count > 0) await batch2.commit();
    for (const id of toDeleteIds) Ledger.removeFromCache(id);
    ReferralModel.clearEarningsCache();

    // Reset RBD Pool
    await db.doc('pools/rbd').set({
      balance_ngn: 0, balance_vpt: 0,
      total_credited_ngn: 0, total_credited_vpt: 0,
      updated_at: Date.now(),
    });

    if (shouldRunLegacySubscriberRewardCleanup) {
      for (const user of usersWithPlans) {
        try {
          const plan = await Plan.findByName(user.subscription_plan);
          if (!plan || plan.price <= 0) continue;
          const legacyRewardUnits = Math.floor(plan.price * 0.15);
          if (legacyRewardUnits <= 0) continue;
          await GiftWallet.adjustVptUnits(user.id, -legacyRewardUnits);
          report.wallet_adjustments++;
          report.legacy_subscriber_wallet_vpt_reversed += legacyRewardUnits;
        } catch (err) {
          report.errors.push(`Legacy subscriber reward cleanup for user ${user.id}: ${err.message}`);
        }
      }

      for (const sub of allCreatorSubs) {
        try {
          const legacyRewardUnits = Math.floor((sub.amount || 0) * 0.15);
          if (legacyRewardUnits <= 0) continue;
          await GiftWallet.adjustVptUnits(sub.subscriber_uid, -legacyRewardUnits);
          report.wallet_adjustments++;
          report.legacy_subscriber_wallet_vpt_reversed += legacyRewardUnits;
        } catch (err) {
          report.errors.push(`Legacy subscriber reward cleanup for creator sub ${sub.id}: ${err.message}`);
        }
      }

      await legacySubscriberRewardCleanupRef.set({
        applied_at: Date.now(),
        note: 'One-time reversal of legacy subscriber vPT rewards that were incorrectly credited to gift wallets.',
      });
    }

    // ── Explicit zero: set ALL gift wallet vpt_units to 0 ────────────
    // Guarantees a clean slate regardless of any stale or inconsistent
    // delta-based adjustments above. vPT lives in the ledger now, not wallets.
    {
      const zeroSnap = await db.collection('users')
        .where('subscription_status', '==', 'active')
        .get();
      let zeroBatch = db.batch();
      let zeroBatchCount = 0;
      for (const doc of zeroSnap.docs) {
        zeroBatch.update(doc.ref, { vpt: 0 });
        zeroBatchCount++;
        if (zeroBatchCount >= 450) { await zeroBatch.commit(); zeroBatch = db.batch(); zeroBatchCount = 0; }
      }
      if (zeroBatchCount > 0) await zeroBatch.commit();
      // Sync in-memory cache
      for (const u of User.getCachedAll(true)) {
        if (u.subscription_status === 'active') {
          u.vpt = 0;
        }
      }
      report.wallet_adjustments += zeroSnap.size;
    }

    // ── Helper: distribute referral rewards for one subscription ─────
    async function _distributeForSub(subscriberUid, amount, subscriptionId, creatorUid, source) {
      const referralPool = Math.floor(amount * 0.15);
      if (referralPool <= 0) return;

      const tree = await ReferralModel.resolveTree(subscriberUid);
      for (let i = 0; i < 5; i++) {
        const recipientUid = tree[i];
        const levelAmount = Math.floor(referralPool * ReferralModel.LEVEL_DISTRIBUTION[i]);
        if (levelAmount <= 0) continue;

        const cashAmount = Math.floor(levelAmount / 2);
        const vptNgnHalf = levelAmount - cashAmount;
        const vptUnits = parseFloat((vptNgnHalf / VPT_PRICE).toFixed(4));

        if (!recipientUid) {
          // Empty level → RBD Pool
          await PoolService.creditRbdPool(cashAmount, vptUnits, {
            reason: `recalc_empty_L${i + 1}`,
            subscriber_uid: subscriberUid,
            subscription_id: subscriptionId,
          });
          report.rbd_pool_dumps++;
          continue;
        }

        // Cash → instant wallet credit
        if (cashAmount > 0) {
          await GiftWallet.adjustNgnBalance(recipientUid, cashAmount);
          report.wallet_adjustments++;
        }

        // Record earning (vPT stays as ledger balance, NOT credited to wallet)
        await ReferralModel.recordEarning({
          recipientUid,
          sourceUid: subscriberUid,
          level: i + 1,
          amountNgn: cashAmount,
          amountVptUnits: vptUnits,
          subscriptionId,
          creatorUid,
        });
        report.new_referral_earnings_created++;

        if (cashAmount > 0) {
          await Ledger.create({
            uid: recipientUid,
            type: 'REFERRAL_EARNING',
            direction: 'credit',
            currency: 'ngn',
            amount_ngn: cashAmount,
            status: 'success',
            meta: { level: i + 1, source_uid: subscriberUid, subscription_id: subscriptionId, creator_uid: creatorUid, split: 'cash_50pct', referral_pool: referralPool, recalculated: true, source },
            description: `Referral L${i + 1} cash — ${source} — recalculated`,
          });
          report.ledger_entries_created++;
        }

        if (vptUnits > 0) {
          await Ledger.create({
            uid: recipientUid,
            type: 'REFERRAL_EARNING',
            direction: 'credit',
            currency: 'vpt',
            amount_vpt_units: vptUnits,
            status: 'pending_distribution',
            meta: { level: i + 1, source_uid: subscriberUid, subscription_id: subscriptionId, creator_uid: creatorUid, split: 'vpt_50pct', vpt_ngn_value: vptNgnHalf, vpt_price: VPT_PRICE, referral_pool: referralPool, recalculated: true, source },
            description: `Referral L${i + 1} vPT ledger — ${vptUnits} vPT (₦${vptNgnHalf}) — recalculated`,
          });
          report.ledger_entries_created++;
        }
      }
    }

    // ── Phase 2: Re-distribute for PLAN SUBSCRIPTIONS ───────────────
    for (const user of usersWithPlans) {
      try {
        const plan = await Plan.findByName(user.subscription_plan);
        if (!plan || plan.price <= 0) continue;
        report.subscriptions_processed++;

        // 15% subscriber vPT reward (converted)
        const subscriberVptNgn = Math.floor(plan.price * 0.15);
        const subscriberVptUnits = parseFloat((subscriberVptNgn / VPT_PRICE).toFixed(4));

        if (subscriberVptUnits > 0) {
          report.new_subscriber_vpt_rewards++;
          await Ledger.create({
            uid: user.id,
            type: 'SUBSCRIBER_VPT_REWARD',
            direction: 'credit',
            currency: 'vpt',
            amount_vpt_units: subscriberVptUnits,
            status: 'pending_distribution',
            meta: { plan_name: plan.name, plan_price: plan.price, vpt_ngn_value: subscriberVptNgn, vpt_price: VPT_PRICE, recalculated: true, source: 'plan_subscription' },
            description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — ${plan.name} plan — recalculated`,
          });
          report.ledger_entries_created++;
        }

        await _distributeForSub(user.id, plan.price, `plan_${plan.id}_${user.id}`, null, `${plan.name}_plan`);
      } catch (err) {
        report.errors.push(`Plan sub for user ${user.id}: ${err.message}`);
      }
    }

    // ── Phase 3: Re-distribute for CREATOR CHANNEL SUBSCRIPTIONS ────
    for (const sub of allCreatorSubs) {
      try {
        const amount = sub.amount || 0;
        if (amount <= 0) continue;
        report.subscriptions_processed++;

        const subscriberVptNgn = Math.floor(amount * 0.15);
        const subscriberVptUnits = parseFloat((subscriberVptNgn / VPT_PRICE).toFixed(4));

        if (subscriberVptUnits > 0) {
          report.new_subscriber_vpt_rewards++;
          await Ledger.create({
            uid: sub.subscriber_uid,
            type: 'SUBSCRIBER_VPT_REWARD',
            direction: 'credit',
            currency: 'vpt',
            amount_vpt_units: subscriberVptUnits,
            status: 'pending_distribution',
            meta: { creator_uid: sub.creator_uid, subscription_id: sub.id, subscription_amount: amount, vpt_ngn_value: subscriberVptNgn, vpt_price: VPT_PRICE, recalculated: true, source: 'creator_subscription' },
            description: `Subscriber vPT reward — ${subscriberVptUnits} vPT (₦${subscriberVptNgn}) — creator sub — recalculated`,
          });
          report.ledger_entries_created++;
        }

        await _distributeForSub(sub.subscriber_uid, amount, sub.id, sub.creator_uid, 'creator_subscription');
      } catch (err) {
        report.errors.push(`Creator sub ${sub.id}: ${err.message}`);
      }
    }

    // Get final RBD pool balance for report
    const rbdBalance = await PoolService.getRbdPoolBalance();

    res.json({
      success: true,
      message: 'Payout recalculation complete.',
      structure: '50% ops, 15% subscriber vPT, 15% referral (L1-5, 50/50 cash+vPT @ ₦750/vPT), 20% community pool. Empty levels → RBD Pool.',
      rbd_pool: rbdBalance,
      report,
    });
  } catch (err) {
    console.error('[Referral] adminRecalculatePayouts:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

module.exports = { getMyCode, applyReferral, getDashboard, distributeReferralEarnings, adminListReferrals, adminAssignUpline, adminRecalculatePayouts };
