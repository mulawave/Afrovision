/**
 * Watch Progress Controller
 * Endpoints for saving and retrieving user watch progress.
 */

const Progress = require('./progress.model');

const VALID_MEDIA_TYPES = ['movie', 'episode'];

exports.saveProgress = async (req, res) => {
  try {
    const { mediaType, mediaId } = req.params;
    const { position_seconds, duration_seconds } = req.body;

    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be "movie" or "episode"' });
    }

    if (typeof position_seconds !== 'number' || position_seconds < 0) {
      return res.status(400).json({ error: 'position_seconds must be a non-negative number' });
    }

    if (typeof duration_seconds !== 'number' || duration_seconds < 0) {
      return res.status(400).json({ error: 'duration_seconds must be a non-negative number' });
    }

    const data = await Progress.saveProgress(
      req.userId,
      mediaType,
      mediaId,
      position_seconds,
      duration_seconds,
    );

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const { mediaType, mediaId } = req.params;

    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be "movie" or "episode"' });
    }

    const data = await Progress.getProgress(req.userId, mediaType, mediaId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
