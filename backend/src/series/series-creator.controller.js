/**
 * Series Creator Controller
 */

const Series = require('./series.model');
const SeriesService = require('./series.service');

// ── Series ──────────────────────────────────────────────

exports.createSeries = async (req, res) => {
  try {
    const { channelId } = req.params;
    const series = await SeriesService.createSeries(req.userId, channelId, req.body);
    res.status(201).json({ success: true, series });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateSeries = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const series = await SeriesService.updateSeriesMeta(req.userId, channelId, seriesId, req.body);
    res.json({ success: true, series });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.publishSeries = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const series = await SeriesService.publishSeries(req.userId, channelId, seriesId);
    res.json({ success: true, series });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.archiveSeries = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const series = await SeriesService.archiveSeries(req.userId, channelId, seriesId);
    res.json({ success: true, series });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.deleteSeries = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    await SeriesService.deleteSeries(req.userId, channelId, seriesId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.listCreatorSeries = async (req, res) => {
  try {
    const { channelId } = req.params;
    const ownerCheck = await SeriesService.ensureCanManageChannel(req.userId, channelId);
    if (ownerCheck.error) return res.status(ownerCheck.error.status).json({ error: ownerCheck.error.message });

    const seriesList = await Series.listSeriesByChannel(channelId);
    const enriched = await Promise.all(
      seriesList.map(async (s) => {
        const seasons = await Series.listSeasonsBySeries(s.id);
        const seasonsWithEpisodes = await Promise.all(
          seasons.map(async (season) => ({
            ...season,
            episodes: await Series.listEpisodesBySeason(season.id),
          }))
        );
        return { ...s, seasons: seasonsWithEpisodes };
      })
    );
    res.json({ success: true, series: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Seasons ─────────────────────────────────────────────

exports.createSeason = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const season = await SeriesService.createSeason(req.userId, channelId, seriesId, req.body);
    res.status(201).json({ success: true, season });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateSeason = async (req, res) => {
  try {
    const { channelId, seriesId, seasonId } = req.params;
    const season = await SeriesService.updateSeason(req.userId, channelId, seriesId, seasonId, req.body);
    res.json({ success: true, season });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.deleteSeason = async (req, res) => {
  try {
    const { channelId, seriesId, seasonId } = req.params;
    await SeriesService.deleteSeason(req.userId, channelId, seriesId, seasonId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

// ── Episodes ────────────────────────────────────────────

exports.createEpisode = async (req, res) => {
  try {
    const { channelId, seriesId, seasonId } = req.params;
    const episode = await SeriesService.createEpisode(req.userId, channelId, seriesId, seasonId, req.body);
    res.status(201).json({ success: true, episode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateEpisode = async (req, res) => {
  try {
    const { channelId, seriesId, episodeId } = req.params;
    const episode = await SeriesService.updateEpisode(req.userId, channelId, seriesId, episodeId, req.body);
    res.json({ success: true, episode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.publishEpisode = async (req, res) => {
  try {
    const { channelId, seriesId, episodeId } = req.params;
    const episode = await SeriesService.publishEpisode(req.userId, channelId, seriesId, episodeId);
    res.json({ success: true, episode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.archiveEpisode = async (req, res) => {
  try {
    const { channelId, seriesId, episodeId } = req.params;
    const episode = await SeriesService.archiveEpisode(req.userId, channelId, seriesId, episodeId);
    res.json({ success: true, episode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.deleteEpisode = async (req, res) => {
  try {
    const { channelId, seriesId, episodeId } = req.params;
    await SeriesService.deleteEpisode(req.userId, channelId, seriesId, episodeId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

// ── Upload helpers ────────────────────────────────────────

exports.createResumableSession = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { file_name, file_size, content_type } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });

    const result = await SeriesService.createResumableEpisodeSession({
      userId: req.userId,
      channelId,
      fileName: file_name,
      fileSize: file_size,
      contentType: content_type,
      origin: req.headers.origin,
    });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    res.status(201).json({ success: true, session: result.session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.completeResumableSession = async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });
    const result = await SeriesService.completeResumableEpisodeSession(session_id, req.userId);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    res.json({ success: true, public_url: result.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadPosterDirect = async (req, res) => {
  try {
    const { channelId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const result = await SeriesService.uploadPosterDirect({
      userId: req.userId,
      channelId,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    res.status(201).json({ success: true, url: result.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
