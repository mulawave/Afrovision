/**
 * AV-EXC-091 script safety/unit tests.
 * Run: node test/exclusive-backfill-script.test.js
 */

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

console.log('\n-- AV-EXC-091 Backfill Script Tests --\n');

const script = require('../scripts/backfill_exclusive_channel_fields');

test('parseArgs defaults to dry-run mode', () => {
  const args = script.parseArgs([]);
  assert(args.dryRun === true, 'dryRun should default to true');
  assert(args.execute === false, 'execute should default to false');
});

test('parseArgs accepts execute mode with confirmation argument capture', () => {
  const args = script.parseArgs(['--execute', '--confirm=BACKFILL_EXCLUSIVE_091']);
  assert(args.execute === true, 'execute should be true');
  assert(args.dryRun === false, 'dryRun should be false when execute used');
  assert(args.confirmation === 'BACKFILL_EXCLUSIVE_091', 'confirmation token mismatch');
});

test('ensureSafeExecution rejects execute mode without required confirmation token', () => {
  let threw = false;
  try {
    script.ensureSafeExecution({ execute: true, confirmation: 'WRONG_TOKEN' });
  } catch (error) {
    threw = true;
    assert(error.message.includes('BACKFILL_EXCLUSIVE_091'), 'expected confirmation guidance in error');
  }
  assert(threw, 'expected ensureSafeExecution to throw for bad token');
});

test('buildChannelBackfillPatch fills missing exclusive defaults', () => {
  const patch = script.buildChannelBackfillPatch({ type: 'exclusive' });
  assert(patch.exclusive_monthly_fee_ngn === 0, 'expected monthly fee default');
  assert(patch.exclusive_fee_currency === 'NGN', 'expected fee currency default');
  assert(Object.prototype.hasOwnProperty.call(patch, 'exclusive_fee_last_updated_at'), 'expected updated_at default field');
  assert(Object.prototype.hasOwnProperty.call(patch, 'exclusive_fee_last_updated_by'), 'expected updated_by default field');
});

test('buildAccessBackfillPatch expires stale active entitlements and seeds lifecycle fields', () => {
  const now = 2_000_000_000_000;
  const patch = script.buildAccessBackfillPatch({
    status: 'active',
    expires_at: now - 1000,
    monthly_fee_ngn: '2500',
  }, now);

  assert(patch.status === 'expired', 'expected stale active status to become expired');
  assert(patch.expired_at === now - 1000, 'expected expired_at set from expires_at');
  assert(typeof patch.reminder_sent_at === 'object', 'expected reminder_sent_at default object');
  assert(typeof patch.lifecycle_flags === 'object', 'expected lifecycle_flags default object');
  assert(Object.prototype.hasOwnProperty.call(patch, 'expiry_notified_at'), 'expected expiry_notified_at field');
  assert(patch.monthly_fee_ngn === 2500, 'expected monthly fee normalized to number');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
process.exit(failed > 0 ? 1 : 0);
