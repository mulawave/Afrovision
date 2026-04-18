const admin = require('firebase-admin');
const User = require('../users/user.model');

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
  const user = User.findById(userId);
  if (!user) return { successCount: 0, failureCount: 0 };

  // Build the token set from afroDeviceToken (AfroVision-exclusive) + fcm_tokens[].
  // deviceToken is intentionally excluded — it belongs to the Raven ecosystem.
  const tokenSet = new Set(Array.isArray(user.fcm_tokens) ? user.fcm_tokens : []);
  if (user.afroDeviceToken) tokenSet.add(user.afroDeviceToken);

  const tokens = [...tokenSet];
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };
  return sendToTokens(tokens, payload, userId);
}

/**
 * Broadcast a notification to every registered user who has at least one FCM token.
 */
async function sendToAll(payload) {
  const allUsers = User.getAll();
  const tokenUserPairs = [];

  for (const user of allUsers) {
    if (Array.isArray(user.fcm_tokens)) {
      for (const token of user.fcm_tokens) {
        tokenUserPairs.push({ token, userId: user.id });
      }
    }
  }

  if (tokenUserPairs.length === 0) return { successCount: 0, failureCount: 0 };

  // FCM multicast supports up to 500 tokens at a time
  const CHUNK = 500;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < tokenUserPairs.length; i += CHUNK) {
    const chunk = tokenUserPairs.slice(i, i + CHUNK);
    const tokens = chunk.map((p) => p.token);
    const result = await sendToTokens(tokens, payload, null);
    totalSuccess += result.successCount;
    totalFailure += result.failureCount;
  }

  return { successCount: totalSuccess, failureCount: totalFailure };
}

module.exports = { sendToTokens, sendToUser, sendToAll };
