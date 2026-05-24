/**
 * AV-LIB-060 persona + flow coverage (static integration checks).
 * Run: node test/library-persona-lifecycle-e2e.test.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  + ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  - ${name}: ${err.message}`);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

console.log('\n-- AV-LIB-060 Persona + Lifecycle E2E Tests --\n');

const viewerController = read('src/library/library-viewer.controller.js');
const policyService = read('src/library/library-policy.service.js');
const routes = read('src/library/library.routes.js');

test('viewer endpoints enforce rollout + entitlement checks', () => {
  assert(viewerController.includes('enforceLibraryRollout'), 'rollout guard helper missing');
  assert(viewerController.includes('canViewLibraryList'), 'list entitlement check missing');
  assert(viewerController.includes('canViewLibraryItemDetail'), 'detail entitlement check missing');
  assert(viewerController.includes('canAccessReader'), 'reader entitlement check missing');
});

test('policy service includes KYC and active PIC requirements', () => {
  assert(policyService.includes('isAdultKycVerified'), 'KYC verifier missing from policy service');
  assert(policyService.includes('findActiveByUserAndChannel'), 'active PIC entitlement check missing');
});

test('library routes are auth-protected for viewer and creator endpoints', () => {
  const authUsage = (routes.match(/authenticateToken/g) || []).length;
  assert(authUsage >= 10, 'expected authenticateToken across library routes');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
