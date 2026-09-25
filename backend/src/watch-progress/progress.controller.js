/**
 * Watch Progress Controller
 * Endpoints for saving and retrieving user watch progress.
 */

const Progress = require('./progress.model');
const Movie = require('../movies/movie.model');
const Series = require('../series/series.model');

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

/**
 * GET /watch-progress/me
 * Returns the caller's most-recently-updated in-progress media, joined with
 * movie or series metadata for immediate rendering (Continue Watching rail).
 */
exports.listMine = async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, requestedLimit))
      : 20;

    const progresses = await Progress.listMine(req.userId, { limit });
    if (progresses.length === 0) {
      return res.json({ success: true, data: { items: [] } });
    }

    // Join with the underlying media. Series episodes resolve up to the parent
    // series card so the rail always points at a poster-bearing entity.
    const items = [];
    for (const p of progresses) {
      try {
        if (p.media_type === 'movie') {
          const movie = await Movie.findById(p.media_id);
          if (!movie) continue;
          items.push({
            media_type: 'movie',
            movie_id: movie.id,
            channel_id: movie.channel_id || null,
            title: movie.title || '',
            poster_url: movie.poster_url || null,
            position_seconds: Number(p.position_seconds) || 0,
            duration_seconds: Number(p.duration_seconds) || 0,
            updated_at: Number(p.updated_at) || 0,
          });
        } else if (p.media_type === 'episode') {
          const episode = await Series.findEpisodeById(p.media_id);
          if (!episode) continue;
          const series = episode.series_id
            ? await Series.findSeriesById(episode.series_id)
            : null;
          if (!series) continue;
          items.push({
            media_type: 'episode',
            series_id: series.id,
            // Clients need the channel to fetch the episode: episode detail
            // is only exposed channel-scoped (series.routes.js).
            channel_id: series.channel_id || null,
            episode_id: episode.id,
            title: series.title || '',
            episode_title: episode.title || '',
            poster_url: series.cover_url || episode.poster_url || null,
            position_seconds: Number(p.position_seconds) || 0,
            duration_seconds: Number(p.duration_seconds) || 0,
            updated_at: Number(p.updated_at) || 0,
          });
        }
      } catch (_) { /* skip broken row */ }
    }

    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error('[WatchProgress] listMine:', err.message);
    res.status(500).json({ error: 'Failed to load watch progress' });
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
