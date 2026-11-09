const path = require('path');

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

console.log('\n-- Library Public vs Exclusive Policy Tests --\n');

async function run() {
  const channelModelPath = require.resolve('../src/channels/channel.model');
  const userModelPath = require.resolve('../src/users/user.model');
  const exclusiveAccessPath = require.resolve('../src/channels/exclusive_access.model');
  const exclusivePolicyPath = require.resolve('../src/channels/exclusive_policy.service');
  const targetPolicyPath = require.resolve('../src/library/library-policy.service');

  await test('public channel allows library access without KYC or PIC', async () => {
    const originals = new Map();
    const channels = {
      pub_1: { id: 'pub_1', type: 'public', owner_id: 'owner_1' },
    };

    withMock(channelModelPath, { findById: async (id) => channels[id] || null }, originals);
    withMock(exclusivePolicyPath, { isAdultKycVerified: async () => ({ isVerified: false, isMinor: false }) }, originals);
    withMock(exclusiveAccessPath, { findActiveByUserAndChannel: async () => null }, originals);

    const LibraryPolicyService = require(targetPolicyPath);
    const policy = new LibraryPolicyService();

    const hasAccess = await policy.hasLibraryAccess('user_regular', 'pub_1');
    assert(hasAccess === true, 'public channel library should be accessible to regular user');

    const canViewList = await policy.canViewLibraryList('user_regular', 'pub_1');
    assert(canViewList === true, 'public channel library list should be viewable');

    const canRead = await policy.canAccessReader('user_regular', 'pub_1', 'item_1');
    assert(canRead === true, 'public channel reader should be accessible');

    const canFav = await policy.canModifyFavorites('user_regular', 'pub_1', 'item_1');
    assert(canFav === true, 'authenticated user should be able to favorite public channel items');

    restoreMocks(originals, targetPolicyPath);
  });

  await test('exclusive channel blocks user without active PIC', async () => {
    const originals = new Map();
    const channels = {
      excl_1: { id: 'excl_1', type: 'exclusive', owner_id: 'owner_99' },
    };

    withMock(channelModelPath, { findById: async (id) => channels[id] || null }, originals);
    withMock(userModelPath, { findById: async () => ({ role: 'user' }) }, originals);
    withMock(exclusivePolicyPath, { isAdultKycVerified: async () => ({ isVerified: true, isMinor: false }) }, originals);
    withMock(exclusiveAccessPath, { findActiveByUserAndChannel: async () => null }, originals);

    const LibraryPolicyService = require(targetPolicyPath);
    const policy = new LibraryPolicyService();

    const hasAccess = await policy.hasLibraryAccess('user_regular', 'excl_1');
    assert(hasAccess === false, 'exclusive channel without PIC should deny access');

    const canRead = await policy.canAccessReader('user_regular', 'excl_1', 'item_1');
    assert(canRead === false, 'exclusive channel reader should be denied without PIC');

    restoreMocks(originals, targetPolicyPath);
  });

  await test('exclusive channel allows access with active PIC and adult KYC', async () => {
    const originals = new Map();
    const channels = {
      excl_1: { id: 'excl_1', type: 'exclusive', owner_id: 'owner_99' },
    };

    withMock(channelModelPath, { findById: async (id) => channels[id] || null }, originals);
    withMock(userModelPath, { findById: async () => ({ role: 'user' }) }, originals);
    withMock(exclusivePolicyPath, { isAdultKycVerified: async () => ({ isVerified: true, isMinor: false }) }, originals);
    withMock(exclusiveAccessPath, { findActiveByUserAndChannel: async () => ({ id: 'pic_123', status: 'active' }) }, originals);

    const LibraryPolicyService = require(targetPolicyPath);
    const policy = new LibraryPolicyService();

    const hasAccess = await policy.hasLibraryAccess('user_member', 'excl_1');
    assert(hasAccess === true, 'exclusive channel with active PIC + KYC should allow access');

    const canRead = await policy.canAccessReader('user_member', 'excl_1', 'item_1');
    assert(canRead === true, 'exclusive channel reader should allow access to member');

    restoreMocks(originals, targetPolicyPath);
  });

  await test('exclusive channel allows channel owner bypass', async () => {
    const originals = new Map();
    const channels = {
      excl_1: { id: 'excl_1', type: 'exclusive', owner_id: 'owner_1' },
    };

    withMock(channelModelPath, { findById: async (id) => channels[id] || null }, originals);
    withMock(userModelPath, { findById: async () => ({ role: 'creator' }) }, originals);
    withMock(exclusivePolicyPath, { isAdultKycVerified: async () => ({ isVerified: false, isMinor: false }) }, originals);
    withMock(exclusiveAccessPath, { findActiveByUserAndChannel: async () => null }, originals);

    const LibraryPolicyService = require(targetPolicyPath);
    const policy = new LibraryPolicyService();

    const hasAccess = await policy.hasLibraryAccess('owner_1', 'excl_1');
    assert(hasAccess === true, 'channel owner should bypass exclusive checks');

    restoreMocks(originals, targetPolicyPath);
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
