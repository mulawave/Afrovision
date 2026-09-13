/**
 * TV-to-TV Chat Model
 * Two connected users can message each other from their AfroVision TVs
 * (and, later, the mobile/web apps once those get a UI for it). A
 * connection starts when one user sends their 6-digit AfroVision PIN to
 * another user, who enters it to request a connection; the PIN owner must
 * accept before either side can message the other.
 *
 * This Firestore project is shared with other products. Per policy, every
 * collection this feature owns is created fresh (nothing existing is
 * renamed/merged/deleted) and prefixed `adtv-` so it can never collide with
 * another project's documents - including `users`, which this feature only
 * ever reads (for display name/avatar), never writes to.
 *
 * Collections:
 *   adtv-chat_pins/{pin}            — reverse lookup: pin -> user_id
 *   adtv-chat_user_pins/{userId}    — a user's own current pin
 *   adtv-chat_connections/{pairId}  — pairId = sorted `${userA}_${userB}`
 *   adtv-chat_messages/{id}         — { connection_id, sender_id, body, created_at }
 */

const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const PINS_COLLECTION = 'adtv-chat_pins';
const USER_PINS_COLLECTION = 'adtv-chat_user_pins';
const CONNECTIONS_COLLECTION = 'adtv-chat_connections';
const MESSAGES_COLLECTION = 'adtv-chat_messages';
const USERS_COLLECTION = 'users';

function pairId(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_');
}

function generatePin() {
  // 6 digits, zero-padded. Not cryptographically sensitive - it's a
  // "give this to a friend so they can add you" code, same spirit as a
  // Switch/Discord friend code, not a security credential.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function allocatePin(userId, oldPin) {
  const db = getFirestore();
  const userPinRef = db.collection(USER_PINS_COLLECTION).doc(userId);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pin = generatePin();
    const pinRef = db.collection(PINS_COLLECTION).doc(pin);
    const created = await db.runTransaction(async (tx) => {
      const pinSnap = await tx.get(pinRef);
      if (pinSnap.exists) return false;
      tx.set(pinRef, { user_id: userId, created_at: new Date().toISOString() });
      tx.set(userPinRef, { pin, updated_at: new Date().toISOString() });
      return true;
    });
    if (created) {
      if (oldPin) await db.collection(PINS_COLLECTION).doc(oldPin).delete().catch(() => {});
      return pin;
    }
  }
  throw new Error('Could not allocate a unique chat PIN, try again');
}

/**
 * Returns the user's existing chat PIN, generating and persisting one on
 * first use.
 */
async function ensurePin(userId) {
  const db = getFirestore();
  const snap = await db.collection(USER_PINS_COLLECTION).doc(userId).get();
  const existing = snap.data()?.pin;
  if (existing) return existing;
  return allocatePin(userId, null);
}

async function regeneratePin(userId) {
  const db = getFirestore();
  const snap = await db.collection(USER_PINS_COLLECTION).doc(userId).get();
  const oldPin = snap.data()?.pin || null;
  return allocatePin(userId, oldPin);
}

async function findUserIdByPin(pin) {
  const db = getFirestore();
  const doc = await db.collection(PINS_COLLECTION).doc(String(pin).trim()).get();
  return doc.exists ? doc.data().user_id : null;
}

/**
 * Creates (or returns the existing) connection between two users from a
 * PIN. If a connection already exists in any state, that same record is
 * returned rather than creating a duplicate.
 */
async function requestConnectionByPin(requesterUserId, pin) {
  const targetUserId = await findUserIdByPin(pin);
  if (!targetUserId) return { error: 'PIN_NOT_FOUND' };
  if (targetUserId === requesterUserId) return { error: 'CANNOT_CONNECT_SELF' };

  const db = getFirestore();
  const id = pairId(requesterUserId, targetUserId);
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    return { connection: { id, ...snap.data() } };
  }

  const record = {
    user_a: requesterUserId,
    user_b: targetUserId,
    requested_by: requesterUserId,
    status: 'pending',
    created_at: new Date().toISOString(),
    accepted_at: null,
    unread_for_a: 0,
    unread_for_b: 0,
  };
  await ref.set(record);
  return { connection: { id, ...record }, targetUserId };
}

async function respondToConnection(userId, connectionId, accept) {
  const db = getFirestore();
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'NOT_FOUND' };
  const data = snap.data();
  if (data.user_a !== userId && data.user_b !== userId) return { error: 'FORBIDDEN' };
  if (data.requested_by === userId) return { error: 'CANNOT_RESPOND_TO_OWN_REQUEST' };

  const patch = accept
    ? { status: 'accepted', accepted_at: new Date().toISOString() }
    : { status: 'declined' };
  await ref.set(patch, { merge: true });
  const otherUserId = data.user_a === userId ? data.user_b : data.user_a;
  return { connection: { id: connectionId, ...data, ...patch }, otherUserId };
}

