const Video = require('./video.model');
const Program = require('./program.model');
const Reminder = require('./reminder.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const LiveTrigger = require('../channels/live_trigger');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const NotificationService = require('../notifications/notification.service');
const TranscoderService = require('./transcoder.service');
const { resolveScheduleState } = require('./scheduler-resolver');
const { sendReminderEmail } = require('../utils/email');
const { generateFlashAudio } = require('../utils/tts');
const SettingsService = require('../admin/settings.service');
const crypto = require('crypto');
const path = require('path');
const {
  generateSignedUploadUrl,
  createResumableUploadSession,
  getGCSObjectMetadata,
  extractGCSPath,
  generateSignedReadUrl,
  getBucket,
} = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');

// ─── SIGNED UPLOAD URL (Direct-to-GCS) ──────────────────

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const UPLOAD_SESSIONS_COLLECTION = 'broadcast_upload_sessions';

async function resolvePlayableVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const gcsPath = extractGCSPath(rawUrl);
  if (!gcsPath) return rawUrl;

  try {
    // 24-hour expiry so long viewing sessions and looped content don't break.
    return await generateSignedReadUrl(gcsPath, 1440);
  } catch (error) {
    console.warn('[Broadcast] Failed to sign playback URL, falling back to raw URL:', error.message);
    return rawUrl;
  }
}

function buildUploadSessionResponse(session) {
  const isActive = ['initiated', 'uploading', 'paused', 'failed'].includes(session.status);
  return {
    ...session,
    upload_url: isActive ? session.upload_url : null,
  };
}

async function ensureCreatorAndChannelOwner(userId, channelId) {
  const user = await User.findById(userId);
  if (!user) return { error: { status: 404, message: 'User not found' } };
  if (user.role !== 'creator' && user.role !== 'admin') {
    return { error: { status: 403, message: 'Only creators can upload videos' } };
  }

  const channel = await Channel.findById(channelId);
  if (!channel) return { error: { status: 404, message: 'Channel not found' } };
  if (channel.owner_id !== userId) {
    return { error: { status: 403, message: 'Not channel owner' } };
  }
  if (channel.stream_source_mode && channel.stream_source_mode !== 'native') {
    return {
      error: {
        status: 400,
        message: 'Only native channels support uploaded and scheduled videos',
      },
    };
  }

  return { user, channel };
}

