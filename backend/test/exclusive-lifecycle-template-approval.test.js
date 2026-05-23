/**
 * AV-EXC-073 template approval artifact tests.
 * Run: node test/exclusive-lifecycle-template-approval.test.js
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

function readRel(relPath) {
  const absPath = path.join(__dirname, '..', relPath);
  assert(fs.existsSync(absPath), `${relPath} file is missing`);
  return fs.readFileSync(absPath, 'utf8');
}

console.log('\n-- AV-EXC-073 Template Approval Tests --\n');

const approvalDoc = readRel('ops/exclusive-lifecycle-template-approval-evidence.md');
const checklistDoc = readRel('ops/exclusive-lifecycle-template-pack-checklist.md');
const messagesFile = readRel('src/channels/exclusive_lifecycle.messages.js');

test('approval evidence doc contains required approval sections', () => {
  const requiredSections = [
    'Approval Evidence Capture Format',
    'Product Review Evidence',
    'Ops Review Evidence',
    'Final Approval Record',
    'Completion Criteria',
  ];

  requiredSections.forEach((section) => {
    assert(approvalDoc.includes(section), `missing approval section: ${section}`);
  });
});

test('template checklist contains coverage matrix and signoff checks', () => {
  const requiredSections = [
    'Template Coverage Matrix',
    'Localization Quality',
    'Verification',
    'Approval and Signoff',
  ];

  requiredSections.forEach((section) => {
    assert(checklistDoc.includes(section), `missing checklist section: ${section}`);
  });
});

test('lifecycle message source includes required events and locale handling', () => {
  const requiredTokens = [
    "case 'user.purchase'",
    "case 'user.reminder'",
    "case 'user.expired'",
    "case 'creator.purchase'",
    "case 'creator.expiring'",
    "case 'creator.expired'",
    "case 'ops.alert'",
    "return 'pcm';",
    "return 'en';",
  ];

  requiredTokens.forEach((token) => {
    assert(messagesFile.includes(token), `missing required message token: ${token}`);
  });
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
