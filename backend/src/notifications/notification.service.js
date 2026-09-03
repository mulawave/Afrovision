const fcm = require('../utils/fcm');
const User = require('../users/user.model');
const Notification = require('./notification.model');

/**
 * Send a push notification to a specific user (by userId).
 */
async function notifyUser(
  userId,
  { title, body, data = {}, type = 'system', link = null, source = null, createdBy = null }
) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      successCount: 0,
      failureCount: 1,
      notification: null,
    };
  }

  const notification = await Notification.create({
    userId,
    title,
    body,
    data,
    type,
    link,
    source,
    createdBy,
  });

  // Get the current unread count so the device can update its app icon badge
  const unreadCount = await Notification.countUnread(userId);

  try {
    const pushResult = await fcm.sendToUser(userId, {
      title,
      body,
      data: {
        ...data,
        notification_id: notification.id,
        link: link || '',
        type,
        unread_count: String(unreadCount),
      },
      badge: unreadCount,
    });

    return {
      ...pushResult,
      notification,
    };
  } catch (_) {
    return {
      successCount: 0,
      failureCount: 1,
      notification,
    };
  }
}

async function notifyUsers(userIds, payload) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return {
      targeted: 0,
      successCount: 0,
      failureCount: 0,
      notifications: [],
    };
  }

  const results = await Promise.allSettled(uniqueUserIds.map((userId) => notifyUser(userId, payload)));
  const notifications = [];
  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      notifications.push(result.value.notification);
      successCount += result.value.notification ? 1 : 0;
      failureCount += result.value.failureCount || 0;
    } else {
      failureCount += 1;
    }
  }

  return {
    targeted: uniqueUserIds.length,
    successCount,
    failureCount,
    notifications,
  };
}

/**
 * Broadcast a push notification to all users who have registered FCM tokens.
 *
 * Avoids an N+1 pattern: notifications are created in one parallel batch via
 * Notification.createMany(), and FCM delivery uses the already-batched
 * fcm.sendToAll() instead of one sendToUser() call per user.
 */
async function broadcast(payload) {
  const { title, body, data = {}, type = 'system', link = null, source = null, createdBy = null } = payload;
  const targets = await fcm.collectBroadcastTargets();
  const userIds = targets.userIds;

  // Persist in-app notification records for all users in parallel
  const notifications = await Notification.createMany(userIds, {
    title, body, data, type, link, source, createdBy,
  });
  const persisted = notifications.filter(Boolean).length;

  // Deliver push via batched multicast to the same target set.
  const pushResult = await fcm.sendToAll(
    { title, body, data: { ...data, link: link || '', type }, badge: 1 },
    targets,
  );

  // Build per-user recipient details for the admin response
  const recipients = [];
  for (const userId of userIds) {
    let user = null;
    try {
      user = await User.findById(userId);
    } catch (_) {}
    const name = user
      ? (user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || null)
      : null;
    const email = user ? (user.email || null) : null;
    const tokens = [];
    if (user) {
      if (Array.isArray(user.fcm_tokens)) tokens.push(...user.fcm_tokens);
      if (user.afroDeviceToken) tokens.push(user.afroDeviceToken);
    }
    const cleanTokens = tokens.map(t => String(t || '').trim()).filter(Boolean);
    recipients.push({
      id: userId,
      name,
      email,
      tokenCount: cleanTokens.length,
      tokens: cleanTokens,
    });
  }

  return {
    targeted: userIds.length,
    persisted,
    successCount: pushResult.successCount,
    failureCount: pushResult.failureCount,
    recipients,
  };
}

module.exports = { notifyUser, notifyUsers, broadcast };
