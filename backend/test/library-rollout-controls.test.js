/**
 * AV-LIB-070 rollout controls tests.
 * Run: node test/library-rollout-controls.test.js
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
  delete require.cache[targetPath];
  for (const [modPath, original] of originals.entries()) {
    if (original) require.cache[modPath] = original;
    else delete require.cache[modPath];
  }
}

console.log('\n-- AV-LIB-070 Library Rollout Control Tests --\n');

async function run() {
  await test('rollout disabled blocks all users', async () => {
    const originals = new Map();
    const settingsPath = require.resolve('../src/admin/settings.service');
    const targetPath = require.resolve('../src/library/library-rollout.service');

    const values = {
      LIBRARY_ROLLOUT_ENABLED: 'false',
      LIBRARY_ROLLOUT_PERCENT: '100',
      LIBRARY_ROLLOUT_ALLOWLIST_USER_IDS: '',
    };

    withMock(settingsPath, { get: async (key) => values[key] }, originals);
    const svc = require(targetPath);

    const enabled = await svc.isLibraryRolloutEnabledForUser('user_1');
    assert(enabled === false, 'expected disabled rollout to block user');

    restoreMocks(originals, targetPath);
  });

  await test('allowlist bypasses percent rollout', async () => {
    const originals = new Map();
    const settingsPath = require.resolve('../src/admin/settings.service');
    const targetPath = require.resolve('../src/library/library-rollout.service');

    const values = {
      LIBRARY_ROLLOUT_ENABLED: 'true',
      LIBRARY_ROLLOUT_PERCENT: '0',
      LIBRARY_ROLLOUT_ALLOWLIST_USER_IDS: 'vip_1,vip_2',
    };

    withMock(settingsPath, { get: async (key) => values[key] }, originals);
    const svc = require(targetPath);

    const allowlisted = await svc.isLibraryRolloutEnabledForUser('vip_2');
    const normalUser = await svc.isLibraryRolloutEnabledForUser('user_22');

    assert(allowlisted === true, 'allowlisted user should pass rollout gate');
    assert(normalUser === false, 'non-allowlisted user should be blocked at 0% rollout');

    restoreMocks(originals, targetPath);
  });

  await test('config normalization clamps percent and parses allowlist', async () => {
    const originals = new Map();
    const settingsPath = require.resolve('../src/admin/settings.service');
    const targetPath = require.resolve('../src/library/library-rollout.service');

    const values = {
      LIBRARY_ROLLOUT_ENABLED: 'true',
      LIBRARY_ROLLOUT_PERCENT: '199',
      LIBRARY_ROLLOUT_ALLOWLIST_USER_IDS: 'a1; a2 a3',
    };

    withMock(settingsPath, { get: async (key) => values[key] }, originals);
    const svc = require(targetPath);

    const config = await svc.getLibraryRolloutConfig();
    assert(config.percent === 100, 'percent should be clamped to 100');
    assert(config.allowlist.has('a1') && config.allowlist.has('a2') && config.allowlist.has('a3'), 'allowlist parsing failed');

    restoreMocks(originals, targetPath);
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
