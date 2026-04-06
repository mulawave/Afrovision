const User = require('../users/user.model');
const Notification = require('./notification.model');
const NotificationService = require('./notification.service');
const AuditService = require('../admin/audit.service');
const { summarizeUser } = require('../admin/admin.presenter');

function isAdmin(req) {
  const caller = User.findById(req.userId);
  return caller && caller.role === 'admin';
}

async function sendToUser(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
  const { userId, title, body, data, type, link, source } = req.body;
  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'userId, title, and body are required' });
  }
  const recipient = User.findById(userId);
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
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
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
  const notifications = Notification.listForUser(req.userId, {
    scope: getScope(req.query.scope),
    unreadOnly: req.query.unread_only === '1',
    limit: req.query.limit,
  });
  res.json({ notifications, unread_count: Notification.countUnread(req.userId) });
}

function getUnreadCount(req, res) {
  res.json({ unread_count: Notification.countUnread(req.userId) });
}

async function markRead(req, res) {
  const notification = await Notification.markRead(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: Notification.countUnread(req.userId) });
}

async function markUnread(req, res) {
  const notification = await Notification.markUnread(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: Notification.countUnread(req.userId) });
}

async function archive(req, res) {
  const notification = await Notification.archive(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: Notification.countUnread(req.userId) });
}

async function unarchive(req, res) {
  const notification = await Notification.unarchive(req.userId, req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification, unread_count: Notification.countUnread(req.userId) });
}

async function remove(req, res) {
  const removed = await Notification.remove(req.userId, req.params.id);
  if (!removed) return res.status(404).json({ error: 'Notification not found' });
  res.json({ success: true, unread_count: Notification.countUnread(req.userId) });
}

async function markAllRead(req, res) {
  const updated = await Notification.markAllRead(req.userId);
  res.json({ updated, unread_count: Notification.countUnread(req.userId) });
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
  res.json({ updated, unread_count: Notification.countUnread(req.userId) });
}

async function clearArchived(req, res) {
  const removed = await Notification.clearArchived(req.userId);
  res.json({ removed, unread_count: Notification.countUnread(req.userId) });
}

module.exports = {
  sendToUser,
  broadcastAll,
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
