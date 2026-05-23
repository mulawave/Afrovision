const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'exclusive_channel_access';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function findLatestByUserAndChannel(userUid, channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_uid', '==', userUid)
    .where('channel_id', '==', channelId)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => Number(b.issued_at || 0) - Number(a.issued_at || 0))[0];
}

async function findActiveByUserAndChannel(userUid, channelId) {
  const latest = await findLatestByUserAndChannel(userUid, channelId);
  if (!latest) return null;
  if (latest.status !== 'active') return null;
  if (Number(latest.expires_at || 0) <= Date.now()) return null;
  return latest;
}

async function expireIfNeeded(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = { ...doc.data(), id: doc.id };
  if (data.status === 'active' && Number(data.expires_at || 0) <= Date.now()) {
    data.status = 'expired';
    data.updated_at = Date.now();
    await db.collection(COLLECTION).doc(id).update({
      status: data.status,
      updated_at: data.updated_at,
    });
  }
  return data;
}

async function grantOrRenew({
  userUid,
  channelId,
  picHash,
  sourcePaymentId,
  monthlyFeeNgn,
}) {
  const now = Date.now();
  const expiresAt = now + THIRTY_DAYS_MS;
  const current = await findLatestByUserAndChannel(userUid, channelId);
  const db = getFirestore();

  if (current) {
    const updated = {
      ...current,
      pic_hash: picHash,
      status: 'active',
      issued_at: now,
      last_renewed_at: now,
      expires_at: expiresAt,
      source_payment_id: sourcePaymentId || null,
      monthly_fee_ngn: Number(monthlyFeeNgn || 0),
      updated_at: now,
    };
    await db.collection(COLLECTION).doc(current.id).set(updated);
    return updated;
  }

  const record = {
    id: crypto.randomUUID(),
    user_uid: userUid,
    channel_id: channelId,
    pic_hash: picHash,
    status: 'active',
    issued_at: now,
    last_renewed_at: null,
    expires_at: expiresAt,
    source_payment_id: sourcePaymentId || null,
    monthly_fee_ngn: Number(monthlyFeeNgn || 0),
    created_at: now,
    updated_at: now,
  };

  await db.collection(COLLECTION).doc(record.id).set(record);
  return record;
}

module.exports = {
  findLatestByUserAndChannel,
  findActiveByUserAndChannel,
  expireIfNeeded,
  grantOrRenew,
  THIRTY_DAYS_MS,
};
