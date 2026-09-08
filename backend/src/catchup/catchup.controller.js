const catchupService = require('./catchup.service');

/**
 * GET /catchup/home
 * Returns the curated catch-up feed: hero carousel, trending people,
 * and a long list of content rails (featured, series, animations, etc.).
 *
 * Public; the upstream TMDB API key lives in server-side settings.
 */
async function home(req, res) {
  try {
    const result = await catchupService.getHome();
    return res.status(200).json(result);
  } catch (error) {
    console.error('[CatchUp] Controller error:', error);
    return res.status(500).json({
      success: true,
      data: {
        hero: [],
        episode_spotlight: null,
        trending_people: [],
        rails: [],
      },
    });
  }
}

/**
 * GET /catchup/detail?type=movie|series&id=<tmdb_id>
 * Returns full details for a catch-up item: cast, directors, certification,
 * genres, runtime, recommendations and trailer.
 */
async function detail(req, res) {
  try {
    const { type, id } = req.query;
    if (!type || !id || !['movie', 'series'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be movie or series and id must be provided',
      });
    }
    const result = await catchupService.getDetail(type, String(id));
    return res.status(200).json(result);
  } catch (error) {
    console.error('[CatchUp] Detail controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load details',
    });
  }
}

module.exports = { home, detail };
