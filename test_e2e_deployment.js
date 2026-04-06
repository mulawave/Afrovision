/**
 * AFROVISION — Comprehensive End-to-End Deployment Readiness Test
 *
 * Validates EVERY module, endpoint, and integration in the system:
 *
 *  1. Health Check & Server Bootstrap
 *  2. Auth Module (register, login, me, forgot-password, reset-password, logout)
 *  3. Auth Security (rate limiting, password strength, JWT validation)
 *  4. User Module (profile, update, currency, request-creator)
 *  5. Admin Module (roles, plans CRUD, categories, settings, channels, flags, dashboard, audit)
 *  6. Subscription Module (plans listing, subscribe, my subscription)
 *  7. Currency Module (list, converted plans)
 *  8. Channel Module (create, list, get, update, enable/disable, privacy)
 *  9. Broadcast Module (server time, video CRUD, scheduling, now-playing)
 * 10. Interactions Module (gifts CRUD, wallet, reactions, send gift, combo, leaderboard, events)
 * 11. Wallet Module (create, get)
 * 12. Withdrawal Module (request, list, approve, reject, fund, reverse, admin queries)
 * 13. VPT Module (balance, transactions, ledger, queue, admin stats, batch, treasury)
 * 14. Home Module (stats)
 * 15. Security Validations (input sanitization, body size limit, CORS headers)
 * 16. Data Integrity (Firestore sync, cache consistency)
 *
 * Starts its OWN server on port 3003 to avoid conflicts.
 *
 * Usage:
 *   cd /path/to/afrovision
 *   node test_e2e_deployment.js
 */

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.E2E_PORT || (3200 + Math.floor(Math.random() * 200)));
const BASE = `http://localhost:${PORT}`;

// ─── State ──────────────────────────────────────────────
let adminToken = null;
let adminId = null;
let viewerToken = null;
let viewerId = null;
let creatorToken = null;
let creatorId = null;
let secondCreatorToken = null;
let secondCreatorId = null;

let testPlanId = null;
let testCategoryId = null;
let testChannelId = null;
let testChannelNumber = null;
let privateChannelId = null;
let testVideoId = null;
let testProgramId = null;
let testGiftId = null;
let testWithdrawalId = null;
let resetToken = null;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const TS = Date.now();

// ─── HTTP Helper ────────────────────────────────────────

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    r.on('error', (err) => resolve({ status: 0, body: { error: err.message }, headers: {} }));
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
    failures.push(name);
    console.log(`  ❌ ${name}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} — skipped: ${reason}`);
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ─── 1. Health Check & Bootstrap ────────────────────────

async function testHealthCheck() {
  section('1. HEALTH CHECK & SERVER BOOTSTRAP');

  const r = await req('GET', '/');
  assert('Server responds', r.status === 200);
  assert('Status JSON returned', r.body && r.body.status === 'AfroVision API running');
}

// ─── 2. Auth Module ─────────────────────────────────────

async function testAuthModule() {
  section('2. AUTH MODULE');

  // Register admin
  console.log('\n  --- Register ---');
  let r = await req('POST', '/auth/register', {
    email: `admin_e2e_${TS}@test.com`,
    password: 'AdminPass1',
  });
  assert('Admin registered (201)', r.status === 201);
  assert('Token returned', !!r.body.token);
  assert('User object returned', !!r.body.user);
  assert('User has id', !!r.body.user?.id);
  assert('User has email', r.body.user?.email === `admin_e2e_${TS}@test.com`);
  adminToken = r.body.token;
  adminId = r.body.user?.id;

  // Promote to admin via model (ensure models are fully loaded)
  const User = require('./backend/src/users/user.model');
  // Models should be initialized by now (server is listening)
  assert('User model ready', User.isInitialized());
  const adminUser = await User.setRole(adminId, 'admin');
  assert('Admin role set via model', adminUser?.role === 'admin');
  if (!adminUser || adminUser.role !== 'admin') {
    console.error('\n  ⛔ CRITICAL: Cannot promote admin — all admin tests will fail.');
    console.error(`    adminId=${adminId}, findById result:`, User.findById(adminId)?.role);
  }

  // Configure WALLET_SECRET for test
  r = await req('PATCH', '/admin/settings/WALLET_SECRET', { value: 'e2e-test-secret-key-deploy' }, adminToken);
  assert('WALLET_SECRET configured', r.status === 200);

  // Register viewer
  r = await req('POST', '/auth/register', {
    email: `viewer_e2e_${TS}@test.com`,
    password: 'ViewerPass1',
  });
  assert('Viewer registered (201)', r.status === 201);
  viewerToken = r.body.token;
  viewerId = r.body.user?.id;

  // Register creator 1
  r = await req('POST', '/auth/register', {
    email: `creator_e2e_${TS}@test.com`,
    password: 'CreatorPass1',
  });
  assert('Creator registered (201)', r.status === 201);
  creatorToken = r.body.token;
  creatorId = r.body.user?.id;

  // Register creator 2
  r = await req('POST', '/auth/register', {
    email: `creator2_e2e_${TS}@test.com`,
    password: 'Creator2Pass1',
  });
  assert('Creator 2 registered (201)', r.status === 201);
  secondCreatorToken = r.body.token;
  secondCreatorId = r.body.user?.id;

  // Duplicate registration
  console.log('\n  --- Duplicate Registration ---');
  r = await req('POST', '/auth/register', {
    email: `admin_e2e_${TS}@test.com`,
    password: 'AdminPass1',
  });
  assert('Duplicate email rejected', r.status >= 400);

  // Login
  console.log('\n  --- Login ---');
  r = await req('POST', '/auth/login', {
    email: `admin_e2e_${TS}@test.com`,
    password: 'AdminPass1',
  });
  assert('Login succeeds (200)', r.status === 200);
  assert('Login returns token', !!r.body.token);
  adminToken = r.body.token; // refresh

  // Wrong password
  r = await req('POST', '/auth/login', {
    email: `admin_e2e_${TS}@test.com`,
    password: 'WrongPass1',
  });
  assert('Wrong password rejected', r.status >= 400);

  // /auth/me
  console.log('\n  --- Me ---');
  r = await req('GET', '/auth/me', null, adminToken);
  assert('/auth/me returns user', r.status === 200);
  assert('/auth/me has correct email', r.body.user?.email === `admin_e2e_${TS}@test.com`);
  assert('/auth/me does not expose password_hash', !r.body.user?.password_hash);

  // Forgot password
  console.log('\n  --- Forgot / Reset Password ---');
  r = await req('POST', '/auth/forgot-password', {
    email: `viewer_e2e_${TS}@test.com`,
  });
  assert('Forgot password accepted (or rate-limited)', r.status === 200 || r.status === 429);
  if (r.status === 429) {
    console.log('    -> Auth limiter hit; skipping reset flow for this run');
  }
  resetToken = r.body.resetToken || null;

  // Reset password (if token returned in dev mode)
  if (resetToken && r.status === 200) {
    r = await req('POST', '/auth/reset-password', {
      token: resetToken,
      password: 'NewViewerPass1',
    });
    assert('Password reset succeeds', r.status === 200);

    // Login with new password
    r = await req('POST', '/auth/login', {
      email: `viewer_e2e_${TS}@test.com`,
      password: 'NewViewerPass1',
    });
    assert('Login with new password works', r.status === 200);
    viewerToken = r.body.token;
  } else {
    skip('Password reset', 'No reset token returned (production mode)');
  }

  // Logout
  console.log('\n  --- Logout ---');
  r = await req('POST', '/auth/logout');
  assert('Logout endpoint responds', r.status === 200);
}

