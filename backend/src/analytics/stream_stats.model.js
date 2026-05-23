const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'stream_stats';

const streamsById = new Map();

function syncStream(stream) {
  if (stream?.id) {
    streamsById.set(stream.id, stream);
  }
  return stream;
}

function isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

async function init() {
  return [];
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
  return syncStream(stream);
}

async function findById(id) {
  if (streamsById.has(id)) {
    return streamsById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncStream({ id: doc.id, ...doc.data() });
}

/**
 * Find the currently active (live) stream for a channel, if any.
 */
async function getActiveByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .where('status', '==', 'live')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return syncStream({ id: doc.id, ...doc.data() });
}

async function getActiveByCreator(creatorUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .where('status', '==', 'live')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return syncStream({ id: doc.id, ...doc.data() });
}

/**
 * Mark a stream as ended.
 */
async function endStream(id) {
  const stream = await findById(id);
  if (!stream) return null;
  stream.end_time = Date.now();
  stream.status = 'ended';
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({ end_time: stream.end_time, status: 'ended' });
  return syncStream(stream);
}

/**
 * Add gift revenue to a stream record (creator's share).
 */
async function addGifts(id, { ngn = 0, vpt = 0 } = {}) {
  const stream = await findById(id);
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
  const stream = await findById(id);
  if (!stream) return;
  stream.new_subscribers += 1;
  const db = getFirestore();
  const admin = require('firebase-admin');
  await db.collection(COLLECTION).doc(id).update({
    new_subscribers: admin.firestore.FieldValue.increment(1),
  }).catch(() => {});
}

async function incrementViewer(id) {
  const stream = await findById(id);
  if (!stream) return null;

  stream.total_viewers = (stream.total_viewers || 0) + 1;
  stream.peak_viewers = Math.max(stream.peak_viewers || 0, stream.total_viewers);

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).update({
    total_viewers: stream.total_viewers,
    peak_viewers: stream.peak_viewers,
  }).catch(() => {});

  return syncStream(stream);
}

/**
 * Get recent streams for a creator (in-memory, newest first).
 */
async function getByCreator(creatorUid, limit = 10) {
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('creator_uid', '==', creatorUid)
      .orderBy('start_time', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => syncStream({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const snapshot = await db.collection(COLLECTION)
      .where('creator_uid', '==', creatorUid)
      .get();
    return snapshot.docs
      .map((doc) => syncStream({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.start_time - a.start_time)
      .slice(0, limit);
  }
}

async function getByChannel(channelId, limit = 50) {
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .orderBy('start_time', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => syncStream({ id: doc.id, ...doc.data() }));
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const snapshot = await db.collection(COLLECTION)
      .where('channel_id', '==', channelId)
      .get();
    return snapshot.docs
      .map((doc) => syncStream({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.start_time - a.start_time)
      .slice(0, limit);
  }
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
