/**
 * Challenge content service tests.
 * Run: node test/challenge-content.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
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
  const firestorePath = require.resolve("../src/utils/firestore");
  const servicePath = require.resolve("../src/design/challenge-content.service");

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
  const service = require("../src/design/challenge-content.service");

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
  console.log("\n-- Challenge Content Service Tests --\n");

  const fakeDb = createFakeFirestore();
  const { service, restore } = loadServiceWithMockedFirestore(fakeDb);

  try {
    await test("returns normalized defaults with all major sections", async () => {
      const page = await service.getAdminChallengeContent();
      assert(page && typeof page === "object", "content should be object");
      assert(Array.isArray(page.lifecycle_phases), "lifecycle_phases missing");
      assert(Array.isArray(page.unstoppable_items), "unstoppable_items missing");
      assert(Array.isArray(page.structure_phases), "structure_phases missing");
      assert(Array.isArray(page.prizes), "prizes missing");
      assert(Array.isArray(page.join_steps), "join_steps missing");
      assert(Array.isArray(page.platform_features), "platform_features missing");
      assert(Array.isArray(page.faqs), "faqs missing");
      assert(typeof page.bottom_cta_title === "string", "bottom_cta_title missing");
    });

    await test("saveChallengeContent persists full-page nested sections", async () => {
      const saved = await service.saveChallengeContent(
        {
          lifecycle_title: "Lifecycle",
          lifecycle_phases: [
            {
              id: "phase-custom",
              icon: "A",
              phase: "Phase A",
              subtitle: "Stage A",
              desc: "Alpha",
              status: "active",
            },
          ],
          prizes: [
            {
              id: "prize-custom",
              icon: "$",
              place: "Winner",
              amount: "100",
              desc: "Cash",
            },
          ],
          faqs: [
            {
              id: "faq-custom",
              q: "Question?",
              a: "Answer.",
            },
          ],
          bottom_cta_primary_href: "https://afrovision.example/join",
        },
        "tester"
      );

      assert(saved.lifecycle_title === "Lifecycle", "lifecycle title not saved");
      assert(saved.lifecycle_phases.length === 1, "lifecycle phases length mismatch");
      assert(saved.prizes[0].place === "Winner", "prize place not saved");
      assert(saved.faqs[0].q === "Question?", "faq question not saved");
      assert(saved.bottom_cta_primary_href === "https://afrovision.example/join", "cta href not saved");
    });

    await test("invalid href is sanitized to default", async () => {
      const saved = await service.saveChallengeContent(
        {
          hero_cta_href: "javascript:alert(1)",
          bottom_cta_secondary_href: "javascript:alert(2)",
        },
        "tester"
      );

      assert(saved.hero_cta_href === "/register", "hero_cta_href should fallback to default");
      assert(saved.bottom_cta_secondary_href === "/challenge/rules", "bottom_cta_secondary_href should fallback to default");
    });

    await test("public content returns persisted expanded model", async () => {
      await service.saveChallengeContent(
        {
          unstoppable_title: "Unstoppable",
          unstoppable_items: [
            {
              id: "u1",
              icon: "*",
              title: "Item",
              desc: "Desc",
            },
          ],
        },
        "tester"
      );

      const page = await service.getPublicChallengeContent();
      assert(page.unstoppable_title === "Unstoppable", "public unstoppable_title mismatch");
      assert(Array.isArray(page.unstoppable_items) && page.unstoppable_items.length === 1, "public unstoppable_items mismatch");
    });
  } finally {
    restore();
  }

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
