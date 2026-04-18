const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'stream_stats';

// In-memory store — most recent 200 streams, newest-first
const streams = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .orderBy('start_time', 'desc')
    .limit(200)
    .get();
  snapshot.forEach((doc) => streams.push({ id: doc.id, ...doc.data() }));
  initialized = true;
}

/**
 * Create a new stream record when a creator goes live.
 */
async function startStream({ creatorUid, channelId }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const stream = {
    id,
    creator_uid: creatorUid,
    channel_id: channelId,
    start_time: Date.now(),
    end_time: null,
    total_viewers: 0,
    peak_viewers: 0,
    total_gifts_ngn: 0,
    total_gifts_vpt: 0,
    new_subscribers: 0,
    status: 'live',
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(stream);
  streams.unshift(stream);
  // Keep in-memory store bounded
  if (streams.length > 200) streams.splice(200);
  return stream;
}

function findById(id) {
  return streams.find((s) => s.id === id) || null;
}

/**
 * Find the currently active (live) stream for a channel, if any.
 */
function getActiveByChannel(channelId) {
  return streams.find((s) => s.channel_id === channelId && s.status === 'live') || null;
}

function getActiveByCreator(creatorUid) {
  return streams.find((s) => s.creator_uid === creatorUid && s.status === 'live') || null;
}

/**
 * Mark a stream as ended.
 */
async function endStream(id) {
  const stream = findById(id);
  if (!stream) return null;
  stream.end_time = Date.now();
  stream.status = 'ended';
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ end_time: stream.end_time, status: 'ended' });
  return stream;
}

/**
 * Add gift revenue to a stream record (creator's share).
 */
async function addGifts(id, { ngn = 0, vpt = 0 } = {}) {
  const stream = findById(id);
  if (!stream) return;
  stream.total_gifts_ngn += ngn;
  stream.total_gifts_vpt += vpt;
  const db = getFirestore();
  const admin = require('firebase-admin');
  await db.collection(COLLECTION).doc(id).update({
    total_gifts_ngn: admin.firestore.FieldValue.increment(ngn),
    total_gifts_vpt: admin.firestore.FieldValue.increment(vpt),
  }).catch(() => {});
}

/**
 * Increment the new-subscriber count on a stream.
 */
async function addSubscriber(id) {
  const stream = findById(id);
  if (!stream) return;
  stream.new_subscribers += 1;
  const db = getFirestore();
  const admin = require('firebase-admin');
  await db.collection(COLLECTION).doc(id).update({
    new_subscribers: admin.firestore.FieldValue.increment(1),
  }).catch(() => {});
}

async function incrementViewer(id) {
  const stream = findById(id);
  if (!stream) return null;

  stream.total_viewers = (stream.total_viewers || 0) + 1;
  stream.peak_viewers = Math.max(stream.peak_viewers || 0, stream.total_viewers);

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({
    total_viewers: stream.total_viewers,
    peak_viewers: stream.peak_viewers,
  }).catch(() => {});

  return stream;
}

/**
 * Get recent streams for a creator (in-memory, newest first).
 */
function getByCreator(creatorUid, limit = 10) {
  return streams
    .filter((s) => s.creator_uid === creatorUid)
    .sort((a, b) => b.start_time - a.start_time)
    .slice(0, limit);
}

function getByChannel(channelId, limit = 50) {
  return streams
    .filter((s) => s.channel_id === channelId)
    .sort((a, b) => b.start_time - a.start_time)
    .slice(0, limit);
}

module.exports = {
  init,
  startStream,
  findById,
  getActiveByChannel,
  getActiveByCreator,
  endStream,
  addGifts,
  addSubscriber,
  incrementViewer,
  getByCreator,
  getByChannel,
};
