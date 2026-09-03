/**
 * Series Service
 * Business logic for series/season/episode CRUD, poster + video upload sessions.
 */

const crypto = require('crypto');
const path = require('path');
const Series = require('./series.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const NotificationService = require('../notifications/notification.service');
const {
  createResumableUploadSession,
  getGCSObjectMetadata,
  uploadToGCS,
} = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const AGE_CLASSIFICATION_VALUES = new Set(['minor_safe', 'teen', 'adult']);
const EPISODE_UPLOAD_SESSIONS_COLLECTION = 'episode_upload_sessions';

function isPublicNonExclusiveChannel(channel) {
  return channel.type === 'public' && Number(channel.exclusive_monthly_fee_ngn || 0) === 0;
}

function extractContentRating(body) {
  const rating = {};
  for (const key of Series.CONTENT_RATING_FIELDS) {
    if (body[key] !== undefined) rating[key] = body[key];
  }
  return rating;
}

function validateContentRating(rating, isPublicChannel) {
  const ac = rating.age_classification;
  if (ac !== undefined) {
    if (!AGE_CLASSIFICATION_VALUES.has(String(ac).toLowerCase())) {
      return 'age_classification must be one of: minor_safe, teen, adult';
    }
    if (isPublicChannel && String(ac).toLowerCase() === 'adult') {
      return 'Public channels cannot upload 18+ content. Use minor_safe or teen only.';
    }
  }
  return null;
}

async function ensureCanManageChannel(userId, channelId) {
  const user = await User.findById(userId);
  if (!user) return { error: { status: 404, message: 'User not found' } };

  const channel = await Channel.findById(channelId);
  if (!channel) return { error: { status: 404, message: 'Channel not found' } };

  const isOwner = channel.owner_id === userId;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return { error: { status: 403, message: 'Not authorized to manage this channel' } };
  }
  return { user, channel };
}

async function validateEmbedUrl(url) {
  if (!url || typeof url !== 'string') return 'embed_url is required for embed mode';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'embed_url must be a valid http(s) URL';
    }
  } catch {
    return 'embed_url is not a valid URL';
  }
  return null;
}

async function validateExternalUrl(url) {
  if (!url || typeof url !== 'string') return 'external_url is required for external_url mode';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'external_url must be a valid http(s) URL';
  } catch {
    return 'external_url is not a valid URL';
  }
  return null;
}

async function validateHlsUrl(url) {
  if (!url || typeof url !== 'string') return 'hls_url is required for hls mode';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'hls_url must be a valid http(s) URL';
  } catch {
    return 'hls_url is not a valid URL';
  }
  return null;
}

// ── Series ──────────────────────────────────────────────

async function createSeries(userId, channelId, payload) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  if (!payload.title || !payload.title.trim()) {
    throw Object.assign(new Error('title is required'), { status: 400 });
  }
  return Series.createSeries({
    channelId,
    createdBy: userId,
    title: payload.title,
    description: payload.description,
    coverUrl: payload.cover_url,
  });
}

async function updateSeriesMeta(userId, channelId, seriesId, updates) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const series = await Series.findSeriesById(seriesId);
  if (!series || series.channel_id !== channelId) {
    throw Object.assign(new Error('Series not found'), { status: 404 });
  }
  return Series.updateSeries(seriesId, updates);
}

async function publishSeries(userId, channelId, seriesId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const series = await Series.findSeriesById(seriesId);
  if (!series || series.channel_id !== channelId) {
    throw Object.assign(new Error('Series not found'), { status: 404 });
  }
  const episodes = await Series.listEpisodesBySeries(seriesId, { onlyPublished: true });
  if (episodes.length === 0) {
    throw Object.assign(new Error('Cannot publish series with no published episodes'), { status: 400 });
  }
  const updated = await Series.updateSeries(seriesId, { status: 'published', published_at: Date.now() });

  NotificationService.notifyUser(userId, {
    title: 'Series published',
    body: `"${series.title}" is now live.`,
    type: 'creator_series_published',
    link: `/channel/${channelId}`,
    data: { series_id: seriesId, channel_id: channelId },
  }).catch(() => {});

  return updated;
}

async function archiveSeries(userId, channelId, seriesId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const series = await Series.findSeriesById(seriesId);
  if (!series || series.channel_id !== channelId) {
    throw Object.assign(new Error('Series not found'), { status: 404 });
  }
  return Series.updateSeries(seriesId, { status: 'archived' });
}