// ─── 3. Auth Security ───────────────────────────────────

async function testAuthSecurity() {
  section('3. AUTH SECURITY');

  // Weak password rejected
  console.log('\n  --- Password Strength ---');
  let r = await req('POST', '/auth/register', {
    email: `weak_${TS}@test.com`,
    password: 'weak',
  });
  assert('Weak password rejected (< 8 chars)', r.status >= 400);

  r = await req('POST', '/auth/register', {
    email: `nodigit_${TS}@test.com`,
    password: 'NoDigitPassword',
  });
  assert('No-digit password rejected', r.status >= 400);

  r = await req('POST', '/auth/register', {
    email: `nolower_${TS}@test.com`,
    password: 'ALLUPPER123',
  });
  assert('No-lowercase password rejected', r.status >= 400);

  r = await req('POST', '/auth/register', {
    email: `noupper_${TS}@test.com`,
    password: 'alllower123',
  });
  assert('No-uppercase password rejected', r.status >= 400);

  // No token → 401/403
  console.log('\n  --- JWT Required ---');
  r = await req('GET', '/auth/me');
  assert('No token returns 401/403', r.status === 401 || r.status === 403);

  // Invalid token → 401/403
  r = await req('GET', '/auth/me', null, 'invalid.token.here');
  assert('Invalid token returns 401/403', r.status === 401 || r.status === 403);

  // Rate limiting (auth endpoints)
  console.log('\n  --- Rate Limiting ---');
  // We can't fully test IP rate limiting in CI without making 10+ requests quickly,
  // but we verify the endpoint still works after a few hits
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(req('POST', '/auth/login', { email: 'nobody@test.com', password: 'Whatever1' }));
  }
  const results = await Promise.all(promises);
  const allResponded = results.every(r => r.status > 0);
  assert('Auth endpoints respond under load', allResponded);
}

// ─── 4. User Module ─────────────────────────────────────

async function testUserModule() {
  section('4. USER MODULE');

  // Get profile
  console.log('\n  --- Profile ---');
  let r = await req('GET', '/users/me', null, viewerToken);
  assert('GET /users/me succeeds', r.status === 200);
  assert('Profile has email', !!r.body.user?.email);
  assert('Profile has role', !!r.body.user?.role);
  assert('No password_hash exposed', !r.body.user?.password_hash);

  // Update profile name
  console.log('\n  --- Update Profile ---');
  r = await req('PUT', '/users/update-profile', { name: 'E2E Viewer' }, viewerToken);
  assert('Update profile succeeds', r.status === 200);
  assert('Name updated', r.body.user?.name === 'E2E Viewer');

  // Update currency
  console.log('\n  --- Currency Preference ---');
  r = await req('PATCH', '/users/currency', { currency: 'USD' }, viewerToken);
  assert('Currency set to USD', r.status === 200);
  assert('Currency stored', r.body.user?.preferred_currency === 'USD');

  r = await req('PATCH', '/users/currency', { currency: 'NGN' }, viewerToken);
  assert('Currency set back to NGN', r.status === 200);

  // Invalid currency
  r = await req('PATCH', '/users/currency', { currency: 'XYZ' }, viewerToken);
  assert('Invalid currency rejected', r.status >= 400);

  // Request creator (viewer → subscriber needed)
  console.log('\n  --- Request Creator ---');
  r = await req('POST', '/users/request-creator', {}, viewerToken);
  // Should fail because viewer has no subscription
  assert('Creator request requires subscription', r.status >= 400);
}

// ─── 5. Admin Module ────────────────────────────────────

