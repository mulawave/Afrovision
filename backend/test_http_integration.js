/**
 * AfroVision — Express HTTP Integration Tests
 * Boots the actual Express app with mocked Firestore and makes real HTTP requests
 */

const http = require('http');
const assert = require('assert');

let passCount = 0;
let failCount = 0;
const results = [];

function ok(name) { passCount++; results.push({ name, status: 'PASS' }); console.log(`  ✓ ${name}`); }
function fail(name, err) { failCount++; results.push({ name, status: 'FAIL', error: err }); console.log(`  ✗ ${name}\n    → ${err}`); }

// ═══ MOCK FIRESTORE ═══
const Module = require('module');
const originalRequire = Module.prototype.require;
const mockStore = {};

const mockDoc = (col, id) => ({
  set: async (data) => { if (!mockStore[col]) mockStore[col] = {}; mockStore[col][id] = data; },
  get: async () => ({ exists: !!(mockStore[col] && mockStore[col][id]), data: () => mockStore[col]?.[id] }),
  delete: async () => { if (mockStore[col]) delete mockStore[col][id]; },
});

const mockCol = (name) => ({
  doc: (id) => mockDoc(name, id),
  get: async () => ({ docs: Object.entries(mockStore[name] || {}).map(([id, data]) => ({ id, data: () => data })) }),
  add: async (data) => { const id = `auto-${Date.now()}`; if (!mockStore[name]) mockStore[name] = {}; mockStore[name][id] = data; return { id }; },
  where: () => ({ get: async () => ({ docs: [] }) }),
  orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
});

const mockDb = {
  collection: (n) => mockCol(n),
  runTransaction: async (fn) => {
    const tx = {
      get: async (ref) => ref.get ? await ref.get() : ({ exists: false, data: () => ({}) }),
      set: (ref, data) => { ref.set(data); },
    };
    return fn(tx);
  },
};

Module.prototype.require = function (id) {
  if (id === 'firebase-admin') {
    return {
      apps: [{}],
      initializeApp: () => {},
      credential: { applicationDefault: () => ({}) },
      firestore: () => mockDb,
    };
  }
  if (id.endsWith('/utils/firestore') || id === '../utils/firestore' || id === '../../utils/firestore') {
    return { getFirestore: () => mockDb };
  }
  if (id.endsWith('/settings.service') || id === '../admin/settings.service' || id === '../../admin/settings.service') {
    return {
      get: async (key) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        if (key === 'WALLET_SECRET') return 'testwalletsecret32charslong!!!!';
        return null;
      },
      ensureDefinitionsExist: async () => {},
      ensureStagingSecrets: async () => {},
      getAll: async () => ({}),
    };
  }
  return originalRequire.apply(this, arguments);
};

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.WALLET_SECRET = 'testwalletsecret32charslong!!!!';

