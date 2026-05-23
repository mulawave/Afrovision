const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'videos';
const videosById = new Map();

function syncVideo(video) {
  if (video?.id) {
    videosById.set(video.id, video);
  }
  return video;
}

async function init() {
  return [];
}

async function create({ creatorUid, channelId, title, description, videoUrl, thumbnailUrl, duration }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const video = {
    id,
    creator_uid: creatorUid,
    channel_id: channelId,
    title,
    description: description || '',
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl || null,
    duration: duration || 0,
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(video);
  return syncVideo(video);
}

async function findById(id) {
  if (videosById.has(id)) {
    return videosById.get(id) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return syncVideo({ ...doc.data(), id: doc.id });
}

async function getByChannel(channelId) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  return snapshot.docs
    .map((doc) => syncVideo({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function getByCreator(creatorUid) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .get();
  return snapshot.docs
    .map((doc) => syncVideo({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
}

async function update(id, fields) {
  const video = await findById(id);
  if (!video) return null;
  const allowed = ['title', 'description', 'thumbnail_url', 'duration'];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      video[key] = fields[key];
      updates[key] = fields[key];
    }
  }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).update(updates);
  }
  return syncVideo(video);
}

async function remove(id) {
  const video = await findById(id);
  if (!video) return false;
  videosById.delete(id);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = { init, create, findById, getByChannel, getByCreator, update, remove };
