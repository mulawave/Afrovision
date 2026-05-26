const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'wave_comments';
const MAX_LENGTH = 500;

async function addComment(waveId, userId, displayName, avatarUrl, text) {
  if (!text || !text.trim()) throw new Error('Comment text is required');
  // Sanitise: strip HTML tags, enforce length
  const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, MAX_LENGTH);

  const db = getFirestore();
  const id = crypto.randomUUID();
  const comment = {
    id,
    wave_id: waveId,
    user_id: userId,
    display_name: displayName || 'Viewer',
    avatar_url: avatarUrl || null,
    text: clean,
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(comment);
  return comment;
}

async function getComments(waveId, limit = 50) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('wave_id', '==', waveId)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function findComment(commentId) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(commentId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function deleteComment(commentId) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(commentId).delete();
}

module.exports = { addComment, getComments, findComment, deleteComment };
