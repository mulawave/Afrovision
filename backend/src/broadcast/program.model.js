const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_programs';
const programs = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    data.id = doc.id;
    programs.push(data);
  });
  initialized = true;
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
  programs.push(program);
  return program;
}

function findById(id) {
  return programs.find((p) => p.id === id) || null;
}

function getCurrentProgram(channelId) {
  const now = Date.now();
  return (
    programs.find(
      (p) => p.channel_id === channelId && p.start_time <= now && p.end_time > now
    ) || null
  );
}

function getUpcoming(channelId, limit = 10) {
  const now = Date.now();
  return programs
    .filter((p) => p.channel_id === channelId && p.start_time > now)
    .sort((a, b) => a.start_time - b.start_time)
    .slice(0, limit);
}

function getUpcomingAll(limit = 12) {
  const now = Date.now();
  return programs
    .filter((p) => p.start_time > now)
    .sort((a, b) => a.start_time - b.start_time)
    .slice(0, limit);
}

function getSchedule(channelId) {
  return programs
    .filter((p) => p.channel_id === channelId)
    .sort((a, b) => a.start_time - b.start_time);
}

function hasOverlap(channelId, startTime, endTime, excludeId) {
  return programs.some(
    (p) =>
      p.channel_id === channelId &&
      p.id !== excludeId &&
      p.start_time < endTime &&
      p.end_time > startTime
  );
}

async function updateStatus(id, status) {
  const program = findById(id);
  if (!program) return null;
  program.status = status;
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ status });
  return program;
}

function getLastEnded(channelId) {
  const now = Date.now();
  const ended = programs
    .filter((p) => p.channel_id === channelId && p.end_time <= now)
    .sort((a, b) => b.end_time - a.end_time);
  return ended.length > 0 ? ended[0] : null;
}

async function remove(id) {
  const idx = programs.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  programs.splice(idx, 1);
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
