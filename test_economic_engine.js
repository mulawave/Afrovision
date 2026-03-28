/**
 * ECONOMIC ENGINE — Production Integration Test
 *
 * Tests:
 * - 10 creators subscribe → community pool → vPT queue
 * - Batch creation groups all pending items
 * - Swap execution (dev mode) + ledger entries
 * - Distribution to each creator wallet
 * - Per-item failure isolation (frozen wallet)
 * - Batch retry mechanism
 * - Treasury balance endpoint
 * - Admin batch history + failed batches
 * - Ledger = source of truth verification
 *
 * Starts its OWN server on port 3002 to avoid conflicts.
 */

const http = require('http');

const PORT = 3002;
const BASE = `http://localhost:${PORT}`;
let adminToken = null;
let adminId = null;
const creators = []; // { email, token, id }
let passed = 0;
let failed = 0;

// ─── Helpers ────────────────────────────────────────────

function req(method, path, body, tokenOverride) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const tkn = tokenOverride || adminToken;
    if (tkn) opts.headers['Authorization'] = `Bearer ${tkn}`;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', (err) => resolve({ status: 0, body: { error: err.message } }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function assert(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

// ─── Test Suites ────────────────────────────────────────

async function setupAdmin() {
  console.log('\n=== SETUP: Admin Account ===');
  const email = `admin_econ_${Date.now()}@test.com`;
  const password = 'Admin1234!';

  let r = await req('POST', '/auth/register', { email, password });
  assert('Admin registered', r.status === 201);
  adminToken = r.body.token;
  adminId = r.body.user?.id;

  // Promote to admin via direct model access (no admin bootstrap endpoint)
  const User = require('./backend/src/users/user.model');
  const user = User.setRole(adminId, 'admin');
  assert('Admin role set', user && user.role === 'admin');

  // Set WALLET_SECRET so wallet encryption works in test
  r = await req('PATCH', '/admin/settings/WALLET_SECRET', { value: 'test-secret-key-for-integration-test' });
  assert('WALLET_SECRET configured', r.status === 200);
}

async function setup10Creators() {
  console.log('\n=== SETUP: 10 Creator Accounts ===');

  for (let i = 0; i < 10; i++) {
    const email = `creator_${i}_${Date.now()}@test.com`;
    const password = 'Creator1234!';

    let r = await req('POST', '/auth/register', { email, password });
    assert(`Creator ${i} registered`, r.status === 201);

    const token = r.body.token;
    const id = r.body.user?.id;

    creators.push({ email, token, id });
  }
  assert('10 creators ready', creators.length === 10);
}

async function testAdminSettings() {
  console.log('\n=== ADMIN SETTINGS: Verify economic parameters ===');

  let r = await req('GET', '/admin/settings');
  assert('Settings accessible', r.status === 200);

  const settings = r.body.settings || [];
  const poolSetting = settings.find(s => s.key === 'COMMUNITY_POOL_PERCENT');
  const extractSetting = settings.find(s => s.key === 'VPT_EXTRACTION_PERCENT');
  assert('COMMUNITY_POOL_PERCENT = 20', poolSetting?.value === '20');
  assert('VPT_EXTRACTION_PERCENT = 30', extractSetting?.value === '30');
}

async function testPlanActivation() {
  console.log('\n=== PLAN ACTIVATION: 10 creators subscribe ===');

  for (let i = 0; i < 10; i++) {
    const creator = creators[i];

    let r = await req('POST', '/subscriptions/subscribe', {
      planId: 'plan_pro',
    }, creator.token);

    assert(`Creator ${i} plan activated`, r.status === 200);
    assert(`Creator ${i} has vpt_queue`, !!r.body.vpt_queue?.id);
  }

  // Wait for async wallet creation to finish
  await new Promise((r) => setTimeout(r, 500));

  // Verify all creators have wallets
  const WalletModel = require('./backend/src/wallet/wallet.model');
  let walletsReady = 0;
  for (const creator of creators) {
    const wallet = WalletModel.findByUserId(creator.id);
    if (wallet) walletsReady++;
  }
  assert('All 10 wallets created', walletsReady === 10);
}

async function testQueueState() {
  console.log('\n=== QUEUE: Verify pending items ===');

  let r = await req('GET', '/vpt/admin/stats');
  assert('Stats accessible', r.status === 200);

  const stats = r.body.stats;
  assert('Queue stats has queue field', stats && stats.queue !== undefined);
  assert('Queue stats has batches field', stats && stats.batches !== undefined);
  assert('Pending items = 10', stats?.queue?.pending === 10);

  // Expected: ₦10,000 × 20% = ₦2,000 pool × 30% = ₦600 per creator
  const expectedNGN = 600 * 10; // ₦6,000 total
  assert(`Total NGN pending ≈ ₦${expectedNGN}`, stats?.queue?.total_ngn_pending === expectedNGN);
}