async function deleteSeries(userId, channelId, seriesId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const series = await Series.findSeriesById(seriesId);
  if (!series || series.channel_id !== channelId) {
    throw Object.assign(new Error('Series not found'), { status: 404 });
  }
  const seasons = await Series.listSeasonsBySeries(seriesId);
  for (const season of seasons) {
    const episodes = await Series.listEpisodesBySeason(season.id);
    for (const ep of episodes) await Series.deleteEpisode(ep.id);
    await Series.deleteSeason(season.id);
  }
  await Series.deleteSeries(seriesId);
  return true;
}

// ── Seasons ─────────────────────────────────────────────

async function createSeason(userId, channelId, seriesId, payload) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const series = await Series.findSeriesById(seriesId);
  if (!series || series.channel_id !== channelId) {
    throw Object.assign(new Error('Series not found'), { status: 404 });
  }
  const existing = await Series.listSeasonsBySeries(seriesId);
  const nextSeasonNumber = payload.season_number || existing.length + 1;
  return Series.createSeason({ seriesId, seasonNumber: nextSeasonNumber, title: payload.title });
}

async function updateSeason(userId, channelId, seriesId, seasonId, updates) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const season = await Series.findSeasonById(seasonId);
  if (!season || season.series_id !== seriesId) {
    throw Object.assign(new Error('Season not found'), { status: 404 });
  }
  return Series.updateSeason(seasonId, updates);
}

async function deleteSeason(userId, channelId, seriesId, seasonId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const season = await Series.findSeasonById(seasonId);
  if (!season || season.series_id !== seriesId) {
    throw Object.assign(new Error('Season not found'), { status: 404 });
  }
  const episodes = await Series.listEpisodesBySeason(seasonId);
  for (const ep of episodes) await Series.deleteEpisode(ep.id);
  await Series.deleteSeason(seasonId);
  return true;
}

// ── Episodes ────────────────────────────────────────────

