const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_programs';
const programsById = new Map();

function syncProgram(program) {
  if (program?.id) {
    programsById.set(program.id, program);
  }
  return program;
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((doc) => syncProgram({ ...doc.data(), id: doc.id }));
}

function isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

async function init() {
  return [];
}

async function create({ channelId, videoId, startTime, endTime }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const program = {
    id,
    channel_id: channelId,
    video_id: videoId,
    start_time: startTime,
    end_time: endTime,
    type: 'sim_live',
    status: 'scheduled',
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(program);
  return syncProgram(program);
}

async function findById(id) {
  if (programsById.has(id)) {
    return programsById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncProgram({ ...doc.data(), id: doc.id });
}

async function getCurrentProgram(channelId) {
  const now = Date.now();
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('end_time', '>', now)
      .orderBy('end_time', 'asc')
      .limit(1)
      .get();
    const program = mapSnapshot(snapshot)[0] || null;
    return program && program.start_time <= now ? program : null;
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const schedule = await getSchedule(channelId);
    return schedule.find((p) => p.start_time <= now && p.end_time > now) || null;
  }
}

async function getUpcoming(channelId, limit = 10) {
  const now = Date.now();
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('start_time', '>', now)
      .orderBy('start_time', 'asc')
      .limit(limit)
      .get();
    return mapSnapshot(snapshot);
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const schedule = await getSchedule(channelId);
    return schedule
      .filter((p) => p.start_time > now)
      .sort((a, b) => a.start_time - b.start_time)
      .slice(0, limit);
  }
}

async function getUpcomingAll(limit = 12) {
  const now = Date.now();
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('start_time', '>', now)
      .orderBy('start_time', 'asc')
      .limit(limit)
      .get();
    return mapSnapshot(snapshot);
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const snapshot = await db.collection(COLLECTION)
      .where('start_time', '>', now)
      .get();
    return mapSnapshot(snapshot)
      .sort((a, b) => a.start_time - b.start_time)
      .slice(0, limit);
  }
}

async function getSchedule(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return mapSnapshot(snapshot)
    .sort((a, b) => a.start_time - b.start_time);
}

async function hasOverlap(channelId, startTime, endTime, excludeId) {
  const schedule = await getSchedule(channelId);
  return schedule.some(
    (p) =>
      p.channel_id === channelId &&
      p.id !== excludeId &&
      p.start_time < endTime &&
      p.end_time > startTime
  );
}

async function updateStatus(id, status) {
  const program = await findById(id);
  if (!program) return null;
  program.status = status;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).set({ status }, { merge: true });
  return syncProgram(program);
}

async function getLastEnded(channelId) {
  const now = Date.now();
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .where('end_time', '<=', now)
      .orderBy('end_time', 'desc')
      .limit(1)
      .get();
    return mapSnapshot(snapshot)[0] || null;
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const schedule = await getSchedule(channelId);
    const ended = schedule
      .filter((p) => p.end_time <= now)
      .sort((a, b) => b.end_time - a.end_time);
    return ended.length > 0 ? ended[0] : null;
  }
}

async function remove(id) {
  const program = await findById(id);
  if (!program) return false;
  programsById.delete(id);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = {
  init,
  create,
  findById,
  getCurrentProgram,
  getUpcoming,
  getUpcomingAll,
  getSchedule,
  hasOverlap,
  updateStatus,
  getLastEnded,
  remove,
};
