/**
 * Distributor Controller
 * Endpoints for the distributor web portal: login, dashboard, marketer CRUD,
 * code listing, device tracking, and financial overview.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const model = require('./distribution.model');
const auth = require('./distribution.auth');

/**
 * POST /distribution/distributor/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const distributor = await model.findDistributorByEmail(email);
    if (!distributor) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(String(password), distributor.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (distributor.status === 'banned') {
      return res.status(403).json({ error: 'DISTRIBUTOR_BANNED', message: 'This distributor account has been banned.' });
    }

    const token = await auth.generateDistributorToken(distributor.id);
    return res.status(200).json({
      success: true,
      token,
      distributor: model.toSafeDistributor(distributor),
    });
  } catch (error) {
    console.error('[Distribution] Distributor login error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/distributor/me  (distributor token)
 * Dashboard overview: profile, quota, license, aggregate stats.
 */
exports.me = async (req, res) => {
  try {
    const distributor = req.distributor;
    const settings = await model.getSettings();
    const marketers = await model.listMarketersByDistributor(distributor.id);
    const devices = await model.listDevices({ distributorId: distributor.id });
    const ledger = await model.listLedgerByDistributor(distributor.id);
    const financials = model.computeFinancials(ledger);

    return res.status(200).json({
      success: true,
      distributor: model.toSafeDistributor(distributor),
      settings: {
        activation_price_ngn: settings.activation_price_ngn,
        license_fee_ngn: settings.license_fee_ngn,
        license_duration_days: settings.license_duration_days,
        split_percent: model.distributorSplitPercent(distributor, settings),
      },
      stats: {
        marketer_count: marketers.length,
        active_marketers: marketers.filter((m) => m.status === 'active').length,
        device_count: devices.length,
        active_devices: devices.filter((d) => d.status === 'active').length,
        quota_total: distributor.quota_total,
        quota_used: distributor.quota_used,
        quota_remaining: Math.max(0, (Number(distributor.quota_total) || 0) - (Number(distributor.quota_used) || 0)),
        license_valid: model.isLicenseValid(distributor),
        license_expires_at: distributor.license_expires_at,
      },
      financials,
    });
  } catch (error) {
    console.error('[Distribution] Distributor me error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Marketer Management ──────────────────────────────────────────

/**
 * GET /distribution/distributor/marketers  (distributor token)
 */
exports.listMarketers = async (req, res) => {
  try {
    const marketers = await model.listMarketersByDistributor(req.distributorId);
    return res.status(200).json({
      success: true,
      marketers: marketers.map((m) => model.toSafeMarketer(m)),
    });
  } catch (error) {
    console.error('[Distribution] List marketers error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/distributor/marketers  (distributor token)
 * Body: { name, phone, username, pin }
 */
exports.createMarketer = async (req, res) => {
  try {
    const { name, phone, username, pin } = req.body || {};
    if (!name || name.length < 2) return res.status(400).json({ error: 'Marketer name is required' });
    if (!username || username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!pin || String(pin).length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await model.findMarketerByUsername(cleanUsername);
    if (existing) return res.status(409).json({ error: 'USERNAME_TAKEN', message: 'This username is already in use.' });

    const pinHash = await bcrypt.hash(String(pin), 10);
    const marketer = await model.createMarketer({
      distributorId: req.distributorId,
      name: String(name).trim(),
      phone: phone || null,
      username: cleanUsername,
      pinHash,
    });

    return res.status(201).json({
      success: true,
      marketer: model.toSafeMarketer(marketer),
    });
  } catch (error) {
    console.error('[Distribution] Create marketer error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * PATCH /distribution/distributor/marketers/:id  (distributor token)
 * Body: { name?, phone?, status?, pin? }
 */
exports.updateMarketer = async (req, res) => {
  try {
    const marketer = await model.findMarketerById(req.params.id);
    if (!marketer) return res.status(404).json({ error: 'Marketer not found' });
    if (marketer.distributor_id !== req.distributorId) {
      return res.status(403).json({ error: 'This marketer does not belong to your distributor account' });
    }

    const patch = {};
    const { name, phone, status, pin } = req.body || {};

    if (name != null) patch.name = String(name).trim();
    if (phone != null) patch.phone = String(phone).trim() || null;
    if (status != null) {
      if (!['active', 'disabled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use "active" or "disabled".' });
      }
      patch.status = status;
    }
    if (pin != null) {
      if (String(pin).length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
      patch.pin_hash = await bcrypt.hash(String(pin), 10);
    }

    const updated = await model.updateMarketer(marketer.id, patch);
    return res.status(200).json({ success: true, marketer: model.toSafeMarketer(updated) });
  } catch (error) {
    console.error('[Distribution] Update marketer error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Codes & Devices ──────────────────────────────────────────────

/**
 * GET /distribution/distributor/codes  (distributor token)
 * Lists all activation codes issued under this distributor.
 */
exports.listCodes = async (req, res) => {
  try {
    const codes = await model.listCodesByDistributor(req.distributorId, 500);
    return res.status(200).json({
      success: true,
      codes: codes.map((c) => ({
        code: c.code,
        status: c.status,
        issued_at: c.issued_at,
        activated_at: c.activated_at,
        device_id: c.device_id,
        marketer_id: c.marketer_id,
      })),
    });
  } catch (error) {
    console.error('[Distribution] Distributor codes error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/distributor/devices  (distributor token)
 * Lists all activated TV devices under this distributor.
 */
exports.listDevices = async (req, res) => {
  try {
    const devices = await model.listDevices({ distributorId: req.distributorId });
    return res.status(200).json({
      success: true,
      devices: devices.map((d) => ({
        device_id: d.id,
        device_name: d.device_name,
        owner_name: d.owner_name,
        owner_email: d.owner_email,
        owner_phone: d.owner_phone,
        status: d.status,
        app_version: d.app_version,
        activated_at: d.activated_at,
        last_seen_at: d.last_seen_at,
        activation_code: d.activation_code,
        marketer_id: d.marketer_id,
      })),
    });
  } catch (error) {
    console.error('[Distribution] Distributor devices error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Financials ───────────────────────────────────────────────────

/**
 * GET /distribution/distributor/financials  (distributor token)
 * Full ledger and computed financial summary.
 */
exports.getFinancials = async (req, res) => {
  try {
    const ledger = await model.listLedgerByDistributor(req.distributorId);
    const financials = model.computeFinancials(ledger);
    return res.status(200).json({
      success: true,
      financials,
      ledger: ledger.map((e) => ({
        id: e.id,
        type: e.type,
        amount_ngn: e.amount_ngn,
        split_percent_afrovision: e.split_percent_afrovision,
        afrovision_share_ngn: e.afrovision_share_ngn,
        distributor_share_ngn: e.distributor_share_ngn,
        code: e.code,
        device_id: e.device_id,
        marketer_id: e.marketer_id,
        created_at: e.created_at,
      })),
    });
  } catch (error) {
    console.error('[Distribution] Distributor financials error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Device Disable Request ─────────────────────────────────────────

/**
 * POST /distribution/distributor/devices/:deviceId/request-disable  (distributor token)
 * Body: { reason }
 * Distributor requests AfroVision admin to disable a specific TV.
 * Creates a disable_request record that admin can act on.
 */
exports.requestDeviceDisable = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body || {};

    const device = await model.findDeviceById(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.distributor_id !== req.distributorId) {
      return res.status(403).json({ error: 'This device does not belong to your distributor account' });
    }
    if (device.status === 'disabled') {
      return res.status(409).json({ error: 'This device is already disabled' });
    }

    const db = require('../utils/firestore').getFirestore();
    const requestRecord = {
      id: crypto.randomUUID(),
      device_id: deviceId,
      distributor_id: req.distributorId,
      reason: String(reason || '').trim() || 'No reason provided',
      status: 'pending',
      owner_name: device.owner_name,
      owner_email: device.owner_email,
      created_at: new Date().toISOString(),
    };
    await db.collection('device_disable_requests').doc(requestRecord.id).set(requestRecord);

    return res.status(201).json({ success: true, request: requestRecord });
  } catch (error) {
    console.error('[Distribution] Distributor request-disable error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
