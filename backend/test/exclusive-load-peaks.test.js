/**
 * AV-EXC-083 load/performance checks for exclusive purchase and renewal peaks.
 * Run: node test/exclusive-load-peaks.test.js
 *
 * Tunables (env):
 * - EXC_LOAD_USERS (default: 120)
 * - EXC_LOAD_CONCURRENCY (default: 24)
 * - EXC_LOAD_MAX_P95_MS (default: 220)
 * - EXC_LOAD_MAX_ERROR_RATE (default: 0)
 */

const crypto = require('crypto');

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const LOAD_USERS = Math.max(20, toNumber(process.env.EXC_LOAD_USERS, 120));
const LOAD_CONCURRENCY = Math.max(2, toNumber(process.env.EXC_LOAD_CONCURRENCY, 24));
const MAX_P95_MS = Math.max(10, toNumber(process.env.EXC_LOAD_MAX_P95_MS, 220));
const MAX_ERROR_RATE = Math.max(0, toNumber(process.env.EXC_LOAD_MAX_ERROR_RATE, 0));

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(q * sortedValues.length) - 1));
  return sortedValues[idx];
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
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
    channel: {
      id: 'ch_peak',
      name: 'Peak Load Vault',
      type: 'exclusive',
      owner_id: 'owner_peak',
      exclusive_monthly_fee_ngn: 3000,
    },
    users: {
      owner_peak: {
        id: 'owner_peak',
        role: 'creator',
        email: 'owner-peak@example.com',
      },
    },
    kycEligible: new Set(),
    wallets: {
      owner_peak: { uid: 'owner_peak', ngn_balance: 0, vpt_units: 0 },
    },
    accesses: {},
    accessSeq: 0,
    firestoreCollections: new Map(),
  };

  for (let i = 0; i < LOAD_USERS; i += 1) {
    const uid = `viewer_${i + 1}`;
    state.users[uid] = {
      id: uid,
      role: 'viewer',
      email: `${uid}@example.com`,
    };
    state.kycEligible.add(uid);
    state.wallets[uid] = { uid, ngn_balance: 100000, vpt_units: 0 };
  }

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

  withMock(channelPath, {
    findById: async (id) => (id === state.channel.id ? clone(state.channel) : null),
    updateExclusiveSettings: async (id, fields) => ({ ...clone(state.channel), ...clone(fields), id }),
  }, originals);

  withMock(userPath, {
    findById: async (id) => clone(state.users[id] || null),
    findCachedById: () => null,
  }, originals);

  withMock(policyPath, {
    isAdultKycVerified: async (userId) => state.kycEligible.has(userId),
  }, originals);

  withMock(accessPath, {
    findLatestByUserAndChannel: async (userUid, channelId) => clone(latestAccess(userUid, channelId)),
    findActiveByUserAndChannel: async (userUid, channelId) => clone(activeAccess(userUid, channelId)),
    grantOrRenew: async ({ userUid, channelId, picHash, sourcePaymentId, monthlyFeeNgn }) => {
      const now = Date.now();
      const existing = latestAccess(userUid, channelId);
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
    adjustNgnBalance: async (uid, amount) => {
      state.wallets[uid].ngn_balance += Number(amount || 0);
      return clone(state.wallets[uid]);
    },
    adjustVptUnits: async (uid, units) => {
      state.wallets[uid].vpt_units += Number(units || 0);
      return clone(state.wallets[uid]);
    },
  }, originals);

  withMock(ledgerPath, {
    create: async (entry) => clone(entry),
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
    notifyUser: async () => ({ successCount: 1, failureCount: 0 }),
  }, originals);

  withMock(emailPath, {
    sendExclusiveLifecycleEmail: async () => true,
  }, originals);

  withMock(rolloutServicePath, {
    isExclusiveRolloutEnabledForUser: async () => true,
  }, originals);

  withMock(auditPath, {
    logAction: async () => true,
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

  clearModule(targetPath);
  const controller = require('../src/channels/exclusive_channel.controller');

  function forceExpireAll() {
    const now = Date.now();
    for (const access of Object.values(state.accesses)) {
      access.status = 'expired';
      access.expires_at = now - 1000;
      access.updated_at = now;
    }
  }

  return {
    controller,
    state,
    forceExpireAll,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

async function runConcurrent(total, concurrency, execute) {
  let index = 0;
  const outcomes = new Array(total);

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= total) return;
      outcomes[current] = await execute(current);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return outcomes;
}

function summarizePhase(phaseName, outcomes, wallTimeMs) {
  const latencies = outcomes.map((row) => row.durationMs).sort((a, b) => a - b);
  const errors = outcomes.filter((row) => !row.ok);
  const successCount = outcomes.length - errors.length;
  const errorRate = outcomes.length ? (errors.length / outcomes.length) : 0;

  const summary = {
    phase: phaseName,
    total: outcomes.length,
    successCount,
    errorCount: errors.length,
    errorRate,
    throughputOpsPerSec: outcomes.length > 0 ? ((outcomes.length * 1000) / wallTimeMs) : 0,
    p50Ms: quantile(latencies, 0.50),
    p95Ms: quantile(latencies, 0.95),
    maxMs: latencies.length ? latencies[latencies.length - 1] : 0,
    wallTimeMs,
    sampleErrors: errors.slice(0, 3).map((row) => row.error),
  };

  return summary;
}

function printSummary(summary) {
  console.log(`\n[${summary.phase}]`);
  console.log(`  total=${summary.total} success=${summary.successCount} error=${summary.errorCount} errorRate=${(summary.errorRate * 100).toFixed(2)}%`);
  console.log(`  throughput=${summary.throughputOpsPerSec.toFixed(2)} ops/s wall=${summary.wallTimeMs.toFixed(2)}ms`);
  console.log(`  p50=${summary.p50Ms.toFixed(2)}ms p95=${summary.p95Ms.toFixed(2)}ms max=${summary.maxMs.toFixed(2)}ms`);
  if (summary.sampleErrors.length) {
    console.log(`  sampleErrors=${summary.sampleErrors.join(' | ')}`);
  }
}

async function runPhase({ harness, phaseName, users, action }) {
  const startedAt = process.hrtime.bigint();

  const outcomes = await runConcurrent(users.length, LOAD_CONCURRENCY, async (index) => {
    const uid = users[index];
    const req = {
      userId: uid,
      params: { id: harness.state.channel.id },
      body: {},
      headers: {
        'x-idempotency-key': `${phaseName}:${uid}:${crypto.randomUUID()}`,
      },
    };

    const res = makeRes();
    const opStart = process.hrtime.bigint();

    try {
      await action(req, res);
      const opEnd = process.hrtime.bigint();
      const durationMs = Number(opEnd - opStart) / 1e6;
      const ok = res.statusCode === 200 && res.payload && res.payload.has_access === true;

      return {
        ok,
        durationMs,
        error: ok ? null : `status=${res.statusCode} payload=${JSON.stringify(res.payload)}`,
      };
    } catch (error) {
      const opEnd = process.hrtime.bigint();
      return {
        ok: false,
        durationMs: Number(opEnd - opStart) / 1e6,
        error: error.message,
      };
    }
  });

  const endedAt = process.hrtime.bigint();
  const wallTimeMs = Number(endedAt - startedAt) / 1e6;

  return summarizePhase(phaseName, outcomes, wallTimeMs);
}

(async function run() {
  console.log('\n-- AV-EXC-083 Exclusive Peak Load Tests --\n');
  console.log(`users=${LOAD_USERS} concurrency=${LOAD_CONCURRENCY} maxP95Ms=${MAX_P95_MS} maxErrorRate=${MAX_ERROR_RATE}`);

  const harness = buildHarness();
  const users = Array.from({ length: LOAD_USERS }, (_, i) => `viewer_${i + 1}`);

  try {
    const purchaseSummary = await runPhase({
      harness,
      phaseName: 'purchase-peak',
      users,
      action: harness.controller.purchaseExclusiveAccess,
    });
    printSummary(purchaseSummary);

    harness.forceExpireAll();

    const renewalSummary = await runPhase({
      harness,
      phaseName: 'renewal-peak',
      users,
      action: harness.controller.renewExclusiveAccess,
    });
    printSummary(renewalSummary);

    const summaries = [purchaseSummary, renewalSummary];
    for (const summary of summaries) {
      assert(summary.errorRate <= MAX_ERROR_RATE, `${summary.phase} errorRate ${summary.errorRate} exceeds max ${MAX_ERROR_RATE}`);
      assert(summary.p95Ms <= MAX_P95_MS, `${summary.phase} p95 ${summary.p95Ms.toFixed(2)}ms exceeds max ${MAX_P95_MS}ms`);
    }

    console.log('\nLoad verdict: PASS\n');
    process.exit(0);
  } catch (error) {
    console.error(`\nLoad verdict: FAIL - ${error.message}\n`);
    process.exit(1);
  } finally {
    harness.teardown();
  }
})();
