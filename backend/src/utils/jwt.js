const jwt = require('jsonwebtoken');
const SettingsService = require('../admin/settings.service');

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
    next();
  } catch (error) {
    if (error.message === 'JWT_SECRET is required in Firebase settings for authentication') {
      return res.status(503).json({ error: error.message });
    }

    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { generateToken, verifyToken, authenticateToken };
