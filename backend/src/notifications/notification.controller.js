const User = require('../users/user.model');
const Notification = require('./notification.model');
const NotificationService = require('./notification.service');
const AuditService = require('../admin/audit.service');
const { summarizeUser } = require('../admin/admin.presenter');

async function isAdmin(req) {
  const caller = await User.findById(req.userId);
  return Boolean(caller && caller.role === 'admin');
}

async function sendToUser(req, res) {
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
  const { userId, title, body, data, type, link, source } = req.body;
  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'userId, title, and body are required' });
  }
  const recipient = await User.findById(userId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient not found' });
  }
  const result = await NotificationService.notifyUser(userId, {
    title,
    body,
    data,
    type,
    link,
    source,
    createdBy: req.userId,
  });
  await AuditService.logAction(req.userId, 'send_admin_notice', userId, {
    title,
    source: source || 'push',
    type: type || 'system',
    link: link || null,
    recipient_uid: userId,
    recipient_details: summarizeUser(recipient),
    persisted: Boolean(result.notification),
    success_count: result.successCount || 0,
    failure_count: result.failureCount || 0,
  });
  res.json({ success: true, result });
}

async function broadcastAll(req, res) {
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
  const { title, body, data, type, link, source } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  const result = await NotificationService.broadcast({
    title,
    body,
    data,
    type,
    link,
    source,
    createdBy: req.userId,
  });
  await AuditService.logAction(req.userId, 'broadcast_admin_notice', 'all_users', {
    title,
    source: source || 'push',
    type: type || 'system',
    link: link || null,
    targeted: result.targeted || 0,
    persisted: result.persisted || 0,
    success_count: result.successCount || 0,
    failure_count: result.failureCount || 0,
  });
  res.json({ success: true, result });
}

function getScope(scope) {
  if (scope === 'archived' || scope === 'all') return scope;
  return 'inbox';
}

async function listMine(req, res) {
  const notifications = await Notification.listForUser(req.userId, {
    scope: getScope(req.query.scope),
    unreadOnly: req.query.unread_only === '1',
    limit: req.query.limit,
  });
  res.json({ notifications, unread_count: await Notification.countUnread(req.userId) });
}

async function getUnreadCount(req, res) {
  res.json({ unread_count: await Notification.countUnread(req.userId) });
}

async function markRead(req, res) {
  const notification = await Notification.markRead(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: await Notification.countUnread(req.userId) });
}

async function markUnread(req, res) {
  const notification = await Notification.markUnread(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: await Notification.countUnread(req.userId) });
}

async function archive(req, res) {
  const notification = await Notification.archive(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: await Notification.countUnread(req.userId) });
}

async function unarchive(req, res) {
  const notification = await Notification.unarchive(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: await Notification.countUnread(req.userId) });
}

async function remove(req, res) {
  const removed = await Notification.remove(req.userId, req.params.id);
  if (!removed) return res.status(404).json({ error: 'Notification not found' });
  res.json({ success: true, unread_count: await Notification.countUnread(req.userId) });
}

async function markAllRead(req, res) {
  const updated = await Notification.markAllRead(req.userId);
  res.json({ updated, unread_count: await Notification.countUnread(req.userId) });
}

async function bulkUpdate(req, res) {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  if (!['read', 'unread', 'archive', 'unarchive', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid bulk action' });
  }

  const updated = await Notification.bulkAction(req.userId, { ids, action });
  res.json({ updated, unread_count: await Notification.countUnread(req.userId) });
}

async function clearArchived(req, res) {
  const removed = await Notification.clearArchived(req.userId);
  res.json({ removed, unread_count: await Notification.countUnread(req.userId) });
}

async function sendTestPush(req, res) {
  const fcm = require('../utils/fcm');
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Build the exact same token set used by sendToUser so the test exercises
  // the full delivery path including the deviceToken field.
  const tokenSet = new Set(Array.isArray(user.fcm_tokens) ? user.fcm_tokens : []);
  if (user.deviceToken) tokenSet.add(user.deviceToken);

  if (tokenSet.size === 0) {
    return res.status(422).json({ success: false, error: 'No device token registered for this account' });
  }

  const result = await fcm.sendToTokens([...tokenSet], {
    title: 'AfroVision Test',
    body: 'Push notification delivery confirmed.',
    data: { type: 'test' },
  }, req.userId);

  if (result.successCount > 0) {
    return res.json({ success: true, delivered: result.successCount, failed: result.failureCount });
  }

  return res.status(502).json({
    success: false,
    error: 'FCM delivery failed — token may be invalid or device is unreachable',
    delivered: 0,
    failed: result.failureCount,
  });
}

module.exports = {
  sendToUser,
  broadcastAll,
  sendTestPush,
  listMine,
  getUnreadCount,
  markRead,
  markUnread,
  archive,
  unarchive,
  remove,
  markAllRead,
  bulkUpdate,
  clearArchived,
};
