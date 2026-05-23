/**
 * Resumable upload session lifecycle tests.
 * Run: node test/broadcast-resumable-upload.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  + ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  - ${name}: ${error.message}`);
  }
}

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function withMock(modulePath, exportsValue, originals) {
  originals.set(modulePath, require.cache[modulePath]);
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function restoreMocks(originals, targetPath) {
  clearModule(targetPath);
  for (const [modPath, original] of originals.entries()) {
    if (original) require.cache[modPath] = original;
    else delete require.cache[modPath];
  }
}

function withFrozenNow(nowMs, fn) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  return Promise.resolve().then(fn).finally(() => {
    Date.now = originalNow;
  });
}

function buildHarness() {
  const originals = new Map();

  const userPath = require.resolve('../src/users/user.model');
  const channelPath = require.resolve('../src/channels/channel.model');
  const gcsPath = require.resolve('../src/utils/gcs');
  const firestorePath = require.resolve('../src/utils/firestore');
  const videoPath = require.resolve('../src/broadcast/video.model');
  const notificationPath = require.resolve('../src/notifications/notification.service');
  const targetPath = require.resolve('../src/broadcast/broadcast.controller');

  const sessions = new Map();
  const videos = new Map();

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function sessionRef(id) {
    return {
      async get() {
        const value = sessions.get(id);
        return {
          exists: value !== undefined,
          id,
          data: () => clone(value),
        };
      },
      async set(payload) {
        sessions.set(id, clone(payload));
      },
      async update(patch) {
        const current = sessions.get(id);
        if (!current) throw new Error('missing-session');
        sessions.set(id, { ...current, ...clone(patch) });
      },
    };
  }

  const firestoreMock = {
    getFirestore: () => ({
      collection(name) {
        if (name !== 'broadcast_upload_sessions') {
          throw new Error(`Unexpected collection ${name}`);
        }
        return {
          doc(id) {
            return sessionRef(id);
          },
          where(field, _op, value) {
            return {
              async get() {
                const docs = Array.from(sessions.entries())
                  .filter(([, session]) => session[field] === value)
                  .map(([id, session]) => ({ id, data: () => clone(session) }));
                return { docs };
              },
            };
          },
        };
      },
      async runTransaction(handler) {
        const pendingUpdates = [];
        const tx = {
          get: (ref) => ref.get(),
          update: (ref, patch) => {
            pendingUpdates.push(() => ref.update(patch));
          },
        };
        const result = await handler(tx);
        for (const apply of pendingUpdates) {
          await apply();
        }
        return result;
      },
    }),
  };

  let videoSeq = 0;

  withMock(userPath, {
    findById: async (id) => ({ id, role: 'creator' }),
  }, originals);

  withMock(channelPath, {
    findById: async (id) => ({ id, owner_id: 'creator_1', stream_source_mode: 'native' }),
  }, originals);

  withMock(gcsPath, {
    generateSignedUploadUrl: async () => ({ signedUrl: 'signed', publicUrl: 'public' }),
    createResumableUploadSession: async (filename) => ({
      sessionUrl: `https://fake-upload/${filename}`,
      publicUrl: `https://storage.googleapis.com/fake/${filename}`,
    }),
    getGCSObjectMetadata: async () => ({ size: '1000' }),
  }, originals);

  withMock(videoPath, {
    create: async ({ title, channelId, creatorUid, description, videoUrl, duration }) => {
      const video = {
        id: `video_${++videoSeq}`,
        title,
        channel_id: channelId,
        creator_uid: creatorUid,
        description,
        video_url: videoUrl,
        duration,
      };
      videos.set(video.id, video);
      return clone(video);
    },
    findById: async (id) => clone(videos.get(id) || null),
  }, originals);

  withMock(notificationPath, {
    notifyUser: async () => ({ successCount: 1, failureCount: 0 }),
  }, originals);

  withMock(firestorePath, firestoreMock, originals);

  clearModule(targetPath);
  const controller = require('../src/broadcast/broadcast.controller');

  return {
    controller,
    sessions,
    videos,
    teardown() {
      restoreMocks(originals, targetPath);
    },
  };
}

(async function run() {
  console.log('\n-- Broadcast Resumable Upload Tests --\n');

  await test('expired progress update returns 410', async () => {
    const h = buildHarness();
    try {
      const now = 2_000_000_000_000;
      await withFrozenNow(now, async () => {
        h.sessions.set('sess_1', {
          id: 'sess_1',
          creator_uid: 'creator_1',
          status: 'uploading',
          uploaded_bytes: 10,
          expires_at: now - 1,
        });

        const req = {
          userId: 'creator_1',
          params: { sessionId: 'sess_1' },
          body: { uploaded_bytes: 20, status: 'uploading' },
        };
        const res = makeRes();
        await h.controller.updateVideoUploadSessionProgress(req, res);
        assert(res.statusCode === 410, 'expected 410 for expired session');
      });
    } finally {
      h.teardown();
    }
  });

  await test('expired completion returns 410', async () => {
    const h = buildHarness();
    try {
      const now = 2_000_000_000_000;
      await withFrozenNow(now, async () => {
        h.sessions.set('sess_2', {
          id: 'sess_2',
          creator_uid: 'creator_1',
          channel_id: 'channel_1',
          filename: 'videos/file.mp4',
          title: 'My Video',
          description: 'Desc',
          public_url: 'https://storage.googleapis.com/fake/videos/file.mp4',
          duration: 12,
          uploaded_bytes: 1000,
          status: 'uploading',
          expires_at: now - 1,
        });

        const req = { userId: 'creator_1', body: { session_id: 'sess_2' } };
        const res = makeRes();
        await h.controller.completeVideoResumableSession(req, res);
        assert(res.statusCode === 410, 'expected 410 for expired completion');
      });
    } finally {
      h.teardown();
    }
  });

  await test('completion lock prevents duplicate video creation during finalizing', async () => {
    const h = buildHarness();
    try {
      const now = 2_000_000_000_000;
      await withFrozenNow(now, async () => {
        h.sessions.set('sess_3', {
          id: 'sess_3',
          creator_uid: 'creator_1',
          channel_id: 'channel_1',
          filename: 'videos/file2.mp4',
          title: 'Race Video',
          description: 'Desc',
          public_url: 'https://storage.googleapis.com/fake/videos/file2.mp4',
          duration: 9,
          uploaded_bytes: 1000,
          status: 'finalizing',
          expires_at: now + 100000,
        });

        const req = { userId: 'creator_1', body: { session_id: 'sess_3' } };
        const res = makeRes();
        await h.controller.completeVideoResumableSession(req, res);
        assert(res.statusCode === 409, 'expected 409 when finalization already in progress');
        assert(h.videos.size === 0, 'no video should be created');
      });
    } finally {
      h.teardown();
    }
  });

  await test('cancel session marks state as canceled and blocks completion', async () => {
    const h = buildHarness();
    try {
      const now = 2_000_000_000_000;
      await withFrozenNow(now, async () => {
        h.sessions.set('sess_4', {
          id: 'sess_4',
          creator_uid: 'creator_1',
          channel_id: 'channel_1',
          filename: 'videos/file3.mp4',
          title: 'Cancel Me',
          description: 'Desc',
          public_url: 'https://storage.googleapis.com/fake/videos/file3.mp4',
          duration: 9,
          uploaded_bytes: 100,
          status: 'uploading',
          expires_at: now + 100000,
        });

        const cancelReq = { userId: 'creator_1', params: { sessionId: 'sess_4' } };
        const cancelRes = makeRes();
        await h.controller.cancelVideoUploadSession(cancelReq, cancelRes);
        assert(cancelRes.statusCode === 200, 'cancel should succeed');

        const completeReq = { userId: 'creator_1', body: { session_id: 'sess_4' } };
        const completeRes = makeRes();
        await h.controller.completeVideoResumableSession(completeReq, completeRes);
        assert(completeRes.statusCode === 409, 'completion should be blocked after cancel');
      });
    } finally {
      h.teardown();
    }
  });

  console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