async function testCreatorQueueView() {
  console.log('\n=== CREATOR QUEUE: Individual queue view ===');

  const creator = creators[0];
  let r = await req('GET', '/vpt/queue', null, creator.token);
  assert('Creator can see own queue', r.status === 200);
  assert('Creator has 1 pending item', r.body.queue?.length === 1);
  assert('Queue item amount = ₦600', r.body.queue?.[0]?.ngn_value === 600);
}

async function testBatchProcessing() {
  console.log('\n=== BATCH PROCESSING: Full pipeline ===');

  let r = await req('POST', '/vpt/admin/process-batch');
  assert('Batch triggered', r.status === 200);
  assert('Result has batch_id', !!r.body.result?.batch_id);
  assert('Processed 10 items', r.body.result?.processed === 10);
  assert('All 10 distributed', r.body.result?.distributed === 10);
  assert('total_ngn = 6000', r.body.result?.total_ngn === 6000);
  assert('total_vpt > 0', r.body.result?.total_vpt > 0);
  assert('Has tx_hash', !!r.body.result?.tx_hash);

  // Store for later checks
  return r.body.result;
}

async function testLedgerSourceOfTruth(batchResult) {
  console.log('\n=== LEDGER: Source of truth verification ===');

  // Check admin ledger
  let r = await req('GET', '/vpt/admin/ledger?limit=100');
  assert('Admin ledger accessible', r.status === 200);
  const ledger = r.body.ledger || [];

  // Count entry types
  const queueEntries = ledger.filter(e => e.type === 'VPT_QUEUE');
  const swapEntries = ledger.filter(e => e.type === 'VPT_SWAP' && e.status === 'success');
  const distEntries = ledger.filter(e => e.type === 'VPT_DISTRIBUTION' && e.status === 'success');
  const splitEntries = ledger.filter(e => e.type === 'SPLIT');

  assert('10 VPT_QUEUE entries', queueEntries.length === 10);
  assert('1 VPT_SWAP entry (batched)', swapEntries.length === 1);
  assert('10 VPT_DISTRIBUTION entries', distEntries.length === 10);
  assert('10 SPLIT entries', splitEntries.length === 10);

  // Check swap entry references the batch
  const swapEntry = swapEntries[0];
  assert('Swap has batch_id meta', !!swapEntry?.meta?.batch_id);
  assert('Swap has tx_hash', !!swapEntry?.tx_hash);
  assert('Swap amount_ngn = 6000', swapEntry?.amount_ngn === 6000);

  // Check ledger stats
  r = await req('GET', '/vpt/admin/ledger-stats');
  assert('Ledger stats accessible', r.status === 200);
  assert('Ledger tracks total entries', r.body.stats?.total_entries > 0);
  assert('Ledger total_vpt_distributed > 0', r.body.stats?.total_vpt_distributed > 0);
  assert('Ledger total failures = 0', r.body.stats?.total_failures === 0);
}

async function testCreatorBalances(batchResult) {
  console.log('\n=== CREATOR BALANCES: Verify vPT distributed ===');

  const totalVPT = batchResult.total_vpt;
  const perCreator = Math.round(totalVPT / 10 * 100) / 100;

  for (let i = 0; i < 10; i++) {
    const creator = creators[i];
    let r = await req('GET', '/vpt/balance', null, creator.token);
    assert(`Creator ${i} balance ≈ ${perCreator} vPT`,
      r.status === 200 && Math.abs(r.body.balance - perCreator) < 0.01);
  }

  // Check individual ledger
  let r = await req('GET', '/vpt/ledger', null, creators[0].token);
  assert('Creator ledger accessible', r.status === 200);
  assert('Creator has ledger entries', r.body.ledger?.length > 0);
}

async function testBatchHistory() {
  console.log('\n=== BATCH HISTORY: Admin visibility ===');

  let r = await req('GET', '/vpt/admin/batches');
  assert('Batch history accessible', r.status === 200);
  assert('Has at least 1 batch', r.body.batches?.length >= 1);

  const batch = r.body.batches[0];
  assert('Batch status = distributed', batch?.status === 'distributed');
  assert('Batch item_count = 10', batch?.item_count === 10);
  assert('Batch has tx_hash', !!batch?.tx_hash);

  // No failed batches yet
  r = await req('GET', '/vpt/admin/batches/failed');
  assert('Failed batches endpoint works', r.status === 200);
  assert('No failed batches', r.body.batches?.length === 0);
}

async function testTreasuryBalance() {
  console.log('\n=== TREASURY: Balance check ===');

  let r = await req('GET', '/vpt/admin/treasury');
  assert('Treasury endpoint accessible', r.status === 200);
  assert('Treasury has mode field', r.body.treasury?.mode !== undefined);
  assert('Treasury has bnb field', r.body.treasury?.bnb !== undefined);
  assert('Treasury has vpt field', r.body.treasury?.vpt !== undefined);
}

