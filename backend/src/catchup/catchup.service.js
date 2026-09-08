/**
 * Catch-up / discovery feed service.
 *
 * Uses The Movie Database (TMDB) API — the de-facto API for IMDb-style
 * trending movies, series, people, and trailers. The API key is configured
 * by admins via Distribution Settings (imdb_api_key) and is never exposed
 * to clients; the mobile app calls AfroVision endpoints and receives a
 * shaped, curated feed.
 */

const { getSettings } = require('../distribution/distribution.model');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w1280';
const PROFILE_SIZE = 'w185';

/**
 * Simple TMDB auth container. The read access token (v4 auth) is preferred
 * because it does not need to be appended to the query string and is sent
 * as an Authorization: Bearer header. The legacy API key (v3) is still
 * supported as a fallback.
 */
function tmdbAuth(settings) {
  const token = String(settings?.imdb_api_token || '').trim() || null;
  const apiKey = String(settings?.imdb_api_key || '').trim() || null;
  if (!token && !apiKey) {
    return null;
  }
  return { token, apiKey };
}

// Simple in-memory cache. Cloud Run is stateless per instance; the feed is
// refreshed at most once per TTL to respect TMDB rate limits.
const _cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for a real feed
const CACHE_EMPTY_TTL_MS = 2 * 60 * 1000; // 2 minutes when the feed is empty
const CACHE_ERROR_TTL_MS = 1 * 60 * 1000; // 1 minute when the factory fails

function cacheKey(name) {
  return `catchup_${name}`;
}

function isEmptyFeed(result) {
  const d = result?.data || {};
  return !d.hero?.length
    && !d.trending_people?.length
    && !d.rails?.length;
}

async function withCache(name, factory) {
  const key = cacheKey(name);
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) {
    return entry.data;
  }
  try {
    const data = await factory();
    const ttl = isEmptyFeed(data) ? CACHE_EMPTY_TTL_MS : CACHE_TTL_MS;
    _cache.set(key, { data, ts: Date.now(), ttl });
    return data;
  } catch (err) {
    console.error('[CatchUp] Failed to build feed, returning empty:', err.message);
    _cache.set(key, { data: emptyResponse(), ts: Date.now(), ttl: CACHE_ERROR_TTL_MS });
    return emptyResponse();
  }
}

function buildTmdbUrl(path, auth, params = {}) {
  if (auth?.token) {
    if (Object.keys(params).length > 0) {
      const query = new URLSearchParams(params);
      return `${TMDB_BASE_URL}${path}?${query.toString()}`;
    }
    return `${TMDB_BASE_URL}${path}`;
  }
  if (auth?.apiKey) {
    const query = new URLSearchParams({ api_key: auth.apiKey, ...params });
    return `${TMDB_BASE_URL}${path}?${query.toString()}`;
  }
  return `${TMDB_BASE_URL}${path}`;
}

async function tmdbFetch(path, params = {}, auth = null) {
  if (!auth) {
    auth = tmdbAuth(await getSettings());
  }
  if (!auth) {
    throw new Error('IMDb/TMDB API key or read access token is not configured');
  }

  const headers = { Accept: 'application/json' };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const url = buildTmdbUrl(path, auth, params);

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TMDB request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json();
}

function posterUrl(path) {
  if (!path) return null;
  return `${IMAGE_BASE}/${POSTER_SIZE}${path}`;
}

function backdropUrl(path) {
  if (!path) return null;
  return `${IMAGE_BASE}/${BACKDROP_SIZE}${path}`;
}

function profileUrl(path) {
  if (!path) return null;
  return `${IMAGE_BASE}/${PROFILE_SIZE}${path}`;
}

function youtubeTrailer(videos) {
  if (!Array.isArray(videos?.results)) return null;
  const trailer = videos.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer',
  );
  if (!trailer) return null;
  return `https://www.youtube.com/watch?v=${trailer.key}`;
}

