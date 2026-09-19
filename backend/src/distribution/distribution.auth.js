/**
 * TV Distribution Auth
 * Issues and validates dedicated JWTs for the three non-user principals in the
 * distribution platform: distributors (web portal), marketers (mobile app),
 * and activated TV devices (long-lived device tokens).
 *
 * Tokens carry a `kind` claim so a distributor token can never be used as a
 * marketer or device token and vice versa.
 */

const jwt = require('jsonwebtoken');
const SettingsService = require('../admin/settings.service');
const model = require('./distribution.model');

async function getSecret() {
  const secret = await SettingsService.get('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is required in Firebase settings for authentication');
  }
  return secret;
}

async function generateDistributorToken(distributorId) {
  const secret = await getSecret();
  return jwt.sign({ kind: 'distributor', distributorId }, secret, { expiresIn: '12h' });
}

async function generateMarketerToken(marketerId) {
  const secret = await getSecret();
  return jwt.sign({ kind: 'marketer', marketerId }, secret, { expiresIn: '30d' });
}

/**
 * Device tokens are effectively permanent — activation is one-time and the TV
 * must never require reactivation. Enforcement (kill switch, bans) happens
 * server-side on every call, not via token expiry.
 */
async function generateDeviceToken(deviceId) {
  const secret = await getSecret();
  return jwt.sign({ kind: 'tv_device', deviceId }, secret, { expiresIn: '3650d' });
}

function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
}

async function verify(token, expectedKind) {
  const secret = await getSecret();
  const payload = jwt.verify(token, secret);
  if (payload.kind !== expectedKind) {
    throw new Error('Wrong token kind');
  }
  return payload;
}

async function authenticateDistributor(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = await verify(token, 'distributor');
    const distributor = await model.findDistributorById(payload.distributorId);
    if (!distributor) return res.status(401).json({ error: 'Invalid or expired token' });
    if (distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_BANNED', message: 'This distributor account has been banned.' });
    }
    req.distributor = distributor;
    req.distributorId = distributor.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function authenticateMarketer(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = await verify(token, 'marketer');
    const marketer = await model.findMarketerById(payload.marketerId);
    if (!marketer) return res.status(401).json({ error: 'Invalid or expired token' });
    if (marketer.status !== 'active') {
      return res.status(403).json({ error: 'MARKETER_DISABLED', message: 'This marketer account has been disabled.' });
    }
    req.marketer = marketer;
    req.marketerId = marketer.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function authenticateTvDevice(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = await verify(token, 'tv_device');
    const device = await model.findDeviceById(payload.deviceId);
    if (!device) return res.status(401).json({ error: 'Device not activated' });
    req.device = device;
    req.deviceId = device.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authenticates the TV device, then acts as the AfroVision account the TV is
 * paired to by exposing that account as `req.userId`.
 *
 * This lets device-token requests reuse the ordinary user-auth controllers
 * (library, reader, progress) unchanged, so entitlement rules stay defined in
 * exactly one place instead of being reimplemented for TV and drifting.
 */
async function authenticateTvDeviceAsOwner(req, res, next) {
  return authenticateTvDevice(req, res, () => {
    const ownerUid = req.device && req.device.owner_user_id;
    if (!ownerUid) {
      return res.status(403).json({
        error: 'NO_LINKED_ACCOUNT',
        message: 'This TV is not linked to an AfroVision account yet.',
      });
    }
    req.userId = ownerUid;
    next();
  });
}

module.exports = {
  generateDistributorToken,
  generateMarketerToken,
  generateDeviceToken,
  authenticateDistributor,
  authenticateMarketer,
  authenticateTvDevice,
  authenticateTvDeviceAsOwner,
};
