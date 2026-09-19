const rateLimit = require('express-rate-limit');

// Strict limiter for unauthenticated credential-guessing surfaces
// (login, register, password reset). Keyed by IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Looser limiter for the admin panel as a whole — high enough not to
// interfere with normal admin use, but closes the previously-unthrottled
// money-mutation endpoints (§H1 of the production readiness audit).
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Please slow down.' },
});

module.exports = { authLimiter, adminLimiter };
