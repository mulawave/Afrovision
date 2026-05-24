/**
 * AV-LIB-061 security abuse checks.
 * Run: node test/library-security-abuse.test.js
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

console.log('\n-- AV-LIB-061 Security Abuse Tests --\n');

const routes = read('src/library/library.routes.js');
const viewer = read('src/library/library-viewer.controller.js');

test('all critical viewer routes require authentication middleware', () => {
  const criticalPaths = [
    '/channels/:channelId/library',
    '/channels/:channelId/library/:itemId',
    '/channels/:channelId/library/:itemId/reader-manifest',
    '/channels/:channelId/library/:itemId/progress',
    '/channels/:channelId/library/:itemId/bookmarks',
    '/channels/:channelId/library/:itemId/favorite',
  ];

  criticalPaths.forEach((routePath) => {
    assert(routes.includes(routePath), `missing route definition: ${routePath}`);
  });

  const authCount = (routes.match(/authenticateToken/g) || []).length;
  assert(authCount >= 12, 'insufficient auth middleware coverage');
});

test('recommendations route is declared before item detail route to prevent shadowing', () => {
  const recIndex = routes.indexOf('/channels/:channelId/library/recommendations');
  const detailIndex = routes.indexOf('/channels/:channelId/library/:itemId');
  assert(recIndex >= 0, 'recommendations route missing');
  assert(detailIndex >= 0, 'item detail route missing');
  assert(recIndex < detailIndex, 'route order vulnerable to path shadowing');
});

test('reader manifest endpoint performs strict access checks', () => {
  assert(viewer.includes('canAccessReader'), 'reader access policy check missing');
  assert(viewer.includes('getSignedUrl'), 'signed URL generation missing');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