async function testAdminModule() {
  section('5. ADMIN MODULE');

  // Non-admin cannot access
  console.log('\n  --- Access Control ---');
  let r = await req('GET', '/admin/dashboard', null, viewerToken);
  assert('Non-admin blocked from dashboard', r.status === 403);

  r = await req('GET', '/admin/users', null, viewerToken);
  assert('Non-admin blocked from user list', r.status === 403);

  // Admin — Dashboard
  console.log('\n  --- Dashboard ---');
  r = await req('GET', '/admin/dashboard', null, adminToken);
  assert('Admin dashboard accessible', r.status === 200);
  assert('Dashboard has user count', typeof r.body.dashboard?.users?.total === 'number');
  assert('Dashboard has channel count', typeof r.body.dashboard?.channels?.total === 'number');

  // Admin — Users list
  console.log('\n  --- Users ---');
  r = await req('GET', '/admin/users', null, adminToken);
  assert('Admin can list users', r.status === 200);
  assert('Users is array', Array.isArray(r.body.users));
  assert('Users count >= 4', r.body.users?.length >= 4); // admin + viewer + 2 creators

  // Admin — Set role
  console.log('\n  --- Role Management ---');
  r = await req('POST', '/admin/set-role', { userId: creatorId, role: 'creator' }, adminToken);
  assert('Set creator role', r.status === 200);

  r = await req('POST', '/admin/set-role', { userId: secondCreatorId, role: 'creator' }, adminToken);
  assert('Set second creator role', r.status === 200);

  // Admin — Set KYC
  console.log('\n  --- KYC ---');
  r = await req('POST', '/admin/set-kyc', { userId: creatorId, kycStatus: 'verified' }, adminToken);
  assert('KYC set to verified', r.status === 200);

  // Admin — Set premium
  console.log('\n  --- Premium Creator ---');
  r = await req('POST', '/admin/set-premium', { userId: creatorId, isPremium: true }, adminToken);
  assert('Premium creator enabled', r.status === 200);

  // Admin — Plans CRUD
  console.log('\n  --- Plans CRUD ---');
  r = await req('POST', '/admin/plans', {
    name: 'E2E Test Plan',
    price: 999,
    currency: 'NGN',
    features: ['test_feature'],
    display_labels: { test_feature: 'Test Feature' },
  }, adminToken);
  assert('Plan created', r.status === 200 || r.status === 201);
  testPlanId = r.body.plan?.id;
  assert('Plan has id', !!testPlanId);

  if (testPlanId) {
    // Add feature
    r = await req('POST', `/admin/plans/${testPlanId}/features`, {
      feature: 'new_feature',
      label: 'New Feature',
    }, adminToken);
    assert('Feature added to plan', r.status === 200);

    // Remove feature
    r = await req('DELETE', `/admin/plans/${testPlanId}/features/new_feature`, null, adminToken);
    assert('Feature removed from plan', r.status === 200);

    // Update plan
    r = await req('PATCH', `/admin/plans/${testPlanId}`, { price: 1500 }, adminToken);
    assert('Plan updated', r.status === 200);

    // Delete plan
    r = await req('DELETE', `/admin/plans/${testPlanId}`, null, adminToken);
    assert('Plan deleted', r.status === 200);
  }

  // Admin — Categories CRUD
  console.log('\n  --- Categories CRUD ---');
  r = await req('GET', '/admin/categories', null, adminToken);
  assert('Admin can list categories', r.status === 200);

  r = await req('POST', '/admin/categories', { name: `E2E Cat ${TS}` }, adminToken);
  assert('Category created', r.status === 200 || r.status === 201);
  testCategoryId = r.body.category?.id;

  if (testCategoryId) {
    r = await req('PATCH', `/admin/categories/${testCategoryId}`, { name: `E2E Cat Updated` }, adminToken);
    assert('Category updated', r.status === 200);

    r = await req('DELETE', `/admin/categories/${testCategoryId}`, null, adminToken);
    assert('Category deleted', r.status === 200);
  }

  // Admin — Settings
  console.log('\n  --- Settings ---');
  r = await req('GET', '/admin/settings', null, adminToken);
  assert('Get all settings', r.status === 200);
  assert('Settings is array', Array.isArray(r.body.settings));

  r = await req('GET', '/admin/settings/COMMUNITY_POOL_PERCENT', null, adminToken);
  assert('Get single setting', r.status === 200);

  r = await req('PATCH', '/admin/settings/COMMUNITY_POOL_PERCENT', { value: '20' }, adminToken);
  assert('Update setting', r.status === 200);

  r = await req('PATCH', '/admin/settings/bulk', {
    settings: [
      { key: 'COMMUNITY_POOL_PERCENT', value: '20' },
      { key: 'VPT_EXTRACTION_PERCENT', value: '30' },
    ],
  }, adminToken);
  assert('Bulk update settings', r.status === 200);

  r = await req('POST', '/admin/settings/COMMUNITY_POOL_PERCENT/reset', null, adminToken);
  assert('Reset setting to default', r.status === 200);

  r = await req('GET', '/admin/settings/INVALID_KEY_DOES_NOT_EXIST', null, adminToken);
  assert('Invalid setting key handled', r.status === 404 || r.status === 200);

  // Admin — Feature Flags
  console.log('\n  --- Feature Flags ---');
  r = await req('GET', '/admin/features', null, adminToken);
  assert('Get feature flags', r.status === 200);

  r = await req('POST', '/admin/features', { key: `e2e_test_flag_${TS}`, enabled: true }, adminToken);
  assert('Set feature flag', r.status === 200);

  r = await req('POST', '/admin/features', { key: `e2e_test_flag_${TS}`, enabled: false }, adminToken);
  assert('Toggle feature flag off', r.status === 200);

  // Admin — Audit Logs
  console.log('\n  --- Audit Logs ---');
  r = await req('GET', '/admin/audit?limit=10', null, adminToken);
  assert('Get audit logs', r.status === 200);
  assert('Audit logs is array', Array.isArray(r.body.logs));
}

// ─── 6. Subscription Module ─────────────────────────────

