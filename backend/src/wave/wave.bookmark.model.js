const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wave_bookmarks';

function bookmarkId(userId, waveId) {
  return `${userId}_${waveId}`;
}

async function toggle(waveId, userId) {
  const db = getFirestore();
  const id = bookmarkId(userId, waveId);
  const doc = await db.collection(COLLECTION).doc(id).get();

  if (doc.exists) {
    await db.collection(COLLECTION).doc(id).delete();
    return { bookmarked: false };
  }

  await db.collection(COLLECTION).doc(id).set({
    id,
    wave_id: waveId,
    user_id: userId,
    created_at: Date.now(),
  });
  return { bookmarked: true };
}

async function getStatus(waveId, userId) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(bookmarkId(userId, waveId)).get();
  return { bookmarked: doc.exists };
}

async function getMyBookmarks(userId, limit = 30) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function countForWave(waveId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('wave_id', '==', waveId)
    .get();
  return snapshot.size;
}

module.exports = { toggle, getStatus, getMyBookmarks, countForWave };
