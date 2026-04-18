const Payment = require('./payment.model');
const Plan = require('../subscriptions/plan.model');
const GiftWallet = require('../interactions/gift-wallet.model');
const Ledger = require('../vpt/ledger.model');
const SettingsService = require('../admin/settings.service');
const User = require('../users/user.model');
const { activatePlatformPlan } = require('../subscriptions/subscription.controller');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';
const DEFAULT_WEBSITE_URL =
  process.env.WEBSITE_URL ||
  'https://afrovision-website-134538542038.us-central1.run.app';

async function getSettingOrEnv(key, envKeys = []) {
  try {
    const value = await SettingsService.get(key);
    if (value) return value;
  } catch (_) {
    // Fall through to env vars.
  }

  for (const envKey of envKeys) {
    if (process.env[envKey]) return process.env[envKey];
  }

  return null;
}

async function getAvailableProviders() {
  const [paystackSecret, flutterwaveSecret] = await Promise.all([
    getSettingOrEnv('PAYSTACK_SECRET_KEY', ['PAYSTACK_SECRET_KEY']),
    getSettingOrEnv('FLUTTERWAVE_SECRET_KEY', ['FLUTTERWAVE_SECRET_KEY']),
  ]);

  return [
    {
      id: 'paystack',
      label: 'Paystack',
      enabled: Boolean(paystackSecret),
    },
    {
      id: 'flutterwave',
      label: 'Flutterwave',
      enabled: Boolean(flutterwaveSecret),
    },
  ];
}

async function requireProviderSecret(provider) {
  if (provider === 'paystack') {
    const secret = await getSettingOrEnv('PAYSTACK_SECRET_KEY', ['PAYSTACK_SECRET_KEY']);
    if (!secret) {
      throw new Error('Paystack is not configured in Admin settings');
    }
    return secret;
  }

  if (provider === 'flutterwave') {
    const secret = await getSettingOrEnv('FLUTTERWAVE_SECRET_KEY', ['FLUTTERWAVE_SECRET_KEY']);
    if (!secret) {
      throw new Error('Flutterwave is not configured in Admin settings');
    }
    return secret;
  }

  throw new Error('Unsupported payment provider');
}

function buildReturnUrl(baseUrl, paymentId) {
  const fallback = `${DEFAULT_WEBSITE_URL}/checkout/result?payment_id=${encodeURIComponent(paymentId)}`;
  if (!baseUrl) return fallback;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('payment_id', paymentId);
    return url.toString();
  } catch (_) {
    return fallback;
  }
}

async function requestJson(baseUrl, path, secret, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || 'Payment provider request failed');
  }

  return payload.data;
}

async function initializeCheckout(payment, user, returnUrl) {
  const provider = payment.provider;
  const secret = await requireProviderSecret(provider);
  const callbackUrl = buildReturnUrl(returnUrl, payment.id);
  const email = user.email || `${user.id}@afrovision.local`;
  const name = user.name || user.email || 'AfroVision User';

  if (provider === 'paystack') {
    const data = await requestJson(PAYSTACK_BASE_URL, '/transaction/initialize', secret, {
      method: 'POST',
      body: {
        email,
        amount: Math.round(payment.amount_ngn * 100),
        reference: payment.id,
        callback_url: callbackUrl,
        metadata: {
          payment_id: payment.id,
          purpose: payment.purpose,
          balance_type: payment.balance_type,
          plan_id: payment.plan_id,
          billing_cycle: payment.billing_cycle,
          user_id: user.id,
        },
      },
    });

    return {
      reference: data.reference,
      checkout_url: data.authorization_url,
    };
  }

  if (provider === 'flutterwave') {
    const data = await requestJson(FLUTTERWAVE_BASE_URL, '/payments', secret, {
      method: 'POST',
      body: {
        tx_ref: payment.id,
        amount: payment.amount_ngn,
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email,
          name,
        },
        customizations: {
          title: 'AfroVision Checkout',
          description:
            payment.purpose === 'platform_plan'
              ? 'Platform subscription checkout'
              : 'Gift wallet top-up',
        },
        meta: {
          payment_id: payment.id,
          purpose: payment.purpose,
          balance_type: payment.balance_type,
          plan_id: payment.plan_id,
          billing_cycle: payment.billing_cycle,
          user_id: user.id,
        },
      },
    });

    return {
      reference: payment.id,
      checkout_url: data.link,
    };
  }

  throw new Error('Unsupported payment provider');
}

