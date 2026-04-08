const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'program_reminders';
const reminders = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    data.id = doc.id;
    reminders.push(data);
  });
  initialized = true;
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
  reminders.push(reminder);
  return reminder;
}

function getByUser(userId) {
  return reminders.filter((r) => r.user_id === userId && !r.sent);
}

function getByProgramAndUser(programId, userId) {
  return reminders.find(
    (r) => r.program_id === programId && r.user_id === userId && !r.sent
  ) || null;
}

async function remove(userId, programId) {
  const idx = reminders.findIndex(
    (r) => r.user_id === userId && r.program_id === programId && !r.sent
  );
  if (idx === -1) return false;
  const reminder = reminders[idx];
  reminders.splice(idx, 1);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(reminder.id).delete();
  return true;
}

function getDueReminders(now) {
  return reminders.filter((r) => !r.sent && r.send_at <= now);
}

async function markSent(id) {
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;
  reminder.sent = true;
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
  markSent,
};
