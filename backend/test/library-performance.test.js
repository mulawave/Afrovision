/**
 * AV-LIB-062 reader and library performance guardrails (static checks).
 * Run: node test/library-performance.test.js
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
  return fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');
}

console.log('\n-- AV-LIB-062 Reader Performance Tests --\n');

const readerPage = read('website/src/app/channel/[id]/library/[itemId]/page.tsx');
const viewerController = read('backend/src/library/library-viewer.controller.js');

test('reader page uses debounced progress saves to reduce write pressure', () => {
  assert(readerPage.includes('window.setTimeout(async () =>'), 'debounced save timeout missing');
  assert(readerPage.includes('450'), 'expected save debounce interval missing');
});

test('reader supports fallback spreads for low-resource manifests', () => {
  assert(readerPage.includes('buildFallbackSpreads'), 'fallback spread builder missing');
  assert(readerPage.includes('manifest?.spreads'), 'manifest spread fallback integration missing');
});

test('recommendations endpoint enforces capped candidate scan', () => {
  assert(viewerController.includes('Math.max(limit * 6, 20)'), 'recommendation candidate cap missing');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
