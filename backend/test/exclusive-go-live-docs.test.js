/**
 * AV-EXC-093 documentation completeness tests.
 * Run: node test/exclusive-go-live-docs.test.js
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

function readDoc(relPath) {
  const abs = path.join(__dirname, '..', relPath);
  assert(fs.existsSync(abs), `${relPath} is missing`);
  return fs.readFileSync(abs, 'utf8');
}

function includesAll(content, phrases) {
  return phrases.every((phrase) => content.includes(phrase));
}

console.log('\n-- AV-EXC-093 Go-Live Docs Tests --\n');

const checklist = readDoc('ops/exclusive-go-live-checklist.md');
const rollback = readDoc('ops/exclusive-rollback-plan.md');
const monitoring = readDoc('ops/exclusive-48h-monitoring-plan.md');

test('go-live checklist contains core release gate items', () => {
  assert(includesAll(checklist, [
    'Feature flags configured by environment',
    'Monitoring and dashboard validation',
    'Canary Rollout Steps',
    'Go/No-Go Decision',
  ]), 'checklist is missing required gate sections');
});

test('rollback plan contains triggers, containment, and recovery criteria', () => {
  assert(includesAll(rollback, [
    'Rollback Triggers',
    'Immediate Containment',
    'Data Safety Rules',
    'Recovery and Re-Enable Criteria',
  ]), 'rollback plan is missing required sections');
});

test('48h monitoring plan contains cadence, signals, and escalation', () => {
  assert(includesAll(monitoring, [
    'Cadence',
    'Primary Signals',
    'Thresholds and Escalation',
    'Completion Criteria',
  ]), 'monitoring plan is missing required sections');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
