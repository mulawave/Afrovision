/**
 * Movie Creator Controller
 * Endpoints for channel owners/admins to manage movies.
 */

const Movie = require('./movie.model');
const MovieService = require('./movie.service');

exports.createMovie = async (req, res) => {
  try {
    const { channelId } = req.params;
    const movie = await MovieService.createMovie(req.userId, channelId, req.body);
    res.status(201).json({ success: true, movie });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const { channelId, movieId } = req.params;
    const movie = await MovieService.updateMovie(req.userId, channelId, movieId, req.body);
    res.json({ success: true, movie });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.publishMovie = async (req, res) => {
  try {
    const { channelId, movieId } = req.params;
    const movie = await MovieService.publishMovie(req.userId, channelId, movieId);
    res.json({ success: true, movie });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.archiveMovie = async (req, res) => {
  try {
    const { channelId, movieId } = req.params;
    const movie = await MovieService.archiveMovie(req.userId, channelId, movieId);
    res.json({ success: true, movie });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    const { channelId, movieId } = req.params;
    await MovieService.deleteMovie(req.userId, channelId, movieId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.listCreatorMovies = async (req, res) => {
  try {
    const { channelId } = req.params;
    const ownerCheck = await MovieService.ensureCanManageChannel(req.userId, channelId);
    if (ownerCheck.error) {
      return res.status(ownerCheck.error.status).json({ error: ownerCheck.error.message });
    }
    const movies = await Movie.listByChannel(channelId);
    res.json({ success: true, movies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createResumableSession = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { file_name, file_size, content_type } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });

    const result = await MovieService.createResumableMovieSession({
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
    const result = await MovieService.completeResumableMovieSession(session_id, req.userId);
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

    const result = await MovieService.uploadPosterDirect({
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
