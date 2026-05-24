/**
 * AV-LIB-071/072 documentation readiness tests.
 * Run: node test/library-go-live-docs.test.js
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

console.log('\n-- AV-LIB-071/072 Docs Tests --\n');

const sloRunbook = readDoc('ops/library-slo-runbook.md');
const checklist = readDoc('ops/library-go-live-checklist.md');
const rollback = readDoc('ops/library-rollback-plan.md');
const monitoring = readDoc('ops/library-48h-monitoring-plan.md');

test('SLO runbook includes objectives, alerting and incident response', () => {
  assert(includesAll(sloRunbook, [
    'Service Level Objectives',
    'Error Budget Policy',
    'Alert Conditions',
    'Incident Response Flow',
  ]), 'SLO runbook missing required sections');
});

test('go-live checklist contains release gates and staged rollout steps', () => {
  assert(includesAll(checklist, [
    'Feature flags configured by environment',
    'Staged Rollout Plan',
    'Go/No-Go Decision',
    'Post-Launch Verification',
  ]), 'go-live checklist missing required sections');
});

test('rollback plan covers triggers, containment, and recovery criteria', () => {
  assert(includesAll(rollback, [
    'Rollback Triggers',
    'Immediate Containment',
    'Data Safety Rules',
    'Recovery and Re-Enable Criteria',
  ]), 'rollback plan missing required sections');
});

test('48h monitoring plan includes cadence, thresholds and completion criteria', () => {
  assert(includesAll(monitoring, [
    'Cadence',
    'Primary Signals',
    'Thresholds and Escalation',
    'Completion Criteria',
  ]), 'monitoring plan missing required sections');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
