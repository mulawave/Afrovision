/**
 * Marketer Controller
 * Endpoints for the lightweight marketer mobile app: login, live stats, and
 * the real-time activation-code request flow. Every code request re-validates
 * the full distributor chain (status, license, quota) before minting.
 */

const bcrypt = require('bcrypt');
const model = require('./distribution.model');
const auth = require('./distribution.auth');

/**
 * POST /distribution/marketer/login
 * Body: { username, pin }
 */
exports.login = async (req, res) => {
  try {
    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and PIN are required' });
    }

    const marketer = await model.findMarketerByUsername(username);
    if (!marketer) return res.status(401).json({ error: 'Invalid username or PIN' });

    const match = await bcrypt.compare(String(pin), marketer.pin_hash);
    if (!match) return res.status(401).json({ error: 'Invalid username or PIN' });

    if (marketer.status !== 'active') {
      return res.status(403).json({ error: 'MARKETER_DISABLED', message: 'Your account has been disabled. Contact your distributor.' });
    }

    const distributor = await model.findDistributorById(marketer.distributor_id);
    if (!distributor || distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_INVALID', message: 'Your distributor is no longer active.' });
    }

    const token = await auth.generateMarketerToken(marketer.id);
    return res.status(200).json({
      success: true,
      token,
      marketer: model.toSafeMarketer(marketer),
      distributor: {
        id: distributor.id,
        company_name: distributor.company_name,
        status: distributor.status,
        license_expires_at: distributor.license_expires_at,
      },
    });
  } catch (error) {
    console.error('[Distribution] Marketer login error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/marketer/me  (marketer token)
 * Live snapshot: personal stats + distributor quota/license state.
 */
exports.me = async (req, res) => {
  try {
    const marketer = req.marketer;
    const distributor = await model.findDistributorById(marketer.distributor_id);
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

    return res.status(200).json({
      success: true,
      marketer: model.toSafeMarketer(marketer),
      distributor: {
        id: distributor.id,
        company_name: distributor.company_name,
        status: distributor.status,
        license_valid: model.isLicenseValid(distributor),
        license_expires_at: distributor.license_expires_at,
        quota_total: distributor.quota_total,
        quota_used: distributor.quota_used,
        quota_remaining: Math.max(0, (Number(distributor.quota_total) || 0) - (Number(distributor.quota_used) || 0)),
      },
    });
  } catch (error) {
    console.error('[Distribution] Marketer me error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/marketer/codes/request  (marketer token)
 * The heart of the anti-abuse chain. A fresh single-use code is minted ONLY
 * after live validation that:
 *   1. the marketer is active (enforced by middleware)
 *   2. the distributor exists and is active (not frozen/banned)
 *   3. the distributor's 1-year license is still valid
 *   4. the distributor has quota remaining
 */
exports.requestCode = async (req, res) => {
  try {
    const marketer = req.marketer;

    const distributor = await model.findDistributorById(marketer.distributor_id);
    if (!distributor) {
      return res.status(404).json({ error: 'DISTRIBUTOR_NOT_FOUND', message: 'Your distributor no longer exists.' });
    }
    if (distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_BANNED', message: 'Your distributor has been banned.' });
    }
    if (distributor.status === 'frozen') {
      return res.status(403).json({ error: 'DISTRIBUTOR_FROZEN', message: 'Your distributor account is frozen. Contact AfroVision.' });
    }
    if (!model.isLicenseValid(distributor)) {
      return res.status(403).json({ error: 'LICENSE_EXPIRED', message: 'Your distributor\'s license has expired and must be renewed.' });
    }

    const quotaRemaining = Math.max(0, (Number(distributor.quota_total) || 0) - (Number(distributor.quota_used) || 0));
    if (quotaRemaining <= 0) {
      return res.status(403).json({ error: 'QUOTA_EXHAUSTED', message: 'Your distributor has no activation quota remaining.' });
    }

    const entry = await model.mintActivationCode({
      distributorId: distributor.id,
      marketerId: marketer.id,
    });

    await model.updateDistributor(distributor.id, {
      quota_used: (Number(distributor.quota_used) || 0) + 1,
    });
    await model.updateMarketer(marketer.id, {
      codes_requested: (Number(marketer.codes_requested) || 0) + 1,
    });

    return res.status(200).json({
      success: true,
      code: entry.code,
      issued_at: entry.issued_at,
      quota_remaining: quotaRemaining - 1,
    });
  } catch (error) {
    console.error('[Distribution] Code request error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/marketer/codes  (marketer token)
 * Code request history with activation status.
 */
exports.listCodes = async (req, res) => {
  try {
    const codes = await model.listCodesByMarketer(req.marketer.id, 200);
    return res.status(200).json({
      success: true,
      codes: codes.map((c) => ({
        code: c.code,
        status: c.status,
        issued_at: c.issued_at,
        activated_at: c.activated_at,
        device_id: c.device_id,
      })),
    });
  } catch (error) {
    console.error('[Distribution] Marketer codes error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
