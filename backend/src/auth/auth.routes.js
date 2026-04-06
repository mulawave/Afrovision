const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./auth.controller');

const router = Router();

// ─── Simple in-memory rate limiter for auth endpoints ─────
const authBuckets = new Map();
const AUTH_RATE_LIMIT = 10; // max attempts
const AUTH_RATE_WINDOW = 60_000; // 1 minute

function authRateLimit(req, res, next) {
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = (authBuckets.get(key) || []).filter((t) => now - t < AUTH_RATE_WINDOW);
  if (bucket.length >= AUTH_RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  bucket.push(now);
  authBuckets.set(key, bucket);
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
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', authRateLimit, ctrl.forgotPassword);
router.post('/reset-password', authRateLimit, ctrl.resetPassword);
router.post('/logout', ctrl.logout);

module.exports = router;
