const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'exclusive_channel_pic_unlocks';

function docId(userUid, channelId) {
  return `${channelId}__${userUid}`;
}

async function findByUserAndChannel(userUid, channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).doc(docId(userUid, channelId)).get();
  if (!snapshot.exists) return null;
  return { ...snapshot.data(), id: snapshot.id };
}

async function findActiveByUserAndChannel(userUid, channelId) {
  const unlock = await findByUserAndChannel(userUid, channelId);
  if (!unlock) return null;
  if (Number(unlock.expires_at || 0) <= Date.now()) return null;
  return unlock;
}

async function upsertActiveUnlock({ userUid, channelId, accessId, expiresAt }) {
  const db = getFirestore();
  const now = Date.now();
  const id = docId(userUid, channelId);

  const payload = {
    id,
    user_uid: userUid,
    channel_id: channelId,
    access_id: accessId || null,
    verified_at: now,
    expires_at: Number(expiresAt || 0),
    updated_at: now,
  };

  const current = await db.collection(COLLECTION).doc(id).get();
  if (!current.exists) {
    payload.created_at = now;
  }

  await db.collection(COLLECTION).doc(id).set(payload, { merge: true });
  return payload;
}

module.exports = {
  findByUserAndChannel,
  findActiveByUserAndChannel,
  upsertActiveUnlock,
};
