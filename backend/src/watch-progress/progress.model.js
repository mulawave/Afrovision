/**
 * Watch Progress Model
 * Firestore schema + CRUD for user watch progress (resume position).
 *
 * Collection: watch_progress
 * Doc ID: ${userId}_${mediaType}_${mediaId}
 */

const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'watch_progress';

async function saveProgress(userId, mediaType, mediaId, positionSeconds, durationSeconds) {
  const db = getFirestore();
  const docId = `${userId}_${mediaType}_${mediaId}`;
  const now = Date.now();

  const data = {
    user_id: userId,
    media_type: mediaType,
    media_id: mediaId,
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds,
    updated_at: now,
  };

  await db.collection(COLLECTION).doc(docId).set(data, { merge: true });
  return data;
}

async function getProgress(userId, mediaType, mediaId) {
  const db = getFirestore();
  const docId = `${userId}_${mediaType}_${mediaId}`;
  const doc = await db.collection(COLLECTION).doc(docId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

module.exports = {
  COLLECTION,
  saveProgress,
  getProgress,
};
