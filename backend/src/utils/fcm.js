const admin = require('firebase-admin');
const User = require('../users/user.model');
const { getFirestore } = require('./firestore');

/**
 * Send a notification to a specific list of FCM tokens.
 * Automatically removes invalid/expired tokens from the owning user.
 *
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 * @param {string|null} userId   Optional — if provided, stale tokens are cleaned up
 */
async function sendToTokens(tokens, payload, userId = null) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const badgeCount = payload.badge || 1;
  const dataMap = payload.data || {};
  // v2 channel ID — v1 channel may have been created on-device without sound so it
  const channelId = 'afrovision_main';

  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: dataMap,
    android: {
      notification: {
        channelId,
        // Explicit monochrome icon — without this the FCM SDK may fall back to
        // the launcher icon (coloured blob) instead of the ADtv status-bar icon.
        icon: 'ic_stat_notification',
        // 'high' triggers heads-up banner on Android.
        priority: 'high',
        defaultVibrateTimings: true,
        defaultLightSettings: true,
        // Sound fields — channel sound setting AND explicit FCM sound are both
        // needed: channel provides the default, FCM payload confirms it.
        defaultSound: true,
        sound: 'default',
      },
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: badgeCount,
        },
      },
    },
  };

  let response;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
  } catch (err) {
    console.error('[FCM] sendEachForMulticast error:', err.message);
    return { successCount: 0, failureCount: tokens.length };
  }

  // Clean up tokens that are no longer valid
  if (response.failureCount > 0) {
    const staleTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        console.error(`[FCM] token[${idx}] error code=${code} message=${r.error && r.error.message}`);
        if (
          userId &&
          (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token')
        ) {
          staleTokens.push(tokens[idx]);
        }
      }
    });
    if (userId) {
      for (const t of staleTokens) {
        await User.removeFcmToken(userId, t).catch(() => {});
      }
    }
  }

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

/**
 * Send a notification to all FCM tokens registered for a given user.
 */
async function sendToUser(userId, payload) {
  const user = await User.findById(userId);
  if (!user) return { successCount: 0, failureCount: 0 };

  // Build the token set from afroDeviceToken (AfroVision-exclusive) + fcm_tokens[].
  // deviceToken is intentionally excluded — it belongs to the Raven ecosystem.
  const tokenSet = new Set(Array.isArray(user.fcm_tokens) ? user.fcm_tokens : []);
  if (user.afroDeviceToken) tokenSet.add(user.afroDeviceToken);

  const tokens = [...tokenSet];
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };
  return sendToTokens(tokens, payload, userId);
}

async function collectBroadcastTargets() {
  const db = getFirestore();
  const userIds = new Set();
  const tokenSet = new Set();

  // Primary source: dedicated notification target index maintained on token writes.
  let cursor = null;
  do {
    const page = await User.listNotificationTargetsPage({ limit: 500, startAfterId: cursor });
    for (const target of page.targets) {
      userIds.add(target.id);
      const tokens = Array.isArray(target.tokens) ? target.tokens : [];
      for (const token of tokens) {
        const normalized = String(token || '').trim();
        if (normalized) tokenSet.add(normalized);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);

  // Compatibility path: include users that still have afroDeviceToken but are not yet indexed.
  let lastToken = null;
  let lastDocId = null;
  while (true) {
    let query = db.collection('users')
      .where('afroDeviceToken', '>=', '')
      .orderBy('afroDeviceToken')
      .orderBy('__name__')
      .limit(500);

    if (lastToken !== null && lastDocId !== null) {
      query = query.startAfter(lastToken, lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const token = String(data.afroDeviceToken || '').trim();
      if (token) {
        userIds.add(doc.id);
        tokenSet.add(token);
      }
    }

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    lastToken = String(lastDoc.data().afroDeviceToken || '');
    lastDocId = lastDoc.id;

    if (snapshot.size < 500) break;
  }

  return {
    userIds: [...userIds],
    tokens: [...tokenSet],
  };
}

/**
 * Broadcast a notification to every registered user who has at least one FCM token.
 */
async function sendToAll(payload, precomputedTargets = null) {
  const targets = precomputedTargets || await collectBroadcastTargets();
  const tokens = targets.tokens;

  if (tokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      targetedUsers: targets.userIds.length,
      targetedTokens: 0,
    };
  }

  // FCM multicast supports up to 500 tokens at a time
  const CHUNK = 500;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunkTokens = tokens.slice(i, i + CHUNK);
    const result = await sendToTokens(chunkTokens, payload, null);
    totalSuccess += result.successCount;
    totalFailure += result.failureCount;
  }

  return {
    successCount: totalSuccess,
    failureCount: totalFailure,
    targetedUsers: targets.userIds.length,
    targetedTokens: tokens.length,
  };
}

module.exports = { sendToTokens, sendToUser, sendToAll, collectBroadcastTargets };
