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

/**
 * List a user's most-recently-updated in-progress items across every mediaType.
 * "In progress" == position_seconds > 0 and not effectively finished — i.e.
 * position/duration < 0.95 AND not within the final 30 seconds of the media.
 */
async function listMine(userId, { limit = 20 } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .orderBy('updated_at', 'desc')
    .limit(Math.max(1, Math.min(100, limit)))
    .get();

  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((p) => {
      const pos = Number(p.position_seconds) || 0;
      const dur = Number(p.duration_seconds) || 0;
      if (pos <= 0) return false;
      if (dur > 0 && (pos >= dur * 0.95 || pos >= dur - 30)) return false;
      return true;
    });
}

module.exports = {
  COLLECTION,
  saveProgress,
  getProgress,
  listMine,
  // Generic listProgress(userId) alias for the watch-history endpoint.
  listProgress: listMine,
};