async function getVideoUploadUrl(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload videos' });
    }

    const { content_type, file_name } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });

    if (!ALLOWED_VIDEO_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported video type: ${content_type}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      });
    }

    const ext = ALLOWED_VIDEO_TYPES[content_type] || path.extname(file_name || '').toLowerCase() || '.mp4';
    const filename = `videos/${crypto.randomUUID()}${ext}`;

    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, content_type, 60);

    res.json({ signed_url: signedUrl, public_url: publicUrl, filename });
  } catch (err) {
    console.error('[Broadcast] getVideoUploadUrl error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function prepareAdaptiveVideo(video) {
  try {
    const transcoding = await TranscoderService.startTranscode(video);
    return await Video.update(video.id, transcoding);
  } catch (error) {
    console.error(`[Transcoder] Failed to queue video ${video.id}:`, error.message);
    return await Video.update(video.id, {
      transcoding_status: 'failed',
      transcoding_error: error.message,
    });
  }
}

async function refreshAdaptiveVideo(video) {
  try {
    if (!video.transcoding_status || (video.transcoding_status === 'pending' && !video.transcoding_job_name)) {
      return await prepareAdaptiveVideo(video);
    }
    if (
      video.transcoding_status === 'processing' &&
      Number(video.transcoding_checked_at || 0) > Date.now() - 60_000
    ) {
      return video;
    }
    const update = await TranscoderService.refreshTranscode(video);
    return update ? await Video.update(video.id, update) : video;
  } catch (error) {
    console.warn(`[Transcoder] Failed to refresh video ${video.id}:`, error.message);
    return video;
  }
}

async function registerUploadedVideo(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload videos' });
    }

    const { channel_id, title, description, duration, video_url } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });
    if (!video_url) return res.status(400).json({ error: 'video_url is required' });

    // Validate URL is from our GCS bucket
    const BUCKET_NAME = process.env.GCS_BUCKET;
    if (!BUCKET_NAME) return res.status(503).json({ error: 'GCS_BUCKET is not configured' });
    if (!video_url.startsWith(`https://storage.googleapis.com/${BUCKET_NAME}/videos/`)) {
      return res.status(400).json({ error: 'Invalid video URL — must be from the AfroVision media bucket' });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }
    if (channel.stream_source_mode && channel.stream_source_mode !== 'native') {
      return res.status(400).json({ error: 'Only native channels support uploaded and scheduled videos' });
    }

    let video = await Video.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title,
      description: description.trim(),
      videoUrl: video_url,
      thumbnailUrl: null,
      duration: duration ? parseInt(duration, 10) : 0,
    });
    video = await prepareAdaptiveVideo(video);

    await NotificationService.notifyUser(req.userId, {
      title: 'Upload completed',
      body: `Your video "${title}" was uploaded and added to your library.`,
      type: 'creator_upload_completed',
      link: '/creator-studio',
      data: {
        video_id: video.id,
        channel_id: channel_id,
      },
    });

    res.status(201).json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createVideoResumableSession(req, res) {
  try {
    const {
      channel_id,
      title,
      description,
      duration,
      file_name,
      content_type,
      file_size,
    } = req.body;

    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });
    if (!ALLOWED_VIDEO_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported video type: ${content_type}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      });
    }

    const ownerCheck = await ensureCreatorAndChannelOwner(req.userId, channel_id);
    if (ownerCheck.error) {
      return res.status(ownerCheck.error.status).json({ error: ownerCheck.error.message });
    }

    const ext = ALLOWED_VIDEO_TYPES[content_type] || path.extname(file_name || '').toLowerCase() || '.mp4';
    const filename = `videos/${crypto.randomUUID()}${ext}`;
    const { sessionUrl, publicUrl } = await createResumableUploadSession(filename, content_type);
    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const totalBytes = Number.isFinite(Number(file_size)) ? Math.max(0, parseInt(file_size, 10)) : 0;

    const session = {
      id: sessionId,
      creator_uid: req.userId,
      channel_id,
      title,
      description: description.trim(),
      duration: duration ? parseInt(duration, 10) : 0,
      file_name: file_name || null,
      content_type,
      filename,
      public_url: publicUrl,
      upload_url: sessionUrl,
      total_bytes: totalBytes,
      uploaded_bytes: 0,
      status: 'initiated',
      error: null,
      video_id: null,
      created_at: now,
      updated_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
    };

    const db = getFirestore();
    await db.collection(UPLOAD_SESSIONS_COLLECTION).doc(sessionId).set(session);

    res.status(201).json({ session: buildUploadSessionResponse(session) });
  } catch (err) {
    console.error('[Broadcast] createVideoResumableSession error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function updateVideoUploadSessionProgress(req, res) {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const db = getFirestore();
    const ref = db.collection(UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Upload session not found' });

    const session = snap.data();
    if (!session || session.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not upload owner' });
    }
    if (Number(session.expires_at || 0) > 0 && Number(session.expires_at) < Date.now()) {
      return res.status(410).json({ error: 'Upload session expired. Create a new upload session.' });
    }

    const nextStatus = req.body?.status;
    const allowedStatuses = new Set(['uploading', 'paused', 'failed']);
    const uploadedBytesRaw = req.body?.uploaded_bytes;
    const uploadedBytes = Number.isFinite(Number(uploadedBytesRaw))
      ? Math.max(0, parseInt(uploadedBytesRaw, 10))
      : session.uploaded_bytes || 0;

    const patch = {
      uploaded_bytes: uploadedBytes,
      updated_at: Date.now(),
    };

    if (typeof nextStatus === 'string' && allowedStatuses.has(nextStatus)) {
      patch.status = nextStatus;
    }
    if (typeof req.body?.error === 'string') {
      patch.error = req.body.error.slice(0, 500);
    } else if (patch.status === 'uploading') {
      patch.error = null;
    }

    await ref.update(patch);
    const updated = { ...session, ...patch };
    res.json({ session: buildUploadSessionResponse(updated) });
  } catch (err) {
    console.error('[Broadcast] updateVideoUploadSessionProgress error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function completeVideoResumableSession(req, res) {
  let acquiredFinalizingLock = false;
  try {
    const sessionId = req.body?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const db = getFirestore();
    const ref = db.collection(UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const lockResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { mode: 'not-found' };
      }

      const currentSession = snap.data();
      if (!currentSession || currentSession.creator_uid !== req.userId) {
        return { mode: 'forbidden' };
      }

      if (Number(currentSession.expires_at || 0) > 0 && Number(currentSession.expires_at) < Date.now()) {
        return { mode: 'expired', session: currentSession };
      }

      if (currentSession.status === 'canceled') {
        return { mode: 'canceled', session: currentSession };
      }

      if (currentSession.status === 'finalizing') {
        return { mode: 'in-progress', session: currentSession };
      }

      if (currentSession.status === 'completed' && currentSession.video_id) {
        return { mode: 'completed', session: currentSession };
      }

      tx.update(ref, {
        status: 'finalizing',
        updated_at: Date.now(),
        error: null,
      });
      return {
        mode: 'acquired',
        session: {
          ...currentSession,
          status: 'finalizing',
          error: null,
        },
      };
    });

    if (lockResult.mode === 'not-found') {
      return res.status(404).json({ error: 'Upload session not found' });
    }
    if (lockResult.mode === 'forbidden') {
      return res.status(403).json({ error: 'Not upload owner' });
    }
    if (lockResult.mode === 'expired') {
      return res.status(410).json({ error: 'Upload session expired. Create a new upload session.' });
    }
    if (lockResult.mode === 'canceled') {
      return res.status(409).json({ error: 'Upload session was canceled and cannot be completed.' });
    }
    if (lockResult.mode === 'in-progress') {
      return res.status(409).json({ error: 'Upload finalization already in progress. Please retry shortly.' });
    }

    const session = lockResult.session;
    acquiredFinalizingLock = lockResult.mode === 'acquired';

    if (lockResult.mode === 'completed' && session?.video_id) {
      const existingCompletedVideo = await Video.findById(session.video_id);
      if (existingCompletedVideo) {
        return res.json({ video: existingCompletedVideo, session: buildUploadSessionResponse(session) });
      }
    }

    const ownerCheck = await ensureCreatorAndChannelOwner(req.userId, session.channel_id);
    if (ownerCheck.error) {
      return res.status(ownerCheck.error.status).json({ error: ownerCheck.error.message });
    }

    if (session.video_id) {
      const existingVideo = await Video.findById(session.video_id);
      if (existingVideo) {
        return res.json({ video: existingVideo, session: buildUploadSessionResponse(session) });
      }
    }

    const metadata = await getGCSObjectMetadata(session.filename);
    if (!metadata) {
      return res.status(409).json({ error: 'Upload is not complete yet. Please retry shortly.' });
    }

    const bytes = Number.isFinite(Number(metadata.size)) ? parseInt(metadata.size, 10) : (session.uploaded_bytes || 0);
    let video = await Video.create({
      creatorUid: req.userId,
      channelId: session.channel_id,
      title: session.title,
      description: session.description,
      videoUrl: session.public_url,
      thumbnailUrl: null,
      duration: session.duration ? parseInt(session.duration, 10) : 0,
    });
    video = await prepareAdaptiveVideo(video);

    const patch = {
      status: 'completed',
      uploaded_bytes: bytes,
      video_id: video.id,
      completed_at: Date.now(),
      updated_at: Date.now(),
      error: null,
      upload_url: null,
    };
    await ref.update(patch);

    await NotificationService.notifyUser(req.userId, {
      title: 'Upload completed',
      body: `Your video "${session.title}" was uploaded and added to your library.`,
      type: 'creator_upload_completed',
      link: '/creator-studio',
      data: {
        video_id: video.id,
        channel_id: session.channel_id,
      },
    });

    res.json({ video, session: buildUploadSessionResponse({ ...session, ...patch }) });
  } catch (err) {
    if (acquiredFinalizingLock && req.body?.session_id) {
      try {
        const db = getFirestore();
        await db.collection(UPLOAD_SESSIONS_COLLECTION).doc(req.body.session_id).update({
          status: 'failed',
          error: err.message,
          updated_at: Date.now(),
        });
      } catch {
        // Ignore cleanup errors.
      }
    }
    console.error('[Broadcast] completeVideoResumableSession error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function cancelVideoUploadSession(req, res) {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const db = getFirestore();
    const ref = db.collection(UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Upload session not found' });

    const session = snap.data();
    if (!session || session.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not upload owner' });
    }

    if (session.status === 'completed' || session.video_id) {
      return res.status(409).json({ error: 'Completed upload sessions cannot be canceled.' });
    }
    if (session.status === 'finalizing') {
      return res.status(409).json({ error: 'Upload finalization in progress. Try again shortly.' });
    }

    if (session.status === 'canceled') {
      return res.json({ session: buildUploadSessionResponse(session) });
    }

    const patch = {
      status: 'canceled',
      error: null,
      upload_url: null,
      updated_at: Date.now(),
    };
    await ref.update(patch);

    res.json({ session: buildUploadSessionResponse({ ...session, ...patch }) });
  } catch (err) {
    console.error('[Broadcast] cancelVideoUploadSession error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteVideoUploadSession(req, res) {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const db = getFirestore();
    const ref = db.collection(UPLOAD_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Upload session not found' });

    const session = snap.data();
    if (!session || session.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not upload owner' });
    }

    // Keep active/finalizing sessions immutable for safety.
    if (['initiated', 'uploading', 'paused', 'finalizing'].includes(session.status)) {
      return res.status(409).json({
        error: 'Active upload sessions cannot be deleted. Cancel it first or wait for completion.',
      });
    }

    await ref.delete();
    return res.json({ success: true, session_id: sessionId });
  } catch (err) {
    console.error('[Broadcast] deleteVideoUploadSession error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function getMyVideoUploadSessions(req, res) {
  try {
    const channelId = typeof req.query.channel_id === 'string' ? req.query.channel_id : null;
    const db = getFirestore();
    const snap = await db
      .collection(UPLOAD_SESSIONS_COLLECTION)
      .where('creator_uid', '==', req.userId)
      .get();

    const sessions = snap.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .filter((session) => !channelId || session.channel_id === channelId)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 100)
      .map((session) => buildUploadSessionResponse(session));

    res.json({ sessions });
  } catch (err) {
    console.error('[Broadcast] getMyVideoUploadSessions error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── VIDEO UPLOAD ────────────────────────────────────────

async function uploadVideo(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload videos' });
    }

    const { channel_id, title, description, duration } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }
    if (channel.stream_source_mode && channel.stream_source_mode !== 'native') {
      return res.status(400).json({ error: 'Only native channels support uploaded and scheduled videos' });
    }

    const videoUrl = req.file.gcsUrl;
    let video = await Video.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title,
      description: description.trim(),
      videoUrl,
      thumbnailUrl: null,
      duration: duration ? parseInt(duration, 10) : 0,
    });
    video = await prepareAdaptiveVideo(video);

    await NotificationService.notifyUser(req.userId, {
      title: 'Upload completed',
      body: `Your video "${title}" was uploaded and added to your library.`,
      type: 'creator_upload_completed',
      link: '/creator-studio',
      data: {
        video_id: video.id,
        channel_id: channel_id,
      },
    });

    res.status(201).json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function uploadThumbnail(req, res) {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not video owner' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const thumbnailUrl = req.file.gcsUrl;
    const updated = await Video.update(video.id, { thumbnail_url: thumbnailUrl });
    res.json({ video: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getChannelVideos(req, res) {
  try {
    const videos = await Video.getByChannel(req.params.channelId);
    res.json({ videos: await Promise.all(videos.map(refreshAdaptiveVideo)) });
  } catch (err) {
    console.error('[Broadcast] getChannelVideos error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getMyVideos(req, res) {
  try {
    const videos = await Video.getByCreator(req.userId);
    res.json({ videos: await Promise.all(videos.map(refreshAdaptiveVideo)) });
  } catch (err) {
    console.error('[Broadcast] getMyVideos error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteVideo(req, res) {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.creator_uid !== req.userId) {
      return res.status(403).json({ error: 'Not video owner' });
    }
    await Video.remove(video.id);
    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── AD BREAK BUFFER ─────────────────────────────────────

async function _getAdBufferMs() {
  try {
    const enabled = await SettingsService.get('AD_SCHEDULING_ENABLED');
    if (enabled === 'false' || enabled === false) return 0;
    const seconds = await SettingsService.get('AD_BREAK_BUFFER_SECONDS');
    const parsed = parseInt(seconds, 10);
    return (isNaN(parsed) || parsed <= 0) ? 0 : parsed * 1000;
  } catch {
    return 45000; // default 45s
  }
}

// ─── SCHEDULING ──────────────────────────────────────────

async function scheduleProgram(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { channel_id, video_id, start_time } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });
    if (!start_time) return res.status(400).json({ error: 'start_time is required' });

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const video = await Video.findById(video_id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (video.duration <= 0) {
      return res.status(400).json({ error: 'Video duration must be set before scheduling' });
    }

    const startMs = parseInt(start_time, 10);
    if (isNaN(startMs) || startMs <= 0) {
      return res.status(400).json({ error: 'start_time must be a valid positive timestamp' });
    }

    // Account for ad break buffer
    const adBuffer = await _getAdBufferMs();
    const endMs = startMs + video.duration * 1000 + adBuffer;

    if (await Program.hasOverlap(channel_id, startMs, endMs, null)) {
      return res.status(409).json({ error: 'Schedule overlaps with existing program' });
    }

    const program = await Program.create({
      channelId: channel_id,
      videoId: video_id,
      startTime: startMs,
      endTime: endMs,
    });

    res.status(201).json({
      program: {
        ...program,
        video_title: video.title,
        video_description: video.description || '',
        video_duration: video.duration,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getChannelSchedule(req, res) {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (channel?.stream_source_mode === 'external_url') {
      return res.json({ schedule: [] });
    }

    const schedule = await Program.getSchedule(req.params.channelId);
    const enriched = await Promise.all(schedule.map(async (p) => {
      const video = await Video.findById(p.video_id);
      return {
        ...p,
        video_title: video ? video.title : 'Unknown',
        video_description: video ? (video.description || '') : '',
        video_duration: video ? video.duration : 0,
        video_thumbnail: video ? video.thumbnail_url : null,
      };
    }));
    res.json({ schedule: enriched });
  } catch (err) {
    console.error('[Broadcast] getChannelSchedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteProgram(req, res) {
  try {
    const program = await Program.findById(req.params.programId);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const channel = await Channel.findById(program.channel_id);
    if (!channel || channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    await Program.remove(program.id);
    res.json({ message: 'Program removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── SEQUENTIAL SCHEDULING ───────────────────────────────

async function scheduleSequential(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { channel_id, video_ids, start_time } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return res.status(400).json({ error: 'video_ids must be a non-empty array' });
    }
    if (!start_time) return res.status(400).json({ error: 'start_time is required' });

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    // Validate all videos exist and have duration
    const videos = [];
    for (const videoId of video_ids) {
      const video = await Video.findById(videoId);
      if (!video) return res.status(404).json({ error: `Video ${videoId} not found` });
      if (video.duration <= 0) {
        return res.status(400).json({ error: `Video "${video.title}" has no duration set` });
      }
      videos.push(video);
    }

    // Chain programs: next start = previous end
    let currentStart = parseInt(start_time, 10);
    if (isNaN(currentStart) || currentStart <= 0) {
      return res.status(400).json({ error: 'start_time must be a valid positive timestamp' });
    }

    // Get ad break buffer for inter-program gaps
    const adBuffer = await _getAdBufferMs();
    const created = [];

    for (const video of videos) {
      const endMs = currentStart + video.duration * 1000;

      if (await Program.hasOverlap(channel_id, currentStart, endMs, null)) {
        return res.status(409).json({
          error: `Schedule overlap for "${video.title}" at slot ${new Date(currentStart).toISOString()}`,
          created_so_far: created.length,
        });
      }

      const program = await Program.create({
        channelId: channel_id,
        videoId: video.id,
        startTime: currentStart,
        endTime: endMs,
      });

      created.push({
        ...program,
        video_title: video.title,
        video_description: video.description || '',
        video_duration: video.duration,
      });

      currentStart = endMs + adBuffer; // add ad break buffer between programs
    }

    res.status(201).json({ programs: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── PLAYBACK (VIEWER) ──────────────────────────────────

async function streamAdaptiveAsset(req, res) {
  try {
    const rawAssetPath = Array.isArray(req.params.assetPath)
      ? req.params.assetPath.join('/')
      : String(req.params.assetPath || '');
    const assetPath = rawAssetPath.replace(/\\/g, '/');
    if (!assetPath || assetPath.includes('..') || assetPath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid adaptive stream asset path' });
    }

    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const objectPath = `${video.hls_output_prefix || TranscoderService.getOutputPrefix(video.id)}/${assetPath}`;
    const file = getBucket().file(objectPath);
    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch (error) {
      if (error.code === 404) return res.status(404).json({ error: 'Adaptive stream asset not found' });
      throw error;
    }

    const size = Number(metadata.size || 0);
    const range = req.headers.range;
    let start;
    let end;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return res.status(416).end();
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : size - 1;
      if (start >= size || end >= size || start > end) return res.status(416).end();
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
    } else if (size > 0) {
      res.setHeader('Content-Length', size);
    }

    const extension = path.extname(assetPath).toLowerCase();
    const contentTypes = {
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
      '.m4s': 'video/iso.segment',
      '.mp4': 'video/mp4',
      '.aac': 'audio/aac',
    };
    res.setHeader('Content-Type', metadata.contentType || contentTypes[extension] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', extension === '.m3u8' ? 'public, max-age=30' : 'public, max-age=31536000, immutable');

    const requestedQuality = Number(req.query.quality || 0);
    if (extension === '.m3u8' && assetPath === 'master.m3u8' && requestedQuality > 0) {
      const [buffer] = await file.download();
      const lines = buffer.toString('utf8').split(/\r?\n/);
      const output = [];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith('#EXT-X-STREAM-INF:')) {
          output.push(line);
          continue;
        }
        const resolution = /RESOLUTION=\d+x(\d+)/i.exec(line);
        const height = resolution ? Number(resolution[1]) : 0;
        const uri = lines[index + 1];
        if (height === requestedQuality && uri) {
          output.push(line, uri);
        }
        index += 1;
      }
      const body = output.join('\n');
      res.status(200);
      res.removeHeader('Content-Range');
      res.setHeader('Content-Length', Buffer.byteLength(body));
      return res.send(body);
    }

    const stream = file.createReadStream({
      ...(start !== undefined ? { start } : {}),
      ...(end !== undefined ? { end } : {}),
    });
    stream.on('error', (error) => {
      console.error(`[Broadcast] HLS stream error ${objectPath}:`, error.message);
      if (!res.headersSent) res.status(500).json({ error: 'Unable to stream adaptive asset' });
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    console.error('[Broadcast] streamAdaptiveAsset error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to stream adaptive asset' });
    }
  }
}

async function getNowPlaying(req, res) {
  try {
    const channelId = req.params.channelId;
    const serverTime = Date.now();

    // Single canonical source: the full schedule. This guarantees the player
    // and the program guide never disagree about what is currently live.
    const schedule = await Program.getSchedule(channelId);

    const {
      activeProgram,
      upcomingProgram,
      chosenProgram,
      reason,
      isLoop,
    } = resolveScheduleState(schedule, serverTime);

    // Synchronize status transitions after the resolver has chosen the program.
    if (activeProgram && activeProgram.status === 'scheduled') {
      await Program.updateStatus(activeProgram.id, 'live');
    }
    await _markEndedPrograms(channelId, serverTime);

    if (chosenProgram) {
      let video = await Video.findById(chosenProgram.video_id);
      if (!video) {
        console.warn(`[Scheduler] channelId=${channelId} now=${serverTime} chosenProgram=${chosenProgram.id} status=${chosenProgram.status} reason=${reason} videoMissing=${chosenProgram.video_id}`);
        return res.json({
          now_playing: null,
          next_program: upcomingProgram ? await enrichProgram(upcomingProgram) : null,
          server_time: serverTime,
          scheduler_state: { reason, program_id: chosenProgram.id, video_missing: true },
        });
      }

      video = await refreshAdaptiveVideo(video);

      let positionSec = 0;
      if (isLoop) {
        const elapsedMs = serverTime - chosenProgram.end_time;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        positionSec = video.duration > 0 ? elapsedSec % video.duration : 0;
      } else {
        const positionMs = serverTime - chosenProgram.start_time;
        positionSec = Math.max(0, Math.floor(positionMs / 1000));
      }

      const playbackSource = video.transcoding_status === 'ready' && video.master_playlist_url
        ? video.master_playlist_url
        : video.video_url;
      const playableVideoUrl = playbackSource.startsWith('/broadcast/hls/')
        ? playbackSource
        : await resolvePlayableVideoUrl(playbackSource);

      console.log(`[Scheduler] channelId=${channelId} now=${serverTime} chosenProgram=${chosenProgram.id} status=${chosenProgram.status} reason=${reason} videoId=${video.id}`);

      return res.json({
        now_playing: {
          program_id: chosenProgram.id,
          channel_id: chosenProgram.channel_id,
          video_id: video.id,
          video_url: playableVideoUrl,
          video_title: video.title,
          video_description: video.description || '',
          thumbnail_url: video.thumbnail_url,
          duration: video.duration,
          start_time: chosenProgram.start_time,
          end_time: chosenProgram.end_time,
          position: positionSec,
          is_loop: isLoop,
          adaptive: playbackSource === video.master_playlist_url,
          available_renditions: video.available_renditions || [],
          transcoding_status: video.transcoding_status || 'unavailable',
        },
        next_program: upcomingProgram ? await enrichProgram(upcomingProgram) : null,
        server_time: serverTime,
        scheduler_state: { reason, program_id: chosenProgram.id },
      });
    }

    console.log(`[Scheduler] channelId=${channelId} now=${serverTime} reason=${reason} upcomingProgram=${upcomingProgram?.id || 'none'}`);
    return res.json({
      now_playing: null,
      next_program: upcomingProgram ? await enrichProgram(upcomingProgram) : null,
      server_time: serverTime,
      scheduler_state: upcomingProgram
        ? { reason, program_id: upcomingProgram.id }
        : { reason },
    });
  } catch (err) {
    console.error('[Broadcast] getNowPlaying error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Helper: mark the most recently-ended live program as ended without scanning the full schedule
async function _markEndedPrograms(channelId, serverTime) {
  const lastEnded = await Program.getLastEnded(channelId);
  if (lastEnded && lastEnded.status === 'live' && serverTime >= lastEnded.end_time) {
    await Program.updateStatus(lastEnded.id, 'ended');
  }
}

async function enrichProgram(program) {
  const video = await Video.findById(program.video_id);
  return {
    program_id: program.id,
    video_title: video ? video.title : 'Unknown',
    video_description: video ? (video.description || '') : '',
    video_duration: video ? video.duration : 0,
    thumbnail_url: video ? video.thumbnail_url : null,
    start_time: program.start_time,
    end_time: program.end_time,
  };
}

// ─── GO-LIVE TRIGGER ────────────────────────────────────────────────────────

/**
 * POST /broadcast/go-live
 * Creator signals they are going live on a channel.
 * Triggers FCM push to all active subscribers (debounced 60s per channel).
 */
async function goLive(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can go live' });
    }

    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your channel' });
    }

    const activeStream = await StreamStats.getActiveByChannel(channel_id);
    let stream = activeStream;
    if (!stream) {
      stream = await StreamStats.startStream({
        creatorUid: channel.owner_id,
        channelId: channel_id,
      });
      await CreatorDailyStats.incrementStreams(channel.owner_id);
    }

    const result = await LiveTrigger.onCreatorGoLive(req.userId, channel_id);
    res.json({
      success: true,
      notified: result.notified,
      skipped: result.skipped,
      stream_started: !activeStream,
      stream_id: stream?.id || null,
    });
  } catch (err) {
    console.error('[Broadcast] goLive error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── SERVER TIME ─────────────────────────────────────────

function getServerTime(_req, res) {
  res.json({ server_time: Date.now() });
}

// ─── UPCOMING ALL CHANNELS (PUBLIC) ──────────────────────

async function getUpcomingAll(_req, res) {
  try {
    const programs = await Program.getUpcomingAll(12);
    const enriched = await Promise.all(programs.map(async (p) => {
      const video = await Video.findById(p.video_id);
      const channel = await Channel.findById(p.channel_id);
      return {
        id: p.id,
        channel_id: p.channel_id,
        channel_name: channel ? channel.name : 'Unknown',
        channel_category: channel ? channel.category : '',
        video_title: video ? video.title : 'Unknown',
        video_description: video ? (video.description || '') : '',
        video_thumbnail: video ? video.thumbnail_url : null,
        start_time: p.start_time,
        end_time: p.end_time,
      };
    }));
    res.json({ upcoming: enriched });
  } catch (err) {
    console.error('[Broadcast] getUpcomingAll error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── REMINDERS ───────────────────────────────────────────

async function createReminder(req, res) {
  try {
    const { program_id } = req.body;
    if (!program_id) return res.status(400).json({ error: 'program_id is required' });

    const program = await Program.findById(program_id);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const existing = await Reminder.getByProgramAndUser(program_id, req.userId);
    if (existing) return res.status(409).json({ error: 'Reminder already set' });

    const video = await Video.findById(program.video_id);
    const channel = await Channel.findById(program.channel_id);

    // Send notification 2 minutes before start, or now if less than 2 min away
    const sendAt = Math.max(Date.now(), program.start_time - 2 * 60 * 1000);

    const reminder = await Reminder.create({
      userId: req.userId,
      programId: program_id,
      channelId: program.channel_id,
      programTitle: video ? video.title : 'Upcoming Show',
      channelName: channel ? channel.name : '',
      sendAt,
    });

    res.status(201).json({ reminder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeReminder(req, res) {
  try {
    const removed = await Reminder.remove(req.userId, req.params.programId);
    if (!removed) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ message: 'Reminder removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyReminders(req, res) {
  const reminders = await Reminder.getByUser(req.userId);
  res.json({ reminders });
}

// ─── FLASH SCREEN TTS ────────────────────────────────────────────

async function getFlashAudio(req, res) {
  try {
    const { type, title, channel_name } = req.query;
    if (!type || !title) {
      return res.status(400).json({ error: 'type and title are required' });
    }
    if (!['coming_up', 'now_playing'].includes(type)) {
      return res.status(400).json({ error: 'type must be coming_up or now_playing' });
    }
    const audio = await generateFlashAudio(type, title, channel_name);
    if (!audio) {
      return res.status(204).end(); // No TTS available
    }
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'public, max-age=3600',
    });
    return res.send(audio);
  } catch (err) {
    console.error('[FlashAudio] error:', err);
    return res.status(500).json({ error: 'TTS generation failed' });
  }
}

module.exports = {
  getVideoUploadUrl,
  createVideoResumableSession,
  updateVideoUploadSessionProgress,
  completeVideoResumableSession,
  getMyVideoUploadSessions,
  cancelVideoUploadSession,
  registerUploadedVideo,
  uploadVideo,
  uploadThumbnail,
  getChannelVideos,
  getMyVideos,
  deleteVideo,
  scheduleProgram,
  scheduleSequential,
  getChannelSchedule,
  deleteProgram,
  streamAdaptiveAsset,
  getNowPlaying,
  getServerTime,
  goLive,
  getUpcomingAll,
  createReminder,
  removeReminder,
  getMyReminders,
  getFlashAudio,
  deleteVideoUploadSession,
};