function shapeMovie(m, { trailer } = {}) {
  return {
    id: String(m.id),
    type: 'movie',
    title: m.title || m.name || 'Untitled',
    overview: m.overview || '',
    posterUrl: posterUrl(m.poster_path),
    backdropUrl: backdropUrl(m.backdrop_path),
    trailerUrl: trailer || null,
    rating: typeof m.vote_average === 'number' ? m.vote_average : 0,
    releaseDate: m.release_date || m.first_air_date || null,
  };
}

function shapeSeries(s, { trailer } = {}) {
  return {
    id: String(s.id),
    type: 'series',
    title: s.name || s.title || 'Untitled',
    overview: s.overview || '',
    posterUrl: posterUrl(s.poster_path),
    backdropUrl: backdropUrl(s.backdrop_path),
    trailerUrl: trailer || null,
    rating: typeof s.vote_average === 'number' ? s.vote_average : 0,
    releaseDate: s.first_air_date || s.release_date || null,
  };
}

function shapeCatchUpItem(item, kind) {
  if (kind === 'series' || item.media_type === 'tv') {
    return shapeSeries(item);
  }
  return shapeMovie(item);
}

async function fetchTrailersForHero(items, auth) {
  const enriched = [];
  for (const it of items.slice(0, 7)) {
    try {
      const kind = it.type === 'series' ? 'tv' : 'movie';
      const videos = await tmdbFetch(`/${kind}/${it.id}/videos`, {}, auth);
      it.trailerUrl = youtubeTrailer(videos) || it.trailerUrl;
    } catch (err) {
      // Best-effort trailers; missing trailer shouldn't hide the hero.
      console.warn('[CatchUp] Trailer fetch failed for', it.id, err.message);
    }
    enriched.push(it);
  }
  return enriched;
}

// Genre IDs used for the discovery rails.
const GENRE = {
  Animation: 16,
  Family: 10751,
  Kids: 10762,
  Comedy: 35,
  Action: 28,
  Documentary: 99,
  Drama: 18,
};

function takeItems(result, kind, limit = 12) {
  const value = result?.status === 'fulfilled' ? result.value : null;
  if (!value) return [];
  return (value.results || []).slice(0, limit).map((item) => shapeCatchUpItem(item, kind));
}

function rail(title, items) {
  return { title, items: items || [] };
}

function unwrapTmdb(result) {
  if (result?.status === 'fulfilled') return result.value;
  if (result?.reason) console.warn('[CatchUp] TMDB call failed:', result.reason.message);
  return null;
}

function certificationForMovie(releaseDates) {
  if (!releaseDates?.results) return null;
  const us = releaseDates.results.find((r) => r.iso_3166_1 === 'US');
  const list = us ? us.release_dates : releaseDates.results[0]?.release_dates;
  if (!list || !list.length) return null;
  const rated = list.find((d) => d.certification);
  return rated?.certification || null;
}

function certificationForSeries(contentRatings) {
  if (!contentRatings?.results) return null;
  const us = contentRatings.results.find((r) => r.iso_3166_1 === 'US');
  return us?.rating || contentRatings.results[0]?.rating || null;
}

function shapeCredits(credits) {
  if (!credits) return { cast: [], directors: [], producers: [], writers: [] };
  const cast = (credits.cast || [])
    .slice(0, 10)
    .map((p) => ({
      id: String(p.id || p.credit_id),
      name: p.name || 'Unknown',
      character: p.character || '',
      profileUrl: profileUrl(p.profile_path),
    }));
  const crew = credits.crew || [];
  const directorJobs = new Set(['Director', 'Creator', 'Co-Director']);
  const producerJobs = new Set(['Producer', 'Executive Producer', 'Co-Producer', 'Associate Producer']);
  const writerJobs = new Set(['Writer', 'Screenplay', 'Story', 'Author', 'Novel']);
  const directors = crew
    .filter((p) => directorJobs.has(p.job))
    .slice(0, 5)
    .map((p) => ({
      id: String(p.id || p.credit_id),
      name: p.name || 'Unknown',
      job: p.job,
      profileUrl: profileUrl(p.profile_path),
    }));
  const producers = crew
    .filter((p) => producerJobs.has(p.job))
    .slice(0, 5)
    .map((p) => ({
      id: String(p.id || p.credit_id),
      name: p.name || 'Unknown',
      job: p.job,
      profileUrl: profileUrl(p.profile_path),
    }));
  const writers = crew
    .filter((p) => writerJobs.has(p.job))
    .slice(0, 5)
    .map((p) => ({
      id: String(p.id || p.credit_id),
      name: p.name || 'Unknown',
      job: p.job,
      profileUrl: profileUrl(p.profile_path),
    }));
  return { cast, directors, producers, writers };
}

