const http = require('http');

const BASE = 'http://localhost:3000';
let token = null;
let userId = null;
let channelId = null;
let passed = 0;
let failed = 0;

function req(method, path, body) {
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
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
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
    console.log(`  ❌ ${name}`);
  }
}

async function run() {
  const email = `test_${Date.now()}@test.com`;
  const password = 'Test1234!';

  console.log('\n=== AUTH ===');
  let r = await req('POST', '/auth/register', { email, password });
  assert('Register', r.status === 201);
  token = r.body.token;
  userId = r.body.user?.id;

  r = await req('POST', '/auth/login', { email, password });
  assert('Login', r.status === 200 && r.body.token);
  token = r.body.token;

  console.log('\n=== CURRENCIES ===');
  r = await req('GET', '/currencies');
  assert('GET /currencies', r.status === 200 && r.body.currencies.length === 4);

  r = await req('GET', '/currencies/plans?currency=USD');
  assert('GET /currencies/plans?currency=USD', r.status === 200 && r.body.symbol === '$');
  assert('Converted price exists', r.body.plans[0].display_price > 0);

  r = await req('GET', '/currencies/plans?currency=INVALID');
  assert('Invalid currency rejected', r.status === 400);

  console.log('\n=== USER CURRENCY ===');
  r = await req('PATCH', '/users/currency', { currency: 'USD' });
  assert('Update preferred currency', r.status === 200 && r.body.user.preferred_currency === 'USD');

  r = await req('PATCH', '/users/currency', { currency: 'INVALID' });
  assert('Invalid currency rejected', r.status === 400);

  r = await req('GET', '/users/me');
  assert('Profile has preferred_currency', r.body.user.preferred_currency === 'USD');
  assert('Profile has vpt_balance', r.body.user.vpt_balance === 0);
  assert('Profile has first_subscription_at', r.body.user.first_subscription_at === null);

  console.log('\n=== SUBSCRIPTION ===');
  r = await req('POST', '/subscriptions/subscribe', { planId: 'plan_pro' });
  assert('Subscribe to pro', r.status === 200 && r.body.user.subscription_plan === 'pro');
  assert('Role set to creator', r.body.user.role === 'creator');
  assert('first_subscription_at set', r.body.user.first_subscription_at !== null);

  // Try vPT payment with 0 balance
  r = await req('POST', '/subscriptions/subscribe', { planId: 'plan_pro', paymentMethod: 'vpt' });
  assert('vPT payment insufficient balance', r.status === 400);

  console.log('\n=== CHANNELS ===');
  r = await req('POST', '/channels', { name: 'Test Channel', description: 'A test channel', category: 'Entertainment' });
  assert('Create channel', r.status === 201 && r.body.channel.name === 'Test Channel');
  channelId = r.body.channel.id;
  assert('Channel has logo_url null', r.body.channel.logo_url === null);
  assert('Channel has banner_url null', r.body.channel.banner_url === null);

  r = await req('GET', '/channels');
  assert('Get public channels', r.status === 200 && r.body.channels.length >= 1);

  r = await req('GET', '/channels/me');
  assert('Get my channels', r.status === 200 && r.body.channels.length >= 1);

  // Edit channel — should fail due to vPT balance < 500
  r = await req('PATCH', `/channels/${channelId}`, { name: 'Updated Name' });
  assert('Edit channel blocked (low vPT)', r.status === 403);

  r = await req('PATCH', `/channels/${channelId}/enable`);
  assert('Enable channel', r.status === 200);

  r = await req('DELETE', `/channels/${channelId}`);
  assert('Disable channel', r.status === 200);

  r = await req('PATCH', `/channels/${channelId}/enable`);
  assert('Re-enable channel', r.status === 200);

  console.log('\n=== VPT ===');
  r = await req('GET', '/vpt/balance');
  assert('Get vPT balance', r.status === 200 && r.body.balance === 0);

  r = await req('GET', '/vpt/transactions');
  assert('Get vPT transactions', r.status === 200 && Array.isArray(r.body.transactions));

  console.log('\n=== PLANS ===');
  r = await req('GET', '/subscriptions/plans');
  assert('Plans have currency field', r.body.plans.every((p) => p.currency === 'NGN'));
  assert('Plans have display_labels', r.body.plans.every((p) => typeof p.display_labels === 'object'));
  assert('Pro plan has badge', r.body.plans.find((p) => p.name === 'pro').badge === 'Pro');

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`========================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
