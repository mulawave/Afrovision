/**
 * Static pages content service tests.
 * Run: node test/static-pages-content.test.js
 */

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function createFakeFirestore() {
  const storage = new Map();

  return {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const value = storage.get(key);
              return {
                exists: value !== undefined,
                data: () => (value ? { ...value } : undefined),
              };
            },
            async set(payload) {
              storage.set(key, { ...payload });
            },
          };
        },
      };
    },
  };
}

function loadServiceWithMockedFirestore(fakeDb) {
  const firestorePath = require.resolve('../src/utils/firestore');
  const servicePath = require.resolve('../src/design/static-pages-content.service');

  const originalFirestoreCache = require.cache[firestorePath];

  require.cache[firestorePath] = {
    id: firestorePath,
    filename: firestorePath,
    loaded: true,
    exports: {
      getFirestore: () => fakeDb,
    },
  };

  delete require.cache[servicePath];
  const service = require('../src/design/static-pages-content.service');

  return {
    service,
    restore() {
      delete require.cache[servicePath];
      if (originalFirestoreCache) {
        require.cache[firestorePath] = originalFirestoreCache;
      } else {
        delete require.cache[firestorePath];
      }
    },
  };
}

(async function run() {
  console.log('\n── Static Pages Content Service Tests ──\n');

  const fakeDb = createFakeFirestore();
  const { service, restore } = loadServiceWithMockedFirestore(fakeDb);

  try {
    await test('allowed slugs expose expected CMS pages', async () => {
      const expected = ['about', 'careers', 'press', 'contact', 'updates'];
      assert(Array.isArray(service.ALLOWED_SLUGS), 'ALLOWED_SLUGS is not an array');
      assert(service.ALLOWED_SLUGS.length === expected.length, 'ALLOWED_SLUGS length mismatch');
      for (const slug of expected) {
        assert(service.ALLOWED_SLUGS.includes(slug), `Missing slug: ${slug}`);
      }
    });

    await test('returns normalized defaults when no content is stored', async () => {
      const about = await service.getAdminPageContent('about');
      assert(about && typeof about === 'object', 'about content is not an object');
      assert(typeof about.title === 'string' && about.title.length > 0, 'about title missing');
      assert(Array.isArray(about.values) && about.values.length > 0, 'about values missing');
      assert(about.cta_href === '/register', 'about default cta_href mismatch');
    });

    await test('savePageContent sanitizes disallowed tags/handlers but preserves safe HTML', async () => {
      const saved = await service.savePageContent('about', {
        title: '  <b>AfroVision Mission</b> <script>alert(1)</script> <div onclick="x()">',
        cta_href: 'javascript:alert(1)',
      }, 'tester');

      assert(saved.title === '<b>AfroVision Mission</b>  <div>', 'title sanitization did not preserve safe HTML or strip unsafe handlers/tags');
      assert(saved.cta_href === '/register', 'invalid href was not reset to template default');
    });

    await test('savePageContent ignores unknown keys via template normalization', async () => {
      const saved = await service.savePageContent('careers', {
        title: 'Careers',
        unknown_field: 'should not survive',
      }, 'tester');

      assert(saved.title === 'Careers', 'expected known key was not saved');
      assert(!Object.prototype.hasOwnProperty.call(saved, 'unknown_field'), 'unknown key should not be preserved');
    });

    await test('getPublicPageContent returns persisted normalized content', async () => {
      await service.savePageContent('press', {
        title: 'Press Room',
        press_email: 'press@afrovision.online',
      }, 'tester');

      const page = await service.getPublicPageContent('press');
      assert(page.title === 'Press Room', 'public content did not include saved title');
      assert(page.press_email === 'press@afrovision.online', 'public content did not include saved email');
    });

    await test('updates page supports nested items and detail bullets', async () => {
      const saved = await service.savePageContent('updates', {
        title: 'Platform Updates',
        items: [
          {
            date: 'April 20, 2026',
            tag: 'Release',
            tone: 'orange',
            icon: '🚀',
            title: 'Updates CMS shipped',
            summary: 'The updates page is now managed from the admin CMS.',
            details: ['Admin editor added', 'Website page reads managed content'],
          },
        ],
      }, 'tester');

      assert(Array.isArray(saved.items), 'updates items were not saved as an array');
      assert(saved.items.length === 1, 'updates items length mismatch');
      assert(saved.items[0].title === 'Updates CMS shipped', 'update item title did not persist');
      assert(Array.isArray(saved.items[0].details), 'update details were not saved as an array');
      assert(saved.items[0].details[1] === 'Website page reads managed content', 'update detail bullet mismatch');
    });

    await test('unsupported slug throws an error', async () => {
      let threw = false;
      try {
        await service.getAdminPageContent('privacy');
      } catch (error) {
        threw = true;
      }
      assert(threw, 'unsupported slug did not throw');
    });
  } finally {
    restore();
  }

  console.log(`\n── ${passed} passed, ${failed} failed ──\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
