const Payment = require('./payment.model');
const PaymentService = require('./payment.service');
const Plan = require('../subscriptions/plan.model');
const User = require('../users/user.model');
const { getPlanEligibilityError } = require('../subscriptions/subscription.controller');

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
    checkout_url: payment.checkout_url,
    raw_status: payment.raw_status,
    error: payment.error,
    verified_at: payment.verified_at,
    applied_at: payment.applied_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

async function getProviders(req, res) {
  try {
    const providers = await PaymentService.getAvailableProviders();
    res.json({ providers });
  } catch (err) {
    console.error('[Payments] getProviders error:', err.message);
    res.status(500).json({ error: 'Failed to load payment providers' });
  }
}

async function initializeCheckout(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      purpose,
      provider = 'paystack',
      return_url,
      planId,
      billingCycle = 'monthly',
      amount_ngn,
      balanceType = 'ngn',
    } = req.body;

    const providers = await PaymentService.getAvailableProviders();
    const selectedProvider = providers.find((item) => item.id === provider);
    if (!selectedProvider) {
      return res.status(400).json({ error: 'Unsupported payment provider' });
    }
    if (!selectedProvider.enabled) {
      return res.status(400).json({ error: `${selectedProvider.label} is not configured in admin settings` });
    }

    let payment;

    if (purpose === 'platform_plan') {
      const plan = Plan.findById(planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      const eligibilityError = getPlanEligibilityError(user, plan);
      if (eligibilityError) {
        return res.status(400).json({ error: eligibilityError });
      }
      if (plan.price <= 0) {
        return res.status(400).json({ error: 'Free plans do not require checkout' });
      }
      if (billingCycle === 'yearly' && (!plan.yearly_price || plan.type !== 'viewer')) {
        return res.status(400).json({ error: 'Yearly billing is not available for this plan' });
      }

      const chargeAmount = Number(
        billingCycle === 'yearly' ? plan.yearly_price : plan.price,
      );

      payment = await Payment.create({
        uid: req.userId,
        purpose,
        provider,
        amount_ngn: chargeAmount,
        currency: 'NGN',
        plan_id: plan.id,
        billing_cycle: billingCycle,
        meta: {
          plan_name: plan.name,
          plan_type: plan.type,
        },
      });
    } else if (purpose === 'wallet_topup') {
      const parsedAmount = Number(amount_ngn || 0);
      if (!['ngn', 'vpt'].includes(balanceType)) {
        return res.status(400).json({ error: 'balanceType must be ngn or vpt' });
      }
      if (!Number.isFinite(parsedAmount) || parsedAmount < 100) {
        return res.status(400).json({ error: 'Top-up amount must be at least ₦100' });
      }
      if (parsedAmount > 5000000) {
        return res.status(400).json({ error: 'Top-up amount exceeds the ₦5,000,000 limit' });
      }

      payment = await Payment.create({
        uid: req.userId,
        purpose,
        provider,
        amount_ngn: parsedAmount,
        currency: 'NGN',
        balance_type: balanceType,
      });
    } else {
      return res.status(400).json({ error: 'Unsupported checkout purpose' });
    }

    const gateway = await PaymentService.initializeCheckout(payment, user, return_url);
    const updated = await Payment.update(payment.id, {
      reference: gateway.reference,
      checkout_url: gateway.checkout_url,
      status: 'initialized',
      error: null,
    });

    res.status(201).json({ payment: serializePayment(updated) });
  } catch (err) {
    console.error('[Payments] initializeCheckout error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to initialize checkout' });
  }
}

async function verifyCheckout(req, res) {
  try {
    const payment = Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.uid !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to verify this payment' });
    }

    const verified = await PaymentService.verifyAndApply(payment);
    const payload = await PaymentService.getVerificationPayload(verified);

    res.json({
      payment: serializePayment(payload.payment),
      user: payload.user,
      wallet: payload.wallet,
      plan: payload.plan,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[Payments] verifyCheckout error:', err.message);
    res.status(statusCode).json({ error: err.message || 'Failed to verify checkout' });
  }
}

module.exports = {
  getProviders,
  initializeCheckout,
  verifyCheckout,
};