async function createEpisode(userId, channelId, seriesId, seasonId, payload) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const { channel } = ownerCheck;
  const season = await Series.findSeasonById(seasonId);
  if (!season || season.series_id !== seriesId) {
    throw Object.assign(new Error('Season not found'), { status: 404 });
  }
  if (!payload.title || !payload.title.trim()) {
    throw Object.assign(new Error('title is required'), { status: 400 });
  }

  const contentRating = extractContentRating(payload);
  if (!contentRating.age_classification) contentRating.age_classification = 'teen';
  const ratingError = validateContentRating(contentRating, channel.type === 'public');
  if (ratingError) throw Object.assign(new Error(ratingError), { status: 400 });

  if (payload.video_source_mode === 'external_url') {
    const urlError = await validateExternalUrl(payload.external_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }
  if (payload.video_source_mode === 'embed') {
    const urlError = await validateEmbedUrl(payload.embed_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }
  if (payload.video_source_mode === 'hls') {
    const urlError = await validateHlsUrl(payload.hls_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }

  const existing = await Series.listEpisodesBySeason(seasonId);
  const nextEpisodeNumber = payload.episode_number || existing.length + 1;

  return Series.createEpisode({
    seriesId,
    seasonId,
    createdBy: userId,
    episodeNumber: nextEpisodeNumber,
    title: payload.title,
    synopsis: payload.synopsis,
    posterUrl: payload.poster_url,
    ageClassification: contentRating.age_classification,
    contentRating,
    videoSourceMode: payload.video_source_mode || 'hosted',
    hostedUrl: payload.hosted_url || null,
    externalUrl: payload.external_url || null,
    embedUrl: payload.embed_url || null,
    hlsUrl: payload.hls_url || null,
    downloadable: !!payload.downloadable,
  });
}

async function updateEpisode(userId, channelId, seriesId, episodeId, updates) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const episode = await Series.findEpisodeById(episodeId);
  if (!episode || episode.series_id !== seriesId) {
    throw Object.assign(new Error('Episode not found'), { status: 404 });
  }
  if (updates.video_source_mode === 'external_url' && updates.external_url) {
    const urlError = await validateExternalUrl(updates.external_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }
  if (updates.video_source_mode === 'embed' && updates.embed_url) {
    const urlError = await validateEmbedUrl(updates.embed_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }
  if (updates.video_source_mode === 'hls' && updates.hls_url) {
    const urlError = await validateHlsUrl(updates.hls_url);
    if (urlError) throw Object.assign(new Error(urlError), { status: 400 });
  }
  return Series.updateEpisode(episodeId, updates);
}

async function publishEpisode(userId, channelId, seriesId, episodeId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const episode = await Series.findEpisodeById(episodeId);
  if (!episode || episode.series_id !== seriesId) {
    throw Object.assign(new Error('Episode not found'), { status: 404 });
  }
  if (episode.video_source_mode === 'hosted' && !episode.hosted_url) {
    throw Object.assign(new Error('Cannot publish: no video file uploaded'), { status: 400 });
  }
  if (episode.video_source_mode === 'external_url' && !episode.external_url) {
    throw Object.assign(new Error('Cannot publish: no external URL set'), { status: 400 });
  }
  if (episode.video_source_mode === 'embed' && !episode.embed_url) {
    throw Object.assign(new Error('Cannot publish: no embed URL set'), { status: 400 });
  }
  if (episode.video_source_mode === 'hls' && !episode.hls_url) {
    throw Object.assign(new Error('Cannot publish: no HLS URL set'), { status: 400 });
  }
  return Series.updateEpisode(episodeId, { status: 'published', published_at: Date.now() });
}

async function archiveEpisode(userId, channelId, seriesId, episodeId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const episode = await Series.findEpisodeById(episodeId);
  if (!episode || episode.series_id !== seriesId) {
    throw Object.assign(new Error('Episode not found'), { status: 404 });
  }
  return Series.updateEpisode(episodeId, { status: 'archived' });
}

async function deleteEpisode(userId, channelId, seriesId, episodeId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });
  const episode = await Series.findEpisodeById(episodeId);
  if (!episode || episode.series_id !== seriesId) {
    throw Object.assign(new Error('Episode not found'), { status: 404 });
  }
  await Series.deleteEpisode(episodeId);
  return true;
}

// ── Upload sessions (reused for episode + movie-like video files) ──────

async function createResumableEpisodeSession({ userId, channelId, fileName, fileSize, contentType, origin }) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) return { error: ownerCheck.error };

  if (!ALLOWED_VIDEO_TYPES[contentType]) {
    return {
      error: {
        status: 400,
        message: `Unsupported video type: ${contentType}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      },
    };
  }

  const ext = ALLOWED_VIDEO_TYPES[contentType] || path.extname(fileName || '').toLowerCase() || '.mp4';
  const filename = `series-episodes/${crypto.randomUUID()}${ext}`;
  const { sessionUrl, publicUrl } = await createResumableUploadSession(filename, contentType, origin);

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id: sessionId,
    creator_uid: userId,
    channel_id: channelId,
    filename,
    public_url: publicUrl,
    upload_url: sessionUrl,
    content_type: contentType,
    total_bytes: Number.isFinite(Number(fileSize)) ? Math.max(0, parseInt(fileSize, 10)) : 0,
    uploaded_bytes: 0,
    status: 'initiated',
    created_at: now,
    updated_at: now,
    expires_at: now + 24 * 60 * 60 * 1000,
  };

  const db = getFirestore();
  await db.collection(EPISODE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId).set(session);
  return { session };
}

async function completeResumableEpisodeSession(sessionId, userId) {
  const db = getFirestore();
  const ref = db.collection(EPISODE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { error: { status: 404, message: 'Upload session not found' } };

  const session = snap.data();
  if (session.creator_uid !== userId) return { error: { status: 403, message: 'Not upload owner' } };

  const metadata = await getGCSObjectMetadata(session.filename);
  if (!metadata) return { error: { status: 409, message: 'Upload is not complete yet. Please retry shortly.' } };

  await ref.update({ status: 'completed', updated_at: Date.now() });
  return { publicUrl: session.public_url };
}

async function uploadPosterDirect({ userId, channelId, buffer, mimetype, originalname }) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) return { error: ownerCheck.error };

  const ext = path.extname(originalname || '').toLowerCase() || '.jpg';
  const filename = `series-posters/${crypto.randomUUID()}${ext}`;
  const publicUrl = await uploadToGCS(buffer, filename, mimetype);
  return { publicUrl };
}

module.exports = {
  isPublicNonExclusiveChannel,
  ensureCanManageChannel,
  createSeries,
  updateSeriesMeta,
  publishSeries,
  archiveSeries,
  deleteSeries,
  createSeason,
  updateSeason,
  deleteSeason,
  createEpisode,
  updateEpisode,
  publishEpisode,
  archiveEpisode,
  deleteEpisode,
  createResumableEpisodeSession,
  completeResumableEpisodeSession,
  uploadPosterDirect,
};