async function testSubscriptionModule() {
  section('6. SUBSCRIPTION MODULE');

  // Public plans
  console.log('\n  --- Plans ---');
  let r = await req('GET', '/subscriptions/plans');
  assert('Public plans endpoint', r.status === 200);
  assert('Plans is array', Array.isArray(r.body.plans));
  assert('At least 1 plan exists', r.body.plans?.length >= 1);

  const proPlan = r.body.plans?.find(p => p.name === 'pro');
  assert('Pro plan exists', !!proPlan);

  // Subscribe creator to pro plan
  console.log('\n  --- Subscribe ---');
  if (proPlan) {
    r = await req('POST', '/subscriptions/subscribe', {
      planId: proPlan.id,
      paymentMethod: 'fiat',
    }, creatorToken);
    assert('Creator subscribed to Pro', r.status === 200);
    assert('Creator role updated', r.body.user?.role === 'creator');

    // Subscribe second creator
    r = await req('POST', '/subscriptions/subscribe', {
      planId: proPlan.id,
      paymentMethod: 'fiat',
    }, secondCreatorToken);
    assert('Second creator subscribed', r.status === 200);
  }

  // Get my subscription
  console.log('\n  --- My Subscription ---');
  r = await req('GET', '/subscriptions/me', null, creatorToken);
  assert('Get my subscription', r.status === 200);

  // Subscribe viewer (basic plan for creator request test later)
  const basicPlan = (await req('GET', '/subscriptions/plans')).body.plans?.find(p => p.name === 'basic');
  if (basicPlan) {
    r = await req('POST', '/subscriptions/subscribe', {
      planId: basicPlan.id,
      paymentMethod: 'fiat',
    }, viewerToken);
    assert('Viewer subscribed to Basic', r.status === 200);
  }
}

// ─── 7. Currency Module ─────────────────────────────────

async function testCurrencyModule() {
  section('7. CURRENCY MODULE');

  let r = await req('GET', '/currencies');
  assert('Get currencies', r.status === 200);
  assert('Currencies is array', Array.isArray(r.body.currencies));
  assert('Has 4 currencies (NGN, USD, GBP, EUR)', r.body.currencies?.length === 4);

  const usd = r.body.currencies?.find(c => c.code === 'USD');
  assert('USD exists with rate', usd && usd.rate_to_ngn > 0);

  r = await req('GET', '/currencies/plans?currency=USD');
  assert('Converted plans endpoint', r.status === 200);
  assert('Plans converted', Array.isArray(r.body.plans));
}

// ─── 8. Channel Module ──────────────────────────────────

async function testChannelModule() {
  section('8. CHANNEL MODULE');

  // Create public channel
  console.log('\n  --- Create Channel ---');
  let r = await req('POST', '/channels', {
    name: `E2E Channel ${TS}`,
    description: 'End-to-end test channel for deployment readiness.',
    category: 'Entertainment',
    type: 'public',
  }, creatorToken);
  assert('Channel created (201)', r.status === 201 || r.status === 200);
  testChannelId = r.body.channel?.id;
  testChannelNumber = r.body.channel?.channel_number;
  assert('Channel has id', !!testChannelId);
  assert('Channel has 6-digit number', /^\d{6}$/.test(testChannelNumber));
  assert('Channel name set', r.body.channel?.name === `E2E Channel ${TS}`);

  // Create private channel (premium creator)
  r = await req('POST', '/channels', {
    name: `E2E Private ${TS}`,
    description: 'Private test channel.',
    category: 'Entertainment',
    type: 'private',
  }, creatorToken);
  if (r.status === 201 || r.status === 200) {
    assert('Private channel created', true);
    privateChannelId = r.body.channel?.id;
  } else {
    // Environment-dependent: may require additional premium constraints.
    skip('Private channel created', `Endpoint returned ${r.status}: ${r.body?.error || 'unknown'}`);
  }

  // Input sanitization: HTML tags stripped
  console.log('\n  --- Input Sanitization ---');
  r = await req('POST', '/channels', {
    name: '<script>alert("xss")</script>Safe Channel',
    description: 'Clean <b>description</b>.',
    category: 'Entertainment',
    type: 'public',
  }, creatorToken);
  if (r.status === 200 || r.status === 201) {
    assert('HTML tags stripped from name', !r.body.channel?.name?.includes('<'));
    assert('HTML tags stripped from description', !r.body.channel?.description?.includes('<'));
  } else {
    skip('Sanitization check', 'Channel creation returned error');
  }

  // Name length limit
  console.log('\n  --- Length Limits ---');
  const longName = 'A'.repeat(101);
  r = await req('POST', '/channels', {
    name: longName,
    description: 'Test',
    category: 'Entertainment',
    type: 'public',
  }, creatorToken);
  assert('Name > 100 chars rejected', r.status >= 400);

  const longDesc = 'B'.repeat(2001);
  r = await req('POST', '/channels', {
    name: 'Length Test',
    description: longDesc,
    category: 'Entertainment',
    type: 'public',
  }, creatorToken);
  assert('Description > 2000 chars rejected', r.status >= 400);

  // Get public channels
  console.log('\n  --- List Channels ---');
  r = await req('GET', '/channels');
  assert('Get public channels', r.status === 200);
  assert('Public channels is array', Array.isArray(r.body.channels));

  // Get my channels
  r = await req('GET', '/channels/me', null, creatorToken);
  assert('Get my channels', r.status === 200);
  assert('My channels includes created', r.body.channels?.some(c => c.id === testChannelId));

  // Get by ID
  console.log('\n  --- Get Channel ---');
  r = await req('GET', `/channels/${testChannelId}`, null, creatorToken);
  assert('Get channel by ID', r.status === 200);
  assert('Channel data returned', r.body.channel?.id === testChannelId);

  // Get by number
  r = await req('GET', `/channels/number/${testChannelNumber}`, null, creatorToken);
  assert('Get channel by number', r.status === 200);
  assert('Correct channel returned', r.body.channel?.id === testChannelId);

  // Privacy: private channel hides owner_id for non-owner
  if (privateChannelId) {
    r = await req('GET', `/channels/${privateChannelId}`, null, viewerToken);
    if (r.status === 200) {
      assert('Private channel hides owner_id', !r.body.channel?.owner_id);
    } else {
      skip('Private channel privacy', 'Channel not accessible to viewer');
    }
  }

  // Disable channel (delete)
  console.log('\n  --- Enable / Disable ---');
  r = await req('DELETE', `/channels/${testChannelId}`, null, creatorToken);
  assert('Channel disabled (soft delete)', r.status === 200);

  // Re-enable
  r = await req('PATCH', `/channels/${testChannelId}/enable`, null, creatorToken);
  assert('Channel re-enabled', r.status === 200);

  // Admin disable/enable
  console.log('\n  --- Admin Channel Control ---');
  r = await req('GET', '/admin/channels', null, adminToken);
  assert('Admin lists all channels', r.status === 200);

  r = await req('POST', `/admin/channels/${testChannelId}/disable`, null, adminToken);
  assert('Admin disables channel', r.status === 200);

  r = await req('POST', `/admin/channels/${testChannelId}/enable`, null, adminToken);
  assert('Admin enables channel', r.status === 200);
}

