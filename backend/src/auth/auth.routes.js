const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./auth.controller');

const router = Router();

// ─── In-memory rate limiter for auth endpoints ───────────
// Uses composite key: IP + normalised email to prevent both
// brute-force from a single IP and credential-stuffing across IPs.
const authBuckets = new Map();
const AUTH_RATE_LIMIT = 10; // max attempts per key
const AUTH_RATE_WINDOW = 60_000; // 1 minute

function authRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const email = String(req.body?.email || '').trim().toLowerCase();
  // Rate-limit by IP alone AND by IP+email so targeted attacks on one account are caught
  const keys = [ip];
  if (email) keys.push(`${ip}:${email}`);

  const now = Date.now();
  for (const key of keys) {
    const bucket = (authBuckets.get(key) || []).filter((t) => now - t < AUTH_RATE_WINDOW);
    if (bucket.length >= AUTH_RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    bucket.push(now);
    authBuckets.set(key, bucket);
  }
  next();
}

// Prune stale auth buckets every 2 min
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of authBuckets) {
    const live = bucket.filter((t) => now - t < AUTH_RATE_WINDOW);
    if (live.length === 0) authBuckets.delete(key);
    else authBuckets.set(key, live);
  }
}, 120_000).unref();

router.post('/register', authRateLimit, ctrl.register);
router.post('/login', authRateLimit, ctrl.login);
router.post('/pak-login', authRateLimit, ctrl.pakLogin);
router.post('/wallet-login', authRateLimit, ctrl.walletLogin);
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', authRateLimit, ctrl.forgotPassword);
router.post('/reset-password', authRateLimit, ctrl.resetPassword);
router.post('/logout', ctrl.logout);

module.exports = router;