function shapeRecommendations(recs, kind) {
  return (recs?.results || []).slice(0, 12).map((item) => shapeCatchUpItem(item, kind));
}

async function getHome() {
  return withCache('home', async () => {
    try {
      const settings = await getSettings();
      const auth = tmdbAuth(settings);
      if (!auth) return emptyResponse();

      const results = await Promise.allSettled([
        tmdbFetch('/trending/movie/week', {}, auth),
        tmdbFetch('/trending/tv/week', {}, auth),
        tmdbFetch('/trending/person/week', {}, auth),
        tmdbFetch('/movie/now_playing', {}, auth),
        tmdbFetch('/movie/upcoming', {}, auth),
        tmdbFetch('/movie/top_rated', {}, auth),
        tmdbFetch('/movie/popular', {}, auth),
        tmdbFetch('/tv/on_the_air', {}, auth),
        tmdbFetch('/tv/airing_today', {}, auth),
        tmdbFetch('/tv/popular', {}, auth),
        tmdbFetch('/tv/top_rated', {}, auth),
        tmdbFetch('/discover/movie', { with_genres: GENRE.Animation, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/tv', { with_genres: GENRE.Animation, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/movie', { with_genres: GENRE.Family, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/tv', { with_genres: GENRE.Kids, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/tv', { with_genres: GENRE.Comedy, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/movie', { with_genres: GENRE.Action, sort_by: 'popularity.desc' }, auth),
        tmdbFetch('/discover/movie', { with_genres: GENRE.Documentary, sort_by: 'popularity.desc' }, auth),
      ]);

      const [
        trendingMovies,
        trendingSeries,
        trendingPeople,
        nowPlaying,
        upcoming,
        topRated,
        popularMovies,
        onAir,
        airingToday,
        popularSeries,
        topRatedSeries,
        animationMovies,
        animationSeries,
        familyMovies,
        kidsSeries,
        comedySeries,
        actionMovies,
        documentaryMovies,
      ] = results;

      const movies = takeItems(trendingMovies, 'movie', 18);
      const series = takeItems(trendingSeries, 'series', 18);

      // Hero: interleave top trending movies and series, up to 7.
      const heroPool = [];
      const maxHero = Math.max(movies.length, series.length);
      for (let i = 0; i < maxHero && heroPool.length < 7; i++) {
        if (movies[i]) heroPool.push(movies[i]);
        if (heroPool.length >= 7) break;
        if (series[i]) heroPool.push(series[i]);
      }

      // Episode spotlight: the top trending series, enriched with trailer.
      let episodeSpotlight = null;
      if (series.length > 0) {
        const spotlight = { ...series[0] };
        try {
          const videos = await tmdbFetch(`/tv/${spotlight.id}/videos`, {}, auth);
          spotlight.trailerUrl = youtubeTrailer(videos) || spotlight.trailerUrl;
        } catch (_) {}
        episodeSpotlight = spotlight;
      }

      // Fetch trailers for hero items.
      const hero = await fetchTrailersForHero(heroPool, auth);

      const people = (unwrapTmdb(trendingPeople)?.results || [])
        .slice(0, 12)
        .map((p) => ({
          id: String(p.id),
          name: p.name || 'Unknown',
          profileUrl: profileUrl(p.profile_path),
          knownFor: (p.known_for || []).slice(0, 3).map((k) => k.title || k.name || ''),
        }));

      const rails = [
        rail('Featured', takeItems(trendingMovies, 'movie', 12)),
        rail('Trending Series', takeItems(trendingSeries, 'series', 12)),
        rail('What to Watch', takeItems(topRated, 'movie', 12)),
        rail('Top Picks', takeItems(nowPlaying, 'movie', 12)),
        rail('Current TV Shows', takeItems(onAir, 'series', 12)),
        rail('Upcoming Movies', takeItems(upcoming, 'movie', 12)),
        rail('Popular Movies', takeItems(popularMovies, 'movie', 12)),
        rail('Popular Series', takeItems(popularSeries, 'series', 12)),
        rail('Top Rated Series', takeItems(topRatedSeries, 'series', 12)),
        rail('Airing Today', takeItems(airingToday, 'series', 12)),
        rail('Animation Movies', takeItems(animationMovies, 'movie', 12)),
        rail('Animation Series', takeItems(animationSeries, 'series', 12)),
        rail('Family Movies', takeItems(familyMovies, 'movie', 12)),
        rail('Kids Series', takeItems(kidsSeries, 'series', 12)),
        rail('Comedy Series', takeItems(comedySeries, 'series', 12)),
        rail('Action Movies', takeItems(actionMovies, 'movie', 12)),
        rail('Documentary Movies', takeItems(documentaryMovies, 'movie', 12)),
      ].filter((r) => r.items.length > 0);

      return {
        success: true,
        data: {
          hero,
          episode_spotlight: episodeSpotlight,
          trending_people: people,
          rails,
        },
      };
    } catch (err) {
      console.error('[CatchUp] Failed to build home feed:', err.message);
      return emptyResponse();
    }
  });
}

async function getDetail(type, id) {
  return withCache(`detail_${type}_${id}`, async () => {
    try {
      const settings = await getSettings();
      const auth = tmdbAuth(settings);
      if (!auth) return { success: false, error: 'IMDb/TMDB not configured' };

      const kind = type === 'series' ? 'tv' : 'movie';
      const [
        detailRes,
        creditsRes,
        certificationRes,
        videosRes,
        recsRes,
      ] = await Promise.allSettled([
        tmdbFetch(`/${kind}/${id}`, {}, auth),
        tmdbFetch(`/${kind}/${id}/credits`, {}, auth),
        tmdbFetch(`/${kind}/${id}/${type === 'series' ? 'content_ratings' : 'release_dates'}`, {}, auth),
        tmdbFetch(`/${kind}/${id}/videos`, {}, auth),
        tmdbFetch(`/${kind}/${id}/recommendations`, {}, auth),
      ]);

      const detail = unwrapTmdb(detailRes);
      if (!detail) return { success: false, error: 'Unable to load details' };

      const credits = unwrapTmdb(creditsRes);
      const certification = type === 'series'
        ? certificationForSeries(unwrapTmdb(certificationRes))
        : certificationForMovie(unwrapTmdb(certificationRes));
      const videos = unwrapTmdb(videosRes);
      const recs = unwrapTmdb(recsRes);

      const base = type === 'series' ? shapeSeries(detail) : shapeMovie(detail);
      const { cast, directors, producers, writers } = shapeCredits(credits);
      const recommendations = shapeRecommendations(recs, type);
      const trailerUrl = youtubeTrailer(videos) || null;
      const runtime = type === 'series' ? (detail?.episode_run_time?.[0] || null) : (detail?.runtime || null);
      const genres = (detail?.genres || []).map((g) => g.name);

      return {
        success: true,
        data: {
          ...base,
          cast,
          directors,
          producers,
          writers,
          certification,
          trailerUrl,
          recommendations,
          runtime,
          genres,
        },
      };
    } catch (err) {
      console.error('[CatchUp] Failed to load detail:', err.message);
      return { success: false, error: err.message };
    }
  });
}

function emptyResponse() {
  return {
    success: true,
    data: {
      hero: [],
      episode_spotlight: null,
      trending_people: [],
      rails: [],
    },
  };
}

module.exports = { getHome, getDetail };
