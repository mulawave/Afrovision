const path = require('path');

// In-memory stand-in for the Firestore calls the hotel-code model makes.
const store = new Map();
function docRef(collection, id) {
  const key = `${collection}/${id}`;
  return {
    key,
    async get() { return snapshot(key); },
    async set(data) { store.set(key, JSON.parse(JSON.stringify(data))); },
    async update(patch) { store.set(key, { ...store.get(key), ...JSON.parse(JSON.stringify(patch)) }); },
  };
}
function snapshot(key) {
  const data = store.get(key);
  return { exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))) };
}
// Transactions run one at a time, like Firestore's serialized retries.
let txQueue = Promise.resolve();
const fakeDb = {
  collection: (name) => ({
    doc: (id) => docRef(name, id),
    where: (field, op, value) => ({
      async get() {
        const docs = [...store.entries()]
          .filter(([k, v]) => k.startsWith(`${name}/`) && v[field] === value)
          .map(([, v]) => ({ data: () => v }));
        return { docs };
      },
    }),
  }),
  runTransaction(fn) {
    const run = txQueue.then(() => fn({
      get: (ref) => ref.get(),
      update: (ref, patch) => { store.set(ref.key, { ...store.get(ref.key), ...JSON.parse(JSON.stringify(patch)) }); },
    }));
    txQueue = run.catch(() => {});
    return run;
  },
};
require.cache[path.resolve(__dirname, '../src/utils/firestore.js')] = {
  id: 'firestore', filename: 'firestore', loaded: true,
  exports: { getFirestore: () => fakeDb },
};

const model = require('../src/distribution/distribution.model');

let passed = 0;
let failed = 0;
function assert(condition, message) { if (!condition) throw new Error(message); }
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  + ${name}`); }
  catch (error) { failed += 1; console.error(`  - ${name}: ${error.message}`); }
}

(async () => {
  console.log('\n-- Hotel Code Tests --\n');

  await test('price follows the bands', () => {
    assert(model.hotelPriceNgn(10) === 250000, `10 TVs: ${model.hotelPriceNgn(10)}`);
    assert(model.hotelPriceNgn(20) === 500000, `20 TVs: ${model.hotelPriceNgn(20)}`);
    assert(model.hotelPriceNgn(21) === 508500, `21 TVs: ${model.hotelPriceNgn(21)}`);
    assert(model.hotelPriceNgn(30) === 585000, `30 TVs: ${model.hotelPriceNgn(30)}`);
    assert(model.hotelPriceNgn(49) === 680000, `49 TVs: ${model.hotelPriceNgn(49)}`);
    assert(model.hotelPriceNgn(50) === 682500, `50 TVs: ${model.hotelPriceNgn(50)}`);
  });

  await test('one more TV never costs less, and price per TV never goes up', () => {
    for (let n = 1; n < 500; n += 1) {
      const a = model.hotelPriceNgn(n);
      const b = model.hotelPriceNgn(n + 1);
      assert(b > a, `${n + 1} TVs (${b}) should cost more than ${n} (${a})`);
      assert(b / (n + 1) <= a / n, `price per TV rose from ${n} to ${n + 1}`);
    }
  });

  const hotel = await model.mintHotelCode({ hotelName: 'Test Lodge', tvCount: 3, createdBy: 'admin1' });

  await test('hotel code starts with every seat free', () => {
    assert(hotel.type === 'hotel' && hotel.max_activations === 3 && hotel.activations_count === 0, 'bad initial code');
    assert(hotel.price_ngn === 75000, `price ${hotel.price_ngn}`);
  });

  await test('each TV takes one seat; the same TV re-activating keeps its seat', async () => {
    const a = await model.claimHotelSeat(hotel.code, 'tv-a');
    const again = await model.claimHotelSeat(hotel.code, 'tv-a');
    assert(a.ok && !a.alreadySeated && a.entry.activations_count === 1, 'first claim');
    assert(again.ok && again.alreadySeated && again.entry.activations_count === 1, 'repeat claim used a second seat');
  });

  await test('two TVs racing for the last two seats both fit, a third does not', async () => {
    const [b, c] = await Promise.all([
      model.claimHotelSeat(hotel.code, 'tv-b'),
      model.claimHotelSeat(hotel.code, 'tv-c'),
    ]);
    const d = await model.claimHotelSeat(hotel.code, 'tv-d');
    assert(b.ok && c.ok, 'b and c should both get seats');
    assert(!d.ok && d.reason === 'full', 'fourth TV should be refused');
    const stored = await model.findActivationCode(hotel.code);
    assert(stored.activations_count === 3 && stored.status === 'full', `stored count ${stored.activations_count}`);
  });

  await test('two TVs racing for one last seat: exactly one wins', async () => {
    const small = await model.mintHotelCode({ hotelName: 'One Room', tvCount: 1 });
    const results = await Promise.all([
      model.claimHotelSeat(small.code, 'x'),
      model.claimHotelSeat(small.code, 'y'),
    ]);
    assert(results.filter((r) => r.ok).length === 1, 'both TVs got the only seat');
  });

  await test('releasing a seat lets a replacement TV activate', async () => {
    const released = await model.releaseHotelSeat(hotel.code, 'tv-b');
    assert(released.ok && released.entry.activations_count === 2, 'release failed');
    const replacement = await model.claimHotelSeat(hotel.code, 'tv-d');
    assert(replacement.ok && replacement.entry.activations_count === 3, 'replacement refused');
  });

  await test('releasing a TV without a seat is rejected', async () => {
    const r = await model.releaseHotelSeat(hotel.code, 'not-a-tv');
    assert(!r.ok && r.reason === 'not_seated', 'expected not_seated');
  });

  await test('hotel codes are listed', async () => {
    const list = await model.listHotelCodes();
    assert(list.length === 2, `expected 2, got ${list.length}`);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
