/**
 * Money-moving and restrictive admin actions must carry a reason, which is
 * saved to the audit log. Enforced server-side so no client can skip it.
 * Normalises req.body.reason to a trimmed string.
 */
const MIN = 3;
const MAX = 300;

function requireReason(req, res, next) {
  const raw = req.body && typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (raw.length < MIN) {
    return res.status(400).json({ error: 'A reason is required for this action (at least 3 characters).' });
  }
  req.body.reason = raw.slice(0, MAX);
  return next();
}

/** For reversals (unban, unfreeze): a reason is optional but normalised and logged if given. */
function optionalReason(req, _res, next) {
  if (req.body && typeof req.body.reason === 'string') {
    const trimmed = req.body.reason.trim().slice(0, MAX);
    req.body.reason = trimmed || undefined;
  }
  return next();
}

module.exports = { requireReason, optionalReason };
