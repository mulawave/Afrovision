/**
 * Audition Payment Service — AV-CHL-003
 *
 * Owns all pricing and allocation logic for the paid audition signup flow.
 *
 * Pricing is now configurable per challenge:
 * - Audition fee (amount user pays)
 * - Participant reward (vPT worth allocated to user)
 * - Community pool (vPT worth allocated to community)
 * - Operations pool (vPT worth allocated to ops)
 *
 * The vPT price is always read from SettingsService at execution time.
 */
'use strict';

const SettingsService = require('../admin/settings.service');
const ChallengeModel = require('./challenge.model');
const PaymentModel = require('../payments/payment.model');
const PaymentService = require('../payments/payment.service');
const AuditionSignupModel = require('./audition_signup.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const PoolService = require('../vpt/pool.service');
const SmtpService = require('../admin/smtp.service');
const NotificationService = require('../notifications/notification.service');

// Default pricing fallback (used if challenge doesn't define pricing)
const DEFAULT_PRICING = {
  audition_price_ngn: 2500,
  user_reward_vpt_ngn: 1000,
  community_pool_vpt_ngn: 500,
  ops_pool_ngn: 1000,
};

// ── Pricing helpers ───────────────────────────────────────────────────────

/**
 * Load pricing for a specific challenge.
 * Falls back to defaults if challenge doesn't have pricing fields.
 * Validates that all allocations sum to the fee.
 */
async function loadChallengePricing(challengeId) {
  const challenge = await ChallengeModel.getChallengeById(challengeId);
  if (!challenge) {
    throw new Error(`Challenge ${challengeId} not found`);
  }

  const pricing = {
    audition_price_ngn: challenge.audition_price_ngn ?? DEFAULT_PRICING.audition_price_ngn,
    user_reward_vpt_ngn: challenge.user_reward_vpt_ngn ?? DEFAULT_PRICING.user_reward_vpt_ngn,
    community_pool_vpt_ngn: challenge.community_pool_vpt_ngn ?? DEFAULT_PRICING.community_pool_vpt_ngn,
    ops_pool_ngn: challenge.ops_pool_ngn ?? DEFAULT_PRICING.ops_pool_ngn,
  };

  // Validate allocations
  const total = pricing.user_reward_vpt_ngn + pricing.community_pool_vpt_ngn + pricing.ops_pool_ngn;
  if (total !== pricing.audition_price_ngn) {
    throw new Error(
      `[AuditionPayment] FATAL: allocation splits do not sum to audition fee (${total} !== ${pricing.audition_price_ngn})`,
    );
  }

  return pricing;
}

/**
 * Fetch the current vPT price from admin settings, with a safe fallback.
 * The fallback only applies if the setting is genuinely absent; the live
 * value is always preferred.
 */
async function getLiveVptPrice() {
  return (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
}

/**
 * Compute how many vPT units correspond to a given NGN amount at the
 * provided price. Rounded to 4 decimal places for ledger precision.
 */
function ngnToVpt(ngnAmount, vptPriceNgn) {
  return parseFloat((ngnAmount / vptPriceNgn).toFixed(4));
}

/**
 * Build the full allocation snapshot for a signup at the current moment.
 * This is called at initiation time and the computed values are stored on
 * the signup record so they can survive price changes.
 *
 * @param {object} pricing - { audition_price_ngn, user_reward_vpt_ngn, community_pool_vpt_ngn, ops_pool_ngn }
 * @returns {{
 *   vpt_price_at_signup: number,
 *   vpt_allocated: number,
 *   community_pool_allocated: number,
 *   ops_pool_allocated: number,
 * }}
 */
async function computeAllocations(pricing) {
  const vptPrice = await getLiveVptPrice();
  return {
    vpt_price_at_signup: vptPrice,
    vpt_allocated: ngnToVpt(pricing.user_reward_vpt_ngn, vptPrice),
    community_pool_allocated: ngnToVpt(pricing.community_pool_vpt_ngn, vptPrice),
    ops_pool_allocated: ngnToVpt(pricing.ops_pool_ngn, vptPrice),
  };
}

// ── Initiation ────────────────────────────────────────────────────────────

/**
 * Initiate an audition signup payment.
 *
 * 1. Checks for an existing enrolled signup (idempotency guard).
 * 2. Re-uses any existing pending_payment signup for the same user+challenge
 *    rather than creating a new one — avoids orphan records on retry.
 * 3. Computes vPT allocations at current price and snapshots them.
 * 4. Creates (or retrieves) the Payment record.
 * 5. Initialises the payment gateway checkout.
 * 6. Returns the checkout URL and linked IDs for the client.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {object} params.user            - full user record (for gateway)
 * @param {string} params.challengeId
 * @param {string} params.challengeTitle
 * @param {string} params.provider        - 'paystack' | 'flutterwave'
 * @param {string} [params.returnUrl]
 */
async function initiateSignupPayment({
  userId,
  user,
  challengeId,
  challengeTitle,
  provider = 'paystack',
  returnUrl,
}) {
  // ── Load challenge pricing ───────────────────────────────────────────
  const pricing = await loadChallengePricing(challengeId);

  // ── Guard: already enrolled ──────────────────────────────────────────
  const existing = await AuditionSignupModel.getSignupByUserId(challengeId, userId);
  if (existing && existing.signup_status === 'enrolled') {
    const err = new Error('You are already enrolled in this audition.');
    err.statusCode = 409;
    err.signup = existing;
    throw err;
  }

  // ── Snapshot allocations at current live price ───────────────────────
  const allocations = await computeAllocations(pricing);

  // ── Create or reuse signup record ────────────────────────────────────
  let signup;
  if (existing && existing.signup_status === 'pending_payment') {
    // Reuse existing pending signup (update allocations in case price changed)
    signup = await AuditionSignupModel.updateSignup(existing.id, {
      ...allocations,
    });
  } else {
    // No existing signup (or previously cancelled) — create fresh
    signup = await AuditionSignupModel.createSignup({
      challenge_id: challengeId,
      user_id: userId,
      email: user.email,
      name: user.name || null,
      ...allocations,
    });
  }

  // ── Create Payment record ─────────────────────────────────────────────
  const payment = await PaymentModel.create({
    uid: userId,
    purpose: 'audition_signup',
    provider,
    amount_ngn: pricing.audition_price_ngn,
    currency: 'NGN',
    meta: {
      challenge_id: challengeId,
      challenge_title: challengeTitle,
      signup_id: signup.id,
      pricing_snapshot: pricing,
      vpt_price_at_signup: allocations.vpt_price_at_signup,
      vpt_allocated: allocations.vpt_allocated,
      community_pool_allocated: allocations.community_pool_allocated,
      ops_pool_allocated: allocations.ops_pool_allocated,
    },
  });

  // Link the payment reference back to the signup record
  await AuditionSignupModel.updateSignup(signup.id, {
    payment_reference: payment.id,
  });

  // ── Initialise gateway checkout ───────────────────────────────────────
  const gateway = await PaymentService.initializeCheckout(payment, user, returnUrl);

  const updatedPayment = await PaymentModel.update(payment.id, {
    reference: gateway.reference,
    checkout_url: gateway.checkout_url,
    status: 'initialized',
  });

  return {
    signup_id: signup.id,
    payment_id: updatedPayment.id,
    payment_reference: gateway.reference,
    checkout_url: gateway.checkout_url,
    fee_ngn: pricing.audition_price_ngn,
    allocations,
  };
}

// ── Confirmation ──────────────────────────────────────────────────────────

/**
 * Verify a payment with the gateway and, on success, enrol the participant.
 * Idempotent: repeat calls with the same paymentId return the already-enrolled
 * signup without re-applying allocations.
 *
 * vPT credit is applied here (AV-CHL-006 extends this further with pool writes).
 * The community and ops pool allocation amounts are stored on the signup record
 * ready for the pool engine to consume; they are NOT double-written here.
 *
 * @param {string} paymentId
 * @param {string} userId       - for ownership check
 * @returns {{ signup, payment }}
 */
async function confirmSignupPayment(paymentId, userId) {
  const payment = await PaymentModel.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }
  if (payment.uid !== userId) {
    const err = new Error('Not authorized to verify this payment');
    err.statusCode = 403;
    throw err;
  }
  if (payment.purpose !== 'audition_signup') {
    const err = new Error('Payment is not an audition signup payment');
    err.statusCode = 400;
    throw err;
  }

  const signupId = payment.meta && payment.meta.signup_id;
  if (!signupId) {
    const err = new Error('Signup ID missing from payment metadata');
    err.statusCode = 500;
    throw err;
  }

  const signup = await AuditionSignupModel.getSignupById(signupId);
  if (!signup) {
    const err = new Error('Audition signup record not found');
    err.statusCode = 404;
    throw err;
  }

  async function attemptAcknowledgementEmail(enrolledSignup) {
    if (!enrolledSignup || !enrolledSignup.email || enrolledSignup.email_sent) return;

    const attempts = Number(enrolledSignup.email_retry_count || 0) + 1;
    const attemptedAt = new Date().toISOString();


    try {
      await SmtpService.sendAuditionSignupAcknowledgementEmail({
        toEmail: enrolledSignup.email,
        displayName: enrolledSignup.name || enrolledSignup.email.split('@')[0],
      });

      await AuditionSignupModel.updateSignup(enrolledSignup.id, {
        email_sent: true,
        email_sent_at: attemptedAt,
        email_error: null,
        email_retry_count: attempts,
        email_last_attempt_at: attemptedAt,
      });
    } catch (emailErr) {
      console.error('[AuditionPayment] acknowledgement email error:', emailErr.message);
      await AuditionSignupModel.updateSignup(enrolledSignup.id, {
        email_sent: false,
        email_error: emailErr.message || 'Acknowledgement email failed',
        email_retry_count: attempts,
        email_last_attempt_at: attemptedAt,
      });
    }
  }

  // ── Idempotency: already enrolled ────────────────────────────────────
  if (signup.signup_status === 'enrolled') {
    await attemptAcknowledgementEmail(signup);
    const latest = await AuditionSignupModel.getSignupById(signup.id);
    return { signup: latest || signup, payment };
  }

  // ── Verify with gateway ───────────────────────────────────────────────
  const verification = await PaymentService.verifyGatewayPayment(payment);

  if (!verification.paid) {
    // Mark payment failed; cancel signup
    await PaymentModel.update(payment.id, {
      raw_status: verification.raw_status,
      error: verification.raw_message || 'Payment not confirmed by gateway',
      status: 'failed',
    });
    const cancelled = await AuditionSignupModel.cancelSignup(
      signupId,
      verification.raw_message || 'Payment not confirmed',
    );
    return { signup: cancelled, payment };
  }

  // Sanity: verify amount matches expected fee (allow ±1 NGN rounding)
  const pricingFromMeta = payment.meta?.pricing_snapshot;
  const expectedFeeNgn = pricingFromMeta?.audition_price_ngn || DEFAULT_PRICING.audition_price_ngn;
  
  if (Math.abs(verification.amount_ngn - expectedFeeNgn) > 1) {
    const err = new Error(
      `Payment amount mismatch: expected ₦${expectedFeeNgn}, got ₦${verification.amount_ngn}`,
    );
    err.statusCode = 400;
    throw err;
  }

  // ── Enrol participant ────────────────────────────────────────────────
  // Use the vPT price that was snapshotted at initiation time, NOT the
  // current live price, so the participant always receives what was
  // shown to them during signup.
  const paymentMeta = payment.meta || {};
  const pricingSnapshot = paymentMeta.pricing_snapshot || {};
  
  const enrollData = {
    payment_reference: verification.provider_payment_id || payment.id,
    vpt_price_at_signup: paymentMeta.vpt_price_at_signup || signup.vpt_price_at_signup,
    vpt_allocated: paymentMeta.vpt_allocated || signup.vpt_allocated,
    community_pool_allocated: paymentMeta.community_pool_allocated || signup.community_pool_allocated,
    ops_pool_allocated: paymentMeta.ops_pool_allocated || signup.ops_pool_allocated,
  };

  const enrolled = await AuditionSignupModel.enrollSignup(signupId, enrollData);

  // ── AV-CHL-006: Apply all financial allocations atomically ─────────────
  // All three writes (participant wallet, community pool, ops pool) must
  // happen together. vpt_credited guards against double-application.
  if (!enrolled.vpt_credited && enrolled.vpt_allocated) {
    const vptPrice = enrolled.vpt_price_at_signup;
    const challengeId = enrolled.challenge_id;
    
    // Get pricing amounts from snapshot, with fallback to defaults
    const userRewardNgn = pricingSnapshot.user_reward_vpt_ngn ?? DEFAULT_PRICING.user_reward_vpt_ngn;
    const communityPoolNgn = pricingSnapshot.community_pool_vpt_ngn ?? DEFAULT_PRICING.community_pool_vpt_ngn;
    const opsPoolNgn = pricingSnapshot.ops_pool_ngn ?? DEFAULT_PRICING.ops_pool_ngn;
    
    const allocationMeta = {
      challenge_id: challengeId,
      signup_id: enrolled.id,
      payment_id: payment.id,
      vpt_price_ngn: vptPrice,
    };

    // 1. Credit vPT to the participant's wallet
    await GiftWallet.ensureWallet(userId);
    await GiftWallet.adjustVptUnits(userId, enrolled.vpt_allocated);
    await Ledger.create({
      uid: userId,
      type: 'AUDITION_REWARD',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: enrolled.vpt_allocated,
      amount_ngn: userRewardNgn,
      status: 'success',
      reference_id: enrolled.id,
      meta: allocationMeta,
      description: `Audition signup reward — challenge ${challengeId}`,
    });

    // 2. Credit vPT to the community pool
    if (enrolled.community_pool_allocated) {
      await PoolService.creditPool(
        communityPoolNgn,
        'audition_signup',
        allocationMeta,
      );
      await Ledger.create({
        uid: 'system',
        type: 'AUDITION_COMMUNITY_POOL',
        direction: 'credit',
        currency: 'vpt',
        amount_vpt_units: enrolled.community_pool_allocated,
        amount_ngn: communityPoolNgn,
        status: 'success',
        reference_id: enrolled.id,
        meta: allocationMeta,
        description: `Audition community pool allocation — challenge ${challengeId}`,
      });
    }

    // 3. Credit vPT to the operations pool
    if (enrolled.ops_pool_allocated) {
      await PoolService.creditOperationsPool(
        opsPoolNgn,
        'audition_signup',
        allocationMeta,
      );
      await Ledger.create({
        uid: 'system',
        type: 'AUDITION_OPS_POOL',
        direction: 'credit',
        currency: 'ngn',
        amount_vpt_units: enrolled.ops_pool_allocated,
        amount_ngn: opsPoolNgn,
        status: 'success',
        reference_id: enrolled.id,
        meta: allocationMeta,
        description: `Audition operations pool allocation — challenge ${challengeId}`,
      });
    }

    // Mark all allocations as applied
    await AuditionSignupModel.updateSignup(signupId, {
      vpt_credited: true,
      allocation_tx_id: payment.id,
    });
  }

  // Mark payment fully applied
  await PaymentModel.update(payment.id, {
    raw_status: verification.raw_status,
    provider_payment_id: verification.provider_payment_id,
    status: 'paid',
    applied_at: Date.now(),
    error: null,
  });

  // Non-blocking business side effect: do not fail successful enrollments
  // when SMTP/template settings are unavailable.
  await attemptAcknowledgementEmail(enrolled);

  const finalSignup = await AuditionSignupModel.getSignupById(enrolled.id);

  if (finalSignup?.vpt_credited && finalSignup?.vpt_allocated) {
    NotificationService.notifyUser(userId, {
      title: 'Audition Reward Credited',
      body: `${Number(finalSignup.vpt_allocated).toLocaleString()} vPT has been credited to your wallet after successful payment verification.`,
      type: 'audition_reward_credited',
      data: {
        signup_id: finalSignup.id,
        challenge_id: finalSignup.challenge_id,
        amount_vpt: String(finalSignup.vpt_allocated),
      },
      link: '/wallet',
      source: 'audition_payment_verification',
    }).catch((err) => {
      console.error('[AuditionPayment] reward notification failed:', err.message);
    });
  }

  return { signup: finalSignup || enrolled, payment };
}

// ── Webhook / callback entry ──────────────────────────────────────────────

/**
 * Resolve an audition signup payment by its gateway reference string.
 * Used when a webhook delivers confirmation without a local payment ID.
 *
 * @param {string} gatewayReference  - the reference returned by Paystack/Flutterwave
 * @returns {{ signup, payment } | null}
 */
async function confirmByGatewayReference(gatewayReference) {
  const payment = await PaymentModel.findByReference(gatewayReference);
  if (!payment || payment.purpose !== 'audition_signup') return null;
  return confirmSignupPayment(payment.id, payment.uid);
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_PRICING,
  loadChallengePricing,
  getLiveVptPrice,
  computeAllocations,
  initiateSignupPayment,
  confirmSignupPayment,
  confirmByGatewayReference,
};
