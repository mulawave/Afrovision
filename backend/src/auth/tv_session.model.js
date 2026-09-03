const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'tv_sessions';
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sessionsById = new Map();

function generatePairingCode() {
  // 6-digit numeric code, human-friendly to type on a phone if QR scan isn't available
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function isExpired(session) {
  if (!session) return true;
  return new Date(session.expires_at).getTime() < Date.now();
}

function cacheSession(session) {
  if (!session || !session.id) return session;
  sessionsById.set(session.id, session);
  return session;
}

/**
 * Create a new pending TV pairing session.
 * @param {string} deviceName - human-readable device label, e.g. "Living Room TV"
 */
async function create({ deviceName } = {}) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id,
    status: 'pending', // pending | linked | expired
    pairing_code: generatePairingCode(),
    device_name: deviceName || 'Android TV',
    user_id: null,
    token: null,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
    linked_at: null,
  };
  await db.collection(COLLECTION).doc(id).set(session);
  return cacheSession(session);
}

async function findById(id) {
  if (!id) return null;
  const cached = sessionsById.get(id);
  if (cached) return cached;
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return cacheSession({ id: doc.id, ...doc.data() });
}

/**
 * Mark a pending session as linked to a user, storing the issued JWT so the
 * TV device can retrieve it on its next status poll.
 */
async function linkToUser(id, { userId, token }) {
  const session = await findById(id);
  if (!session) return null;
  if (isExpired(session)) {
    await markExpired(id);
    return null;
  }
  if (session.status !== 'pending') return null;

  session.status = 'linked';
  session.user_id = userId;
  session.token = token;
  session.linked_at = new Date().toISOString();

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({
    status: session.status,
    user_id: session.user_id,
    token: session.token,
    linked_at: session.linked_at,
  });
  return cacheSession(session);
}

async function markExpired(id) {
  const session = sessionsById.get(id);
  if (session) session.status = 'expired';
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ status: 'expired' }).catch(() => {});
  return session;
}

/**
 * Returns the session with a freshly computed status: if it's still 'pending'
 * but past its TTL, it is lazily flipped to 'expired' on read.
 */
async function getEffectiveStatus(id) {
  const session = await findById(id);
  if (!session) return null;
  if (session.status === 'pending' && isExpired(session)) {
    return markExpired(id).then(() => ({ ...session, status: 'expired' }));
  }
  return session;
}

module.exports = {
  create,
  findById,
  linkToUser,
  markExpired,
  getEffectiveStatus,
  isExpired,
};
