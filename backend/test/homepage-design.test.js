/**
 * Homepage design service tests.
 * Run: node test/homepage-design.test.js
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
  const servicePath = require.resolve('../src/design/homepage-design.service');

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
  const service = require('../src/design/homepage-design.service');

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
  console.log('\n── Homepage Design Service Tests ──\n');

  const fakeDb = createFakeFirestore();
  const { service, restore } = loadServiceWithMockedFirestore(fakeDb);

  try {
    await test('returns default design when firestore is empty', async () => {
      const design = await service.getAdminHomepageDesign();
      assert(design.branding, 'Missing branding');
      assert(design.social_links.length > 0, 'Missing default social links');
      assert(design.social_links[0].platform === 'twitter', 'Expected twitter default');
    });

    await test('normalizes social links with custom platform and icon_url', async () => {
      const saved = await service.saveHomepageDesign({
        social_links: [
          { platform: 'discord', label: 'AfroVision Discord', url: 'https://discord.gg/abc', icon_url: 'https://example.com/discord.png', enabled: true },
          { platform: 'twitter', label: 'Twitter', url: 'https://x.com/abc' }
        ]
      }, 'tester');
      
      const discordLink = saved.social_links[0];
      assert(discordLink.platform === 'discord', 'Failed to save custom platform');
      assert(discordLink.icon_url === 'https://example.com/discord.png', 'Failed to save icon_url');
      assert(saved.social_links[1].platform === 'twitter', 'Failed to save standard platform');
    });

    await test('public endpoint exposes icon_url for social links', async () => {
      const pub = await service.getPublicHomepageContent();
      assert(pub.social_links.length > 0, 'No public social links');
      assert(pub.social_links[0].platform === 'discord', 'Expected discord from previous test');
      assert(pub.social_links[0].icon_url === 'https://example.com/discord.png', 'icon_url should be public');
      assert(!Object.prototype.hasOwnProperty.call(pub.social_links[0], 'enabled'), 'enabled flag should not be public');
    });
  } finally {
    restore();
  }

  console.log(`\n── ${passed} passed, ${failed} failed ──\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