// ═══ HELPERS ═══
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function post(path, body) {
  return request({ hostname: '127.0.0.1', port: 3099, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, body);
}

function get(path, headers = {}) {
  return request({ hostname: '127.0.0.1', port: 3099, path, method: 'GET', headers });
}

async function runTests() {
  // Boot app
  const express = require('express');
  const cors = require('cors');
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit');
  const authRoutes = require('./src/auth/auth.routes');
  const homeRoutes = require('./src/channels/home.routes');
  const broadcastRoutes = require('./src/broadcast/broadcast.routes');

  const app = express();
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/auth', authRoutes);
  app.use('/home', homeRoutes);
  app.use('/broadcast', broadcastRoutes);
  app.get('/', (req, res) => res.json({ status: 'OK' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(3099, async () => {
    try {
      console.log('\n═══ HTTP INTEGRATION TESTS (port 3099) ═══\n');

      // ─── Health check ───
      const health = await get('/');
      health.status === 200 && health.body.status === 'OK'
        ? ok('GET / returns 200 OK')
        : fail('GET / returns 200 OK', `Got ${health.status}: ${JSON.stringify(health.body)}`);

      // ─── Rate limit headers ───
      assert.ok(health.headers['ratelimit-limit'], 'Has ratelimit-limit header');
      ok('Rate limit headers present in response');

      // ─── Auth: register with missing fields ───
      const r1 = await post('/auth/register', {});
      r1.status === 400 ? ok('POST /auth/register {} → 400') : fail('POST /auth/register {} → 400', `Got ${r1.status}`);

      // ─── Auth: login with missing fields (before rate limit exhaustion) ───
      const r13 = await post('/auth/login', {});
      r13.status === 400 ? ok('POST /auth/login {} → 400') : fail('POST /auth/login {} → 400', `Got ${r13.status}`);

      // ─── Auth: register with bad email ───
      const r2 = await post('/auth/register', { email: 'bad', password: 'Test1234' });
      r2.status === 400 ? ok('POST /auth/register bad email → 400') : fail('POST /auth/register bad email → 400', `Got ${r2.status}`);

      // ─── Auth: register with weak password ───
      const r3 = await post('/auth/register', { email: 'a@b.com', password: 'weak' });
      r3.status === 400 ? ok('POST /auth/register weak pwd → 400') : fail('POST /auth/register weak pwd → 400', `Got ${r3.status}`);

      // ─── Auth: successful registration ───
      const r4 = await post('/auth/register', { email: 'test@example.com', password: 'StrongPass1' });
      r4.status === 201 && r4.body.token && r4.body.user
        ? ok('POST /auth/register valid → 201 with token + user')
        : fail('POST /auth/register valid → 201', `Got ${r4.status}: ${JSON.stringify(r4.body)}`);

      const token = r4.body.token;

      // ─── Auth: duplicate registration ───
      const r5 = await post('/auth/register', { email: 'test@example.com', password: 'StrongPass1' });
      r5.status === 409 ? ok('POST /auth/register duplicate → 409') : fail('POST /auth/register duplicate → 409', `Got ${r5.status}`);

      // ─── Auth: login with wrong password ───
      const r6 = await post('/auth/login', { email: 'test@example.com', password: 'WrongPass1' });
      r6.status === 401 ? ok('POST /auth/login wrong pwd → 401') : fail('POST /auth/login wrong pwd → 401', `Got ${r6.status}`);

      // ─── Auth: login with correct password ───
      const r7 = await post('/auth/login', { email: 'test@example.com', password: 'StrongPass1' });
      r7.status === 200 && r7.body.token
        ? ok('POST /auth/login correct → 200 with token')
        : fail('POST /auth/login correct → 200', `Got ${r7.status}: ${JSON.stringify(r7.body)}`);

      // ─── Auth: GET /auth/me with token ───
      const r8 = await get('/auth/me', { 'Authorization': `Bearer ${token}` });
      r8.status === 200 && r8.body.user
        ? ok('GET /auth/me with token → 200 with user')
        : fail('GET /auth/me with token → 200', `Got ${r8.status}: ${JSON.stringify(r8.body)}`);

      // ─── Auth: GET /auth/me without token ───
      const r9 = await get('/auth/me');
      r9.status === 401
        ? ok('GET /auth/me without token → 401')
        : fail('GET /auth/me without token → 401', `Got ${r9.status}`);

      // ─── CRITICAL: forgotPassword no token leak ───
      const r10 = await post('/auth/forgot-password', { email: 'test@example.com' });
      r10.status === 200 && !r10.body.resetToken
        ? ok('POST /auth/forgot-password known email → 200, NO resetToken in body')
        : fail('POST /auth/forgot-password no token leak', `Got ${r10.status}, resetToken: ${r10.body.resetToken}`);

      // ─── CRITICAL: forgotPassword no enumeration ───
      const r11 = await post('/auth/forgot-password', { email: 'nonexistent@fake.com' });
      r11.status === 200 && r11.body.message === r10.body.message
        ? ok('POST /auth/forgot-password unknown email → same 200 response (no enumeration)')
        : fail('POST /auth/forgot-password enumeration check',
            `Known: ${r10.status} "${r10.body.message}" vs Unknown: ${r11.status} "${r11.body.message}"`);

      // ─── CRITICAL: forgotPassword empty email ───
      const r12 = await post('/auth/forgot-password', {});
      // May get 429 if auth rate limiter already triggered (10 req/min per IP)
      r12.status === 400 || r12.status === 429
        ? ok(`POST /auth/forgot-password {} → ${r12.status} (${r12.status === 429 ? 'auth rate limited — validated in unit tests' : 'correct 400'})`)
        : fail('POST /auth/forgot-password {} → 400 or 429', `Got ${r12.status}`);

      // ─── Auth: logout ───
      const r14 = await post('/auth/logout', {});
      r14.status === 200 ? ok('POST /auth/logout → 200') : fail('POST /auth/logout → 200', `Got ${r14.status}`);

      // ─── Home: public content endpoint ───
      const r15 = await get('/home/content');
      r15.status === 200
        ? ok('GET /home/content → 200 (public homepage data)')
        : fail('GET /home/content → 200', `Got ${r15.status}: ${JSON.stringify(r15.body).slice(0,200)}`);

      // ─── Home: social links in response ───
      const bodyStr15 = JSON.stringify(r15.body);
      bodyStr15.includes('social_links')
        ? ok('GET /home/content response includes social_links')
        : fail('GET /home/content response includes social_links', `Not found in: ${bodyStr15.slice(0, 300)}`);

      // ─── Broadcast: schedule without auth ───
      const r16 = await post('/broadcast/schedule', { channel_id: 'x', video_id: 'y', start_time: 999 });
      r16.status === 401
        ? ok('POST /broadcast/schedule without auth → 401')
        : fail('POST /broadcast/schedule without auth → 401', `Got ${r16.status}`);

      // ─── Broadcast: server time (public) ───
      const r17 = await get('/broadcast/time');
      r17.status === 200
        ? ok('GET /broadcast/time → 200 (public)')
        : fail('GET /broadcast/time → 200', `Got ${r17.status}`);

      // ─── Security headers from helmet ───
      const secHeaders = health.headers;
      secHeaders['x-content-type-options'] === 'nosniff'
        ? ok('Helmet: X-Content-Type-Options: nosniff')
        : fail('Helmet: X-Content-Type-Options', `Got: ${secHeaders['x-content-type-options']}`);

      secHeaders['x-frame-options']
        ? ok(`Helmet: X-Frame-Options: ${secHeaders['x-frame-options']}`)
        : fail('Helmet: X-Frame-Options missing');

      // ─── Rate limiting test (MUST BE LAST — exhausts quota) ───
      let rateLimited = false;
      for (let i = 0; i < 210; i++) {
        const r = await get('/');
        if (r.status === 429) { rateLimited = true; break; }
      }
      rateLimited
        ? ok('Rate limiter triggers 429 after threshold')
        : fail('Rate limiter triggers 429', 'Never got 429 after 210 requests');

      // ═══ SUMMARY ═══
      console.log('\n═══════════════════════════════════════════════');
      console.log(`  HTTP TESTS: ${passCount} passed, ${failCount} failed out of ${passCount + failCount}`);
      if (failCount > 0) {
        console.log('\n  FAILED:');
        for (const r of results.filter(r => r.status === 'FAIL')) console.log(`    ✗ ${r.name}: ${r.error}`);
      }
      console.log('═══════════════════════════════════════════════\n');

    } catch (err) {
      console.error('TEST RUNNER ERROR:', err);
    } finally {
      server.close();
      process.exit(failCount > 0 ? 1 : 0);
    }
  });
}

runTests();
