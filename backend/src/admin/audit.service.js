const { getFirestore } = require('../utils/firestore');
const User = require('../users/user.model');
const {
  summarizeUser,
  findAnyChannel,
  summarizeChannel,
} = require('./admin.presenter');

const COLLECTION = 'audit_logs';

function summarizeAuditUser(user) {
  const summary = summarizeUser(user);
  return summary ? { type: 'user', ...summary } : null;
}

function buildFallbackTarget(targetId, meta = {}) {
  if (!targetId) return null;

  return {
    type: 'entity',
    id: targetId,
    display_name: meta.name || meta.label || targetId,
  };
}

function inferTarget(action, targetId, meta = {}) {
  if (!targetId) return null;

  switch (action) {
    case 'set_role':
    case 'set_premium':
    case 'set_kyc':
    case 'delete_user':
      return summarizeAuditUser(User.findCachedById(targetId)) || {
        type: 'user',
        id: targetId,
        display_name: targetId,
      };
    case 'disable_channel':
    case 'enable_channel':
    case 'set_channel_premium':
      return summarizeChannel(findAnyChannel(targetId)) || {
        type: 'channel',
        id: targetId,
        display_name: meta.name || targetId,
      };
    case 'set_feature_flag':
      return {
        type: 'feature_flag',
        id: targetId,
        display_name: targetId,
        enabled: typeof meta.enabled === 'boolean' ? meta.enabled : null,
      };
    default:
      return summarizeAuditUser(User.findCachedById(targetId))
        || summarizeChannel(findAnyChannel(targetId))
        || buildFallbackTarget(targetId, meta);
  }
}

function enrichMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return meta || {};
  }

  const enriched = { ...meta };

  const addDetails = (key, value) => {
    if (!value) return;
    const detailKey = `${key
      .replace(/_uid$/, '')
      .replace(/_user_id$/, '')
      .replace(/_channel_id$/, '')
      .replace(/_id$/, '')
      .replace(/Id$/, '')}_details`;

    if (!(detailKey in enriched)) {
      enriched[detailKey] = value;
    }
  };

  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== 'string' || !value) continue;

    if (key.endsWith('_uid') || key === 'user_id' || key === 'userId') {
      addDetails(key, summarizeAuditUser(User.findCachedById(value)));
      continue;
    }

    if (key === 'channel_id' || key === 'channelId' || key.endsWith('_channel_id')) {
      addDetails(key, summarizeChannel(findAnyChannel(value)));
    }
  }

  return enriched;
}

function enrichAuditEntry(entry) {
  const meta = enrichMeta(entry.meta);
  const admin = entry.admin || summarizeAuditUser(User.findCachedById(entry.admin_uid)) || {
    type: 'user',
    id: entry.admin_uid,
    display_name: entry.admin_uid,
    email: null,
    name: null,
    role: null,
  };
  const target = entry.target || inferTarget(entry.action, entry.target_id, meta);

  return {
    ...entry,
    admin,
    target,
    meta,
  };
}

async function logAction(adminUid, action, targetId, meta = {}) {
  const db = getFirestore();
  const enrichedMeta = enrichMeta(meta);
  const entry = {
    admin_uid: adminUid,
    action,
    target_id: targetId || null,
    admin: summarizeAuditUser(User.findCachedById(adminUid)),
    target: inferTarget(action, targetId, enrichedMeta),
    meta: enrichedMeta,
    timestamp: Date.now(),
  };
  await db.collection(COLLECTION).add(entry);
  return entry;
}

async function getRecent(limit = 50) {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => enrichAuditEntry({ id: doc.id, ...doc.data() }));
}

/** Newest-first page of admin audit logs; optional action filter; cursor = timestamp (ms). */
async function getPage({ limit, before, action } = {}) {
  const { pageByTime } = require('./paging');
  return pageByTime(getFirestore(), COLLECTION, 'timestamp', {
    limit,
    before,
    filter: action ? ['action', action] : null,
    map: enrichAuditEntry,
  });
}

module.exports = {
  logAction,
  getRecent,
  getPage,
};
