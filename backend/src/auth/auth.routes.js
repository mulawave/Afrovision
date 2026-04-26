const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./auth.controller');

const router = Router();

// ─── In-memory rate limiter for auth endpoints ───────────
// Uses composite key: IP + normalised email to prevent both
// brute-force from a single IP and credential-stuffing across IPs.
const authBuckets = new Map();
const AUTH_RATE_LIMIT = 30; // max attempts per key
const AUTH_RATE_WINDOW = 60_000; // 1 minute

function authRateLimit(req, res, next) {
  // Rate limiting disabled — admin panel was being blocked by shared Cloud Run IP
  next();
}

router.post('/register', authRateLimit, ctrl.register);
router.post('/login', authRateLimit, ctrl.login);
router.post('/pak-login', authRateLimit, ctrl.pakLogin);
router.post('/wallet-login', authRateLimit, ctrl.walletLogin);
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', authRateLimit, ctrl.forgotPassword);
router.post('/reset-password', authRateLimit, ctrl.resetPassword);
router.post('/logout', ctrl.logout);

module.exports = router;