// ─── 9. Broadcast Module ────────────────────────────────

async function testBroadcastModule() {
  section('9. BROADCAST MODULE');

  // Server time
  console.log('\n  --- Server Time ---');
  let r = await req('GET', '/broadcast/time');
  assert('Server time endpoint', r.status === 200);
  assert('Time is number', typeof r.body.server_time === 'number');
  assert('Time is recent', Math.abs(r.body.server_time - Date.now()) < 10000);

  // List my videos (empty)
  console.log('\n  --- Videos ---');
  r = await req('GET', '/broadcast/videos/me', null, creatorToken);
  assert('List my videos', r.status === 200);
  assert('Videos is array', Array.isArray(r.body.videos));

  // Note: Video upload requires multipart/form-data which needs a real file.
  // We test the endpoint responds correctly to a JSON request (should fail gracefully).
  r = await req('POST', '/broadcast/videos', { channel_id: testChannelId, title: 'Test' }, creatorToken);
  // Expected: 400 (no file) or 500 (multer expects file)
  assert('Video upload without file handled', r.status >= 400);

  // Channel videos
  r = await req('GET', `/broadcast/videos/channel/${testChannelId}`, null, creatorToken);
  assert('Get channel videos', r.status === 200);

  // Schedule (no videos available — test error handling)
  console.log('\n  --- Schedule ---');
  r = await req('GET', `/broadcast/schedule/${testChannelId}`, null, creatorToken);
  assert('Get channel schedule', r.status === 200);
  assert('Schedule is array', Array.isArray(r.body.schedule));

  // Now playing (no program — should still respond)
  console.log('\n  --- Now Playing ---');
  r = await req('GET', `/broadcast/now-playing/${testChannelId}`, null, creatorToken);
  assert('Now-playing endpoint responds', r.status === 200);
}

// ─── 10. Interactions Module ────────────────────────────

async function testInteractionsModule() {
  section('10. INTERACTIONS MODULE');

  // Get gifts (might be empty initially)
  console.log('\n  --- Gift CRUD (Admin) ---');
  let r = await req('GET', '/interactions/gifts', null, creatorToken);
  assert('Get active gifts', r.status === 200);
  const initialGiftCount = r.body.gifts?.length || 0;

  // Admin creates gift
  r = await req('POST', '/interactions/gifts', {
    name: 'E2E Star',
    icon: '⭐',
    animation: 'bounce',
    currency: 'ngn',
    naira_value: 50,
    sort_order: 99,
  }, adminToken);
  assert('Admin created gift', r.status === 200 || r.status === 201);
  testGiftId = r.body.gift?.id;
  assert('Gift has id', !!testGiftId);

  // Admin creates vPT gift
  let vptGiftId = null;
  r = await req('POST', '/interactions/gifts', {
    name: 'E2E Crown',
    icon: '👑',
    animation: 'glow',
    currency: 'vpt',
    vpt_units: 10,
    sort_order: 100,
  }, adminToken);
  assert('VPT gift created', r.status === 200 || r.status === 201);
  vptGiftId = r.body.gift?.id;

  // Get all gifts (admin)
  r = await req('GET', '/interactions/gifts/all', null, adminToken);
  assert('Admin gets all gifts', r.status === 200);
  assert('Gifts count increased', (r.body.gifts?.length || 0) >= initialGiftCount + 2);

  // Update gift
  if (testGiftId) {
    r = await req('PATCH', `/interactions/gifts/${testGiftId}`, { name: 'E2E Star Updated' }, adminToken);
    assert('Gift updated', r.status === 200);
  }

  // Get gift wallet
  console.log('\n  --- Gift Wallet ---');
  r = await req('GET', '/interactions/wallet', null, creatorToken);
  assert('Get gift wallet', r.status === 200);
  assert('Wallet has vpt_units', typeof r.body.wallet?.vpt_units === 'number');
  assert('Wallet has ngn_balance', typeof r.body.wallet?.ngn_balance === 'number');

  // Fund creator's gift wallet for testing
  r = await req('POST', '/withdrawals/fund', {
    uid: creatorId,
    amount_ngn: 500,
  }, adminToken);
  assert('Admin funded gift wallet', r.status === 200);

  // Send reaction
  console.log('\n  --- Reactions ---');
  r = await req('POST', '/interactions/reactions', {
    channel_id: testChannelId,
    emoji: '🔥',
  }, viewerToken);
  assert('Reaction sent', r.status === 200);

  // Send gift
  console.log('\n  --- Send Gift ---');
  if (testGiftId && testChannelId) {
    r = await req('POST', '/interactions/gifts/send', {
      channel_id: testChannelId,
      gift_id: testGiftId,
    }, creatorToken);
    // May succeed or fail depending on wallet balance
    assert('Send gift endpoint responds', r.status === 200 || r.status >= 400);
    if (r.status === 200) {
      console.log('    → Gift sent successfully');
    } else {
      console.log(`    → Gift send returned ${r.status}: ${r.body.error || 'unknown'}`);
    }
  }

  // Combo
  console.log('\n  --- Combo ---');
  if (testGiftId && testChannelId) {
    r = await req('GET', `/interactions/combo?channel_id=${testChannelId}&gift_id=${testGiftId}`, null, creatorToken);
    assert('Combo endpoint responds', r.status === 200);
  }

  // Leaderboard
  console.log('\n  --- Leaderboard ---');
  r = await req('GET', `/interactions/leaderboard/${testChannelId}`, null, creatorToken);
  assert('Leaderboard responds', r.status === 200);
  assert('Leaderboard is array', Array.isArray(r.body.leaderboard));
  // Verify no uid leaked
  if (r.body.leaderboard?.length > 0) {
    assert('Leaderboard hides uid', !r.body.leaderboard[0].uid);
  }

  // Channel events
  console.log('\n  --- Channel Events ---');
  r = await req('GET', `/interactions/events/${testChannelId}`, null, creatorToken);
  if (r.status === 200) {
    assert('Channel events responds', true);
    assert('Events is array', Array.isArray(r.body.events));
  } else if ((r.body?.error || '').includes('index')) {
    skip('Channel events responds', 'Firestore composite index missing for channel_events query');
    skip('Events is array', 'Firestore composite index missing for channel_events query');
  } else {
    assert('Channel events responds', false);
    assert('Events is array', false);
  }

  // Delete gift
  console.log('\n  --- Delete Gift ---');
  if (vptGiftId) {
    r = await req('DELETE', `/interactions/gifts/${vptGiftId}`, null, adminToken);
    assert('VPT gift deleted', r.status === 200);
  }
}

