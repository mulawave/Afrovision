const crypto = require('crypto');
const path = require('path');
const Wave = require('./wave.model');
const WavePulse = require('./wave.pulse.model');
const WaveComment = require('./wave.comment.model');
const WaveBookmark = require('./wave.bookmark.model');
const Channel = require('../channels/channel.model');
const User = require('../users/user.model');
const { generateSignedUploadUrl, generateSignedReadUrl, extractGCSPath } = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const INTEREST_COLLECTION = 'wave_interest_signals';
const REPORTS_COLLECTION = 'wave_reports';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolvePlayableUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  const gcsPath = extractGCSPath(rawUrl);
  if (!gcsPath) return rawUrl;
  try {
    return await generateSignedReadUrl(gcsPath, 120);
  } catch {
    return rawUrl;
  }
}

async function enrichWave(wave, userId = null) {
  const signed = { ...wave, video_url: await resolvePlayableUrl(wave.video_url) };
  if (userId) {
    const [bookmark, { total: pulseCount }] = await Promise.all([
      WaveBookmark.getStatus(wave.id, userId),
      WavePulse.getPulseStats(wave.id),
    ]);
    signed.is_bookmarked = bookmark.bookmarked;
    signed.pulse_count = pulseCount;
  }
  return signed;
}

async function ensureChannelOwner(userId, channelId) {
  const user = await User.findById(userId);
  if (!user) return { error: { status: 404, message: 'User not found' } };
  if (user.role !== 'creator' && user.role !== 'admin') {
    return { error: { status: 403, message: 'Only creators can manage waves' } };
  }
  const channel = await Channel.findById(channelId);
  if (!channel) return { error: { status: 404, message: 'Channel not found' } };
  if (channel.owner_id !== userId && user.role !== 'admin') {
    return { error: { status: 403, message: 'Not channel owner' } };
  }
  return { user, channel };
}

// ─── Upload URL ──────────────────────────────────────────────────────────────

