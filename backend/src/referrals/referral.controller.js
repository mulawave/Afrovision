const ReferralModel = require('./referral.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const User = require('../users/user.model');

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

    const referralRecord = ReferralModel.findByCode(referral_code);
    if (!referralRecord) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const referrerUid = referralRecord.uid;
    if (referrerUid === req.userId) {
      return res.status(400).json({ error: 'Cannot apply your own referral code' });
    }

    await ReferralModel.recordInvite(referrerUid, req.userId);

    const updated = ReferralModel.findByUid(referrerUid);
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
    const earnings = ReferralModel.getEarnings(req.userId);
    const directReferrals = ReferralModel.getDirectReferrals(req.userId);

    // Resolve names for direct referrals
    const referralUsers = directReferrals.map((uid) => {
      const u = User.findById(uid);
      return {
        uid,
        name: u?.name || null,
        email: u ? _maskEmail(u.email) : null,
        joined_at: u?.created_at || null,
      };
    });

    // Resolve referrer chain (who referred me, who referred them, etc.)
    const upline = [];
    let currentUid = req.userId;
    for (let i = 0; i < 5; i++) {
      const rec = ReferralModel.findByUid(currentUid);
      if (!rec || !rec.referred_by) break;
      const referrer = User.findById(rec.referred_by);
      upline.push({
        level: i + 1,
        uid: rec.referred_by,
        name: referrer?.name || null,
        email: referrer ? _maskEmail(referrer.email) : null,
      });
      currentUid = rec.referred_by;
    }

    // Enrich earnings with names
    const enrichedEarnings = earnings.map((e) => {
      const source = User.findById(e.source_uid);
      return {
        ...e,
        source_name: source?.name || null,
        source_email: source ? _maskEmail(source.email) : null,
      };
    });

    res.json({
      referral_code: referral.referral_code,
      invited_count: referral.invited_count,
      total_earnings_ngn: referral.total_earnings_ngn || 0,
      total_earnings_vpt_units: referral.total_earnings_vpt_units || 0,
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
 * Distribute referral earnings from a creator subscription.
 * Called internally from the creator subscription controller.
 *
 * @param {string} subscriberUid - Who made the subscription
 * @param {number} communityPoolAmount - The 30% community pool amount (in same currency)
 * @param {string} currency - 'ngn' or 'vpt'
 * @param {string} subscriptionId - Subscription record ID
 * @param {string} creatorUid - Creator who received the subscription
 */
async function distributeReferralEarnings({
  subscriberUid,
  communityPoolAmount,
  currency,
  subscriptionId,
  creatorUid,
}) {
  try {
    // 1/3 of community pool goes to referral tree
    const referralPool = Math.floor(communityPoolAmount * ReferralModel.REFERRAL_POOL_FRACTION);
    if (referralPool <= 0) return;

    // Resolve the 5-level tree
    const tree = ReferralModel.resolveTree(subscriberUid);

    for (let i = 0; i < 5; i++) {
      const recipientUid = tree[i];
      if (!recipientUid) continue; // Skip if no base account exists yet

      const levelAmount = Math.floor(referralPool * ReferralModel.LEVEL_DISTRIBUTION[i]);
      if (levelAmount <= 0) continue;

      // Split earning 50/50: cash wallet + vPT wallet
      const cashAmount = Math.floor(levelAmount / 2);
      const vptAmount = levelAmount - cashAmount;

      // Credit cash wallet (NGN portion)
      if (currency === 'ngn') {
        await GiftWallet.adjustNgnBalance(recipientUid, cashAmount);
      } else {
        await GiftWallet.adjustVptUnits(recipientUid, cashAmount);
      }

      // Credit vPT wallet (converted portion — same units for now, conversion happens at batch)
      if (currency === 'ngn') {
        await GiftWallet.adjustVptUnits(recipientUid, vptAmount);
      } else {
        await GiftWallet.adjustVptUnits(recipientUid, vptAmount);
      }

      // Record earning
      await ReferralModel.recordEarning({
        recipientUid,
        sourceUid: subscriberUid,
        level: i + 1,
        amountNgn: currency === 'ngn' ? levelAmount : 0,
        amountVptUnits: currency === 'vpt' ? levelAmount : 0,
        subscriptionId,
        creatorUid,
      });

      // Ledger entry
      await Ledger.create({
        uid: recipientUid,
        type: 'REFERRAL_EARNING',
        direction: 'credit',
        currency,
        amount_ngn: currency === 'ngn' ? levelAmount : 0,
        amount_vpt_units: currency === 'vpt' ? levelAmount : 0,
        status: 'success',
        meta: {
          level: i + 1,
          source_uid: subscriberUid,
          subscription_id: subscriptionId,
          creator_uid: creatorUid,
          cash_portion: cashAmount,
          vpt_portion: vptAmount,
          referral_pool: referralPool,
        },
        description: `Referral L${i + 1} earning — subscription by ${subscriberUid.slice(0, 8)}`,
      });
    }
  } catch (err) {
    console.error('[Referral] distributeReferralEarnings error:', err.message);
    // Non-fatal: subscription still succeeds even if referral distribution fails
  }
}

/** Mask email for privacy: j***@gmail.com */
function _maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

module.exports = { getMyCode, applyReferral, getDashboard, distributeReferralEarnings };
