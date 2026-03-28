const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000,
      path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function test() {
  // Register (ignore if exists)
  let reg = await req('POST', '/auth/register', { email: 'test2@vpt.com', password: 'Test12345!' });
  if (reg.status !== 201) {
    reg = await req('POST', '/auth/login', { email: 'test2@vpt.com', password: 'Test12345!' });
  }
  console.log('Auth:', reg.status);
  const token = reg.body.token;
  if (!token) { console.log('No token:', JSON.stringify(reg.body)); return; }

  // Get plans
  const plans = await req('GET', '/subscriptions/plans', null, token);
  const premiumPlan = plans.body.plans.find(p => p.name === 'premium');
  console.log('Premium plan:', premiumPlan.name, 'N' + premiumPlan.price);

  // Subscribe
  const sub = await req('POST', '/subscriptions/subscribe', { planId: premiumPlan.id, paymentMethod: 'fiat' }, token);
  console.log('Subscribe status:', sub.status);
  console.log('User vpt_balance:', sub.body.user.vpt_balance);
  console.log('User bsc_address:', sub.body.user.bsc_address ? sub.body.user.bsc_address.slice(0,12) + '...' : null);
  console.log('Batch result:', JSON.stringify(sub.body.batch));

  // Ledger
  const ledger = await req('GET', '/vpt/ledger', null, token);
  console.log('\nLedger entries (' + ledger.body.ledger.length + '):');
  for (const e of ledger.body.ledger) {
    console.log('  ', e.type, '| NGN:', e.amount_ngn, '| VPT:', e.amount_vpt, '| Status:', e.status);
  }

  // Profile
  const profile = await req('GET', '/users/me', null, token);
  console.log('\nProfile vpt_balance:', profile.body.user.vpt_balance);
  console.log('Profile bsc_address:', profile.body.user.bsc_address ? profile.body.user.bsc_address.slice(0,12) + '...' : null);

  // Home stats
  const home = await req('GET', '/home/stats', null, token);
  console.log('\nCommunity Pool:', JSON.stringify(home.body.community_pool));

  // Wallet
  const wallet = await req('GET', '/wallet/me', null, token);
  console.log('Wallet:', wallet.body.wallet ? wallet.body.wallet.bsc_address.slice(0,12) + '...' : 'none');
}

test().catch(console.error);