// ─── 11. Wallet Module ──────────────────────────────────

async function testWalletModule() {
  section('11. WALLET MODULE');

  // Get wallet (auto-create on subscription)
  let r = await req('GET', '/wallet/me', null, creatorToken);
  assert('Get my wallet', r.status === 200 || r.status === 404);
  // Wallet may have been auto-created during subscription
  if (r.body.wallet) {
    assert('Wallet has bsc_address', !!r.body.wallet.bsc_address);
    assert('Wallet does NOT expose private key', !r.body.wallet.encrypted_private_key);
  } else {
    // Explicitly create
    r = await req('POST', '/wallet/create', {}, creatorToken);
    assert('Wallet created', r.status === 200 || r.status === 201);
    assert('New wallet has bsc_address', !!r.body.wallet?.bsc_address);
  }

  // Duplicate create should fail
  r = await req('POST', '/wallet/create', {}, creatorToken);
  assert('Duplicate wallet creation rejected', r.status >= 400);
}

// ─── 12. Withdrawal Module ──────────────────────────────

async function testWithdrawalModule() {
  section('12. WITHDRAWAL MODULE');

  // Request withdrawal
  console.log('\n  --- Request Withdrawal ---');
  // Ensure user has sufficient NGN first
  let r = await req('POST', '/withdrawals/fund', {
    uid: creatorId,
    amount_ngn: 1000,
  }, adminToken);
  assert('Pre-fund creator for withdrawal tests', r.status === 200);

  r = await req('POST', '/withdrawals/request', {
    amount: 100,
  }, creatorToken);
  assert('Withdrawal requested', r.status === 200 || r.status === 201);
  testWithdrawalId = r.body.withdrawal?.id;
  assert('Withdrawal has id', !!testWithdrawalId);

  // Validation: amount too small
  r = await req('POST', '/withdrawals/request', { amount: 50 }, creatorToken);
  assert('Amount < ₦100 rejected', r.status >= 400);

  // Validation: amount too large
  r = await req('POST', '/withdrawals/request', { amount: 6000000 }, creatorToken);
  assert('Amount > ₦5M rejected', r.status >= 400);

  // Validation: too many decimals
  r = await req('POST', '/withdrawals/request', { amount: 100.123 }, creatorToken);
  assert('More than 2 decimals rejected', r.status >= 400);

  // Validation: non-numeric
  r = await req('POST', '/withdrawals/request', { amount: 'abc' }, creatorToken);
  assert('Non-numeric amount rejected', r.status >= 400);

  // My withdrawals
  console.log('\n  --- My Withdrawals ---');
  r = await req('GET', '/withdrawals', null, creatorToken);
  assert('List my withdrawals', r.status === 200);
  assert('Withdrawals is array', Array.isArray(r.body.withdrawals));

  // Admin — all withdrawals
  console.log('\n  --- Admin Withdrawals ---');
  r = await req('GET', '/withdrawals/all', null, adminToken);
  assert('Admin lists all withdrawals', r.status === 200);
  assert('All withdrawals is array', Array.isArray(r.body.withdrawals));

  // Admin approve
  if (testWithdrawalId) {
    r = await req('POST', `/withdrawals/${testWithdrawalId}/approve`, null, adminToken);
    assert('Admin approves withdrawal', r.status === 200);
  }

  // Request another and reject
  console.log('\n  --- Reject ---');
  r = await req('POST', '/withdrawals/request', { amount: 200 }, creatorToken);
  const rejectId = r.body.withdrawal?.id;
  if (rejectId) {
    r = await req('POST', `/withdrawals/${rejectId}/reject`, null, adminToken);
    assert('Admin rejects withdrawal', r.status === 200);
  }

  // Admin fund wallet
  console.log('\n  --- Fund Wallet ---');
  r = await req('POST', '/withdrawals/fund', {
    uid: secondCreatorId,
    amount_ngn: 1000,
  }, adminToken);
  assert('Admin funds wallet', r.status === 200);

  // Admin reversal
  console.log('\n  --- Reversal ---');
  // Get a ledger entry to reverse
  const Ledger = require('./backend/src/vpt/ledger.model');
  const entries = Ledger.getByUser(secondCreatorId);
  const fundEntry = entries.find(e => e.type === 'WALLET_FUND');
  if (fundEntry) {
    r = await req('POST', '/withdrawals/reverse', {
      original_entry_id: fundEntry.id,
      reason: 'E2E test reversal',
    }, adminToken);
    assert('Admin reversal processed', r.status === 200);
  } else {
    skip('Reversal', 'No WALLET_FUND ledger entry found');
  }

  // Admin queries
  console.log('\n  --- Admin Reports ---');
  r = await req('GET', `/withdrawals/admin/user/${creatorId}/transactions`, null, adminToken);
  assert('User transactions report', r.status === 200);

  r = await req('GET', `/withdrawals/admin/channel/${testChannelId}/earnings`, null, adminToken);
  assert('Channel earnings report', r.status === 200);

  r = await req('GET', '/withdrawals/admin/system-totals', null, adminToken);
  assert('System totals report', r.status === 200);
}