async function getWaveUploadUrl(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload waves' });
    }

    const { content_type, channel_id } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    if (!ALLOWED_VIDEO_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported type: ${content_type}. Allowed: ${Object.keys(ALLOWED_VIDEO_TYPES).join(', ')}`,
      });
    }

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const ext = ALLOWED_VIDEO_TYPES[content_type];
    const filename = `waves/${crypto.randomUUID()}${ext}`;
    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, content_type, 60);
    res.json({ signed_url: signedUrl, public_url: publicUrl, filename });
  } catch (err) {
    console.error('[Wave] getWaveUploadUrl:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

async function registerWave(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'creator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only creators can upload waves' });
    }

    const { channel_id, title, description, video_url, thumbnail_url, duration } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (!video_url) return res.status(400).json({ error: 'video_url is required' });

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not channel owner' });
    }

    const wave = await Wave.create({
      creatorUid: req.userId,
      channelId: channel_id,
      title: title.trim(),
      description: description || '',
      videoUrl: video_url,
      thumbnailUrl: thumbnail_url || null,
      duration: duration || 0,
    });

    res.status(201).json(wave);
  } catch (err) {
    console.error('[Wave] registerWave:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Feed ────────────────────────────────────────────────────────────────────

async function getFeed(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const waves = await Wave.getFeed({ limit, cursor });
    const userId = req.userId || null;
    const enriched = await Promise.all(waves.map((w) => enrichWave(w, userId)));
    const nextCursor = enriched.length === limit ? enriched[enriched.length - 1].id : null;
    res.json({ waves: enriched, next_cursor: nextCursor });
  } catch (err) {
    console.error('[Wave] getFeed:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Single wave ─────────────────────────────────────────────────────────────

async function getWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const userId = req.userId || null;
    res.json(await enrichWave(wave, userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Channel waves ───────────────────────────────────────────────────────────

async function getChannelWaves(req, res) {
  try {
    const includeHidden = String(req.query.include_hidden || '').toLowerCase() === 'true';
    if (includeHidden) {
      if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
      const permission = await ensureChannelOwner(req.userId, req.params.channelId);
      if (permission.error) {
        return res.status(permission.error.status).json({ error: permission.error.message });
      }
    }

    const waves = await Wave.getByChannel(req.params.channelId, { includeHidden });
    res.json(waves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function deleteWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (wave.creator_uid !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Wave.remove(wave.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function setTimelineVisibility(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const hidden = req.body?.hidden;
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const permission = await ensureChannelOwner(req.userId, wave.channel_id);
    if (permission.error) {
      return res.status(permission.error.status).json({ error: permission.error.message });
    }

    await Wave.updateStatus(wave.id, hidden ? 'hidden' : 'active');
    const updated = await Wave.findById(wave.id);
    return res.json({ success: true, wave: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function bulkDeleteWaves(req, res) {
  try {
    const waveIds = Array.isArray(req.body?.wave_ids) ? req.body.wave_ids : [];
    const uniqueIds = [...new Set(waveIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: 'wave_ids is required' });
    }
    if (uniqueIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 wave_ids per request' });
    }

    const deleted_ids = [];
    const failed = {};

    for (const waveId of uniqueIds) {
      try {
        const wave = await Wave.findById(waveId);
        if (!wave || wave.status === 'deleted') {
          failed[waveId] = 'Wave not found';
          continue;
        }

        const permission = await ensureChannelOwner(req.userId, wave.channel_id);
        if (permission.error) {
          failed[waveId] = permission.error.message;
          continue;
        }

        await Wave.remove(wave.id);
        deleted_ids.push(wave.id);
      } catch (err) {
        failed[waveId] = err.message || 'Failed to delete wave';
      }
    }

    return res.json({
      success: true,
      requested_count: uniqueIds.length,
      deleted_count: deleted_ids.length,
      deleted_ids,
      failed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function bulkSetTimelineVisibility(req, res) {
  try {
    const waveIds = Array.isArray(req.body?.wave_ids) ? req.body.wave_ids : [];
    const hidden = req.body?.hidden;

    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const uniqueIds = [...new Set(waveIds.filter((id) => typeof id === 'string' && id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: 'wave_ids is required' });
    }
    if (uniqueIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 wave_ids per request' });
    }

    const updated_ids = [];
    const failed = {};

    for (const waveId of uniqueIds) {
      try {
        const wave = await Wave.findById(waveId);
        if (!wave || wave.status === 'deleted') {
          failed[waveId] = 'Wave not found';
          continue;
        }

        const permission = await ensureChannelOwner(req.userId, wave.channel_id);
        if (permission.error) {
          failed[waveId] = permission.error.message;
          continue;
        }

        await Wave.updateStatus(wave.id, hidden ? 'hidden' : 'active');
        updated_ids.push(wave.id);
      } catch (err) {
        failed[waveId] = err.message || 'Failed to update wave';
      }
    }

    return res.json({
      success: true,
      requested_count: uniqueIds.length,
      updated_count: updated_ids.length,
      updated_ids,
      hidden,
      failed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Pulse ───────────────────────────────────────────────────────────────────

async function addPulse(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const intensity = Math.min(Math.max(parseInt(req.body.intensity) || 1, 1), 3);
    const momentSeconds = parseFloat(req.body.moment_seconds) || 0;

    const pulse = await WavePulse.addPulse(wave.id, req.userId, intensity, momentSeconds);
    if (!pulse) return res.status(429).json({ error: 'Daily pulse limit reached for this wave' });

    // Update wave counters and score
    await Wave.incrementField(wave.id, 'pulse_count', 1);
    const { weightedScore } = await WavePulse.getPulseStats(wave.id);
    await Wave.updatePulseScore(wave.id, weightedScore);

    res.json({ success: true, pulse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Pulse moments ───────────────────────────────────────────────────────────

async function getPulseMoments(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const moments = await WavePulse.getPulseMoments(wave.id);
    res.json({ moments, duration: wave.duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

async function getComments(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const comments = await WaveComment.getComments(wave.id);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postComment(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

    const comment = await WaveComment.addComment(
      wave.id,
      req.userId,
      user.display_name || user.username || 'Viewer',
      user.avatar_url || null,
      text
    );

    await Wave.incrementField(wave.id, 'comment_count', 1);
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteComment(req, res) {
  try {
    const comment = await WaveComment.findComment(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (comment.user_id !== req.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await WaveComment.deleteComment(comment.id);
    await Wave.incrementField(req.params.waveId, 'comment_count', -1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

async function toggleBookmark(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const result = await WaveBookmark.toggle(wave.id, req.userId);
    await Wave.incrementField(wave.id, 'bookmark_count', result.bookmarked ? 1 : -1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBookmarkStatus(req, res) {
  try {
    const status = await WaveBookmark.getStatus(req.params.waveId, req.userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyBookmarks(req, res) {
  try {
    const bookmarks = await WaveBookmark.getMyBookmarks(req.userId);
    // Fetch wave details for each bookmark
    const waves = await Promise.all(
      bookmarks.map(async (b) => {
        const w = await Wave.findById(b.wave_id);
        return w && w.status === 'active' ? enrichWave(w, req.userId) : null;
      })
    );
    res.json(waves.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Interest signal ─────────────────────────────────────────────────────────

async function setInterest(req, res) {
  try {
    const { signal } = req.body;
    if (!['interested', 'not_interested'].includes(signal)) {
      return res.status(400).json({ error: 'signal must be "interested" or "not_interested"' });
    }
    const db = getFirestore();
    const id = `${req.userId}_${req.params.waveId}`;
    await db.collection(INTEREST_COLLECTION).doc(id).set({
      id,
      wave_id: req.params.waveId,
      user_id: req.userId,
      signal,
      created_at: Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

async function reportWave(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });

    const db = getFirestore();
    const id = crypto.randomUUID();
    await db.collection(REPORTS_COLLECTION).doc(id).set({
      id,
      wave_id: wave.id,
      reporter_uid: req.userId,
      reason: req.body.reason || 'no reason provided',
      created_at: Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── View tracking ───────────────────────────────────────────────────────────

async function trackView(req, res) {
  try {
    const wave = await Wave.findById(req.params.waveId);
    if (!wave || wave.status === 'deleted') return res.status(404).json({ error: 'Wave not found' });
    const userKey = req.userId || (req.ip || '').replace(/:/g, '_').slice(-20);
    await Wave.trackView(wave.id, userKey);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getWaveUploadUrl,
  registerWave,
  getFeed,
  getWave,
  getChannelWaves,
  deleteWave,
  setTimelineVisibility,
  bulkDeleteWaves,
  bulkSetTimelineVisibility,
  addPulse,
  getPulseMoments,
  getComments,
  postComment,
  deleteComment,
  toggleBookmark,
  getBookmarkStatus,
  getMyBookmarks,
  setInterest,
  reportWave,
  trackView,
};
