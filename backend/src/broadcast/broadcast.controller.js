const Video = require('./video.model');
const Program = require('./program.model');
const Reminder = require('./reminder.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const LiveTrigger = require('../channels/live_trigger');
const CreatorDailyStats = require('../analytics/creator_daily_stats.model');
const StreamStats = require('../analytics/stream_stats.model');
const NotificationService = require('../notifications/notification.service');
const { sendReminderEmail } = require('../utils/email');
const { generateFlashAudio } = require('../utils/tts');
const SettingsService = require('../admin/settings.service');
const crypto = require('crypto');
const path = require('path');
const { generateSignedUploadUrl } = require('../utils/gcs');

// ─── SIGNED UPLOAD URL (Direct-to-GCS) ──────────────────

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/webm': '.webm',
};

async function getVideoUploadUrl(req, res) {
  try {
    const user = User.findById(req.userId);
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
    res.status(500).json({ error: err.message });
  }
}

async function registerUploadedVideo(req, res) {
  try {
    const user = User.findById(req.userId);
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

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const video = await Video.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title,
      description: description.trim(),
      videoUrl: video_url,
      thumbnailUrl: null,
      duration: duration ? parseInt(duration, 10) : 0,
    });

    res.status(201).json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── VIDEO UPLOAD ────────────────────────────────────────

