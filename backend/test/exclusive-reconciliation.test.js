/**
 * AV-EXC-043 reconciliation and split exception tests.
 * Run: node test/exclusive-reconciliation.test.js
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

function createFirestoreMock() {
  const exceptions = new Map();
  const summaries = new Map();

  return {
    _exceptions: exceptions,
    _summaries: summaries,
    collection(name) {
      if (name === 'exclusive_split_exceptions') {
        return {
          doc(id) {
            return {
              async set(payload) {
                exceptions.set(id, payload);
              },
            };
          },
          where(field, _op, value) {
            return {
              async get() {
                const docs = Array.from(exceptions.entries())
                  .filter(([, payload]) => payload[field] === value)
                  .map(([id, payload]) => ({ id, data: () => payload }));
                return { docs };
              },
            };
          },
        };
      }

      if (name === 'ops_summaries') {
        return {
          doc(id) {
            return {
              async set(payload) {
                const previous = summaries.get(id) || {};
                summaries.set(id, { ...previous, ...payload });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function buildHarness() {
  const originals = new Map();

  const ledgerPath = require.resolve('../src/vpt/ledger.model');
  const userPath = require.resolve('../src/users/user.model');
  const notificationPath = require.resolve('../src/notifications/notification.service');
  const firestorePath = require.resolve('../src/utils/firestore');
  const messagesPath = require.resolve('../src/channels/exclusive_lifecycle.messages');
  const targetPath = require.resolve('../src/channels/exclusive_reconciliation.service');

  const firestore = createFirestoreMock();
  const notifications = [];

  withMock(ledgerPath, {
    getSuccessfulDebitsInRange: async () => ([
      {
        id: 'ledger_ok',
        type: 'EXCLUSIVE_CHANNEL_ACCESS_PAYMENT',
        amount_ngn: 1000,
        reference_id: 'ref_ok',
        channel_id: 'ch1',
        meta: {
          creator_cash: 500,
          community_pool_ngn: 100,
          operations_pool_ngn: 200,
          referral_pool_ngn: 100,
          creator_vpt_ngn: 100,
        },
      },
      {
        id: 'ledger_bad',
        type: 'EXCLUSIVE_CHANNEL_ACCESS_PAYMENT',
        amount_ngn: 1000,
        reference_id: 'ref_bad',
        channel_id: 'ch2',
        meta: {
          creator_cash: 490,
          community_pool_ngn: 100,
          operations_pool_ngn: 200,
          referral_pool_ngn: 100,
          creator_vpt_ngn: 110,
        },
      },
    ]),
  }, originals);

  withMock(userPath, {
    getAll: async () => ([
      { id: 'admin_1', role: 'admin', deleted_at: null },
      { id: 'viewer_1', role: 'user', deleted_at: null },
    ]),
    findById: async (id) => ({ id, role: id.startsWith('admin') ? 'admin' : 'user' }),
  }, originals);

  withMock(notificationPath, {
    notifyUser: async (uid, payload) => {
      notifications.push({ uid, payload });
      return { successCount: 1, failureCount: 0 };
    },
  }, originals);

  withMock(firestorePath, {
    getFirestore: () => firestore,
  }, originals);

  withMock(messagesPath, {
    buildExclusiveLifecycleMessage: () => ({
      title: 'Exclusive Lifecycle Worker Alert',
      body: 'Exclusive lifecycle run completed with 1 error(s) and 1 anomaly record(s).',
      type: 'exclusive_ops_alert',
    }),
  }, originals);

  clearModule(targetPath);
  const service = require('../src/channels/exclusive_reconciliation.service');

  return {
    service,
    firestore,
    notifications,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

(async function run() {
  console.log('\n-- AV-EXC-043 Reconciliation Tests --\n');

  await test('queues split exceptions for manual reconciliation', async () => {
    const h = buildHarness();
    try {
      const queued = await h.service.queueExclusiveSplitException({
        referenceId: 'ref_exc_1',
        channelId: 'channel_1',
        userUid: 'viewer_1',
        ownerUid: 'creator_1',
        amountNgn: 5000,
        split: { creator_cash: 2500 },
        reason: 'SPLIT_PARTIAL_FAILURE',
        failedStep: 'creditOperationsPool',
        errorMessage: 'ops pool timeout',
      });

      assert(queued.status === 'pending', 'expected pending queue status');
      assert(queued.reference_id === 'ref_exc_1', 'expected queued reference id');
      assert(h.firestore._exceptions.size === 1, 'expected one queued exception document');
    } finally {
      h.teardown();
    }
  });

  await test('detects split mismatches and sends ops alert', async () => {
    const h = buildHarness();
    try {
      await h.service.queueExclusiveSplitException({
        referenceId: 'stale_1',
        channelId: 'channel_2',
        amountNgn: 1000,
        split: {},
        reason: 'SPLIT_EXCEPTION',
        failedStep: 'unknown',
        errorMessage: 'manual seed',
      });

      const summary = await h.service.runScheduledExclusiveReconciliation({
        trigger: 'test',
        lookbackHours: 24,
      });

      assert(summary.scanned_payments === 2, 'expected two exclusive payment ledger rows scanned');
      assert(summary.mismatch_count === 1, 'expected one mismatch');
      assert(summary.pending_exceptions >= 1, 'expected pending exceptions to be included');
      assert(summary.ops_alerts_sent === 1, 'expected one ops alert to admin recipient');
      assert(h.notifications.length === 1, 'expected one notification dispatch');
      assert(h.firestore._summaries.has('exclusive_reconciliation'), 'expected persisted summary document');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
