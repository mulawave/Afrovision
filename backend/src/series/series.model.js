/**
 * Series Model
 * Firestore schema + CRUD for channel-owned series, seasons, and episodes.
 *
 * Collections:
 * - channel_series (series shell)
 * - channel_series_seasons
 * - channel_series_episodes
 */

const crypto = require('crypto');
const { getFirestore } = require('../utils/firestore');

const SERIES_COLLECTION = 'channel_series';
const SEASONS_COLLECTION = 'channel_series_seasons';
const EPISODES_COLLECTION = 'channel_series_episodes';

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

// ── Series ──────────────────────────────────────────────

async function createSeries({ channelId, createdBy, title, description, coverUrl }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const now = Date.now();
  const series = {
    id,
    channel_id: channelId,
    created_by: createdBy,
    title: title.trim(),
    description: description || '',
    cover_url: coverUrl || null,
    status: 'draft', // draft|published|archived
    published_at: null,
    created_at: now,
    updated_at: now,
  };
  await db.collection(SERIES_COLLECTION).doc(id).set(series);
  return series;
}

async function findSeriesById(id) {
  const db = getFirestore();
  const doc = await db.collection(SERIES_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

const SERIES_UPDATE_FIELDS = ['title', 'description', 'cover_url', 'status', 'published_at'];

async function updateSeries(id, fields) {
  const series = await findSeriesById(id);
  if (!series) return null;
  const updates = {};
  for (const key of SERIES_UPDATE_FIELDS) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  updates.updated_at = Date.now();
  const db = getFirestore();
  await db.collection(SERIES_COLLECTION).doc(id).set(updates, { merge: true });
  return { ...series, ...updates };
}

async function deleteSeries(id) {
  const db = getFirestore();
  await db.collection(SERIES_COLLECTION).doc(id).delete();
  return true;
}

async function listSeriesByChannel(channelId, { onlyPublished = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(SERIES_COLLECTION).where('channel_id', '==', channelId).get();
  let items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  if (onlyPublished) items = items.filter((s) => s.status === 'published');
  return items.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

async function listPublicSeriesFeed({ page = 1, limit = 24, publicChannelIds = [] } = {}) {
  const db = getFirestore();
  if (publicChannelIds.length === 0) return { items: [], total: 0, pages: 1 };

  const chunks = [];
  for (let i = 0; i < publicChannelIds.length; i += 30) {
    chunks.push(publicChannelIds.slice(i, i + 30));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      db.collection(SERIES_COLLECTION).where('channel_id', 'in', chunk).where('status', '==', 'published').get()
    )
  );

  let items = [];
  for (const snap of results) {
    items = items.concat(snap.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
  }
  items.sort((a, b) => (b.published_at || b.created_at || 0) - (a.published_at || a.created_at || 0));

  const total = items.length;
  const offset = (page - 1) * limit;
  return { items: items.slice(offset, offset + limit), total, pages: Math.max(1, Math.ceil(total / limit)) };
}

// ── Seasons ─────────────────────────────────────────────

async function createSeason({ seriesId, seasonNumber, title }) {
  const db = getFirestore();
  const id = crypto.randomUUID();
  const now = Date.now();
  const season = {
    id,
    series_id: seriesId,
    season_number: Number(seasonNumber) || 1,
    title: title || `Season ${seasonNumber || 1}`,
    created_at: now,
    updated_at: now,
  };
  await db.collection(SEASONS_COLLECTION).doc(id).set(season);
  return season;
}

async function findSeasonById(id) {
  const db = getFirestore();
  const doc = await db.collection(SEASONS_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

async function updateSeason(id, fields) {
  const season = await findSeasonById(id);
  if (!season) return null;
  const updates = {};
  if (fields.title !== undefined) updates.title = fields.title;
  if (fields.season_number !== undefined) updates.season_number = Number(fields.season_number);
  updates.updated_at = Date.now();
  const db = getFirestore();
  await db.collection(SEASONS_COLLECTION).doc(id).set(updates, { merge: true });
  return { ...season, ...updates };
}

async function deleteSeason(id) {
  const db = getFirestore();
  await db.collection(SEASONS_COLLECTION).doc(id).delete();
  return true;
}

async function listSeasonsBySeries(seriesId) {
  const db = getFirestore();
  const snapshot = await db.collection(SEASONS_COLLECTION).where('series_id', '==', seriesId).get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
}

// ── Episodes ────────────────────────────────────────────

async function createEpisode({
  seriesId,
  seasonId,
  createdBy,
  episodeNumber,
  title,
  synopsis,
  posterUrl,
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
  const episode = {
    id,
    series_id: seriesId,
    season_id: seasonId,
    created_by: createdBy,
    episode_number: Number(episodeNumber) || 1,
    title: title.trim(),
    synopsis: synopsis || '',
    poster_url: posterUrl || null,
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
  };
  await db.collection(EPISODES_COLLECTION).doc(id).set(episode);
  return episode;
}

async function findEpisodeById(id) {
  const db = getFirestore();
  const doc = await db.collection(EPISODES_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { ...doc.data(), id: doc.id };
}

const EPISODE_UPDATE_FIELDS = [
  'episode_number',
  'title',
  'synopsis',
  'poster_url',
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

async function updateEpisode(id, fields) {
  const episode = await findEpisodeById(id);
  if (!episode) return null;
  const updates = {};
  for (const key of EPISODE_UPDATE_FIELDS) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  updates.updated_at = Date.now();
  const db = getFirestore();
  await db.collection(EPISODES_COLLECTION).doc(id).set(updates, { merge: true });
  return { ...episode, ...updates };
}

async function deleteEpisode(id) {
  const db = getFirestore();
  await db.collection(EPISODES_COLLECTION).doc(id).delete();
  return true;
}

async function listEpisodesBySeason(seasonId, { onlyPublished = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(EPISODES_COLLECTION).where('season_id', '==', seasonId).get();
  let items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  if (onlyPublished) items = items.filter((e) => e.status === 'published');
  return items.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
}

async function listEpisodesBySeries(seriesId, { onlyPublished = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(EPISODES_COLLECTION).where('series_id', '==', seriesId).get();
  let items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  if (onlyPublished) items = items.filter((e) => e.status === 'published');
  return items;
}

module.exports = {
  SERIES_COLLECTION,
  SEASONS_COLLECTION,
  EPISODES_COLLECTION,
  CONTENT_RATING_FIELDS,
  createSeries,
  findSeriesById,
  updateSeries,
  deleteSeries,
  listSeriesByChannel,
  listPublicSeriesFeed,
  createSeason,
  findSeasonById,
  updateSeason,
  deleteSeason,
  listSeasonsBySeries,
  createEpisode,
  findEpisodeById,
  updateEpisode,
  deleteEpisode,
  listEpisodesBySeason,
  listEpisodesBySeries,
};
