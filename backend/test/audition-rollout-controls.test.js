/**
 * AV-CHL-011 rollout control tests.
 * Run: node test/audition-rollout-controls.test.js
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

function buildHarness({ signupEnabled = 'true' } = {}) {
  const originals = new Map();

  const userPath = require.resolve('../src/users/user.model');
  const challengePath = require.resolve('../src/challenge/challenge.model');
  const paymentServicePath = require.resolve('../src/challenge/audition_payment.service');
  const providerServicePath = require.resolve('../src/payments/payment.service');
  const paymentModelPath = require.resolve('../src/payments/payment.model');
  const settingsPath = require.resolve('../src/admin/settings.service');
  const controllerPath = require.resolve('../src/challenge/audition_payment.controller');

  withMock(settingsPath, {
    get: async (key) => (key === 'AUDITION_SIGNUP_ENABLED' ? signupEnabled : null),
  }, originals);

  withMock(userPath, {
    findById: async () => ({ id: 'u1', email: 'qa@example.com', name: 'QA' }),
  }, originals);

  withMock(challengePath, {
    findById: async () => ({ id: 'ch1', title: 'The Amazons', status: 'audition' }),
  }, originals);

  withMock(providerServicePath, {
    getAvailableProviders: async () => [{ id: 'paystack', label: 'Paystack', enabled: true }],
  }, originals);

  withMock(paymentModelPath, {}, originals);

  withMock(paymentServicePath, {
    initiateSignupPayment: async () => ({
      signup_id: 'as_1',
      payment_id: 'pay_1',
      payment_reference: 'ref_1',
      checkout_url: 'https://checkout.test/1',
      fee_ngn: 2500,
      allocations: { vpt_price_at_signup: 500, vpt_allocated: 2, community_pool_allocated: 1, ops_pool_allocated: 2 },
    }),
  }, originals);

  clearModule(controllerPath);
  const controller = require('../src/challenge/audition_payment.controller');

  return {
    controller,
    teardown() {
      restoreMocks(originals, controllerPath);
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

(async function run() {
  console.log('\n-- AV-CHL-011 Rollout Control Tests --\n');

  await test('initialization is blocked when AUDITION_SIGNUP_ENABLED=false', async () => {
    const h = buildHarness({ signupEnabled: 'false' });
    try {
      const req = {
        userId: 'u1',
        body: { challenge_id: 'ch1', provider: 'paystack' },
      };
      const res = makeRes();
      await h.controller.initializeAuditionPayment(req, res);
      assert(res.statusCode === 503, 'expected 503 while disabled');
      assert(res.payload && res.payload.code === 'AUDITION_SIGNUP_DISABLED', 'expected disabled error code');
    } finally {
      h.teardown();
    }
  });

  await test('initialization proceeds when AUDITION_SIGNUP_ENABLED=true', async () => {
    const h = buildHarness({ signupEnabled: 'true' });
    try {
      const req = {
        userId: 'u1',
        body: { challenge_id: 'ch1', provider: 'paystack' },
      };
      const res = makeRes();
      await h.controller.initializeAuditionPayment(req, res);
      assert(res.statusCode === 201, 'expected 201 while enabled');
      assert(res.payload && res.payload.payment_id === 'pay_1', 'expected initialized payload');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
