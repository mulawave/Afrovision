/**
 * AV-EXC-092 exclusive ops dashboard controller tests.
 * Run: node test/exclusive-ops-dashboard.test.js
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

function buildHarness() {
  const originals = new Map();

  const userPath = require.resolve('../src/users/user.model');
  const settingsPath = require.resolve('../src/admin/settings.service');
  const firestorePath = require.resolve('../src/utils/firestore');
  const targetPath = require.resolve('../src/admin/admin.controller');

  const summaryDoc = {
    trigger: 'ops-http',
    started_at: 100,
    finished_at: 200,
    scanned_active: 50,
    user_reminders_sent: 10,
    user_expiry_sent: 5,
    error_count: 1,
    anomaly_count: 2,
    ops_alerts_sent: 1,
  };

  function makeCountSnapshot(count) {
    return {
      data: () => ({ count }),
    };
  }

  function hasFilter(filters, key, value) {
    return filters.some((filter) => filter.field === key && filter.value === value);
  }

  function resolveCount(collectionName, filters) {
    if (collectionName === 'channels') {
      if (hasFilter(filters, 'type', 'exclusive') && hasFilter(filters, 'is_active', true)) {
        return 3;
      }
      if (hasFilter(filters, 'type', 'exclusive')) {
        return 5;
      }
    }

    if (collectionName === 'exclusive_channel_access') {
      if (hasFilter(filters, 'status', 'active')) return 12;
      if (hasFilter(filters, 'status', 'expired')) return 4;
    }

    return 0;
  }

  function makeQuery(collectionName, filters = []) {
    return {
      where(field, op, value) {
        return makeQuery(collectionName, [...filters, { field, op, value }]);
      },
      count() {
        return {
          get: async () => makeCountSnapshot(resolveCount(collectionName, filters)),
        };
      },
    };
  }

  withMock(userPath, {
    findById: (uid) => {
      if (uid === 'admin_1') return { id: 'admin_1', role: 'admin' };
      return { id: uid, role: 'viewer' };
    },
  }, originals);

  withMock(settingsPath, {
    get: async (key) => {
      if (key === 'EXCLUSIVE_ROLLOUT_ENABLED') return 'true';
      if (key === 'EXCLUSIVE_ROLLOUT_PERCENT') return '40';
      if (key === 'EXCLUSIVE_ROLLOUT_ALLOWLIST_USER_IDS') return 'u1,u2';
      return null;
    },
  }, originals);

  withMock(firestorePath, {
    getFirestore: () => ({
      collection: (name) => {
        if (name === 'ops_summaries') {
          return {
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({ ...summaryDoc }),
              }),
            }),
          };
        }
        return makeQuery(name);
      },
    }),
  }, originals);

  clearModule(targetPath);
  const controller = require('../src/admin/admin.controller');

  return {
    controller,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

(async function run() {
  console.log('\n-- AV-EXC-092 Exclusive Ops Dashboard Tests --\n');

  await test('returns exclusive ops dashboard payload for admin caller', async () => {
    const h = buildHarness();
    try {
      const req = { userId: 'admin_1' };
      const res = makeRes();
      await h.controller.getExclusiveOpsDashboard(req, res);

      assert(res.statusCode === 200, 'expected 200 response');
      assert(res.payload && res.payload.dashboard, 'dashboard payload missing');
      assert(res.payload.dashboard.exclusive.channels.total === 5, 'unexpected exclusive channel total');
      assert(res.payload.dashboard.exclusive.channels.active === 3, 'unexpected active exclusive channels');
      assert(res.payload.dashboard.exclusive.entitlements.active === 12, 'unexpected active entitlement count');
      assert(res.payload.dashboard.exclusive.rollout.percent === 40, 'unexpected rollout percent');
      assert(res.payload.dashboard.slo.current.scheduler_error_rate > 0, 'expected non-zero scheduler error rate');
      assert(String(res.payload.dashboard.runbook.path || '').includes('exclusive-ops-slo-runbook.md'), 'runbook path missing');
    } finally {
      h.teardown();
    }
  });

  await test('blocks non-admin caller', async () => {
    const h = buildHarness();
    try {
      const req = { userId: 'viewer_1' };
      const res = makeRes();
      await h.controller.getExclusiveOpsDashboard(req, res);

      assert(res.statusCode === 403, 'expected 403 for non-admin');
      assert(String(res.payload.error || '').toLowerCase().includes('admin'), 'expected admin access error');
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
