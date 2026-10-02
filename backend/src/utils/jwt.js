const jwt = require('jsonwebtoken');
const SettingsService = require('../admin/settings.service');
const User = require('../users/user.model');

async function getJwtSecret() {
  const secret = await SettingsService.get('JWT_SECRET');

  if (!secret) {
    throw new Error('JWT_SECRET is required in Firebase settings for authentication');
  }

  return secret;
}

async function generateToken(userId) {
  const secret = await getJwtSecret();
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

/**
 * Partner-app tokens: a real user, but only for the routes listed under
 * their scope. Every other route behind authenticateToken rejects them, and
 * optionalAuth treats them as anonymous.
 */
const TOKEN_SCOPES = {
  // OMS "Share to Afrovision Waves" (POST /auth/firebase).
  oms_waves: [
    ['GET', /^\/channels\/me$/],
    ['POST', /^\/wave\/upload-url$/],
    ['POST', /^\/wave\/register$/],
    ['POST', /^\/wave\/[^/]+\/thumbnail$/],
  ],
};

async function generateScopedToken(userId, scope) {
  if (!TOKEN_SCOPES[scope]) throw new Error(`Unknown token scope: ${scope}`);
  const secret = await getJwtSecret();
  return jwt.sign({ userId, scope }, secret, { expiresIn: '1d' });
}

function isScopeAllowed(scope, req) {
  const rules = TOKEN_SCOPES[scope];
  if (!rules) return false;
  const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '');
  return rules.some(([method, pattern]) => req.method === method && pattern.test(path));
}

async function verifyToken(token) {
  const secret = await getJwtSecret();
  return jwt.verify(token, secret);
}

async function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = await verifyToken(token);
    if (payload.scope && !isScopeAllowed(payload.scope, req)) {
      return res.status(401).json({ error: 'Token not valid for this route' });
    }
    req.userId = payload.userId;
    req.tokenScope = payload.scope || null;
    req.user = await User.findById(payload.userId);
    if (!req.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (req.user.is_banned && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ACCOUNT_BANNED', message: 'Your account has been banned. Contact support.' });
    }
    req.userRole = req.user.role || null;
    next();
  } catch (error) {
    if (error.message === 'JWT_SECRET is required in Firebase settings for authentication') {
      return res.status(503).json({ error: error.message });
    }

    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  const token = header.split(' ')[1];
  try {
    const payload = await verifyToken(token);
    // Scoped partner tokens never identify a user on optional-auth routes.
    if (!payload.scope) {
      req.userId = payload.userId;
      req.user = await User.findById(payload.userId);
      req.userRole = req.user?.role || null;
    }
  } catch (_) {
    // Invalid token — proceed without auth
  }
  next();
}

function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { generateToken, generateScopedToken, verifyToken, authenticateToken, optionalAuth, requireAdminRole };