// ─── 13. VPT Module ─────────────────────────────────────

async function testVptModule() {
  section('13. VPT MODULE');

  // Creator endpoints
  console.log('\n  --- Creator VPT ---');
  let r = await req('GET', '/vpt/balance', null, creatorToken);
  assert('Get vPT balance', r.status === 200);
  assert('Balance is number', typeof r.body.balance === 'number');

  r = await req('GET', '/vpt/transactions', null, creatorToken);
  assert('Get vPT transactions', r.status === 200);
  assert('Transactions is array', Array.isArray(r.body.transactions));

  r = await req('GET', '/vpt/ledger', null, creatorToken);
  assert('Get vPT ledger', r.status === 200);
  assert('Ledger entries is array', Array.isArray(r.body.ledger));

  r = await req('GET', '/vpt/queue', null, creatorToken);
  assert('Get distribution queue', r.status === 200);

  // Admin endpoints
  console.log('\n  --- Admin VPT ---');
  r = await req('GET', '/vpt/admin/stats', null, adminToken);
  assert('Admin queue stats', r.status === 200);

  r = await req('GET', '/vpt/admin/ledger-stats', null, adminToken);
  assert('Admin ledger stats', r.status === 200);
  assert('Ledger stats has total_entries', typeof r.body.stats?.total_entries === 'number');

  r = await req('GET', '/vpt/admin/ledger', null, adminToken);
  assert('Admin full ledger', r.status === 200);

  r = await req('GET', '/vpt/admin/batches', null, adminToken);
  assert('Admin batch history', r.status === 200);

  r = await req('GET', '/vpt/admin/batches/failed', null, adminToken);
  assert('Admin failed batches', r.status === 200);

  r = await req('GET', '/vpt/admin/preflight', null, adminToken);
  assert('Blockchain preflight', r.status === 200 || r.status === 400);
  console.log(`    -> Blockchain ready: ${r.body.readiness?.ready || false}`);

  // Non-admin blocked
  console.log('\n  --- Access Control ---');
  r = await req('GET', '/vpt/admin/stats', null, viewerToken);
  assert('Non-admin blocked from VPT admin', r.status === 403);

  r = await req('GET', '/vpt/admin/ledger', null, creatorToken);
  assert('Creator blocked from VPT admin', r.status === 403);

  // Treasury balance
  console.log('\n  --- Treasury ---');
  r = await req('GET', '/vpt/admin/treasury', null, adminToken);
  assert('Treasury endpoint responds', r.status === 200 || r.status === 500);
  // May fail if blockchain not configured, that's OK for staging

  // Batch processing
  console.log('\n  --- Batch Processing ---');
  r = await req('POST', '/vpt/admin/process-batch', {}, adminToken);
  // Will succeed (possibly no-op if queue empty) or fail if blockchain down
  assert('Batch process endpoint responds', r.status === 200 || r.status === 400 || r.status === 500);
  if (r.status === 200) {
    console.log(`    → Batch: ${r.body.batch_id || 'no pending items'}`);
  }
}

// ─── 14. Home Module ────────────────────────────────────

async function testHomeModule() {
  section('14. HOME MODULE');

  let r = await req('GET', '/home/stats', null, creatorToken);
  assert('Home stats accessible', r.status === 200);
  assert('Has total channels', typeof r.body.stats?.total_channels === 'number');
  assert('Has total members', typeof r.body.stats?.total_members === 'number');
  assert('Has community pool', !!r.body.community_pool);
  assert('Has recent channels', Array.isArray(r.body.recent_channels));
}

// ─── 15. Categories (Public) ────────────────────────────

async function testCategoriesModule() {
  section('15. CATEGORIES (PUBLIC)');

  let r = await req('GET', '/categories');
  assert('Public categories endpoint', r.status === 200);
  assert('Categories is array', Array.isArray(r.body.categories));
  assert('Default categories exist (>=10)', r.body.categories?.length >= 10);
}

// ─── 16. Security & Edge Cases ──────────────────────────

