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
    req.userId = payload.userId;
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
    req.userId = payload.userId;
    req.user = await User.findById(payload.userId);
    req.userRole = req.user?.role || null;
  } catch (_) {
    // Invalid token — proceed without auth
  }
  next();
}

module.exports = { generateToken, verifyToken, authenticateToken, optionalAuth };
