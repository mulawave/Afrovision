/**
 * AV-EXC-082 security hardening tests (bypass, brute force, replay/idempotency abuse).
 * Run: node test/exclusive-security-abuse.test.js
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

function restoreMocks(originals, targetPath) {
  clearModule(targetPath);
  for (const [modPath, original] of originals.entries()) {
    if (original) require.cache[modPath] = original;
    else delete require.cache[modPath];
  }
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

function withFrozenNow(nowMs, fn) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Date.now = originalNow;
    });
}

function buildHarness() {
  const originals = new Map();

  const channelPath = require.resolve('../src/channels/channel.model');
  const userPath = require.resolve('../src/users/user.model');
  const policyPath = require.resolve('../src/channels/exclusive_policy.service');
  const accessPath = require.resolve('../src/channels/exclusive_access.model');
  const walletPath = require.resolve('../src/interactions/gift-wallet.model');
  const ledgerPath = require.resolve('../src/vpt/ledger.model');
  const poolPath = require.resolve('../src/vpt/pool.service');
  const referralPath = require.resolve('../src/referrals/referral.model');
  const notificationPath = require.resolve('../src/notifications/notification.service');
  const emailPath = require.resolve('../src/utils/email');
  const auditPath = require.resolve('../src/admin/audit.service');
  const firestorePath = require.resolve('../src/utils/firestore');
  const rolloutServicePath = require.resolve('../src/channels/exclusive_rollout.service');
  const targetPath = require.resolve('../src/channels/exclusive_channel.controller');

  const state = {
    channels: {
      ch_exclusive: {
        id: 'ch_exclusive',
        name: 'Security Vault',
        type: 'exclusive',
        owner_id: 'owner_1',
        exclusive_monthly_fee_ngn: 3000,
      },
    },
    users: {
      owner_1: { id: 'owner_1', role: 'creator', email: 'owner@example.com' },
      user_nonkyc: { id: 'user_nonkyc', role: 'viewer', email: 'nonkyc@example.com' },
      user_kyc: { id: 'user_kyc', role: 'viewer', email: 'kyc@example.com' },
    },
    eligibleKyc: new Set(['user_kyc']),
    wallets: {
      owner_1: { uid: 'owner_1', ngn_balance: 0, vpt_units: 0 },
      user_nonkyc: { uid: 'user_nonkyc', ngn_balance: 10000, vpt_units: 0 },
      user_kyc: { uid: 'user_kyc', ngn_balance: 20000, vpt_units: 0 },
    },
    accesses: {},
    accessSeq: 0,
    notifications: [],
    emails: [],
    ledger: [],
    auditLogs: [],
    firestoreCollections: new Map(),
  };

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function ensureCollection(name) {
    if (!state.firestoreCollections.has(name)) {
      state.firestoreCollections.set(name, new Map());
    }
    return state.firestoreCollections.get(name);
  }

  function makeDocRef(collectionName, docId) {
    return {
      collectionName,
      docId,
      async get() {
        const col = ensureCollection(collectionName);
        const value = col.get(docId);
        return {
          exists: value !== undefined,
          data: () => clone(value),
        };
      },
      async set(payload, options = {}) {
        const col = ensureCollection(collectionName);
        if (options && options.merge) {
          const current = col.get(docId) || {};
          col.set(docId, { ...current, ...clone(payload) });
        } else {
          col.set(docId, clone(payload));
        }
      },
    };
  }

  const FirestoreMock = {
    getFirestore: () => ({
      collection: (name) => ({
        doc: (docId) => makeDocRef(name, docId),
      }),
      runTransaction: async (handler) => {
        const queuedWrites = [];
        const tx = {
          get: (ref) => ref.get(),
          set: (ref, payload, options) => {
            queuedWrites.push(() => ref.set(payload, options));
          },
        };

        const result = await handler(tx);
        for (const write of queuedWrites) {
          await write();
        }
        return result;
      },
    }),
  };

  function getLatestAccessFor(userUid, channelId) {
    const rows = Object.values(state.accesses)
      .filter((entry) => entry.user_uid === userUid && entry.channel_id === channelId)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return rows[0] || null;
  }

  function getActiveAccessFor(userUid, channelId) {
    const now = Date.now();
    const rows = Object.values(state.accesses)
      .filter((entry) => entry.user_uid === userUid
        && entry.channel_id === channelId
        && entry.status === 'active'
        && Number(entry.expires_at || 0) > now)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return rows[0] || null;
  }

  withMock(channelPath, {
    findById: async (id) => clone(state.channels[id] || null),
    updateExclusiveSettings: async (id, fields) => ({ ...clone(state.channels[id]), ...clone(fields) }),
  }, originals);

  withMock(userPath, {
    findById: async (id) => clone(state.users[id] || null),
    findCachedById: () => null,
  }, originals);

  withMock(policyPath, {
    isAdultKycVerified: async (userId) => state.eligibleKyc.has(userId),
  }, originals);

  withMock(accessPath, {
    findLatestByUserAndChannel: async (userUid, channelId) => clone(getLatestAccessFor(userUid, channelId)),
    findActiveByUserAndChannel: async (userUid, channelId) => clone(getActiveAccessFor(userUid, channelId)),
    grantOrRenew: async ({ userUid, channelId, picHash, sourcePaymentId, monthlyFeeNgn }) => {
      const now = Date.now();
      const existing = getLatestAccessFor(userUid, channelId);
      const id = existing ? existing.id : `acc_${++state.accessSeq}`;
      const row = {
        id,
        user_uid: userUid,
        channel_id: channelId,
        pic_hash: picHash,
        source_payment_id: sourcePaymentId,
        monthly_fee_ngn: Number(monthlyFeeNgn || 0),
        status: 'active',
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        expires_at: now + (30 * 24 * 60 * 60 * 1000),
      };
      state.accesses[id] = row;
      return clone(row);
    },
  }, originals);

  withMock(walletPath, {
    ensureWallet: async (uid) => clone(state.wallets[uid]),
    adjustNgnBalance: async (uid, delta) => {
      state.wallets[uid].ngn_balance += Number(delta || 0);
      return clone(state.wallets[uid]);
    },
    adjustVptUnits: async (uid, units) => {
      state.wallets[uid].vpt_units += Number(units || 0);
      return clone(state.wallets[uid]);
    },
  }, originals);

  withMock(ledgerPath, {
    create: async (entry) => {
      state.ledger.push(clone(entry));
      return clone(entry);
    },
  }, originals);

  withMock(poolPath, {
    creditPool: async () => {},
    creditOperationsPool: async () => {},
    creditRbdPool: async () => {},
  }, originals);

  withMock(referralPath, {
    VPT_PRICE_NGN: 500,
    LEVEL_DISTRIBUTION: [0.5, 0.2, 0.15, 0.1, 0.05],
    resolveTree: async () => [],
    recordEarning: async () => {},
  }, originals);

  withMock(notificationPath, {
    notifyUser: async (userId, payload) => {
      state.notifications.push({ userId, payload: clone(payload) });
      return { successCount: 1, failureCount: 0 };
    },
  }, originals);

  withMock(emailPath, {
    sendExclusiveLifecycleEmail: async (payload) => {
      state.emails.push(clone(payload));
      return true;
    },
  }, originals);

  withMock(rolloutServicePath, {
    isExclusiveRolloutEnabledForUser: async () => true,
  }, originals);

  withMock(auditPath, {
    logAction: async (adminUid, action, targetId, meta) => {
      state.auditLogs.push({ adminUid, action, targetId, meta: clone(meta) });
      return true;
    },
  }, originals);

  withMock(firestorePath, FirestoreMock, originals);

  clearModule(targetPath);
  const controller = require('../src/channels/exclusive_channel.controller');

  return {
    controller,
    state,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

(async function run() {
  console.log('\n-- AV-EXC-082 Security Abuse Tests --\n');

  await test('bypass attempt: non-KYC user cannot purchase exclusive access', async () => {
    const h = buildHarness();
    try {
      const res = makeRes();
      await h.controller.purchaseExclusiveAccess({
        userId: 'user_nonkyc',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: {},
      }, res);

      assert(res.statusCode === 403, 'non-kyc purchase should be forbidden');
      assert(String(res.payload.error || '').toLowerCase().includes('kyc'), 'expected kyc error');
    } finally {
      h.teardown();
    }
  });

  await test('brute force: repeated invalid PIC attempts trigger lockout (429)', async () => {
    process.env.EXCLUSIVE_PIC_MAX_FAILED_ATTEMPTS = '3';
    process.env.EXCLUSIVE_PIC_LOCKOUT_MS = String(2 * 60 * 1000);

    const h = buildHarness();
    try {
      const purchaseRes = makeRes();
      await h.controller.purchaseExclusiveAccess({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: {},
      }, purchaseRes);
      assert(purchaseRes.statusCode === 200, 'purchase setup should succeed');

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const invalidRes = makeRes();
        await h.controller.verifyExclusivePic({
          userId: 'user_kyc',
          params: { id: 'ch_exclusive' },
          body: { pic: `WRONG${attempt}` },
        }, invalidRes);
        assert(invalidRes.statusCode === 403, `attempt ${attempt} should be 403 before lock`);
      }

      const lockRes = makeRes();
      await h.controller.verifyExclusivePic({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: { pic: 'STILLWRONG' },
      }, lockRes);
      assert(lockRes.statusCode === 429, 'threshold attempt should lock and return 429');
      assert(Number(lockRes.payload.retry_after_seconds || 0) > 0, 'retry_after_seconds must be present');

      const lockedRes = makeRes();
      await h.controller.verifyExclusivePic({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: { pic: purchaseRes.payload.personal_identifier_code },
      }, lockedRes);
      assert(lockedRes.statusCode === 429, 'locked user should remain blocked during lock window');
    } finally {
      delete process.env.EXCLUSIVE_PIC_MAX_FAILED_ATTEMPTS;
      delete process.env.EXCLUSIVE_PIC_LOCKOUT_MS;
      h.teardown();
    }
  });

  await test('replay/idempotency abuse: same key replays result without double wallet debit', async () => {
    const h = buildHarness();
    try {
      const beforeBalance = h.state.wallets.user_kyc.ngn_balance;

      const firstRes = makeRes();
      await h.controller.purchaseExclusiveAccess({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: { 'x-idempotency-key': 'exc-security-key-001' },
      }, firstRes);
      assert(firstRes.statusCode === 200, 'first purchase should succeed');

      const secondRes = makeRes();
      await h.controller.purchaseExclusiveAccess({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: { 'x-idempotency-key': 'exc-security-key-001' },
      }, secondRes);
      assert(secondRes.statusCode === 200, 'replayed purchase should return 200');
      assert(secondRes.payload.idempotent_replay === true, 'replayed purchase should be marked idempotent_replay');
      assert(secondRes.payload.access_id === firstRes.payload.access_id, 'replayed response should preserve access id');

      const afterBalance = h.state.wallets.user_kyc.ngn_balance;
      assert(beforeBalance - afterBalance === 3000, 'wallet should be debited exactly once');
    } finally {
      h.teardown();
    }
  });

  await test('idempotency abuse: in-flight duplicate request returns 409 conflict', async () => {
    const h = buildHarness();
    try {
      const key = 'exc-security-key-pending';
      const keyDocId = require('crypto').createHash('sha256').update(`user_kyc:ch_exclusive:${key}`).digest('hex');
      const collection = h.state.firestoreCollections.get('exclusive_purchase_idempotency') || new Map();
      collection.set(keyDocId, {
        status: 'pending',
        user_uid: 'user_kyc',
        channel_id: 'ch_exclusive',
        key,
        updated_at: Date.now(),
        created_at: Date.now(),
      });
      h.state.firestoreCollections.set('exclusive_purchase_idempotency', collection);

      const res = makeRes();
      await h.controller.purchaseExclusiveAccess({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: { 'x-idempotency-key': key },
      }, res);

      assert(res.statusCode === 409, 'pending duplicate request should return 409');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
