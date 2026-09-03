/**
 * Series Viewer Controller
 * Public/channel-scoped read endpoints for series, seasons, episodes.
 */

const Series = require('./series.model');
const Channel = require('../channels/channel.model');
const { resolvePlayableUrl } = require('../utils/gcs');
const { isPublicNonExclusiveChannel } = require('./series.service');
const { checkChannelAccess } = require('../utils/exclusive-access-helper');

exports.listChannelSeries = async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (!channel.is_active) return res.status(404).json({ error: 'Channel not found' });

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const seriesList = await Series.listSeriesByChannel(channelId, { onlyPublished: true });
    res.json({ success: true, data: { series: seriesList } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /channels/:channelId/series/:seriesId
 * Returns series detail with published seasons + episodes nested.
 */
exports.getSeriesDetail = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.is_active) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const series = await Series.findSeriesById(seriesId);
    if (!series || series.channel_id !== channelId || series.status !== 'published') {
      return res.status(404).json({ error: 'Series not found' });
    }

    const seasons = await Series.listSeasonsBySeries(seriesId);
    const seasonsWithEpisodes = await Promise.all(
      seasons.map(async (season) => {
        const episodes = await Series.listEpisodesBySeason(season.id, { onlyPublished: true });
        const resolvedEpisodes = await Promise.all(
          episodes.map(async (ep) => {
            const resolved = { ...ep };
            if (resolved.hls_url) resolved.hls_url = await resolvePlayableUrl(resolved.hls_url);
            if (resolved.video_url) resolved.video_url = await resolvePlayableUrl(resolved.video_url);
            if (resolved.hosted_url) resolved.hosted_url = await resolvePlayableUrl(resolved.hosted_url);
            return resolved;
          })
        );
        return { ...season, episodes: resolvedEpisodes };
      })
    );

    res.json({ success: true, data: { series: { ...series, seasons: seasonsWithEpisodes } } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /channels/:channelId/series/:seriesId/episodes/:episodeId
 * Episode detail + previous/next episode navigation across the whole
 * series (season-ordered, then episode-number-ordered) for autoplay.
 */
exports.getEpisodeDetail = async (req, res) => {
  try {
    const { channelId, seriesId, episodeId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.is_active) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const access = await checkChannelAccess(channel, req.userId || null);
    if (!access.allowed) {
      return res.status(access.status).json({ error: access.message });
    }

    const series = await Series.findSeriesById(seriesId);
    if (!series || series.channel_id !== channelId || series.status !== 'published') {
      return res.status(404).json({ error: 'Series not found' });
    }

    const episode = await Series.findEpisodeById(episodeId);
    if (!episode || episode.series_id !== seriesId || episode.status !== 'published') {
      return res.status(404).json({ error: 'Episode not found' });
    }

    if (episode.hls_url) episode.hls_url = await resolvePlayableUrl(episode.hls_url);
    if (episode.video_url) episode.video_url = await resolvePlayableUrl(episode.video_url);
    if (episode.hosted_url) episode.hosted_url = await resolvePlayableUrl(episode.hosted_url);

    const seasons = await Series.listSeasonsBySeries(seriesId);
    const orderedEpisodeIds = [];
    for (const season of seasons) {
      const episodes = await Series.listEpisodesBySeason(season.id, { onlyPublished: true });
      for (const ep of episodes) orderedEpisodeIds.push(ep.id);
    }

    const currentIndex = orderedEpisodeIds.indexOf(episodeId);
    const previousEpisodeId = currentIndex > 0 ? orderedEpisodeIds[currentIndex - 1] : null;
    const nextEpisodeId =
      currentIndex >= 0 && currentIndex < orderedEpisodeIds.length - 1
        ? orderedEpisodeIds[currentIndex + 1]
        : null;

    res.json({
      success: true,
      data: { episode, navigation: { previousEpisodeId, nextEpisodeId } },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /series
 * Global public feed — published series from public, non-exclusive channels only.
 */
exports.listPublicSeries = async (req, res) => {
  try {
    const { page = 1, limit = 24 } = req.query;
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));

    const publicChannels = await Channel.getPublicChannels();
    const eligibleChannelIds = publicChannels
      .filter((ch) => isPublicNonExclusiveChannel(ch))
      .map((ch) => ch.id);

    const result = await Series.listPublicSeriesFeed({
      page: pageNumber,
      limit: limitNumber,
      publicChannelIds: eligibleChannelIds,
    });

    res.json({
      success: true,
      data: {
        series: result.items,
        pagination: { page: pageNumber, limit: limitNumber, total: result.total, pages: result.pages },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
