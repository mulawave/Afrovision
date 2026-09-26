const User = require('../users/user.model');

/**
 * Short-lived in-memory cache for expensive, read-only admin GET endpoints
 * (dashboard aggregates). The admin console auto-refreshes; without this,
 * every refresh would re-run full collection scans in Firestore.
 *
 * - Admin role is verified BEFORE a cached body is served.
 * - Keyed by path + sorted query (minus `fresh`); `?fresh=1` recomputes.
 * - Per Cloud Run instance; only successful (200) responses are cached.
 */
const store = new Map();
const MAX_ENTRIES = 200;

function keyFor(req) {
  const params = Object.entries(req.query || {})
    .filter(([k]) => k !== 'fresh')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${req.baseUrl}${req.path}?${params}`;
}

function cacheJson(ttlMs) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
      const caller = await User.findById(req.userId);
      if (!caller || caller.role !== 'admin') return next(); // the handler returns its own 403
    } catch {
      return next();
    }

    const key = keyFor(req);
    const hit = store.get(key);
    if (req.query.fresh !== '1' && hit && Date.now() - hit.at < ttlMs) {
      res.set('X-Admin-Cache', 'HIT');
      res.set('X-Admin-Cache-Age', String(Math.round((Date.now() - hit.at) / 1000)));
      return res.status(200).json(hit.body);
    }

    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        store.set(key, { at: Date.now(), body });
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
      }
      res.set('X-Admin-Cache', 'MISS');
      return json(body);
    };
    return next();
  };
}

module.exports = { cacheJson };
