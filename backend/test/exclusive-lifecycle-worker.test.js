/**
 * Exclusive lifecycle worker integration-style tests (mocked dependencies).
 * Run: node test/exclusive-lifecycle-worker.test.js
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

function withFrozenNow(nowMs, fn) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Date.now = originalNow;
    });
}

function buildWorkerHarness({ accesses, channels = {}, users = {} }) {
  const originals = new Map();

  const accessPath = require.resolve('../src/channels/exclusive_access.model');
  const channelPath = require.resolve('../src/channels/channel.model');
  const userPath = require.resolve('../src/users/user.model');
  const notificationPath = require.resolve('../src/notifications/notification.service');
  const emailPath = require.resolve('../src/utils/email');
  const messagesPath = require.resolve('../src/channels/exclusive_lifecycle.messages');
  const firestorePath = require.resolve('../src/utils/firestore');
  const workerPath = require.resolve('../src/channels/exclusive_lifecycle.worker');

  const state = {
    notifications: [],
    emails: [],
    markReminderSent: [],
    markExpired: [],
    markExpiryNotified: [],
    markLifecycleFlag: [],
    summaryWrites: [],
  };

  const ExclusiveAccessMock = {
    listActiveAccesses: async () => accesses.map((entry) => ({ ...entry })),
    markReminderSent: async (id, bucket, sentAt) => {
      state.markReminderSent.push({ id, bucket, sentAt });
      return { id, bucket, sentAt };
    },
    markExpired: async (id, expiredAt) => {
      state.markExpired.push({ id, expiredAt });
      return { id, expiredAt };
    },
    markExpiryNotified: async (id, notifiedAt) => {
      state.markExpiryNotified.push({ id, notifiedAt });
      return { id, notifiedAt };
    },
    markLifecycleFlag: async (id, flag, at) => {
      state.markLifecycleFlag.push({ id, flag, at });
      return { id, flag, at };
    },
  };

  const ChannelMock = {
    findById: async (channelId) => channels[channelId] || null,
  };

  const UserMock = {
    findById: async (userId) => users[userId] || null,
    getAll: async () => Object.values(users),
  };

  const NotificationServiceMock = {
    notifyUser: async (userId, payload) => {
      state.notifications.push({ userId, payload });
      return { successCount: 1, failureCount: 0 };
    },
  };

  const EmailMock = {
    sendExclusiveLifecycleEmail: async (payload) => {
      state.emails.push(payload);
      return true;
    },
  };

  const MessagesMock = {
    buildExclusiveLifecycleMessage: (event, params = {}) => ({
      title: `title:${event}`,
      body: `body:${event}:${params.channelName || ''}`,
      type: `type:${event}`,
      emailSubject: `subject:${event}`,
      ctaLabel: `cta:${event}`,
    }),
  };

  const FirestoreMock = {
    getFirestore: () => ({
      collection: (name) => {
        if (name !== 'ops_summaries') {
          throw new Error(`Unexpected collection ${name}`);
        }

        return {
          doc: (docId) => ({
            set: async (payload) => {
              state.summaryWrites.push({ docId, payload });
            },
          }),
        };
      },
    }),
  };

  withMock(accessPath, ExclusiveAccessMock, originals);
  withMock(channelPath, ChannelMock, originals);
  withMock(userPath, UserMock, originals);
  withMock(notificationPath, NotificationServiceMock, originals);
  withMock(emailPath, EmailMock, originals);
  withMock(messagesPath, MessagesMock, originals);
  withMock(firestorePath, FirestoreMock, originals);

  clearModule(workerPath);
  const worker = require('../src/channels/exclusive_lifecycle.worker');

  return {
    worker,
    state,
    teardown() {
      restoreMocks(originals, workerPath);
    },
  };
}

(async function run() {
  console.log('\n-- Exclusive Lifecycle Worker Tests --\n');

  await test('d3 reminder sends user reminder only and marks reminder bucket', async () => {
    const now = 1_800_000_000_000;
    const harness = buildWorkerHarness({
      accesses: [
        {
          id: 'acc_1',
          user_uid: 'viewer_1',
          channel_id: 'ch_1',
          expires_at: now + (2 * 24 * 60 * 60 * 1000),
          reminder_sent_at: {},
          lifecycle_flags: {},
        },
      ],
      channels: {
        ch_1: { id: 'ch_1', name: 'Culture Stage', owner_id: 'owner_1' },
      },
      users: {
        viewer_1: { id: 'viewer_1', email: 'viewer1@example.com', role: 'viewer' },
        owner_1: { id: 'owner_1', email: 'owner1@example.com', role: 'creator' },
      },
    });

    try {
      await withFrozenNow(now, async () => {
        const summary = await harness.worker.processExclusiveLifecycle();
        assert(summary.user_reminders_sent === 1, 'expected one user reminder');
        assert(summary.creator_reminders_sent === 0, 'creator reminder should not send for d3');
      });

      assert(harness.state.markReminderSent.length === 1, 'expected markReminderSent once');
      assert(harness.state.markReminderSent[0].bucket === 'd3', 'expected d3 reminder bucket');
      assert(harness.state.notifications.length === 1, 'expected one notification');
      assert(harness.state.notifications[0].userId === 'viewer_1', 'expected notification for viewer');
    } finally {
      harness.teardown();
    }
  });

  await test('expired entitlement sends user+creator expiry, flags, and marks expired', async () => {
    const now = 1_800_000_000_000;
    const harness = buildWorkerHarness({
      accesses: [
        {
          id: 'acc_expired',
          user_uid: 'viewer_2',
          channel_id: 'ch_2',
          expires_at: now - 1000,
          reminder_sent_at: {},
          lifecycle_flags: {},
        },
      ],
      channels: {
        ch_2: { id: 'ch_2', name: 'Drama Empire', owner_id: 'owner_2' },
      },
      users: {
        viewer_2: { id: 'viewer_2', email: 'viewer2@example.com', role: 'viewer' },
        owner_2: { id: 'owner_2', email: 'owner2@example.com', role: 'creator' },
      },
    });

    try {
      await withFrozenNow(now, async () => {
        const summary = await harness.worker.processExclusiveLifecycle();
        assert(summary.expired_marked === 1, 'expected expired mark');
        assert(summary.user_expiry_sent === 1, 'expected user expiry notice');
        assert(summary.creator_expiry_sent === 1, 'expected creator expiry notice');
      });

      assert(harness.state.markExpired.length === 1, 'expected markExpired once');
      assert(harness.state.markExpiryNotified.length === 1, 'expected markExpiryNotified once');
      assert(
        harness.state.markLifecycleFlag.some((entry) => entry.flag === 'creator_expired'),
        'expected creator_expired lifecycle flag',
      );
      assert(harness.state.notifications.length === 2, 'expected two expiry notifications');
    } finally {
      harness.teardown();
    }
  });

  await test('d1 reminder sends creator renewal risk unless already flagged', async () => {
    const now = 1_800_000_000_000;
    const harness = buildWorkerHarness({
      accesses: [
        {
          id: 'acc_d1',
          user_uid: 'viewer_3',
          channel_id: 'ch_3',
          expires_at: now + (12 * 60 * 60 * 1000),
          reminder_sent_at: {},
          lifecycle_flags: {},
        },
      ],
      channels: {
        ch_3: { id: 'ch_3', name: 'Prime Night', owner_id: 'owner_3' },
      },
      users: {
        viewer_3: { id: 'viewer_3', email: 'viewer3@example.com', role: 'viewer' },
        owner_3: { id: 'owner_3', email: 'owner3@example.com', role: 'creator' },
      },
    });

    try {
      await withFrozenNow(now, async () => {
        const summary = await harness.worker.processExclusiveLifecycle();
        assert(summary.user_reminders_sent === 1, 'expected viewer d1 reminder');
        assert(summary.creator_reminders_sent === 1, 'expected creator d1 risk reminder');
      });

      assert(
        harness.state.markLifecycleFlag.some((entry) => entry.flag === 'creator_d1'),
        'expected creator_d1 lifecycle flag',
      );
      assert(harness.state.notifications.length === 2, 'expected viewer and creator notifications');
    } finally {
      harness.teardown();
    }
  });

  await test('already-sent reminder bucket is skipped (dedupe)', async () => {
    const now = 1_800_000_000_000;
    const harness = buildWorkerHarness({
      accesses: [
        {
          id: 'acc_dedupe',
          user_uid: 'viewer_4',
          channel_id: 'ch_4',
          expires_at: now + (2 * 24 * 60 * 60 * 1000),
          reminder_sent_at: { d3: now - 1000 },
          lifecycle_flags: {},
        },
      ],
      channels: {
        ch_4: { id: 'ch_4', name: 'Cinema Gold', owner_id: 'owner_4' },
      },
      users: {
        viewer_4: { id: 'viewer_4', email: 'viewer4@example.com', role: 'viewer' },
        owner_4: { id: 'owner_4', email: 'owner4@example.com', role: 'creator' },
      },
    });

    try {
      await withFrozenNow(now, async () => {
        const summary = await harness.worker.processExclusiveLifecycle();
        assert(summary.user_reminders_sent === 0, 'expected no reminder due to dedupe');
        assert(summary.creator_reminders_sent === 0, 'expected no creator reminder due to dedupe');
      });

      assert(harness.state.notifications.length === 0, 'no notifications expected for deduped access');
      assert(harness.state.markReminderSent.length === 0, 'no reminder mark expected for deduped access');
    } finally {
      harness.teardown();
    }
  });

  await test('anomaly triggers ops alerts and summary write', async () => {
    const now = 1_800_000_000_000;
    const harness = buildWorkerHarness({
      accesses: [
        {
          id: 'acc_bad',
          user_uid: 'viewer_5',
          channel_id: 'ch_5',
          expires_at: null,
          reminder_sent_at: {},
          lifecycle_flags: {},
        },
      ],
      channels: {
        ch_5: { id: 'ch_5', name: 'Noir Vault', owner_id: 'owner_5' },
      },
      users: {
        admin_1: { id: 'admin_1', email: 'admin1@example.com', role: 'admin' },
        admin_2: { id: 'admin_2', email: 'admin2@example.com', role: 'admin' },
      },
    });

    try {
      await withFrozenNow(now, async () => {
        const summary = await harness.worker.processExclusiveLifecycle();
        assert(summary.anomaly_count === 1, 'expected one anomaly');
        assert(summary.ops_alerts_sent === 2, 'expected ops alerts to admin recipients');
      });

      assert(harness.state.summaryWrites.length === 1, 'expected one summary write');
      assert(
        harness.state.notifications.every((entry) => entry.userId.startsWith('admin_')),
        'expected only admin recipients for ops alerts',
      );
      assert(harness.state.emails.length === 2, 'expected ops alert emails to admins');
    } finally {
      harness.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
