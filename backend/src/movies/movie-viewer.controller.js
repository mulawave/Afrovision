/**
 * Movie Viewer Controller
 * Public/channel-scoped read endpoints for movies.
 */

const Movie = require('./movie.model');
const Channel = require('../channels/channel.model');
const { resolvePlayableUrl } = require('../utils/gcs');
const { isPublicNonExclusiveChannel } = require('./movie.service');
const { checkChannelAccess } = require('../utils/exclusive-access-helper');

/**
 * GET /channels/:channelId/movies
 * Published movies for a single channel. Enforces exclusive channel access
 * for channels with exclusive_monthly_fee_ngn > 0.
 */
exports.listChannelMovies = async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!channel.is_active) return res.status(404).json({ error: 'Channel not found' });

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const movies = await Movie.listByChannel(channelId, { onlyPublished: true });
    res.json({ success: true, data: { movies } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMovieDetail = async (req, res) => {
  try {
    const { channelId, movieId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.is_active) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const movie = await Movie.findById(movieId);
    if (!movie || movie.channel_id !== channelId || movie.status !== 'published') {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.hls_url) movie.hls_url = await resolvePlayableUrl(movie.hls_url);
    if (movie.hosted_url) movie.hosted_url = await resolvePlayableUrl(movie.hosted_url);

    res.json({ success: true, data: { movie } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /movies/:movieId
 * Direct movie detail by ID. Used by the website public movie page.
 * Allows the channel owner/admins to preview draft movies.
 */
exports.getMovieById = async (req, res) => {
  try {
    const { movieId } = req.params;
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const channel = await Channel.findById(movie.channel_id);
    if (!channel || !channel.is_active) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const isOwnerOrAdmin = req.userId && (req.userRole === 'admin' || channel.owner_id === req.userId);
    if (movie.status !== 'published' && !isOwnerOrAdmin) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.hls_url) movie.hls_url = await resolvePlayableUrl(movie.hls_url);
    if (movie.hosted_url) movie.hosted_url = await resolvePlayableUrl(movie.hosted_url);

    res.json({ success: true, data: { movie } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /movies
 * Global public feed — aggregates published movies from public,
 * non-exclusive channels only. Used by the website Media Center menu and
 * the TV app's Movies tab.
 */
exports.listPublicMovies = async (req, res) => {
  try {
    const { page = 1, limit = 24 } = req.query;
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));

    const publicChannels = await Channel.getPublicChannels();
    const eligibleChannelIds = publicChannels
      .filter((ch) => isPublicNonExclusiveChannel(ch))
      .map((ch) => ch.id);

    const result = await Movie.listPublicFeed({
      page: pageNumber,
      limit: limitNumber,
      publicChannelIds: eligibleChannelIds,
    });

    res.json({
      success: true,
      data: {
        movies: result.items,
        pagination: { page: pageNumber, limit: limitNumber, total: result.total, pages: result.pages },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
