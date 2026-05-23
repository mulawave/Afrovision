/**
 * AV-CHL-010 QA tests for paid audition signup flow.
 * Run: node test/audition-signup-qa.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  + ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  - ${name}: ${err.message}`);
  }
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function withMock(modulePath, exportsValue, originals) {
  originals.set(modulePath, require.cache[modulePath]);
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function restoreMocks(originals, servicePath) {
  clearModule(servicePath);
  for (const [modPath, original] of originals.entries()) {
    if (original) require.cache[modPath] = original;
    else delete require.cache[modPath];
  }
}

function makeAuditionPaymentHarness({ emailShouldFail = false } = {}) {
  const originals = new Map();

  const settingsPath = require.resolve('../src/admin/settings.service');
  const paymentModelPath = require.resolve('../src/payments/payment.model');
  const paymentServicePath = require.resolve('../src/payments/payment.service');
  const signupModelPath = require.resolve('../src/challenge/audition_signup.model');
  const walletPath = require.resolve('../src/interactions/gift-wallet.model');
  const ledgerPath = require.resolve('../src/vpt/ledger.model');
  const poolPath = require.resolve('../src/vpt/pool.service');
  const smtpPath = require.resolve('../src/admin/smtp.service');
  const targetPath = require.resolve('../src/challenge/audition_payment.service');

  const state = {
    payments: new Map(),
    signups: new Map(),
    paymentSeq: 0,
    signupSeq: 0,
    walletCredits: 0,
    ledgerEntries: 0,
    communityCredits: 0,
    opsCredits: 0,
    emailSends: 0,
  };

  const SettingsService = {
    getNumber: async (key) => (key === 'VPT_PRICE_NGN' ? 500 : null),
  };

  const PaymentModel = {
    create: async (data) => {
      state.paymentSeq += 1;
      const id = `pay_${state.paymentSeq}`;
      const payment = {
        id,
        uid: data.uid,
        purpose: data.purpose,
        provider: data.provider,
        amount_ngn: data.amount_ngn,
        currency: data.currency,
        meta: data.meta || {},
        status: 'created',
        reference: null,
      };
      state.payments.set(id, payment);
      return { ...payment };
    },
    update: async (id, fields) => {
      const current = state.payments.get(id);
      const next = { ...current, ...fields };
      state.payments.set(id, next);
      return { ...next };
    },
    findById: async (id) => {
      const p = state.payments.get(id);
      return p ? { ...p } : null;
    },
    findByReference: async (reference) => {
      for (const payment of state.payments.values()) {
        if (payment.reference === reference) return { ...payment };
      }
      return null;
    },
  };

  const PaymentService = {
    initializeCheckout: async (payment) => ({
      reference: `ref_${payment.id}`,
      checkout_url: `https://checkout.test/${payment.id}`,
    }),
    verifyGatewayPayment: async (payment) => {
      if (payment.meta && payment.meta.force_unpaid) {
        return {
          paid: false,
          raw_status: 'failed',
          raw_message: 'card_declined',
          amount_ngn: 0,
          provider_payment_id: null,
        };
      }

      return {
        paid: true,
        raw_status: 'success',
        raw_message: 'paid',
        amount_ngn: 2500,
        provider_payment_id: `prov_${payment.id}`,
      };
    },
  };

  const AuditionSignupModel = {
    PAYMENT_STATUSES: ['pending', 'paid', 'failed'],
    SIGNUP_STATUSES: ['pending_payment', 'enrolled', 'cancelled'],
    createSignup: async (data) => {
      state.signupSeq += 1;
      const id = `as_${state.signupSeq}`;
      const now = new Date().toISOString();
      const row = {
        id,
        challenge_id: data.challenge_id,
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        payment_reference: null,
        payment_status: 'pending',
        payment_amount_ngn: 2500,
        vpt_price_at_signup: data.vpt_price_at_signup,
        vpt_allocated: data.vpt_allocated,
        community_pool_allocated: data.community_pool_allocated,
        ops_pool_allocated: data.ops_pool_allocated,
        vpt_credited: false,
        allocation_tx_id: null,
        signup_status: 'pending_payment',
        enrolled_at: null,
        cancelled_at: null,
        cancel_reason: null,
        email_sent: false,
        email_sent_at: null,
        email_error: null,
        email_retry_count: 0,
        email_last_attempt_at: null,
        consent_marketing: false,
        campaign_tags: [],
        created_at: now,
        updated_at: now,
      };
      state.signups.set(id, row);
      return { ...row };
    },
    getSignupById: async (id) => {
      const row = state.signups.get(id);
      return row ? { ...row } : null;
    },
    getSignupByUserId: async (challengeId, userId) => {
      const all = [...state.signups.values()].filter((s) => s.challenge_id === challengeId && s.user_id === userId);
      if (!all.length) return null;
      return { ...all[all.length - 1] };
    },
    updateSignup: async (id, fields) => {
      const current = state.signups.get(id);
      if (!current) return null;
      const next = { ...current, ...fields, updated_at: new Date().toISOString() };
      state.signups.set(id, next);
      return { ...next };
    },
    enrollSignup: async (id, paymentData) => {
      const current = state.signups.get(id);
      if (!current) return null;
      if (current.signup_status === 'enrolled') return { ...current };
      const next = {
        ...current,
        payment_status: 'paid',
        payment_reference: paymentData.payment_reference || current.payment_reference,
        signup_status: 'enrolled',
        enrolled_at: new Date().toISOString(),
        vpt_price_at_signup: paymentData.vpt_price_at_signup,
        vpt_allocated: paymentData.vpt_allocated,
        community_pool_allocated: paymentData.community_pool_allocated,
        ops_pool_allocated: paymentData.ops_pool_allocated,
        updated_at: new Date().toISOString(),
      };
      state.signups.set(id, next);
      return { ...next };
    },
    cancelSignup: async (id, reason) => {
      const current = state.signups.get(id);
      if (!current) return null;
      const next = {
        ...current,
        payment_status: 'failed',
        signup_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || null,
        updated_at: new Date().toISOString(),
      };
      state.signups.set(id, next);
      return { ...next };
    },
    listSignups: async ({ payment_status, signup_status, search, challenge_id, email_sent }) => {
      let rows = [...state.signups.values()];
      if (challenge_id) rows = rows.filter((r) => r.challenge_id === challenge_id);
      if (payment_status) rows = rows.filter((r) => r.payment_status === payment_status);
      if (signup_status) rows = rows.filter((r) => r.signup_status === signup_status);
      if (email_sent !== undefined) rows = rows.filter((r) => !!r.email_sent === !!email_sent);
      if (search) {
        const q = String(search).toLowerCase();
        rows = rows.filter((r) => [r.email, r.name, r.payment_reference].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
      }
      return { items: rows, total: rows.length };
    },
  };

  const GiftWallet = {
    ensureWallet: async () => {},
    adjustVptUnits: async () => {
      state.walletCredits += 1;
    },
  };

  const Ledger = {
    create: async () => {
      state.ledgerEntries += 1;
    },
  };

  const PoolService = {
    creditPool: async () => {
      state.communityCredits += 1;
    },
    creditOperationsPool: async () => {
      state.opsCredits += 1;
    },
  };

  const SmtpService = {
    sendAuditionSignupAcknowledgementEmail: async () => {
      state.emailSends += 1;
      if (emailShouldFail) {
        throw new Error('smtp_down');
      }
      return { messageId: 'msg_1', accepted: ['ok'] };
    },
  };

  withMock(settingsPath, SettingsService, originals);
  withMock(paymentModelPath, PaymentModel, originals);
  withMock(paymentServicePath, PaymentService, originals);
  withMock(signupModelPath, AuditionSignupModel, originals);
  withMock(walletPath, GiftWallet, originals);
  withMock(ledgerPath, Ledger, originals);
  withMock(poolPath, PoolService, originals);
  withMock(smtpPath, SmtpService, originals);

  clearModule(targetPath);
  const service = require('../src/challenge/audition_payment.service');

  return {
    service,
    state,
    async createInitializedPayment({ forceUnpaid = false } = {}) {
      const init = await service.initiateSignupPayment({
        userId: 'u_1',
        user: { id: 'u_1', email: 'qa@example.com', name: 'QA User' },
        challengeId: 'ch_1',
        challengeTitle: 'The Amazons',
        provider: 'paystack',
      });

      if (forceUnpaid) {
        const payment = state.payments.get(init.payment_id);
        payment.meta = { ...payment.meta, force_unpaid: true };
        state.payments.set(payment.id, payment);
      }

      return init;
    },
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

function makeAdminControllerHarness() {
  const originals = new Map();

  const signupModelPath = require.resolve('../src/challenge/audition_signup.model');
  const challengeModelPath = require.resolve('../src/challenge/challenge.model');
  const userModelPath = require.resolve('../src/users/user.model');
  const targetPath = require.resolve('../src/challenge/audition_signup.controller');

  let capturedOpts = null;

  const AuditionSignupModel = {
    PAYMENT_STATUSES: ['pending', 'paid', 'failed'],
    SIGNUP_STATUSES: ['pending_payment', 'enrolled', 'cancelled'],
    listSignups: async (opts) => {
      capturedOpts = { ...opts };
      return { items: [{ id: 'as_1' }], total: 1 };
    },
  };

  withMock(signupModelPath, AuditionSignupModel, originals);
  withMock(challengeModelPath, {}, originals);
  withMock(userModelPath, {}, originals);

  clearModule(targetPath);
  const controller = require('../src/challenge/audition_signup.controller');

  return {
    controller,
    getCapturedOpts: () => capturedOpts,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

(async function run() {
  console.log('\n-- AV-CHL-010 Audition Signup QA Tests --\n');

  await test('success flow enrolls user, allocates once, and marks email sent', async () => {
    const h = makeAuditionPaymentHarness();
    try {
      const init = await h.createInitializedPayment();
      const result = await h.service.confirmSignupPayment(init.payment_id, 'u_1');

      assert(result.signup.signup_status === 'enrolled', 'signup should be enrolled');
      assert(result.signup.payment_status === 'paid', 'payment status should be paid');
      assert(result.signup.vpt_credited === true, 'vpt_credited should be true');
      assert(result.signup.email_sent === true, 'email_sent should be true');
      assert(Number(result.signup.email_retry_count) === 1, 'email_retry_count should be 1');
      assert(h.state.walletCredits === 1, 'wallet should be credited once');
      assert(h.state.communityCredits === 1, 'community pool should be credited once');
      assert(h.state.opsCredits === 1, 'ops pool should be credited once');
      assert(h.state.ledgerEntries === 3, 'should emit three ledger entries');
      assert(h.state.emailSends === 1, 'should send one acknowledgement email');
    } finally {
      h.teardown();
    }
  });

  await test('failure path cancels signup and does not allocate funds', async () => {
    const h = makeAuditionPaymentHarness();
    try {
      const init = await h.createInitializedPayment({ forceUnpaid: true });
      const result = await h.service.confirmSignupPayment(init.payment_id, 'u_1');

      assert(result.signup.signup_status === 'cancelled', 'signup should be cancelled');
      assert(result.signup.payment_status === 'failed', 'payment should be failed');
      assert(result.signup.vpt_credited === false, 'vpt_credited should remain false');
      assert(h.state.walletCredits === 0, 'wallet must not be credited');
      assert(h.state.communityCredits === 0, 'community pool must not be credited');
      assert(h.state.opsCredits === 0, 'ops pool must not be credited');
      assert(h.state.emailSends === 0, 'email should not be sent on failure');
    } finally {
      h.teardown();
    }
  });

  await test('duplicate callback is idempotent and does not double reward', async () => {
    const h = makeAuditionPaymentHarness();
    try {
      const init = await h.createInitializedPayment();
      await h.service.confirmSignupPayment(init.payment_id, 'u_1');
      const second = await h.service.confirmSignupPayment(init.payment_id, 'u_1');

      assert(second.signup.signup_status === 'enrolled', 'signup should remain enrolled');
      assert(h.state.walletCredits === 1, 'wallet credit should remain single');
      assert(h.state.communityCredits === 1, 'community pool credit should remain single');
      assert(h.state.opsCredits === 1, 'ops pool credit should remain single');
      assert(h.state.ledgerEntries === 3, 'ledger entries should remain single batch');
      assert(h.state.emailSends === 1, 'email should not be resent after sent');
    } finally {
      h.teardown();
    }
  });

  await test('email send failure does not invalidate successful enrollment', async () => {
    const h = makeAuditionPaymentHarness({ emailShouldFail: true });
    try {
      const init = await h.createInitializedPayment();
      const result = await h.service.confirmSignupPayment(init.payment_id, 'u_1');

      assert(result.signup.signup_status === 'enrolled', 'signup should still be enrolled');
      assert(result.signup.payment_status === 'paid', 'payment should remain paid');
      assert(result.signup.email_sent === false, 'email_sent should be false on smtp error');
      assert(Number(result.signup.email_retry_count) === 1, 'retry count should increment');
      assert(typeof result.signup.email_error === 'string' && result.signup.email_error.length > 0, 'email_error should be captured');
    } finally {
      h.teardown();
    }
  });

  await test('admin list supports challenge/status/search/email_sent filtering inputs', async () => {
    const h = makeAdminControllerHarness();
    try {
      const req = {
        userRole: 'admin',
        query: {
          challenge_id: 'ch_1',
          payment_status: 'paid',
          signup_status: 'enrolled',
          email_sent: 'false',
          search: 'qa@example.com',
          limit: '25',
          offset: '5',
        },
      };
      let statusCode = 200;
      let payload = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          payload = body;
        },
      };

      await h.controller.adminListSignups(req, res);

      const opts = h.getCapturedOpts();
      assert(statusCode === 200, 'admin list should respond 200');
      assert(payload && payload.total === 1, 'admin list should return result payload');
      assert(opts.challenge_id === 'ch_1', 'challenge filter should be forwarded');
      assert(opts.payment_status === 'paid', 'payment filter should be forwarded');
      assert(opts.signup_status === 'enrolled', 'signup filter should be forwarded');
      assert(opts.email_sent === false, 'email_sent filter should parse boolean false');
      assert(opts.search === 'qa@example.com', 'search filter should be forwarded');
      assert(opts.limit === 25, 'limit should parse to number');
      assert(opts.offset === 5, 'offset should parse to number');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
