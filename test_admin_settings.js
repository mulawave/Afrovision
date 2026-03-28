/**
 * Test: Admin Settings System
 * Verifies runtime-configurable settings via admin panel.
 * Starts its OWN server on port 3001 to avoid stale instance conflicts.
 */
const http = require('http');

const PORT = 3001;
const BASE = `http://localhost:${PORT}`;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(opts, (res) => {
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
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  // Start our own server on test port
  process.env.PORT = PORT;
  require('./backend/src/app.js');
  await new Promise((r) => setTimeout(r, 1000)); // Wait for server to start

  const ts = Date.now();

  // 1. Register admin user
  console.log('\n1. Setup — register + promote to admin');
  const reg = await request('POST', '/auth/register', {
    email: `admin_settings_${ts}@test.com`,
    password: 'Test123!@#',
  });
  assert('Register admin user', reg.status === 201);
  const adminToken = reg.body.token;

  // Promote to admin (need another admin — register as first admin via set-role workaround)
  // For testing, we'll directly set role if there's a bootstrap — but since there isn't,
  // let's just test that non-admin gets 403 first, then we'll use the admin user from tests.

  // Actually, let's register a second user and test access control
  const reg2 = await request('POST', '/auth/register', {
    email: `viewer_settings_${ts}@test.com`,
    password: 'Test123!@#',
  });
  const viewerToken = reg2.body.token;

  // 2. Non-admin should get 403 on settings
  console.log('\n2. Access control — non-admin blocked');
  const forbidden = await request('GET', '/admin/settings', null, viewerToken);
  assert('Non-admin gets 403', forbidden.status === 403, `got ${forbidden.status}: ${JSON.stringify(forbidden.body)}`);

  // We need to manually make the first user admin for testing
  // Use the user model directly — but since we're testing via HTTP, we need a bootstrap
  // Let's test what we can without admin first, then create a standalone test

  // For integration test, we'll use a direct node require approach
  console.log('\n3. Direct model tests (Settings.get/set)');

  // Test settings model directly
  const Settings = require('./backend/src/admin/settings.model');

  // Get with defaults
  const pancakeDefault = Settings.get('PANCAKE_ROUTER');
  assert('Default PANCAKE_ROUTER', pancakeDefault === '0x10ED43C718714eb63d5aA57B78B54704E256024E', pancakeDefault);

  const rateDefault = Settings.getNumber('NGN_TO_BNB_RATE');
  assert('Default NGN_TO_BNB_RATE', rateDefault === 0.0000004, String(rateDefault));

  const poolDefault = Settings.getNumber('COMMUNITY_POOL_PERCENT');
  assert('Default COMMUNITY_POOL_PERCENT', poolDefault === 30, String(poolDefault));

  // Set override
  const setResult = Settings.set('NGN_TO_BNB_RATE', '0.0000005');
  assert('Set NGN_TO_BNB_RATE override', setResult && setResult.source === 'admin_override');

  const newRate = Settings.getNumber('NGN_TO_BNB_RATE');
  assert('Override takes effect', newRate === 0.0000005, String(newRate));

  // Set community pool
  Settings.set('COMMUNITY_POOL_PERCENT', '25');
  assert('Set COMMUNITY_POOL_PERCENT to 25', Settings.getNumber('COMMUNITY_POOL_PERCENT') === 25);

  // Bulk set
  const bulkResults = Settings.bulkSet([
    { key: 'BATCH_SIZE', value: '200' },
    { key: 'MAX_RETRY_ATTEMPTS', value: '5' },
  ]);
  assert('Bulk set 2 settings', bulkResults.length === 2);
  assert('BATCH_SIZE = 200', Settings.getNumber('BATCH_SIZE') === 200);
  assert('MAX_RETRY_ATTEMPTS = 5', Settings.getNumber('MAX_RETRY_ATTEMPTS') === 5);

  // Get all
  const all = Settings.getAll();
  assert('Get all returns 10 settings', all.length === 10, String(all.length));

  // Check sensitive masking
  Settings.set('WALLET_SECRET', 'my-super-secret-key');
  const walletSetting = Settings.getOne('WALLET_SECRET');
  assert('Sensitive value masked', walletSetting.value === '********');
  assert('Actual value accessible via get()', Settings.get('WALLET_SECRET') === 'my-super-secret-key');

  // Reset
  const resetResult = Settings.reset('NGN_TO_BNB_RATE');
  assert('Reset removes override', resetResult.source === 'default' || resetResult.source === 'env');
  const resetRate = Settings.getNumber('NGN_TO_BNB_RATE');
  assert('Rate back to default 0.0000004', resetRate === 0.0000004, String(resetRate));

  // Invalid key
  assert('Invalid key returns undefined', Settings.get('NONEXISTENT') === undefined);
  assert('isValidKey false for invalid', !Settings.isValidKey('NONEXISTENT'));
  assert('isValidKey true for valid', Settings.isValidKey('BSC_RPC'));

  // 4. Test swap service reads from settings
  console.log('\n4. SwapService reads from admin settings');
  Settings.set('NGN_TO_BNB_RATE', '0.0000008');
  const SwapService = require('./backend/src/vpt/swap.service');
  const bnb = SwapService.convertNGNtoBNB(1000000); // 1M NGN
  assert('SwapService uses admin rate', Math.abs(bnb - 0.8) < 0.0001, String(bnb));

  // Change rate again — should reflect immediately
  Settings.set('NGN_TO_BNB_RATE', '0.0000002');
  const bnb2 = SwapService.convertNGNtoBNB(1000000);
  assert('Rate change reflects immediately', Math.abs(bnb2 - 0.2) < 0.0001, String(bnb2));

  // 5. Test admin API endpoints (need admin user)
  console.log('\n5. Admin API endpoints');

  // Since we're in the same process, the User model is shared with the server
  const User = require('./backend/src/users/user.model');
  const adminUser = User.findByEmail(`admin_settings_${ts}@test.com`);
  assert('Admin user found in shared model', !!adminUser, adminUser ? 'found' : 'not found');
  if (adminUser) {
    User.setRole(adminUser.id, 'admin');

    const settingsRes = await request('GET', '/admin/settings', null, adminToken);
    assert('GET /admin/settings returns 200', settingsRes.status === 200);
    assert('Returns settings array', Array.isArray(settingsRes.body.settings));
    assert('Has 10 settings', settingsRes.body.settings.length === 10, String(settingsRes.body.settings.length));

    // Get single setting
    const singleRes = await request('GET', '/admin/settings/PANCAKE_ROUTER', null, adminToken);
    assert('GET single setting', singleRes.status === 200 && singleRes.body.setting.key === 'PANCAKE_ROUTER');

    // Update setting
    const updateRes = await request('PATCH', '/admin/settings/NGN_TO_BNB_RATE', { value: '0.0000006' }, adminToken);
    assert('PATCH update setting', updateRes.status === 200 && updateRes.body.setting.source === 'admin_override');

    // Verify it took effect
    const verifyRes = await request('GET', '/admin/settings/NGN_TO_BNB_RATE', null, adminToken);
    assert('Updated value persists', verifyRes.body.setting.value === '0.0000006');

    // Bulk update
    const bulkRes = await request('PATCH', '/admin/settings/bulk', {
      settings: [
        { key: 'BATCH_SIZE', value: '500' },
        { key: 'MAX_RETRY_ATTEMPTS', value: '10' },
      ],
    }, adminToken);
    assert('Bulk update returns results', bulkRes.status === 200 && bulkRes.body.updated.length === 2);

    // Reset
    const resetRes = await request('POST', '/admin/settings/NGN_TO_BNB_RATE/reset', null, adminToken);
    assert('Reset setting', resetRes.status === 200 && resetRes.body.setting.source !== 'admin_override');

    // Invalid key
    const invalidRes = await request('PATCH', '/admin/settings/FAKE_KEY', { value: 'test' }, adminToken);
    assert('Invalid key returns 404', invalidRes.status === 404);

    // Missing value
    const noValRes = await request('PATCH', '/admin/settings/BATCH_SIZE', {}, adminToken);
    assert('Missing value returns 400', noValRes.status === 400);
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'='.repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
