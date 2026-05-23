/**
 * AV-EXC-081 end-to-end persona and lifecycle coverage (mocked integration harness).
 * Run: node test/exclusive-persona-lifecycle-e2e.test.js
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

function restoreMocks(originals, targetPaths = []) {
  for (const targetPath of targetPaths) {
    clearModule(targetPath);
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

  const channelModelPath = require.resolve('../src/channels/channel.model');
  const userModelPath = require.resolve('../src/users/user.model');
  const exclusivePolicyPath = require.resolve('../src/channels/exclusive_policy.service');
  const exclusiveAccessPath = require.resolve('../src/channels/exclusive_access.model');
  const walletModelPath = require.resolve('../src/interactions/gift-wallet.model');
  const ledgerModelPath = require.resolve('../src/vpt/ledger.model');
  const poolServicePath = require.resolve('../src/vpt/pool.service');
  const referralModelPath = require.resolve('../src/referrals/referral.model');
  const notificationServicePath = require.resolve('../src/notifications/notification.service');
  const emailPath = require.resolve('../src/utils/email');
  const auditServicePath = require.resolve('../src/admin/audit.service');
  const firestorePath = require.resolve('../src/utils/firestore');
  const rolloutServicePath = require.resolve('../src/channels/exclusive_rollout.service');

  const channelControllerPath = require.resolve('../src/channels/channel.controller');
  const exclusiveControllerPath = require.resolve('../src/channels/exclusive_channel.controller');
  const lifecycleWorkerPath = require.resolve('../src/channels/exclusive_lifecycle.worker');

  const now = Date.now();

  const state = {
    users: {
      owner_1: {
        id: 'owner_1',
        role: 'creator',
        name: 'Owner One',
        email: 'owner1@example.com',
      },
      user_nonkyc: {
        id: 'user_nonkyc',
        role: 'viewer',
        name: 'Viewer Non KYC',
        email: 'viewer-nonkyc@example.com',
      },
      user_kyc: {
        id: 'user_kyc',
        role: 'viewer',
        name: 'Viewer KYC',
        email: 'viewer-kyc@example.com',
      },
    },
    channels: {
      ch_public: {
        id: 'ch_public',
        name: 'Public Arena',
        description: 'Public channel',
        category: 'General',
        type: 'public',
        owner_id: 'owner_1',
        channel_number: 100,
        is_active: true,
      },
      ch_exclusive: {
        id: 'ch_exclusive',
        name: 'Exclusive Vault',
        description: 'Exclusive channel',
        category: 'Premium',
        type: 'exclusive',
        owner_id: 'owner_1',
        channel_number: 101,
        is_active: true,
        exclusive_monthly_fee_ngn: 3000,
      },
    },
    eligibleKycUserIds: new Set(['user_kyc']),
    wallets: {
      owner_1: { uid: 'owner_1', ngn_balance: 0, vpt_units: 0 },
      user_nonkyc: { uid: 'user_nonkyc', ngn_balance: 20000, vpt_units: 0 },
      user_kyc: { uid: 'user_kyc', ngn_balance: 20000, vpt_units: 0 },
    },
    accesses: {},
    accessSeq: 0,
    ledgerEntries: [],
    poolCredits: [],
    operationsPoolCredits: [],
    referralEarnings: [],
    notifications: [],
    lifecycleEmails: [],
    summaryWrites: [],
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

  function getLatestAccessFor(userUid, channelId) {
    const entries = Object.values(state.accesses)
      .filter((entry) => entry.user_uid === userUid && entry.channel_id === channelId)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return entries[0] || null;
  }

  function getActiveAccessFor(userUid, channelId) {
    const currentNow = Date.now();
    const entries = Object.values(state.accesses)
      .filter((entry) => entry.user_uid === userUid
        && entry.channel_id === channelId
        && entry.status === 'active'
        && Number(entry.expires_at || 0) > currentNow)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return entries[0] || null;
  }

  const ChannelModelMock = {
    ALLOWED_SOURCE_MODES: ['native', 'external', 'external_url'],
    ALLOWED_STREAM_STATUSES: ['unknown', 'live', 'scheduled', 'offline', 'error', 'valid'],
    getAll: async () => Object.values(state.channels).map((entry) => clone(entry)),
    findById: async (id) => clone(state.channels[id] || null),
  };

  const UserModelMock = {
    findById: async (id) => clone(state.users[id] || null),
    findCachedById: () => null,
    countChannelFollowers: async () => 0,
    getAll: async () => Object.values(state.users).map((entry) => clone(entry)),
  };

  const ExclusivePolicyMock = {
    isAdultKycVerified: async (userId) => state.eligibleKycUserIds.has(userId),
  };

  const ExclusiveAccessMock = {
    THIRTY_DAYS_MS: 30 * 24 * 60 * 60 * 1000,
    findLatestByUserAndChannel: async (userUid, channelId) => clone(getLatestAccessFor(userUid, channelId)),
    findActiveByUserAndChannel: async (userUid, channelId) => clone(getActiveAccessFor(userUid, channelId)),
    grantOrRenew: async ({ userUid, channelId, picHash, sourcePaymentId, monthlyFeeNgn }) => {
      const existing = getLatestAccessFor(userUid, channelId);
      const startAt = Date.now();
      const accessId = existing ? existing.id : `acc_${++state.accessSeq}`;
      const next = {
        id: accessId,
        user_uid: userUid,
        channel_id: channelId,
        status: 'active',
        pic_hash: picHash,
        source_payment_id: sourcePaymentId,
        monthly_fee_ngn: Number(monthlyFeeNgn || 0),
        created_at: existing ? existing.created_at : startAt,
        updated_at: startAt,
        starts_at: startAt,
        expires_at: startAt + (30 * 24 * 60 * 60 * 1000),
        reminder_sent_at: existing?.reminder_sent_at || {},
        lifecycle_flags: existing?.lifecycle_flags || {},
        expiry_notified_at: null,
      };
      state.accesses[accessId] = next;
      return clone(next);
    },
    listActiveAccesses: async () => Object.values(state.accesses)
      .filter((entry) => entry.status === 'active')
      .map((entry) => clone(entry)),
    markReminderSent: async (id, bucket, sentAt = Date.now()) => {
      const current = state.accesses[id];
      if (!current) return null;
      current.reminder_sent_at = {
        ...(current.reminder_sent_at || {}),
        [bucket]: sentAt,
      };
      current.updated_at = sentAt;
      return clone(current);
    },
    markExpired: async (id, expiredAt = Date.now()) => {
      const current = state.accesses[id];
      if (!current) return null;
      current.status = 'expired';
      current.expired_at = expiredAt;
      current.updated_at = expiredAt;
      return clone(current);
    },
    markExpiryNotified: async (id, notifiedAt = Date.now()) => {
      const current = state.accesses[id];
      if (!current) return null;
      current.expiry_notified_at = notifiedAt;
      current.updated_at = notifiedAt;
      return clone(current);
    },
    markLifecycleFlag: async (id, flag, at = Date.now()) => {
      const current = state.accesses[id];
      if (!current) return null;
      current.lifecycle_flags = {
        ...(current.lifecycle_flags || {}),
        [flag]: at,
      };
      current.updated_at = at;
      return clone(current);
    },
  };

  const GiftWalletMock = {
    ensureWallet: async (uid) => {
      if (!state.wallets[uid]) {
        state.wallets[uid] = { uid, ngn_balance: 0, vpt_units: 0 };
      }
      return clone(state.wallets[uid]);
    },
    adjustNgnBalance: async (uid, amount) => {
      await GiftWalletMock.ensureWallet(uid);
      state.wallets[uid].ngn_balance += Number(amount || 0);
      return clone(state.wallets[uid]);
    },
    adjustVptUnits: async (uid, units) => {
      await GiftWalletMock.ensureWallet(uid);
      state.wallets[uid].vpt_units += Number(units || 0);
      return clone(state.wallets[uid]);
    },
  };

  const LedgerMock = {
    create: async (entry) => {
      state.ledgerEntries.push(clone(entry));
      return clone(entry);
    },
  };

  const PoolServiceMock = {
    creditPool: async (amount, reason, meta = {}) => {
      state.poolCredits.push({ amount, reason, meta: clone(meta) });
    },
    creditOperationsPool: async (amount, reason, meta = {}) => {
      state.operationsPoolCredits.push({ amount, reason, meta: clone(meta) });
    },
    creditRbdPool: async () => {},
  };

  const ReferralModelMock = {
    VPT_PRICE_NGN: 500,
    LEVEL_DISTRIBUTION: [0.5, 0.2, 0.15, 0.1, 0.05],
    resolveTree: async () => [],
    recordEarning: async (payload) => {
      state.referralEarnings.push(clone(payload));
    },
  };

  const NotificationServiceMock = {
    notifyUser: async (userId, payload) => {
      state.notifications.push({ userId, payload: clone(payload) });
      return { successCount: 1, failureCount: 0 };
    },
  };

  const EmailMock = {
    sendExclusiveLifecycleEmail: async (payload) => {
      state.lifecycleEmails.push(clone(payload));
      return true;
    },
  };

  const AuditServiceMock = {
    logAction: async (adminUid, action, targetId, meta = {}) => {
      state.auditLogs.push({
        adminUid,
        action,
        targetId,
        meta: clone(meta),
      });
      return true;
    },
  };

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

  withMock(channelModelPath, ChannelModelMock, originals);
  withMock(userModelPath, UserModelMock, originals);
  withMock(exclusivePolicyPath, ExclusivePolicyMock, originals);
  withMock(exclusiveAccessPath, ExclusiveAccessMock, originals);
  withMock(walletModelPath, GiftWalletMock, originals);
  withMock(ledgerModelPath, LedgerMock, originals);
  withMock(poolServicePath, PoolServiceMock, originals);
  withMock(referralModelPath, ReferralModelMock, originals);
  withMock(notificationServicePath, NotificationServiceMock, originals);
  withMock(emailPath, EmailMock, originals);
  withMock(auditServicePath, AuditServiceMock, originals);
  withMock(firestorePath, FirestoreMock, originals);
  withMock(rolloutServicePath, {
    isExclusiveRolloutEnabledForUser: async () => true,
  }, originals);

  clearModule(channelControllerPath);
  clearModule(exclusiveControllerPath);
  clearModule(lifecycleWorkerPath);

  const channelController = require('../src/channels/channel.controller');
  const exclusiveController = require('../src/channels/exclusive_channel.controller');
  const lifecycleWorker = require('../src/channels/exclusive_lifecycle.worker');

  function setAccessExpiry(userUid, channelId, expiresAt) {
    const access = getLatestAccessFor(userUid, channelId);
    if (!access) return null;
    access.expires_at = expiresAt;
    access.updated_at = Date.now();
    state.accesses[access.id] = access;
    return clone(access);
  }

  return {
    channelController,
    exclusiveController,
    lifecycleWorker,
    state,
    setAccessExpiry,
    teardown() {
      restoreMocks(originals, [
        channelControllerPath,
        exclusiveControllerPath,
        lifecycleWorkerPath,
      ]);
    },
  };
}

(async function run() {
  console.log('\n-- AV-EXC-081 Persona + Lifecycle E2E Tests --\n');

  await test('guest and non-KYC users cannot discover exclusive channels', async () => {
    const h = buildHarness();
    try {
      const guestRes = makeRes();
      await h.channelController.getPublicChannels({}, guestRes);
      assert(guestRes.statusCode === 200, 'guest public channels should return 200');
      assert(Array.isArray(guestRes.payload.channels), 'guest channels payload missing');
      assert(guestRes.payload.channels.length === 1, 'guest should only see public channels');
      assert(guestRes.payload.channels[0].id === 'ch_public', 'guest saw unexpected channel');

      const nonKycRes = makeRes();
      await h.channelController.getPublicChannels({ userId: 'user_nonkyc' }, nonKycRes);
      assert(nonKycRes.statusCode === 200, 'non-kyc public channels should return 200');
      assert(nonKycRes.payload.channels.length === 1, 'non-kyc should not see exclusive channel');
      assert(nonKycRes.payload.channels[0].id === 'ch_public', 'non-kyc saw unexpected channel');
    } finally {
      h.teardown();
    }
  });

  await test('exclusive channel detail rejects guest and non-KYC personas', async () => {
    const h = buildHarness();
    try {
      const guestRes = makeRes();
      await h.channelController.getChannelById({ params: { id: 'ch_exclusive' } }, guestRes);
      assert(guestRes.statusCode === 403, 'guest detail should be 403');
      assert(guestRes.payload && guestRes.payload.requires_login === true, 'guest detail must require login');

      const nonKycRes = makeRes();
      await h.channelController.getChannelById({ userId: 'user_nonkyc', params: { id: 'ch_exclusive' } }, nonKycRes);
      assert(nonKycRes.statusCode === 403, 'non-kyc detail should be 403');
      assert(nonKycRes.payload && nonKycRes.payload.requires_kyc === true, 'non-kyc detail must require kyc');
    } finally {
      h.teardown();
    }
  });

  await test('kyc-approved user without entitlement is blocked and gets access-status guidance', async () => {
    const h = buildHarness();
    try {
      const detailRes = makeRes();
      await h.channelController.getChannelById({ userId: 'user_kyc', params: { id: 'ch_exclusive' } }, detailRes);
      assert(detailRes.statusCode === 403, 'kyc user without entitlement should be blocked');
      assert(detailRes.payload && detailRes.payload.requires_pic === true, 'requires_pic should be true');
      assert(detailRes.payload && detailRes.payload.requires_payment === true, 'requires_payment should be true');

      const statusRes = makeRes();
      await h.exclusiveController.checkExclusiveAccessStatus({ userId: 'user_kyc', params: { id: 'ch_exclusive' } }, statusRes);
      assert(statusRes.statusCode === 200, 'status check should return 200');
      assert(statusRes.payload.eligibleByKyc === true, 'status should confirm kyc eligibility');
      assert(statusRes.payload.hasActiveEntitlement === false, 'status should show no entitlement');
      assert(statusRes.payload.renewalRequired === true, 'status should require renewal/purchase');
    } finally {
      h.teardown();
    }
  });

  await test('purchase grants entitlement, PIC verify gates, and detail access succeeds', async () => {
    const h = buildHarness();
    try {
      const purchaseRes = makeRes();
      await h.exclusiveController.purchaseExclusiveAccess({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
      }, purchaseRes);

      assert(purchaseRes.statusCode === 200, 'purchase should return 200');
      assert(purchaseRes.payload && purchaseRes.payload.has_access === true, 'purchase must grant access');
      assert(typeof purchaseRes.payload.personal_identifier_code === 'string', 'purchase must return PIC');

      const invalidPicRes = makeRes();
      await h.exclusiveController.verifyExclusivePic({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: { pic: 'INVALID123' },
      }, invalidPicRes);
      assert(invalidPicRes.statusCode === 403, 'invalid PIC should be rejected');

      const validPicRes = makeRes();
      await h.exclusiveController.verifyExclusivePic({
        userId: 'user_kyc',
        params: { id: 'ch_exclusive' },
        body: { pic: purchaseRes.payload.personal_identifier_code },
      }, validPicRes);
      assert(validPicRes.statusCode === 200, 'valid PIC should pass');
      assert(validPicRes.payload && validPicRes.payload.valid === true, 'valid PIC response should be true');

      const detailRes = makeRes();
      await h.channelController.getChannelById({ userId: 'user_kyc', params: { id: 'ch_exclusive' } }, detailRes);
      assert(detailRes.statusCode === 200, 'entitled user should access detail');
      assert(detailRes.payload && detailRes.payload.channel && detailRes.payload.channel.id === 'ch_exclusive', 'detail payload missing channel');

      assert(h.state.notifications.length >= 2, 'purchase should emit viewer and creator notifications');
      assert(h.state.lifecycleEmails.length >= 2, 'purchase should emit lifecycle emails');
    } finally {
      h.teardown();
    }
  });

  await test('lifecycle worker sends d1 reminder then expires entitlement and re-gates detail', async () => {
    const h = buildHarness();
    try {
      const baseNow = 1_900_000_000_000;

      await withFrozenNow(baseNow, async () => {
        const purchaseRes = makeRes();
        await h.exclusiveController.purchaseExclusiveAccess({
          userId: 'user_kyc',
          params: { id: 'ch_exclusive' },
        }, purchaseRes);
        assert(purchaseRes.statusCode === 200, 'setup purchase should succeed');
      });

      await withFrozenNow(baseNow + 1, async () => {
        h.setAccessExpiry('user_kyc', 'ch_exclusive', Date.now() + (12 * 60 * 60 * 1000));
        const reminderSummary = await h.lifecycleWorker.processExclusiveLifecycle();
        assert(reminderSummary.user_reminders_sent === 1, 'expected one user reminder at d1');
        assert(reminderSummary.creator_reminders_sent === 1, 'expected one creator reminder at d1');
      });

      await withFrozenNow(baseNow + 2, async () => {
        h.setAccessExpiry('user_kyc', 'ch_exclusive', Date.now() - 10);
        const expirySummary = await h.lifecycleWorker.processExclusiveLifecycle();
        assert(expirySummary.expired_marked === 1, 'expected expired mark');
        assert(expirySummary.user_expiry_sent === 1, 'expected user expiry notification');
        assert(expirySummary.creator_expiry_sent === 1, 'expected creator expiry notification');
      });

      const statusAfterExpiry = makeRes();
      await h.exclusiveController.checkExclusiveAccessStatus({ userId: 'user_kyc', params: { id: 'ch_exclusive' } }, statusAfterExpiry);
      assert(statusAfterExpiry.statusCode === 200, 'status after expiry should return 200');
      assert(statusAfterExpiry.payload.hasActiveEntitlement === false, 'entitlement should be inactive after expiry');
      assert(statusAfterExpiry.payload.renewalRequired === true, 'renewal should be required after expiry');

      const detailAfterExpiry = makeRes();
      await h.channelController.getChannelById({ userId: 'user_kyc', params: { id: 'ch_exclusive' } }, detailAfterExpiry);
      assert(detailAfterExpiry.statusCode === 403, 'detail should be gated again after expiry');
      assert(detailAfterExpiry.payload && detailAfterExpiry.payload.requires_pic === true, 'post-expiry should require PIC/payment again');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
