const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_access';
let records = [];
let initialized = false;

async function persist(record) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(record.id).set(record);
}

async function init() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  records = snapshot.docs.map((doc) => doc.data());
  initialized = true;
  return records;
}

function isInitialized() {
  return initialized;
}

/**
 * Returns a non-expired access record for this uid+channel, or undefined.
 */
function findActiveAccess(uid, channelId) {
  const now = Date.now();
  return records.find(
    (r) => r.user_uid === uid && r.channel_id === channelId && r.expires_at > now,
  );
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
  records.push(record);
  await persist(record);
  return record;
}

function getByUser(uid) {
  const now = Date.now();
  return records
    .filter((r) => r.user_uid === uid && r.expires_at > now)
    .sort((a, b) => b.granted_at - a.granted_at);
}

function getByChannel(channelId) {
  const now = Date.now();
  return records
    .filter((r) => r.channel_id === channelId && r.expires_at > now)
    .sort((a, b) => b.granted_at - a.granted_at);
}

function getAll() {
  return records.sort((a, b) => b.granted_at - a.granted_at);
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
