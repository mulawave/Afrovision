const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'creator_supporters';

function _isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

function _getAliasKey(senderAlias) {
  return crypto.createHash('sha1').update(senderAlias || 'Anonymous').digest('hex');
}

function _getSupporterDocId({ creatorUid, channelId, channelType, senderUid, senderAlias }) {
  if (channelType === 'private' || !senderUid) {
    return `anon:${creatorUid}:${channelId}:${_getAliasKey(senderAlias)}`;
  }
  return `uid:${creatorUid}:${senderUid}`;
}

function _toSupporterPayload({ creatorUid, channelId, channelType, senderUid, senderAlias }) {
  const isPrivate = channelType === 'private' || !senderUid;
  return {
    creator_uid: creatorUid,
    channel_id: isPrivate ? channelId : null,
    sender_uid: isPrivate ? '' : senderUid,
    sender_alias: isPrivate ? (senderAlias || 'Anonymous') : null,
    visibility: isPrivate ? 'private' : 'public',
    updated_at: Date.now(),
  };
}

function applyGiftDelta(tx, db, { creatorUid, channelId, channelType, senderUid, senderAlias, ngn = 0, vpt = 0 }) {
  const admin = require('firebase-admin');
  const docId = _getSupporterDocId({ creatorUid, channelId, channelType, senderUid, senderAlias });

  tx.set(
    db.collection(COLLECTION).doc(docId),
    {
      ..._toSupporterPayload({ creatorUid, channelId, channelType, senderUid, senderAlias }),
      total_gifts_ngn: admin.firestore.FieldValue.increment(ngn),
      total_gifts_vpt: admin.firestore.FieldValue.increment(vpt),
      total_value: admin.firestore.FieldValue.increment((ngn || 0) + (vpt || 0)),
    },
    { merge: true },
  );
}

async function getTopSupporters(creatorUid, limit = 10) {
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('creator_uid', '==', creatorUid)
      .orderBy('total_value', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!_isIndexError(error)) throw error;
    const snapshot = await db.collection(COLLECTION)
      .where('creator_uid', '==', creatorUid)
      .get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
      .slice(0, limit);
  }
}

async function backfillForCreator(creatorUid, channels = []) {
  if (!creatorUid || channels.length === 0) return 0;

  const db = getFirestore();
  const channelTypeById = new Map(channels.map((channel) => [channel.id, channel.type || 'public']));
  const channelIds = channels.map((channel) => channel.id);
  const chunkSize = 10;
  const totals = new Map();

  for (let index = 0; index < channelIds.length; index += chunkSize) {
    const chunk = channelIds.slice(index, index + chunkSize);
    const snapshot = await db.collection('gift_stats')
      .where('channel_id', 'in', chunk)
      .get();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const channelType = channelTypeById.get(data.channel_id) || 'public';
      const senderAlias = data.sender_alias || 'Anonymous';
      const senderUid = channelType === 'private' ? '' : (data.sender_uid || '');
      const docId = _getSupporterDocId({
        creatorUid,
        channelId: data.channel_id,
        channelType,
        senderUid,
        senderAlias,
      });
      const existing = totals.get(docId) || {
        ..._toSupporterPayload({
          creatorUid,
          channelId: data.channel_id,
          channelType,
          senderUid,
          senderAlias,
        }),
        total_gifts_ngn: 0,
        total_gifts_vpt: 0,
        total_value: 0,
      };

      const ngn = Number(data.naira || 0) * 0.5;
      const vpt = Math.floor(Number(data.vpt_units || 0) * 0.5);
      existing.total_gifts_ngn += ngn;
      existing.total_gifts_vpt += vpt;
      existing.total_value += ngn + vpt;
      existing.updated_at = Date.now();
      totals.set(docId, existing);
    });
  }

  if (totals.size === 0) return 0;

  let batch = db.batch();
  let batchCount = 0;
  let written = 0;

  const commitBatch = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    written += batchCount;
    batch = db.batch();
    batchCount = 0;
  };

  for (const [docId, payload] of totals.entries()) {
    batch.set(db.collection(COLLECTION).doc(docId), payload, { merge: true });
    batchCount += 1;
    if (batchCount >= 400) await commitBatch();
  }

  await commitBatch();
  return written;
}

module.exports = {
  applyGiftDelta,
  getTopSupporters,
  backfillForCreator,
};