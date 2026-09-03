/**
 * Movie Model
 * Firestore schema + CRUD for channel-owned long-form movies.
 *
 * Collection: channel_movies
 */

const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const COLLECTION = 'channel_movies';

const CONTENT_RATING_FIELDS = [
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

function create({
  channelId,
  createdBy,
  title,
  synopsis,
  posterUrl,
  releaseDate,
  ageClassification,
  contentRating = {},
  videoSourceMode,
  hostedUrl,
  externalUrl,
  embedUrl,
  hlsUrl,
  downloadable,
}) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const now = Date.now();

  const movie = {
    id,
    channel_id: channelId,
    created_by: createdBy,
    title: title.trim(),
    synopsis: synopsis || '',
    poster_url: posterUrl || null,
    release_date: releaseDate || null,
    age_classification: ageClassification || 'teen',
    has_explicit_language: !!contentRating.has_explicit_language,
    has_nudity: !!contentRating.has_nudity,
    has_violence: !!contentRating.has_violence,
    has_revealing_clothes: !!contentRating.has_revealing_clothes,
    has_partial_nudity: !!contentRating.has_partial_nudity,
    has_explicit_content: !!contentRating.has_explicit_content,
    has_parental_guidance: !!contentRating.has_parental_guidance,
    has_erotic_dancing: !!contentRating.has_erotic_dancing,
    has_sexual_nature: !!contentRating.has_sexual_nature,
    has_sex: !!contentRating.has_sex,
    video_source_mode: videoSourceMode || 'hosted', // hosted|external_url|embed|hls
    hosted_url: hostedUrl || null,
    external_url: externalUrl || null,
    embed_url: embedUrl || null,
    hls_url: hlsUrl || null,
    downloadable: !!downloadable,
    duration: 0,
    status: 'draft', // draft|published|archived
    published_at: null,
    created_at: now,
    updated_at: now,
    total_views: 0,
    total_downloads: 0,
  };

  return db.collection(COLLECTION).doc(id).set(movie).then(() => movie);
}

async function findById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

const ALLOWED_UPDATE_FIELDS = [
  'title',
  'synopsis',
  'poster_url',
  'release_date',
  'age_classification',
  ...CONTENT_RATING_FIELDS.filter((f) => f !== 'age_classification'),
  'video_source_mode',
  'hosted_url',
  'external_url',
  'embed_url',
  'hls_url',
  'downloadable',
  'duration',
  'status',
  'published_at',
];

async function update(id, fields) {
  const movie = await findById(id);
  if (!movie) return null;

  const updates = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (fields[key] !== undefined) {
      updates[key] = fields[key];
    }
  }
  updates.updated_at = Date.now();

  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).set(updates, { merge: true });
  return { ...movie, ...updates };
}

async function remove(id) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(id).delete();
  return true;
}

async function listByChannel(channelId, { onlyPublished = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).where('channel_id', '==', channelId).get();
  let items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  if (onlyPublished) {
    items = items.filter((m) => m.status === 'published');
  }
  return items.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

async function listPublicFeed({ page = 1, limit = 20, publicChannelIds = [] } = {}) {
  const db = getFirestore();
  if (publicChannelIds.length === 0) {
    return { items: [], total: 0, pages: 1 };
  }

  // Firestore 'in' queries are limited to 30 values; chunk if needed.
  const chunks = [];
  for (let i = 0; i < publicChannelIds.length; i += 30) {
    chunks.push(publicChannelIds.slice(i, i + 30));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection(COLLECTION)
        .where('channel_id', 'in', chunk)
        .where('status', '==', 'published')
        .get()
    )
  );

  let items = [];
  for (const snap of results) {
    items = items.concat(snap.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
  }
  items.sort((a, b) => (b.published_at || b.created_at || 0) - (a.published_at || a.created_at || 0));

  const total = items.length;
  const offset = (page - 1) * limit;
  const paged = items.slice(offset, offset + limit);

  return { items: paged, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = {
  COLLECTION,
  CONTENT_RATING_FIELDS,
  create,
  findById,
  update,
  remove,
  listByChannel,
  listPublicFeed,
};
