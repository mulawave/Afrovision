/**
 * Movie Service
 * Business logic for movie CRUD, poster + video upload session handling.
 */

const crypto = require('crypto');
const path = require('path');
const Movie = require('./movie.model');
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
  'video/x-matroska': '.mkv',
};

const AGE_CLASSIFICATION_VALUES = new Set(['minor_safe', 'teen', 'adult']);
const MOVIE_UPLOAD_SESSIONS_COLLECTION = 'movie_upload_sessions';

function isPublicNonExclusiveChannel(channel) {
  return channel.type === 'public' && Number(channel.exclusive_monthly_fee_ngn || 0) === 0;
}

function extractContentRating(body) {
  const rating = {};
  for (const key of Movie.CONTENT_RATING_FIELDS) {
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
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'external_url must be a valid http(s) URL';
    }
  } catch {
    return 'external_url is not a valid URL';
  }
  return null;
}

async function validateHlsUrl(url) {
  if (!url || typeof url !== 'string') return 'hls_url is required for hls mode';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'hls_url must be a valid http(s) URL';
    }
  } catch {
    return 'hls_url is not a valid URL';
  }
  return null;
}

async function createResumableMovieSession({ userId, channelId, fileName, fileSize, contentType, origin }) {
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
  const filename = `movies/${crypto.randomUUID()}${ext}`;
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
  await db.collection(MOVIE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId).set(session);

  return { session };
}

async function completeResumableMovieSession(sessionId, userId) {
  const db = getFirestore();
  const ref = db.collection(MOVIE_UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { error: { status: 404, message: 'Upload session not found' } };

  const session = snap.data();
  if (session.creator_uid !== userId) {
    return { error: { status: 403, message: 'Not upload owner' } };
  }

  const metadata = await getGCSObjectMetadata(session.filename);
  if (!metadata) {
    return { error: { status: 409, message: 'Upload is not complete yet. Please retry shortly.' } };
  }

  await ref.update({ status: 'completed', updated_at: Date.now() });
  return { publicUrl: session.public_url };
}

async function uploadPosterDirect({ userId, channelId, buffer, mimetype, originalname }) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) return { error: ownerCheck.error };

  const ext = path.extname(originalname || '').toLowerCase() || '.jpg';
  const filename = `movie-posters/${crypto.randomUUID()}${ext}`;
  const publicUrl = await uploadToGCS(buffer, filename, mimetype);
  return { publicUrl };
}

async function createMovie(userId, channelId, payload) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const { channel } = ownerCheck;
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

  const movie = await Movie.create({
    channelId,
    createdBy: userId,
    title: payload.title,
    synopsis: payload.synopsis,
    posterUrl: payload.poster_url,
    releaseDate: payload.release_date,
    ageClassification: contentRating.age_classification,
    contentRating,
    videoSourceMode: payload.video_source_mode || 'hosted',
    hostedUrl: payload.hosted_url || null,
    externalUrl: payload.external_url || null,
    embedUrl: payload.embed_url || null,
    hlsUrl: payload.hls_url || null,
    downloadable: !!payload.downloadable,
  });

  return movie;
}

async function updateMovie(userId, channelId, movieId, updates) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const movie = await Movie.findById(movieId);
  if (!movie || movie.channel_id !== channelId) {
    throw Object.assign(new Error('Movie not found'), { status: 404 });
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
  return Movie.update(movieId, updates);
}

async function publishMovie(userId, channelId, movieId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const movie = await Movie.findById(movieId);
  if (!movie || movie.channel_id !== channelId) {
    throw Object.assign(new Error('Movie not found'), { status: 404 });
  }

  if (movie.video_source_mode === 'hosted' && !movie.hosted_url) {
    throw Object.assign(new Error('Cannot publish: no video file uploaded'), { status: 400 });
  }
  if (movie.video_source_mode === 'external_url' && !movie.external_url) {
    throw Object.assign(new Error('Cannot publish: no external URL set'), { status: 400 });
  }
  if (movie.video_source_mode === 'embed' && !movie.embed_url) {
    throw Object.assign(new Error('Cannot publish: no embed URL set'), { status: 400 });
  }
  if (movie.video_source_mode === 'hls' && !movie.hls_url) {
    throw Object.assign(new Error('Cannot publish: no HLS URL set'), { status: 400 });
  }

  const updated = await Movie.update(movieId, { status: 'published', published_at: Date.now() });

  NotificationService.notifyUser(userId, {
    title: 'Movie published',
    body: `"${movie.title}" is now live.`,
    type: 'creator_movie_published',
    link: `/channel/${channelId}`,
    data: { movie_id: movieId, channel_id: channelId },
  }).catch(() => {});

  return updated;
}

async function archiveMovie(userId, channelId, movieId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const movie = await Movie.findById(movieId);
  if (!movie || movie.channel_id !== channelId) {
    throw Object.assign(new Error('Movie not found'), { status: 404 });
  }
  return Movie.update(movieId, { status: 'archived' });
}

async function deleteMovie(userId, channelId, movieId) {
  const ownerCheck = await ensureCanManageChannel(userId, channelId);
  if (ownerCheck.error) throw Object.assign(new Error(ownerCheck.error.message), { status: ownerCheck.error.status });

  const movie = await Movie.findById(movieId);
  if (!movie || movie.channel_id !== channelId) {
    throw Object.assign(new Error('Movie not found'), { status: 404 });
  }
  await Movie.remove(movieId);
  return true;
}

module.exports = {
  isPublicNonExclusiveChannel,
  ensureCanManageChannel,
  createResumableMovieSession,
  completeResumableMovieSession,
  uploadPosterDirect,
  createMovie,
  updateMovie,
  publishMovie,
  archiveMovie,
  deleteMovie,
};
