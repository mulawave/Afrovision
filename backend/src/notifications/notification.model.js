const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const NOTIFICATIONS_COLLECTION = 'notifications';
let notifications = [];
let initialized = false;

async function persistNotification(notification) {
  const db = getFirestore();
  await db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id).set(notification);
}

async function deletePersistedNotification(id) {
  const db = getFirestore();
  await db.collection(NOTIFICATIONS_COLLECTION).doc(id).delete();
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(NOTIFICATIONS_COLLECTION).get();
  notifications = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return notifications;
}

function isInitialized() {
  return initialized;
}

function findById(id) {
  return notifications.find((notification) => notification.id === id);
}

function findByUser(userId, id) {
  return notifications.find(
    (notification) => notification.id === id && notification.user_id === userId
  );
}

async function create({
  userId,
  title,
  body,
  data = {},
  type = 'system',
  link = null,
  source = null,
  createdBy = null,
}) {
  const notification = {
    id: crypto.randomUUID(),
    user_id: userId,
    title,
    body,
    data,
    type,
    link,
    source,
    created_by: createdBy,
    is_read: false,
    archived: false,
    read_at: null,
    archived_at: null,
    created_at: Date.now(),
  };

  notifications.push(notification);
  await persistNotification(notification);
  return notification;
}

async function createMany(userIds, payload) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  return Promise.all(uniqueUserIds.map((userId) => create({ userId, ...payload })));
}

function listForUser(userId, { scope = 'inbox', unreadOnly = false, limit = 50 } = {}) {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  return notifications
    .filter((notification) => notification.user_id === userId)
    .filter((notification) => {
      if (scope === 'archived') return notification.archived;
      if (scope === 'inbox') return !notification.archived;
      return true;
    })
    .filter((notification) => (unreadOnly ? !notification.is_read : true))
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, normalizedLimit);
}

function countUnread(userId) {
  return notifications.filter(
    (notification) =>
      notification.user_id === userId && !notification.archived && !notification.is_read
  ).length;
}

async function update(notification, updates) {
  Object.assign(notification, updates);
  await persistNotification(notification);
  return notification;
}

async function markRead(userId, id) {
  const notification = findByUser(userId, id);
  if (!notification) return null;
  if (notification.is_read) return notification;
  return update(notification, { is_read: true, read_at: Date.now() });
}

async function markUnread(userId, id) {
  const notification = findByUser(userId, id);
  if (!notification) return null;
  if (!notification.is_read) return notification;
  return update(notification, { is_read: false, read_at: null });
}

async function archive(userId, id) {
  const notification = findByUser(userId, id);
  if (!notification) return null;
  if (notification.archived) return notification;
  return update(notification, {
    archived: true,
    archived_at: Date.now(),
    is_read: true,
    read_at: notification.read_at || Date.now(),
  });
}

async function unarchive(userId, id) {
  const notification = findByUser(userId, id);
  if (!notification) return null;
  if (!notification.archived) return notification;
  return update(notification, { archived: false, archived_at: null });
}

async function remove(userId, id) {
  const notification = findByUser(userId, id);
  if (!notification) return false;
  notifications = notifications.filter((entry) => entry.id !== id);
  await deletePersistedNotification(id);
  return true;
}

async function markAllRead(userId) {
  const unread = notifications.filter(
    (notification) => notification.user_id === userId && !notification.archived && !notification.is_read
  );
  await Promise.all(
    unread.map((notification) =>
      update(notification, { is_read: true, read_at: notification.read_at || Date.now() })
    )
  );
  return unread.length;
}

async function bulkAction(userId, { ids = [], action }) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  let affected = 0;

  for (const id of uniqueIds) {
    let result = null;
    if (action === 'read') result = await markRead(userId, id);
    if (action === 'unread') result = await markUnread(userId, id);
    if (action === 'archive') result = await archive(userId, id);
    if (action === 'unarchive') result = await unarchive(userId, id);
    if (action === 'delete') result = await remove(userId, id);
    if (result) affected += 1;
  }

  return affected;
}

async function clearArchived(userId) {
  const archivedIds = notifications
    .filter((notification) => notification.user_id === userId && notification.archived)
    .map((notification) => notification.id);
  await Promise.all(archivedIds.map((id) => deletePersistedNotification(id)));
  notifications = notifications.filter(
    (notification) => !(notification.user_id === userId && notification.archived)
  );
  return archivedIds.length;
}

module.exports = {
  init,
  isInitialized,
  findById,
  findByUser,
  create,
  createMany,
  listForUser,
  countUnread,
  markRead,
  markUnread,
  archive,
  unarchive,
  remove,
  markAllRead,
  bulkAction,
  clearArchived,
};
