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

async function create({ creatorUid, channelId, title, description, videoUrl, thumbnailUrl, duration,
  ageClassification, hasExplicitLanguage, hasNudity, hasViolence, hasRevealingClothes,
  hasPartialNudity, hasExplicitContent, hasParentalGuidance, hasEroticDancing, hasSexualNature, hasSex }) {
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
    transcoding_status: 'pending',
    transcoding_job_name: null,
    transcoding_error: null,
    master_playlist_url: null,
    available_renditions: [],
    created_at: Date.now(),
    age_classification: ageClassification || 'teen',
    has_explicit_language: hasExplicitLanguage || false,
    has_nudity: hasNudity || false,
    has_violence: hasViolence || false,
    has_revealing_clothes: hasRevealingClothes || false,
    has_partial_nudity: hasPartialNudity || false,
    has_explicit_content: hasExplicitContent || false,
    has_parental_guidance: hasParentalGuidance || false,
    has_erotic_dancing: hasEroticDancing || false,
    has_sexual_nature: hasSexualNature || false,
    has_sex: hasSex || false,
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

async function getByChannel(channelId, { page, limit } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('channel_id', '==', channelId)
    .get();
  const all = snapshot.docs
    .map((doc) => syncVideo({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
  if (page && limit) {
    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    return { videos: all.slice(start, start + limit), pagination: { page, limit, total, totalPages } };
  }
  return { videos: all, pagination: null };
}

async function getByCreator(creatorUid, { page, limit } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('creator_uid', '==', creatorUid)
    .get();
  const all = snapshot.docs
    .map((doc) => syncVideo({ ...doc.data(), id: doc.id }))
    .sort((a, b) => b.created_at - a.created_at);
  if (page && limit) {
    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    return { videos: all.slice(start, start + limit), pagination: { page, limit, total, totalPages } };
  }
  return { videos: all, pagination: null };
}

async function update(id, fields) {
  const video = await findById(id);
  if (!video) return null;
  const allowed = [
    'title',
    'description',
    'thumbnail_url',
    'duration',
    'transcoding_status',
    'transcoding_job_name',
    'transcoding_error',
    'transcoding_completed_at',
    'transcoding_checked_at',
    'master_playlist_url',
    'available_renditions',
    'hls_output_prefix',
    'age_classification',
    'has_explicit_language',
    'has_nudity',
    'has_violence',
    'has_revealing_clothes',
    'has_partial_nudity',
    'has_explicit_content',
    'has_parental_guidance',
    'has_erotic_dancing',
    'has_sexual_nature',
    'has_sex',
  ];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      video[key] = fields[key];
      updates[key] = fields[key];
    }
  }
  if (Object.keys(updates).length > 0) {
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).set(updates, { merge: true });
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
