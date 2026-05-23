const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'program_reminders';

async function init() {
  return [];
}

async function create({ userId, programId, channelId, programTitle, channelName, sendAt }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const reminder = {
    id,
    user_id: userId,
    program_id: programId,
    channel_id: channelId,
    program_title: programTitle || '',
    channel_name: channelName || '',
    send_at: sendAt,
    sent: false,
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(reminder);
  return reminder;
}

async function getByUser(userId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .where('sent', '==', false)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getByProgramAndUser(programId, userId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('program_id', '==', programId)
    .where('user_id', '==', userId)
    .where('sent', '==', false)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function remove(userId, programId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('user_id', '==', userId)
    .where('program_id', '==', programId)
    .where('sent', '==', false)
    .limit(1)
    .get();
  if (snapshot.empty) return false;
  await snapshot.docs[0].ref.delete();
  return true;
}

async function getDueReminders(now, limit = 50) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('sent', '==', false)
    .where('send_at', '<=', now)
    .orderBy('send_at', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function getNextDueAt() {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('sent', '==', false)
    .orderBy('send_at', 'asc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data().send_at ?? null;
}

async function markSent(id) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ sent: true });
}

module.exports = {
  init,
  create,
  getByUser,
  getByProgramAndUser,
  remove,
  getDueReminders,
  getNextDueAt,
  markSent,
};
