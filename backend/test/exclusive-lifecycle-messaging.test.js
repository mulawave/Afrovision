/**
 * Exclusive lifecycle messaging tests.
 * Run: node test/exclusive-lifecycle-messaging.test.js
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          passed += 1;
          console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
          failed += 1;
          console.error(`  ✗ ${name}: ${err.message}`);
        });
    }

    passed += 1;
    console.log(`  ✓ ${name}`);
    return Promise.resolve();
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}: ${err.message}`);
    return Promise.resolve();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n-- Exclusive Lifecycle Messaging Tests --\n');

const { buildExclusiveLifecycleMessage } = require('../src/channels/exclusive_lifecycle.messages');
const Email = require('../src/utils/email');

test('english purchase message maps expected type and labels', () => {
  const message = buildExclusiveLifecycleMessage('user.purchase', {
    user: { preferred_locale: 'en-US' },
    channelName: 'Afro Beats TV',
    isRenewal: false,
  });

  assert(message.type === 'exclusive_access_activated', 'unexpected type for purchase activation');
  assert(message.title.includes('Activated'), 'expected activated title');
  assert(message.emailSubject.toLowerCase().includes('activated'), 'expected activated email subject');
});

test('pidgin renewal reminder message is generated', () => {
  const message = buildExclusiveLifecycleMessage('user.reminder', {
    user: { preferred_language: 'pidgin' },
    channelName: 'Culture TV',
    daysLeft: 3,
  });

  assert(message.type === 'exclusive_access_reminder', 'unexpected reminder type');
  assert(message.body.toLowerCase().includes('go expire'), 'expected pidgin reminder copy');
  assert(message.emailSubject.toLowerCase().includes('expire'), 'expected reminder email subject');
});

test('creator expiring message is generated with dashboard intent', () => {
  const message = buildExclusiveLifecycleMessage('creator.expiring', {
    user: { preferred_locale: 'en' },
    channelName: 'Drama Hub',
  });

  assert(message.type === 'exclusive_access_expiring_creator', 'unexpected creator expiring type');
  assert(message.ctaLabel.toLowerCase().includes('dashboard'), 'expected dashboard cta label');
});

test('ops alert message carries error and anomaly context', () => {
  const message = buildExclusiveLifecycleMessage('ops.alert', {
    user: { preferred_locale: 'en' },
    errorCount: 2,
    anomalyCount: 1,
  });

  assert(message.type === 'exclusive_ops_alert', 'unexpected ops alert type');
  assert(message.body.includes('2 error(s)'), 'expected error count in ops body');
  assert(message.body.includes('1 anomaly'), 'expected anomaly count in ops body');
});

test('exclusive lifecycle email sender export exists', () => {
  assert(typeof Email.sendExclusiveLifecycleEmail === 'function', 'sendExclusiveLifecycleEmail export missing');
});

test('exclusive lifecycle email sender returns false without api key', async () => {
  const result = await Email.sendExclusiveLifecycleEmail({
    to: 'noreply@example.com',
    subject: 'Test',
    title: 'Exclusive Test',
    body: 'Message body',
    ctaUrl: 'https://example.com',
  });

  assert(result === false, 'expected false when SENDGRID_API_KEY is not configured');
});

Promise.resolve()
  .then(() => test('worker module exports scheduler', () => {
    const worker = require('../src/channels/exclusive_lifecycle.worker');
    assert(typeof worker.processExclusiveLifecycle === 'function', 'processExclusiveLifecycle is missing');
    assert(typeof worker.runScheduledExclusiveLifecycle === 'function', 'runScheduledExclusiveLifecycle is missing');
  }))
  .then(() => {
    console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