async function testFrozenWalletIsolation() {
  console.log('\n=== FAILURE ISOLATION: Frozen wallet ===');

  // Register 3 more creators for this test
  const testCreators = [];
  for (let i = 0; i < 3; i++) {
    const email = `frozen_test_${i}_${Date.now()}@test.com`;
    let r = await req('POST', '/auth/register', { email, password: 'Creator1234!' });
    const token = r.body.token;
    const id = r.body.user?.id;
    testCreators.push({ email, token, id });
  }

  // Subscribe all 3 (auto-creates wallets and queues vPT)
  for (let i = 0; i < 3; i++) {
    await req('POST', '/subscriptions/subscribe', {
      planId: 'plan_pro',
    }, testCreators[i].token);
  }

  // Wait for async wallet creation
  await new Promise((r) => setTimeout(r, 500));

  // Freeze creator 1's wallet via direct model access
  const WalletModel = require('./backend/src/wallet/wallet.model');
  WalletModel.setStatus(testCreators[1].id, 'frozen');
  assert('Creator 1 wallet frozen', WalletModel.findByUserId(testCreators[1].id)?.status === 'frozen');

  // Process batch — creator 1 should fail (frozen), others succeed
  let r = await req('POST', '/vpt/admin/process-batch');
  assert('Frozen batch processed', r.status === 200);
  assert('Frozen batch has batch_id', !!r.body.result?.batch_id);
  assert('3 items in frozen batch', r.body.result?.processed === 3);

  // Check results: 2 distributed, 1 failed
  const results = r.body.result?.results || [];
  const distributed = results.filter(r => r.status === 'completed');
  const failedItems = results.filter(r => r.status === 'failed');
  assert('2 items distributed (non-frozen)', distributed.length === 2);
  assert('1 item failed (frozen wallet)', failedItems.length === 1);
  assert('Failed item reason = no_active_wallet', failedItems[0]?.error === 'no_active_wallet');
}

async function testEmptyBatch() {
  console.log('\n=== EDGE CASE: Empty batch (or retry of failed items) ===');

  let r = await req('POST', '/vpt/admin/process-batch');
  assert('Batch call returns 200', r.status === 200);
  // If there are retryable failed items from frozen wallet, a batch may be created
  // Otherwise it returns { processed: 0, message: 'No pending items' }
  const result = r.body.result;
  assert('Result is valid', result && typeof result === 'object');
}

async function testNonAdminAccess() {
  console.log('\n=== SECURITY: Non-admin access blocked ===');
  const creatorToken = creators[0].token;

  let r = await req('GET', '/vpt/admin/stats', null, creatorToken);
  assert('Stats blocked for non-admin', r.status === 403);

  r = await req('POST', '/vpt/admin/process-batch', null, creatorToken);
  assert('Batch trigger blocked for non-admin', r.status === 403);

  r = await req('GET', '/vpt/admin/treasury', null, creatorToken);
  assert('Treasury blocked for non-admin', r.status === 403);

  r = await req('GET', '/vpt/admin/batches', null, creatorToken);
  assert('Batch history blocked for non-admin', r.status === 403);
}

async function testQueueStatsAfterProcessing() {
  console.log('\n=== FINAL STATS: Post-processing state ===');

  let r = await req('GET', '/vpt/admin/stats');
  assert('Stats accessible', r.status === 200);

  const stats = r.body.stats;
  assert('No pending items left', stats?.queue?.pending === 0);
  assert('Completed items > 0', stats?.queue?.completed > 0);
  assert('Batches total ≥ 2', stats?.batches?.total >= 2);
  assert('Distributed batches ≥ 2', stats?.batches?.distributed >= 2);
}

// ─── Runner ─────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  ECONOMIC ENGINE — Production Integration    ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Start our own server on test port
  process.env.PORT = PORT;
  require('./backend/src/app.js');
  await new Promise((r) => setTimeout(r, 1000));

  try {
    await setupAdmin();
    await setup10Creators();
    await testAdminSettings();
    await testPlanActivation();
    await testQueueState();
    await testCreatorQueueView();
    const batchResult = await testBatchProcessing();
    await testLedgerSourceOfTruth(batchResult);
    await testCreatorBalances(batchResult);
    await testBatchHistory();
    await testTreasuryBalance();
    await testFrozenWalletIsolation();
    await testEmptyBatch();
    await testNonAdminAccess();
    await testQueueStatsAfterProcessing();
  } catch (err) {
    console.error('\n💥 FATAL:', err);
    failed++;
  }

  console.log(`\n${'═'.repeat(46)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('═'.repeat(46));
  process.exit(failed > 0 ? 1 : 0);
}

run();
