/**
 * Backend smoke tests — validates core modules load without crashing.
 * Run: node test/smoke.test.js
 */

const path = require('path');
const fs = require('fs');
let passed = 0;
let failed = 0;

if (!process.env.GCS_BUCKET) {
  process.env.GCS_BUCKET = 'afrovision-test-bucket';
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n── Backend Smoke Tests ──\n');

// ─── Module loading ──────────────────────────────────────

test('auth controller loads', () => {
  const ctrl = require('../src/auth/auth.controller');
  assert(typeof ctrl.register === 'function', 'register is not a function');
  assert(typeof ctrl.login === 'function', 'login is not a function');
  assert(typeof ctrl.me === 'function', 'me is not a function');
  assert(typeof ctrl.forgotPassword === 'function', 'forgotPassword is not a function');
  assert(typeof ctrl.resetPassword === 'function', 'resetPassword is not a function');
});

test('jwt utility loads', () => {
  const jwt = require('../src/utils/jwt');
  assert(typeof jwt.generateToken === 'function', 'generateToken is not a function');
  assert(typeof jwt.verifyToken === 'function', 'verifyToken is not a function');
  assert(typeof jwt.authenticateToken === 'function', 'authenticateToken is not a function');
});

test('user model loads', () => {
  const User = require('../src/users/user.model');
  assert(typeof User.findById === 'function', 'findById is not a function');
  assert(typeof User.findByEmail === 'function', 'findByEmail is not a function');
  assert(typeof User.create === 'function', 'create is not a function');
  assert(typeof User.toSafeUser === 'function', 'toSafeUser is not a function');
});

test('wallet model loads', () => {
  const Wallet = require('../src/wallet/wallet.model');
  assert(typeof Wallet.findByUserId === 'function', 'findByUserId is not a function');
  assert(typeof Wallet.setConnectedWallet === 'function', 'setConnectedWallet is not a function');
  assert(typeof Wallet.clearConnectedWallet === 'function', 'clearConnectedWallet is not a function');
});

test('wallet controller loads', () => {
  const ctrl = require('../src/wallet/wallet.controller');
  assert(typeof ctrl.scanBalance === 'function', 'scanBalance is not a function');
  assert(typeof ctrl.importAddress === 'function', 'importAddress is not a function');
  assert(typeof ctrl.connectExternal === 'function', 'connectExternal is not a function');
  assert(typeof ctrl.transfer === 'function', 'transfer is not a function');
});

test('vpt model loads', () => {
  const Vpt = require('../src/vpt/vpt.model');
  assert(typeof Vpt !== 'undefined', 'vpt model is undefined');
});

test('settings service loads', () => {
  const Settings = require('../src/admin/settings.service');
  assert(typeof Settings.get === 'function', 'get is not a function');
  assert(typeof Settings.set === 'function', 'set is not a function');
});

// ─── Pure-logic validation ───────────────────────────────

test('email regex validates correctly', () => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert(EMAIL_REGEX.test('user@example.com'), 'valid email rejected');
  assert(!EMAIL_REGEX.test('not-an-email'), 'invalid email accepted');
  assert(!EMAIL_REGEX.test(''), 'empty string accepted');
  assert(!EMAIL_REGEX.test('user@'), 'user@ accepted');
});

test('strong password regex validates correctly', () => {
  const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  assert(STRONG_PASSWORD.test('Password1'), 'valid password rejected');
  assert(!STRONG_PASSWORD.test('password'), 'lowercase-only accepted');
  assert(!STRONG_PASSWORD.test('12345678'), 'digits-only accepted');
  assert(!STRONG_PASSWORD.test('Short1'), 'short password accepted');
});

// ─── Route registration ──────────────────────────────────

test('auth routes register without error', () => {
  const authRoutes = require('../src/auth/auth.routes');
  assert(authRoutes && typeof authRoutes === 'function', 'auth routes is not an express router');
});

test('wallet routes register without error', () => {
  const walletRoutes = require('../src/wallet/wallet.routes');
  assert(walletRoutes && typeof walletRoutes === 'function', 'wallet routes is not an express router');
});

test('admin routes register without error', () => {
  const adminRoutes = require('../src/admin/admin.routes');
  assert(adminRoutes && typeof adminRoutes === 'function', 'admin routes is not an express router');
});

test('default npm test chain includes critical suites', () => {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const testScript = String(packageJson?.scripts?.test || '');

  const requiredSuites = [
    'test/smoke.test.js',
    'test/static-pages-content.test.js',
    'test/homepage-design.test.js',
    'test/broadcast-resumable-upload.test.js',
    'test/exclusive-security-abuse.test.js',
    'test/exclusive-rollout-controls.test.js',
    'test/exclusive-go-live-docs.test.js',
  ];

  for (const suite of requiredSuites) {
    assert(
      testScript.includes(suite),
      `npm test must include ${suite}`,
    );
  }
});

// ─── Summary ─────────────────────────────────────────────

console.log(`\n── ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);