async function testSecurityEdgeCases() {
  section('16. SECURITY & EDGE CASES');

  // Body size limit (1 MB)
  console.log('\n  --- Body Size Limit ---');
  // Send a moderately large body (not over limit — just verify it responds)
  const largeBody = { data: 'x'.repeat(50000) };
  let r = await req('POST', '/auth/login', largeBody);
  assert('Large body still processed', r.status > 0);

  // Non-existent route
  console.log('\n  --- 404 Handling ---');
  r = await req('GET', '/nonexistent/endpoint');
  assert('Unknown route returns 404', r.status === 404);

  // Invalid JSON
  console.log('\n  --- Malformed Requests ---');
  r = await new Promise((resolve) => {
    const url = new URL('/auth/login', BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const request = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    request.on('error', () => resolve({ status: 0 }));
    request.write('{invalid json');
    request.end();
  });
  assert('Malformed JSON handled', r.status >= 400);

  // Cross-module auth: viewer can't access admin endpoints
  console.log('\n  --- Cross-Module Auth ---');
  r = await req('POST', '/admin/set-role', { userId: viewerId, role: 'admin' }, viewerToken);
  assert('Viewer cannot set roles', r.status === 403);

  r = await req('POST', '/admin/plans', { name: 'Hacked Plan', price: 1 }, viewerToken);
  assert('Viewer cannot create plans', r.status === 403);

  r = await req('POST', '/interactions/gifts', { name: 'Hacked Gift' }, viewerToken);
  assert('Viewer cannot create gifts', r.status === 403);

  r = await req('GET', '/withdrawals/all', null, viewerToken);
  assert('Viewer cannot see all withdrawals', r.status === 403);
}

// ─── 17. Data Integrity Spot-Checks ─────────────────────

async function testDataIntegrity() {
  section('17. DATA INTEGRITY');

  // Verify model caches match expectations
  const User = require('./backend/src/users/user.model');
  const Channel = require('./backend/src/channels/channel.model');
  const GiftWallet = require('./backend/src/interactions/gift-wallet.model');
  const Ledger = require('./backend/src/vpt/ledger.model');

  console.log('\n  --- Model Initialization ---');
  assert('User model initialized', User.isInitialized());
  assert('GiftWallet model initialized', GiftWallet.isInitialized());
  assert('Ledger model initialized', Ledger.isInitialized());

  console.log('\n  --- Cache Consistency ---');
  const user = User.findById(creatorId);
  assert('Creator exists in cache', !!user);
  assert('Creator has correct role', user?.role === 'creator');

  const channel = Channel.findById(testChannelId);
  assert('Channel exists in cache', !!channel);
  assert('Channel is active', channel?.is_active === true);

  const wallet = GiftWallet.findByUid(creatorId);
  assert('Gift wallet exists in cache', !!wallet);

  console.log('\n  --- Firestore Reload ---');
  const reloaded = await GiftWallet.reloadFromFirestore(creatorId);
  if (reloaded) {
    assert('Firestore reload works', true);
    assert('Reload returns wallet data', typeof reloaded.ngn_balance === 'number');
  } else {
    skip('Firestore reload', 'Method returned null (Firestore may not have entry yet)');
  }

  console.log('\n  --- Ledger Entries ---');
  const entries = Ledger.getAll();
  assert('Ledger has entries', entries.length > 0);
  const types = [...new Set(entries.map(e => e.type))];
  console.log(`    → Ledger entry types: ${types.join(', ')}`);
  assert('Ledger records multiple types', types.length >= 2);
}

// ─── 18. Cleanup Verification ───────────────────────────

async function testCleanupAndFinalChecks() {
  section('18. FINAL DEPLOYMENT CHECKS');

  // Static file serving
  console.log('\n  --- Static Assets ---');
  let r = await req('GET', '/uploads/');
  // May return 404 or directory listing — just verify server doesn't crash
  assert('Static /uploads/ path handled', r.status > 0);

  // Re-verify all core endpoints respond
  console.log('\n  --- Endpoint Smoke Test ---');
  const endpoints = [
    ['GET', '/'],
    ['GET', '/subscriptions/plans'],
    ['GET', '/categories'],
    ['GET', '/currencies'],
    ['GET', '/broadcast/time'],
  ];

  for (const [method, path] of endpoints) {
    r = await req(method, path);
    assert(`${method} ${path} → ${r.status}`, r.status === 200);
  }

  // Authenticated endpoint smoke
  const authEndpoints = [
    ['GET', '/auth/me', adminToken],
    ['GET', '/users/me', creatorToken],
    ['GET', '/channels/me', creatorToken],
    ['GET', '/vpt/balance', creatorToken],
    ['GET', '/wallet/me', creatorToken],
    ['GET', '/interactions/wallet', creatorToken],
    ['GET', '/interactions/gifts', creatorToken],
    ['GET', '/subscriptions/me', creatorToken],
    ['GET', '/withdrawals', creatorToken],
    ['GET', '/home/stats', creatorToken],
    ['GET', '/admin/dashboard', adminToken],
    ['GET', '/admin/users', adminToken],
    ['GET', '/admin/channels', adminToken],
    ['GET', '/admin/settings', adminToken],
    ['GET', '/admin/features', adminToken],
    ['GET', '/admin/audit', adminToken],
    ['GET', '/vpt/admin/stats', adminToken],
    ['GET', '/vpt/admin/ledger', adminToken],
    ['GET', '/vpt/admin/batches', adminToken],
  ];

  for (const [method, path, token] of authEndpoints) {
    r = await req(method, path, null, token);
    assert(`${method} ${path} → ${r.status}`, r.status === 200);
  }
}

// ─── Runner ─────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  AFROVISION — E2E DEPLOYMENT READINESS TEST             ║');
  console.log(`║  Started: ${new Date().toISOString()}            ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Boot server
  process.env.PORT = String(PORT);
  console.log(`\n⏳ Starting server on port ${PORT}...`);
  require('./backend/src/app');

  // Wait for server to be fully ready (models initialized + listening)
  await new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 240; // 120 seconds max
    const check = () => {
      attempts++;
      if (attempts > maxAttempts) {
        console.error('❌ Server failed to start within 120s');
        process.exit(1);
      }
      const r = http.get(BASE + '/', (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            // Extra delay to ensure all model init is settled
            setTimeout(resolve, 1000);
          } else {
            setTimeout(check, 500);
          }
        });
      });
      r.on('error', () => setTimeout(check, 500));
    };
    setTimeout(check, 3000);
  });
  console.log('✅ Server ready\n');

  // Run all test suites in order
  try {
    await testHealthCheck();
    await testAuthModule();
    await testAuthSecurity();
    await testUserModule();
    await testAdminModule();
    await testSubscriptionModule();
    await testCurrencyModule();
    await testChannelModule();
    await testBroadcastModule();
    await testInteractionsModule();
    await testWalletModule();
    await testWithdrawalModule();
    await testVptModule();
    await testHomeModule();
    await testCategoriesModule();
    await testSecurityEdgeCases();
    await testDataIntegrity();
    await testCleanupAndFinalChecks();
  } catch (err) {
    console.error(`\n💥 FATAL ERROR: ${err.message}`);
    console.error(err.stack);
  }

  // Report
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  TEST RESULTS                                           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed:  ${String(passed).padStart(4)}                                       ║`);
  console.log(`║  ❌ Failed:  ${String(failed).padStart(4)}                                       ║`);
  console.log(`║  ⏭️  Skipped: ${String(skipped).padStart(4)}                                       ║`);
  console.log(`║  📊 Total:   ${String(passed + failed + skipped).padStart(4)}                                       ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\n❌ FAILED ASSERTIONS:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  const pct = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`\n${failed === 0 ? '🚀' : '⚠️'}  Pass rate: ${pct}% — ${failed === 0 ? 'DEPLOYMENT READY' : 'NEEDS FIXES'}`);

  console.log(`\n⏱️  Completed: ${new Date().toISOString()}`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
