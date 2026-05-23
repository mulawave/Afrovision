/**
 * AV-EXC-090 rollout control tests.
 * Run: node test/exclusive-rollout-controls.test.js
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

function restoreMocks(originals, targets) {
  for (const target of targets) {
    clearModule(target);
  }

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

function buildHarness({ rolloutEnabled = 'true', rolloutPercent = '100', allowlist = '' } = {}) {
  const originals = new Map();

  const settingsPath = require.resolve('../src/admin/settings.service');
  const channelModelPath = require.resolve('../src/channels/channel.model');
  const userModelPath = require.resolve('../src/users/user.model');
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
  const streamResolverPath = require.resolve('../src/channels/stream_resolver.service');
  const rolloutServicePath = require.resolve('../src/channels/exclusive_rollout.service');

  const channelControllerPath = require.resolve('../src/channels/channel.controller');
  const exclusiveControllerPath = require.resolve('../src/channels/exclusive_channel.controller');

  const state = {
    users: {
      owner_1: { id: 'owner_1', role: 'creator', name: 'Owner', email: 'owner@example.com' },
      user_eligible: { id: 'user_eligible', role: 'viewer', name: 'Eligible', email: 'eligible@example.com' },
      user_blocked: { id: 'user_blocked', role: 'viewer', name: 'Blocked', email: 'blocked@example.com' },
      user_allowlisted: { id: 'user_allowlisted', role: 'viewer', name: 'Allowlisted', email: 'allowlisted@example.com' },
    },
    channels: {
      ch_public: {
        id: 'ch_public',
        name: 'Public One',
        description: 'Public',
        category: 'General',
        type: 'public',
        owner_id: 'owner_1',
        channel_number: 1,
        is_active: true,
      },
      ch_exclusive: {
        id: 'ch_exclusive',
        name: 'Exclusive One',
        description: 'Exclusive',
        category: 'Premium',
        type: 'exclusive',
        owner_id: 'owner_1',
        channel_number: 2,
        is_active: true,
        exclusive_monthly_fee_ngn: 3000,
      },
    },
    wallets: {
      owner_1: { uid: 'owner_1', ngn_balance: 0, vpt_units: 0 },
      user_eligible: { uid: 'user_eligible', ngn_balance: 10000, vpt_units: 0 },
      user_blocked: { uid: 'user_blocked', ngn_balance: 10000, vpt_units: 0 },
      user_allowlisted: { uid: 'user_allowlisted', ngn_balance: 10000, vpt_units: 0 },
    },
    accesses: {},
    accessSeq: 0,
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
        if (options.merge) {
          const current = col.get(docId) || {};
          col.set(docId, { ...current, ...clone(payload) });
        } else {
          col.set(docId, clone(payload));
        }
      },
    };
  }

  function latestAccess(userUid, channelId) {
    const entries = Object.values(state.accesses)
      .filter((row) => row.user_uid === userUid && row.channel_id === channelId)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return entries[0] || null;
  }

  function activeAccess(userUid, channelId) {
    const now = Date.now();
    const entries = Object.values(state.accesses)
      .filter((row) => row.user_uid === userUid
        && row.channel_id === channelId
        && row.status === 'active'
        && Number(row.expires_at || 0) > now)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return entries[0] || null;
  }

  withMock(settingsPath, {
    get: async (key) => {
      if (key === 'EXCLUSIVE_ROLLOUT_ENABLED') return rolloutEnabled;
      if (key === 'EXCLUSIVE_ROLLOUT_PERCENT') return rolloutPercent;
      if (key === 'EXCLUSIVE_ROLLOUT_ALLOWLIST_USER_IDS') return allowlist;
      return null;
    },
  }, originals);

  withMock(channelModelPath, {
    ALLOWED_SOURCE_MODES: ['native', 'external', 'external_url'],
    ALLOWED_STREAM_STATUSES: ['unknown', 'live', 'scheduled', 'offline', 'error', 'valid'],
    getAll: async () => Object.values(state.channels).map((entry) => clone(entry)),
    findById: async (id) => clone(state.channels[id] || null),
    updateExclusiveSettings: async (id, fields) => ({ ...clone(state.channels[id]), ...clone(fields), id }),
  }, originals);

  withMock(userModelPath, {
    findById: async (id) => clone(state.users[id] || null),
    findCachedById: () => null,
    countChannelFollowers: async () => 0,
    getAll: async () => Object.values(state.users).map((entry) => clone(entry)),
  }, originals);

  withMock(policyPath, {
    isAdultKycVerified: async () => true,
  }, originals);

  withMock(accessPath, {
    findLatestByUserAndChannel: async (uid, channelId) => clone(latestAccess(uid, channelId)),
    findActiveByUserAndChannel: async (uid, channelId) => clone(activeAccess(uid, channelId)),
    grantOrRenew: async ({ userUid, channelId, picHash, sourcePaymentId, monthlyFeeNgn }) => {
      const now = Date.now();
      const existing = latestAccess(userUid, channelId);
      const id = existing ? existing.id : `acc_${++state.accessSeq}`;
      const row = {
        id,
        user_uid: userUid,
        channel_id: channelId,
        status: 'active',
        pic_hash: picHash,
        source_payment_id: sourcePaymentId,
        monthly_fee_ngn: Number(monthlyFeeNgn || 0),
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
    adjustNgnBalance: async (uid, amount) => {
      state.wallets[uid].ngn_balance += Number(amount || 0);
      return clone(state.wallets[uid]);
    },
    adjustVptUnits: async (uid, units) => {
      state.wallets[uid].vpt_units += Number(units || 0);
      return clone(state.wallets[uid]);
    },
  }, originals);

  withMock(ledgerPath, { create: async () => true }, originals);
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
  withMock(notificationPath, { notifyUser: async () => ({ successCount: 1, failureCount: 0 }) }, originals);
  withMock(emailPath, { sendExclusiveLifecycleEmail: async () => true }, originals);
  withMock(auditPath, { logAction: async () => true }, originals);
  withMock(streamResolverPath, {
    resolveSource: async () => ({ ok: true, stream_source_mode: 'external_url' }),
    recheckHealth: async () => ({ stream_status: 'live', last_checked_at: new Date().toISOString() }),
  }, originals);

  withMock(firestorePath, {
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
  }, originals);

  clearModule(channelControllerPath);
  clearModule(exclusiveControllerPath);
  clearModule(rolloutServicePath);

  const channelController = require('../src/channels/channel.controller');
  const exclusiveController = require('../src/channels/exclusive_channel.controller');

  return {
    channelController,
    exclusiveController,
    teardown() {
      restoreMocks(originals, [channelControllerPath, exclusiveControllerPath, rolloutServicePath]);
    },
  };
}

(async function run() {
  console.log('\n-- AV-EXC-090 Rollout Control Tests --\n');

  await test('rollout disabled hides exclusive discovery and blocks direct access', async () => {
    const h = buildHarness({ rolloutEnabled: 'false', rolloutPercent: '100' });
    try {
      const listRes = makeRes();
      await h.channelController.getPublicChannels({ userId: 'user_eligible' }, listRes);
      assert(listRes.statusCode === 200, 'expected 200 for list');
      assert(listRes.payload.channels.length === 1, 'exclusive should be hidden when rollout disabled');
      assert(listRes.payload.channels[0].id === 'ch_public', 'unexpected visible channel');

      const detailRes = makeRes();
      await h.channelController.getChannelById({ userId: 'user_eligible', params: { id: 'ch_exclusive' } }, detailRes);
      assert(detailRes.statusCode === 403, 'direct access should be blocked');
      assert(detailRes.payload.rollout_blocked === true, 'rollout_blocked flag expected');

      const purchaseRes = makeRes();
      await h.exclusiveController.purchaseExclusiveAccess({ userId: 'user_eligible', params: { id: 'ch_exclusive' }, body: {}, headers: {} }, purchaseRes);
      assert(purchaseRes.statusCode === 403, 'purchase should be blocked');
      assert(purchaseRes.payload.rollout_blocked === true, 'rollout_blocked expected on purchase');
    } finally {
      h.teardown();
    }
  });

  await test('percent rollout 0 blocks normal users but allowlist bypasses', async () => {
    const h = buildHarness({
      rolloutEnabled: 'true',
      rolloutPercent: '0',
      allowlist: 'user_allowlisted',
    });

    try {
      const blockedStatusRes = makeRes();
      await h.exclusiveController.checkExclusiveAccessStatus({ userId: 'user_blocked', params: { id: 'ch_exclusive' } }, blockedStatusRes);
      assert(blockedStatusRes.statusCode === 403, 'blocked user should get 403');
      assert(blockedStatusRes.payload.rollout_blocked === true, 'blocked user should have rollout flag');

      const allowlistedStatusRes = makeRes();
      await h.exclusiveController.checkExclusiveAccessStatus({ userId: 'user_allowlisted', params: { id: 'ch_exclusive' } }, allowlistedStatusRes);
      assert(allowlistedStatusRes.statusCode === 200, 'allowlisted user should pass rollout gate');
      assert(allowlistedStatusRes.payload.eligibleByKyc === true, 'allowlisted status should evaluate normally');

      const allowlistedPurchaseRes = makeRes();
      await h.exclusiveController.purchaseExclusiveAccess({
        userId: 'user_allowlisted',
        params: { id: 'ch_exclusive' },
        body: {},
        headers: {},
      }, allowlistedPurchaseRes);
      assert(allowlistedPurchaseRes.statusCode === 200, 'allowlisted purchase should succeed');
      assert(allowlistedPurchaseRes.payload.has_access === true, 'allowlisted purchase should grant access');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