async function uploadVideo(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload videos' });
    }

    const { channel_id, title, description, duration } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const videoUrl = req.file.gcsUrl;
    const video = await Video.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title,
      description: description.trim(),
      videoUrl,
      thumbnailUrl: null,
      duration: duration ? parseInt(duration, 10) : 0,
    });

    res.status(201).json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function uploadThumbnail(req, res) {
  try {
    const video = Video.findById(req.params.videoId);
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

function getChannelVideos(req, res) {
  const videos = Video.getByChannel(req.params.channelId);
  res.json({ videos });
}

function getMyVideos(req, res) {
  const videos = Video.getByCreator(req.userId);
  res.json({ videos });
}

async function deleteVideo(req, res) {
  try {
    const video = Video.findById(req.params.videoId);
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
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { channel_id, video_id, start_time } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });
    if (!start_time) return res.status(400).json({ error: 'start_time is required' });

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const video = Video.findById(video_id);
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

    if (Program.hasOverlap(channel_id, startMs, endMs, null)) {
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

function getChannelSchedule(req, res) {
  const schedule = Program.getSchedule(req.params.channelId);
  const enriched = schedule.map((p) => {
    const video = Video.findById(p.video_id);
    return {
      ...p,
      video_title: video ? video.title : 'Unknown',
      video_description: video ? (video.description || '') : '',
      video_duration: video ? video.duration : 0,
      video_thumbnail: video ? video.thumbnail_url : null,
    };
  });
  res.json({ schedule: enriched });
}

async function deleteProgram(req, res) {
  try {
    const program = Program.findById(req.params.programId);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const channel = Channel.findById(program.channel_id);
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
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { channel_id, video_ids, start_time } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return res.status(400).json({ error: 'video_ids must be a non-empty array' });
    }
    if (!start_time) return res.status(400).json({ error: 'start_time is required' });

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    // Validate all videos exist and have duration
    const videos = [];
    for (const videoId of video_ids) {
      const video = Video.findById(videoId);
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

      if (Program.hasOverlap(channel_id, currentStart, endMs, null)) {
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

function getNowPlaying(req, res) {
  const channelId = req.params.channelId;
  const serverTime = Date.now();
  let program = Program.getCurrentProgram(channelId);

  // Auto-status: scheduled → live
  if (program && program.status === 'scheduled') {
    Program.updateStatus(program.id, 'live');
  }

  if (program) {
    const video = Video.findById(program.video_id);
    if (!video) {
      return res.json({ now_playing: null, next_program: null, server_time: serverTime });
    }

    const positionMs = serverTime - program.start_time;
    const positionSec = Math.max(0, Math.floor(positionMs / 1000));
    const upcoming = Program.getUpcoming(channelId, 1);

    return res.json({
      now_playing: {
        program_id: program.id,
        channel_id: program.channel_id,
        video_id: video.id,
        video_url: video.video_url,
        video_title: video.title,
        video_description: video.description || '',
        thumbnail_url: video.thumbnail_url,
        duration: video.duration,
        start_time: program.start_time,
        end_time: program.end_time,
        position: positionSec,
        is_loop: false,
      },
      next_program: upcoming.length > 0 ? enrichProgram(upcoming[0]) : null,
      server_time: serverTime,
    });
  }

  // No current program — check upcoming
  const upcoming = Program.getUpcoming(channelId, 1);
  if (upcoming.length > 0) {
    // Auto-status: mark past live programs as ended
    _markEndedPrograms(channelId, serverTime);
    return res.json({
      now_playing: null,
      next_program: enrichProgram(upcoming[0]),
      server_time: serverTime,
    });
  }

  // No upcoming — fallback: loop last ended video
  const lastEnded = Program.getLastEnded(channelId);
  if (lastEnded) {
    const video = Video.findById(lastEnded.video_id);
    if (video && video.duration > 0) {
      // Wrap position around video duration for seamless loop
      const elapsedMs = serverTime - lastEnded.end_time;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const loopPosition = elapsedSec % video.duration;

      return res.json({
        now_playing: {
          program_id: lastEnded.id,
          channel_id: lastEnded.channel_id,
          video_id: video.id,
          video_url: video.video_url,
          video_title: video.title,
          video_description: video.description || '',
          thumbnail_url: video.thumbnail_url,
          duration: video.duration,
          start_time: lastEnded.start_time,
          end_time: lastEnded.end_time,
          position: loopPosition,
          is_loop: true,
        },
        next_program: null,
        server_time: serverTime,
      });
    }
  }

  // Truly nothing to play
  _markEndedPrograms(channelId, serverTime);
  res.json({ now_playing: null, next_program: null, server_time: serverTime });
}

// Helper: mark past live programs as ended
function _markEndedPrograms(channelId, serverTime) {
  const schedule = Program.getSchedule(channelId);
  for (const p of schedule) {
    if (p.status === 'live' && serverTime >= p.end_time) {
      Program.updateStatus(p.id, 'ended');
    }
  }
}

function enrichProgram(program) {
  const video = Video.findById(program.video_id);
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
    const user = User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can go live' });
    }

    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your channel' });
    }

    const activeStream = StreamStats.getActiveByChannel(channel_id);
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

function getUpcomingAll(_req, res) {
  const programs = Program.getUpcomingAll(12);
  const enriched = programs.map((p) => {
    const video = Video.findById(p.video_id);
    const channel = Channel.findById(p.channel_id);
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
  });
  res.json({ upcoming: enriched });
}

// ─── REMINDERS ───────────────────────────────────────────

async function createReminder(req, res) {
  try {
    const { program_id } = req.body;
    if (!program_id) return res.status(400).json({ error: 'program_id is required' });

    const program = Program.findById(program_id);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const existing = Reminder.getByProgramAndUser(program_id, req.userId);
    if (existing) return res.status(409).json({ error: 'Reminder already set' });

    const video = Video.findById(program.video_id);
    const channel = Channel.findById(program.channel_id);

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

function getMyReminders(req, res) {
  const reminders = Reminder.getByUser(req.userId);
  res.json({ reminders });
}

// ─── REMINDER CHECK TIMER ────────────────────────────────

let _reminderInterval = null;

function startReminderTimer() {
  if (_reminderInterval) return;
  _reminderInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const due = Reminder.getDueReminders(now);
      for (const reminder of due) {
        await NotificationService.notifyUser(reminder.user_id, {
          title: '🔔 Show Starting Soon!',
          body: `"${reminder.program_title}" on ${reminder.channel_name} is about to start!`,
          type: 'reminder',
          link: `/live/${reminder.channel_id}`,
          data: {
            program_id: reminder.program_id,
            channel_id: reminder.channel_id,
          },
        });
        // Also send email reminder
        const user = User.findById(reminder.user_id);
        if (user && user.email && !user.email.endsWith('@afrovision.invalid')) {
          sendReminderEmail({
            to: user.email,
            programTitle: reminder.program_title,
            channelName: reminder.channel_name,
            channelId: reminder.channel_id,
          }).catch((err) => console.error('[Reminder] Email error:', err.message));
        }
        await Reminder.markSent(reminder.id);
      }
    } catch (err) {
      console.error('[Reminder] Timer error:', err.message);
    }
  }, 30_000); // check every 30 seconds
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
  getNowPlaying,
  getServerTime,
  goLive,
  getUpcomingAll,
  createReminder,
  removeReminder,
  getMyReminders,
  startReminderTimer,
  getFlashAudio,
};
