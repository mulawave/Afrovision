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

  return {
    targeted: userIds.length,
    persisted,
    successCount: pushResult.successCount,
    failureCount: pushResult.failureCount,
  };
}

module.exports = { notifyUser, broadcast };
