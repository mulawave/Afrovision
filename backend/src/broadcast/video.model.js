const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'videos';
const videos = [];
let initialized = false;

async function init() {
  if (initialized) return;
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    data.id = doc.id;
    videos.push(data);
  });
  initialized = true;
}

async function create({ creatorUid, channelId, title, videoUrl, thumbnailUrl, duration }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const video = {
    id,
    creator_uid: creatorUid,
    channel_id: channelId,
    title,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl || null,
    duration: duration || 0,
    created_at: Date.now(),
  };
  await db.collection(COLLECTION).doc(id).set(video);
  videos.push(video);
  return video;
}

function findById(id) {
  return videos.find((v) => v.id === id) || null;
}

function getByChannel(channelId) {
  return videos
    .filter((v) => v.channel_id === channelId)
    .sort((a, b) => b.created_at - a.created_at);
}

function getByCreator(creatorUid) {
  return videos
    .filter((v) => v.creator_uid === creatorUid)
    .sort((a, b) => b.created_at - a.created_at);
}

async function update(id, fields) {
  const video = findById(id);
  if (!video) return null;
  const allowed = ['title', 'thumbnail_url', 'duration'];
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
  return video;
}

async function remove(id) {
  const idx = videos.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  videos.splice(idx, 1);
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

module.exports = { init, create, findById, getByChannel, getByCreator, update, remove };
