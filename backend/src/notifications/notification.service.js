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
  const user = User.findById(userId);
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
  const unreadCount = Notification.countUnread(userId);

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
 */
async function broadcast(payload) {
  const userIds = User.getAll().map((user) => user.id);
  const results = await Promise.all(userIds.map((userId) => notifyUser(userId, payload)));

  return {
    targeted: userIds.length,
    persisted: results.filter((result) => result.notification).length,
    successCount: results.reduce((sum, result) => sum + (result.successCount || 0), 0),
    failureCount: results.reduce((sum, result) => sum + (result.failureCount || 0), 0),
  };
}

module.exports = { notifyUser, broadcast };