async function verifyGatewayPayment(payment) {
  const provider = payment.provider;
  const secret = await requireProviderSecret(provider);

  if (provider === 'paystack') {
    const data = await requestJson(
      PAYSTACK_BASE_URL,
      `/transaction/verify/${encodeURIComponent(payment.reference)}`,
      secret,
    );

    return {
      paid: data.status === 'success',
      amount_ngn: Number(data.amount || 0) / 100,
      provider_payment_id: data.id ? String(data.id) : null,
      raw_status: data.status || 'pending',
      raw_message: data.gateway_response || data.message || null,
    };
  }

  if (provider === 'flutterwave') {
    const data = await requestJson(
      FLUTTERWAVE_BASE_URL,
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.reference)}`,
      secret,
    );
    const rawStatus = String(data.status || '').toLowerCase();

    return {
      paid: rawStatus === 'successful',
      amount_ngn: Number(data.amount || 0),
      provider_payment_id: data.id ? String(data.id) : data.flw_ref || null,
      raw_status: rawStatus || 'pending',
      raw_message: data.processor_response || data.narration || null,
    };
  }

  throw new Error('Unsupported payment provider');
}

function amountsMatch(expectedAmount, actualAmount) {
  return Math.abs(Number(expectedAmount || 0) - Number(actualAmount || 0)) <= 1;
}

async function applyWalletTopup(payment) {
  if (payment.balance_type === 'vpt') {
    const vptPrice = (await SettingsService.getNumber('VPT_PRICE_NGN')) || 750;
    const units = parseFloat((payment.amount_ngn / vptPrice).toFixed(4));
    await GiftWallet.ensureWallet(payment.uid);
    await GiftWallet.adjustVptUnits(payment.uid, units);
    await Ledger.create({
      uid: payment.uid,
      type: 'WALLET_TOPUP',
      direction: 'credit',
      currency: 'vpt',
      amount_vpt_units: units,
      amount_ngn: payment.amount_ngn,
      status: 'success',
      reference_id: payment.id,
      meta: {
        provider: payment.provider,
        balance_type: 'vpt',
        vpt_price_ngn: vptPrice,
      },
      description: `Gift wallet vPT top-up via ${payment.provider}`,
    });
    return;
  }

  await GiftWallet.ensureWallet(payment.uid);
  await GiftWallet.adjustNgnBalance(payment.uid, payment.amount_ngn);
  await Ledger.create({
    uid: payment.uid,
    type: 'WALLET_TOPUP',
    direction: 'credit',
    currency: 'ngn',
    amount_ngn: payment.amount_ngn,
    status: 'success',
    reference_id: payment.id,
    meta: {
      provider: payment.provider,
      balance_type: 'ngn',
    },
    description: `Gift wallet NGN top-up via ${payment.provider}`,
  });
}

async function applySuccessfulPayment(payment) {
  if (payment.applied_at) {
    return payment;
  }

  if (payment.purpose === 'platform_plan') {
    await activatePlatformPlan({
      userId: payment.uid,
      planId: payment.plan_id,
      billingCycle: payment.billing_cycle || 'monthly',
      paymentMethod: payment.provider,
      amountNgn: payment.amount_ngn,
      referenceId: payment.id,
    });
  } else if (payment.purpose === 'wallet_topup') {
    await applyWalletTopup(payment);
  } else {
    throw new Error('Unsupported payment purpose');
  }

  return Payment.update(payment.id, {
    applied_at: Date.now(),
    status: 'paid',
    error: null,
  });
}

async function verifyAndApply(payment) {
  const existing = Payment.findById(payment.id);
  if (!existing) {
    const error = new Error('Payment not found');
    error.statusCode = 404;
    throw error;
  }

  if (existing.applied_at) {
    return existing;
  }

  const verification = await verifyGatewayPayment(existing);

  if (!verification.paid) {
    await Payment.update(existing.id, {
      status: verification.raw_status === 'failed' ? 'failed' : 'pending',
      raw_status: verification.raw_status,
      error: verification.raw_message,
    });

    const error = new Error(
      verification.raw_status === 'failed'
        ? 'Payment failed at the gateway'
        : 'Payment is not completed yet',
    );
    error.statusCode = verification.raw_status === 'failed' ? 402 : 409;
    throw error;
  }

  if (!amountsMatch(existing.amount_ngn, verification.amount_ngn)) {
    await Payment.update(existing.id, {
      status: 'failed',
      raw_status: verification.raw_status,
      error: 'Amount mismatch during verification',
    });
    const error = new Error('Verified payment amount did not match the expected amount');
    error.statusCode = 400;
    throw error;
  }

  const verifiedPayment = await Payment.update(existing.id, {
    status: 'paid',
    verified_at: Date.now(),
    provider_payment_id: verification.provider_payment_id,
    raw_status: verification.raw_status,
    error: null,
  });

  return applySuccessfulPayment(verifiedPayment);
}

async function getVerificationPayload(payment) {
  const user = User.findById(payment.uid);
  const wallet = await GiftWallet.ensureWallet(payment.uid);
  const plan = payment.plan_id ? Plan.findById(payment.plan_id) : null;
  const safeUser = user ? User.toSafeUser(user) : null;

  return {
    payment,
    user: safeUser,
    wallet: {
      vpt: safeUser?.vpt ?? wallet.vpt_units,
      cash: safeUser?.cash ?? wallet.ngn_balance,
      coins: safeUser?.coins ?? 0,

      // Backward compatibility for older clients.
      vpt_units: wallet.vpt_units,
      ngn_balance: wallet.ngn_balance,
    },
    plan,
  };
}

module.exports = {
  getAvailableProviders,
  initializeCheckout,
  verifyAndApply,
  getVerificationPayload,
};
