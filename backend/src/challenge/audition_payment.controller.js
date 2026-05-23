'use strict';

/**
 * Audition Payment Controller — AV-CHL-003
 *
 * Exposes:
 *   POST /challenge/audition/payment/initialize  (auth)
 *   POST /challenge/audition/payment/:paymentId/verify  (auth)
 */

const User = require('../users/user.model');
const ChallengeModel = require('./challenge.model');
const AuditionPaymentService = require('./audition_payment.service');
const PaymentModel = require('../payments/payment.model');
const PaymentService = require('../payments/payment.service');
const SettingsService = require('../admin/settings.service');

function _toBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

// ── helpers ───────────────────────────────────────────────────────────────

function serializePayment(p) {
  return {
    id: p.id,
    purpose: p.purpose,
    provider: p.provider,
    status: p.status,
    amount_ngn: p.amount_ngn,
    reference: p.reference,
    checkout_url: p.checkout_url,
    raw_status: p.raw_status,
    error: p.error,
    applied_at: p.applied_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

function serializeSignup(s) {
  return {
    id: s.id,
    challenge_id: s.challenge_id,
    signup_status: s.signup_status,
    payment_status: s.payment_status,
    vpt_price_at_signup: s.vpt_price_at_signup,
    vpt_allocated: s.vpt_allocated,
    community_pool_allocated: s.community_pool_allocated,
    ops_pool_allocated: s.ops_pool_allocated,
    vpt_credited: s.vpt_credited,
    enrolled_at: s.enrolled_at,
    created_at: s.created_at,
  };
}

// ── POST /challenge/audition/payment/initialize ───────────────────────────

async function initializeAuditionPayment(req, res) {
  try {
    const signupEnabled = _toBool(await SettingsService.get('AUDITION_SIGNUP_ENABLED'));
    if (!signupEnabled) {
      return res.status(503).json({
        error: 'Audition signup is temporarily disabled. Please try again later.',
        code: 'AUDITION_SIGNUP_DISABLED',
      });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      challenge_id,
      provider = 'paystack',
      return_url,
    } = req.body;

    // Validate return_url is provided (callback destination)
    if (!return_url) {
      console.warn(
        '[initializeAuditionPayment] Missing return_url from client. User:',
        req.userId
      );
      // Still proceed but log it for debugging
    }

    // Resolve challenge: prefer explicit challenge_id, otherwise use active challenge
    let challenge = null;
    let resolvedChallengeId = challenge_id || null;
    if (resolvedChallengeId) {
      challenge = await ChallengeModel.getChallengeById(resolvedChallengeId);
    } else {
      challenge = await ChallengeModel.getActiveChallenge();
      resolvedChallengeId = challenge && challenge.id;
    }

    // Verify challenge exists and is accepting signups
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    if (!['registration-and-audition', 'registration', 'audition'].includes(challenge.phase)) {
      return res.status(409).json({
        error: `Challenge is not currently open for signups (phase: ${challenge.phase})`,
      });
    }

    // Validate provider
    const providers = await PaymentService.getAvailableProviders();
    const selectedProvider = providers.find((p) => p.id === provider);
    if (!selectedProvider) {
      return res.status(400).json({ error: 'Unsupported payment provider' });
    }
    if (!selectedProvider.enabled) {
      return res.status(400).json({
        error: `${selectedProvider.label} is not configured in admin settings`,
      });
    }

    const result = await AuditionPaymentService.initiateSignupPayment({
      userId: req.userId,
      user,
      challengeId: resolvedChallengeId,
      challengeTitle: challenge.title || challenge.id,
      provider,
      returnUrl: return_url,
    });

    return res.status(201).json({
      signup_id: result.signup_id,
      payment_id: result.payment_id,
      payment_reference: result.payment_reference,
      checkout_url: result.checkout_url,
      fee_ngn: result.fee_ngn,
      allocations: result.allocations,
    });
  } catch (err) {
    if (err.statusCode === 409 && err.signup) {
      // Already enrolled — return friendly info
      return res.status(409).json({
        error: err.message,
        signup: serializeSignup(err.signup),
      });
    }
    console.error('[AuditionPayment] initializeAuditionPayment error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to initialize audition payment',
    });
  }
}

// ── POST /challenge/audition/payment/:paymentId/verify ────────────────────

async function verifyAuditionPayment(req, res) {
  try {
    const { paymentId } = req.params;

    const { signup, payment } = await AuditionPaymentService.confirmSignupPayment(
      paymentId,
      req.userId,
    );

    return res.json({
      signup: serializeSignup(signup),
      payment: serializePayment(payment),
    });
  } catch (err) {
    console.error('[AuditionPayment] verifyAuditionPayment error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to verify audition payment',
    });
  }
}

// ── GET /challenge/audition/payment/pricing ───────────────────────────────
// Returns the current fee and live vPT allocation preview for a challenge
// Query params: challenge_id (optional, defaults to active challenge)

async function getAuditionPricing(req, res) {
  try {
    const { challenge_id } = req.query;
    
    let ch;
    if (challenge_id) {
      ch = await ChallengeModel.getChallengeById(challenge_id);
      if (!ch) return res.status(404).json({ error: 'Challenge not found' });
    } else {
      ch = await ChallengeModel.getActiveChallenge();
      if (!ch) return res.status(404).json({ error: 'No active challenge' });
    }

    const pricing = {
      audition_price_ngn: ch.audition_price_ngn || 2500,
      user_reward_vpt_ngn: ch.user_reward_vpt_ngn || 1000,
      community_pool_vpt_ngn: ch.community_pool_vpt_ngn || 500,
      ops_pool_ngn: ch.ops_pool_ngn || 1000,
    };

    // Compute vPT allocations at live VPT price
    const allocations = await AuditionPaymentService.computeAllocations(pricing);
    
    return res.json({
      challenge_id: ch.id,
      challenge_title: ch.title,
      fee_ngn: pricing.audition_price_ngn,
      pricing,
      allocations,
    });
  } catch (err) {
    console.error('[AuditionPayment] getAuditionPricing error:', err.message);
    return res.status(500).json({ error: 'Failed to load pricing' });
  }
}

module.exports = {
  initializeAuditionPayment,
  verifyAuditionPayment,
  getAuditionPricing,
};
