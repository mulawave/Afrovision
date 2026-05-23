const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_access';

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.id).set(record);
}

async function init() {
  return [];
}

function isInitialized() {
  return true;
}

/**
 * Returns a non-expired access record for this uid+channel, or undefined.
 */
async function findActiveAccess(uid, channelId) {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_uid', '==', uid)
    .where('channel_id', '==', channelId)
    .get();

  const active = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((record) => record.expires_at > now)
    .sort((a, b) => b.granted_at - a.granted_at);

  return active[0];
}

/**
 * Grant access to a user for a channel.
 * @param {object} p
 * @param {string} p.uid
 * @param {string} p.channelId
 * @param {number} p.durationMinutes
 */
async function grant({ uid, channelId, durationMinutes }) {
  const now = Date.now();
  const record = {
    id: crypto.randomUUID(),
    user_uid: uid,
    channel_id: channelId,
    expires_at: now + durationMinutes * 60_000,
    granted_at: now,
  };
  await persist(record);
  return record;
}

async function getByUser(uid) {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_uid', '==', uid)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((r) => r.expires_at > now)
    .sort((a, b) => b.granted_at - a.granted_at);
}

async function getByChannel(channelId) {
  const now = Date.now();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((r) => r.expires_at > now)
    .sort((a, b) => b.granted_at - a.granted_at);
}

async function getAll() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.granted_at - a.granted_at);
}

module.exports = {
  init,
  isInitialized,
  findActiveAccess,
  grant,
  getByUser,
  getByChannel,
  getAll,
};