async function listConnections(userId) {
  const db = getFirestore();
  const [asA, asB] = await Promise.all([
    db.collection(CONNECTIONS_COLLECTION).where('user_a', '==', userId).get(),
    db.collection(CONNECTIONS_COLLECTION).where('user_b', '==', userId).get(),
  ]);
  const rows = [...asA.docs, ...asB.docs].map((d) => ({ id: d.id, ...d.data() }));

  const otherIds = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a));
  const users = await hydrateUsers(otherIds);

  return rows
    .map((r) => {
      const otherId = r.user_a === userId ? r.user_b : r.user_a;
      const unread = r.user_a === userId ? r.unread_for_a || 0 : r.unread_for_b || 0;
      return { ...r, other_user: users[otherId] || null, unread_count: unread };
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

async function hydrateUsers(userIds) {
  const db = getFirestore();
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = {};
  await Promise.all(
    unique.map(async (id) => {
      const doc = await db.collection(USERS_COLLECTION).doc(id).get();
      if (doc.exists) {
        const d = doc.data();
        out[id] = { id, name: d.name || d.full_name || 'AfroVision user', avatar: d.avatar || d.profile_image || null };
      }
    })
  );
  return out;
}

async function getConnection(connectionId) {
  const db = getFirestore();
  const doc = await db.collection(CONNECTIONS_COLLECTION).doc(connectionId).get();
  return doc.exists ? { id: connectionId, ...doc.data() } : null;
}

async function listMessages(connectionId, limit = 100) {
  const db = getFirestore();
  const snap = await db
    .collection(MESSAGES_COLLECTION)
    .where('connection_id', '==', connectionId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
}

async function sendMessage(connectionId, senderId, body) {
  const db = getFirestore();
  const connRef = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
  const record = {
    connection_id: connectionId,
    sender_id: senderId,
    body: String(body).slice(0, 2000),
    created_at: new Date().toISOString(),
  };

  const { message, recipientId } = await db.runTransaction(async (tx) => {
    const connSnap = await tx.get(connRef);
    const conn = connSnap.data();
    const msgRef = db.collection(MESSAGES_COLLECTION).doc();
    tx.set(msgRef, record);

    const senderIsA = conn.user_a === senderId;
    const unreadField = senderIsA ? 'unread_for_b' : 'unread_for_a';
    tx.set(connRef, { [unreadField]: (conn[unreadField] || 0) + 1 }, { merge: true });

    return {
      message: { id: msgRef.id, ...record },
      recipientId: senderIsA ? conn.user_b : conn.user_a,
    };
  });

  return { message, recipientId };
}

async function markConnectionRead(connectionId, userId) {
  const db = getFirestore();
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data();
  const field = data.user_a === userId ? 'unread_for_a' : data.user_b === userId ? 'unread_for_b' : null;
  if (!field) return;
  await ref.set({ [field]: 0 }, { merge: true });
}

/**
 * Total "new for me" count for the nav badge: unread chat messages across
 * all accepted connections, plus pending incoming connection requests.
 */
async function getUnreadSummary(userId) {
  const db = getFirestore();
  const [asA, asB] = await Promise.all([
    db.collection(CONNECTIONS_COLLECTION).where('user_a', '==', userId).get(),
    db.collection(CONNECTIONS_COLLECTION).where('user_b', '==', userId).get(),
  ]);
  const rows = [...asA.docs, ...asB.docs].map((d) => d.data());

  let unreadMessages = 0;
  let pendingRequests = 0;
  for (const r of rows) {
    if (r.status === 'accepted') {
      unreadMessages += r.user_a === userId ? r.unread_for_a || 0 : r.unread_for_b || 0;
    } else if (r.status === 'pending' && r.requested_by !== userId) {
      pendingRequests += 1;
    }
  }
  return { unread_messages: unreadMessages, pending_requests: pendingRequests, total: unreadMessages + pendingRequests };
}

// ── Admin moderation ───────────────────────────────────────────────

async function adminListConnections(limit = 200) {
  const db = getFirestore();
  const snap = await db.collection(CONNECTIONS_COLLECTION).orderBy('created_at', 'desc').limit(limit).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const users = await hydrateUsers(rows.flatMap((r) => [r.user_a, r.user_b]));
  return rows.map((r) => ({ ...r, user_a_info: users[r.user_a] || null, user_b_info: users[r.user_b] || null }));
}

async function adminListMessages(connectionId, limit = 500) {
  return listMessages(connectionId, limit);
}

async function adminSetConnectionStatus(connectionId, status) {
  const db = getFirestore();
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
  await ref.set({ status }, { merge: true });
  const snap = await ref.get();
  return { id: connectionId, ...snap.data() };
}

module.exports = {
  ensurePin,
  regeneratePin,
  findUserIdByPin,
  requestConnectionByPin,
  respondToConnection,
  listConnections,
  getConnection,
  listMessages,
  sendMessage,
  markConnectionRead,
  getUnreadSummary,
  adminListConnections,
  adminListMessages,
  adminSetConnectionStatus,
};
