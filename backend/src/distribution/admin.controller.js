/**
 * Distribution Admin Controller
 * Endpoints for the admin panel's TV Distribution section: full CRUD on
 * distributors and marketers, device kill switch, global settings, QR
 * whitelist management, and platform-wide financial overview.
 */

const bcrypt = require('bcrypt');
const model = require('./distribution.model');
const AuditService = require('../admin/audit.service');

/**
 * Guard helper — returns the caller user object or sends 403 and null.
 * Relies on authenticateToken middleware having set req.userId.
 */
async function requireAdmin(req, res) {
  const caller = req.user;
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

// ── Platform Overview ────────────────────────────────────────────

/**
 * GET /distribution/admin/overview  (admin token)
 */
exports.overview = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const distributors = await model.listDistributors();
    const allLedger = await model.listAllLedgerEntries(5000);
    const financials = model.computeFinancials(allLedger);
    const devices = await model.listDevices({ limit: 2000 });
    const settings = await model.getSettings();

    const allMarketerPromises = distributors.map((d) => model.listMarketersByDistributor(d.id));
    const marketerLists = await Promise.all(allMarketerPromises);
    const totalMarketers = marketerLists.reduce((sum, list) => sum + list.length, 0);

    return res.status(200).json({
      success: true,
      stats: {
        distributor_count: distributors.length,
        active_distributors: distributors.filter((d) => d.status === 'active').length,
        marketer_count: totalMarketers,
        device_count: devices.length,
        active_devices: devices.filter((d) => d.status === 'active').length,
        disabled_devices: devices.filter((d) => d.status === 'disabled').length,
      },
      financials,
      settings: {
        activation_price_ngn: settings.activation_price_ngn,
        default_split_percent_afrovision: settings.default_split_percent_afrovision,
        license_fee_ngn: settings.license_fee_ngn,
        license_duration_days: settings.license_duration_days,
        qr_whitelist_user_ids: settings.qr_whitelist_user_ids || [],
        tv_app: settings.tv_app,
        config_version: settings.config_version,
      },
    });
  } catch (error) {
    console.error('[Distribution] Admin overview error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Distributor CRUD ─────────────────────────────────────────────

/**
 * GET /distribution/admin/distributors  (admin token)
 */
exports.listDistributors = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const distributors = await model.listDistributors();
    return res.status(200).json({
      success: true,
      distributors: distributors.map((d) => model.toSafeDistributor(d)),
    });
  } catch (error) {
    console.error('[Distribution] Admin list distributors error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/admin/distributors/:id  (admin token)
 * Full detail: distributor + marketers + financials + devices.
 */
exports.getDistributor = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const distributor = await model.findDistributorById(req.params.id);
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

    const [marketers, devices, ledger] = await Promise.all([
      model.listMarketersByDistributor(distributor.id),
      model.listDevices({ distributorId: distributor.id }),
      model.listLedgerByDistributor(distributor.id),
    ]);
    const financials = model.computeFinancials(ledger);

    return res.status(200).json({
      success: true,
      distributor: model.toSafeDistributor(distributor),
      marketers: marketers.map((m) => model.toSafeMarketer(m)),
      devices: devices.map((d) => ({
        device_id: d.id,
        device_name: d.device_name,
        owner_name: d.owner_name,
        owner_email: d.owner_email,
        status: d.status,
        activated_at: d.activated_at,
        last_seen_at: d.last_seen_at,
      })),
      financials,
    });
  } catch (error) {
    console.error('[Distribution] Admin get distributor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * POST /distribution/admin/distributors  (admin token)
 * Body: { company_name, contact_name, email, phone, password, license_duration_days, quota_total, split_percent_afrovision }
 */
exports.createDistributor = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const { company_name, contact_name, email, phone, password, license_duration_days, quota_total, split_percent_afrovision } = req.body || {};

    if (!company_name) return res.status(400).json({ error: 'Company name is required' });
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await model.findDistributorByEmail(email);
    if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'A distributor with this email already exists.' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const distributor = await model.createDistributor({
      companyName: String(company_name).trim(),
      contactName: contact_name || null,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
      passwordHash,
      licenseDurationDays: Number(license_duration_days) || 365,
      quotaTotal: Number(quota_total) || 0,
      splitPercentAfrovision: split_percent_afrovision != null ? Number(split_percent_afrovision) : null,
    });

    // Record license fee as an informational ledger entry.
    const settings = await model.getSettings();
    await model.addLedgerEntry({
      type: 'license_fee',
      distributor_id: distributor.id,
      amount_ngn: Number(settings.license_fee_ngn) || 0,
      note: `Annual license fee — ${license_duration_days || 365} days`,
    });

    await AuditService.logAction(caller.id, 'dist_create_distributor', distributor.id, { company_name: distributor.company_name, email: distributor.email });
    return res.status(201).json({
      success: true,
      distributor: model.toSafeDistributor(distributor),
    });
  } catch (error) {
    console.error('[Distribution] Admin create distributor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * PATCH /distribution/admin/distributors/:id  (admin token)
 * Body: { company_name?, contact_name?, email?, phone?, status?, quota_total?, split_percent_afrovision?, license_duration_days? }
 */
exports.updateDistributor = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const distributor = await model.findDistributorById(req.params.id);
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

    const patch = {};
    const { company_name, contact_name, email, phone, status, quota_total, split_percent_afrovision, license_duration_days, password } = req.body || {};

    if (company_name != null) patch.company_name = String(company_name).trim();
    if (contact_name != null) patch.contact_name = String(contact_name).trim() || null;
    if (email != null) patch.email = String(email).trim().toLowerCase();
    if (phone != null) patch.phone = String(phone).trim() || null;
    if (status != null) {
      if (!['active', 'frozen', 'banned'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use "active", "frozen", or "banned".' });
      }
      patch.status = status;
    }
    if (quota_total != null) patch.quota_total = Number(quota_total) || 0;
    if (split_percent_afrovision != null) patch.split_percent_afrovision = Number(split_percent_afrovision);

    // License renewal: extend from now (or from current expiry if still valid).
    if (license_duration_days != null) {
      const days = Number(license_duration_days) || 365;
      const base = model.isLicenseValid(distributor)
        ? new Date(distributor.license_expires_at).getTime()
        : Date.now();
      patch.license_expires_at = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
    }

    if (password != null && password.length >= 6) {
      patch.password_hash = await bcrypt.hash(String(password), 12);
    }

    const updated = await model.updateDistributor(distributor.id, patch);
    await AuditService.logAction(caller.id, 'dist_update_distributor', distributor.id, patch);
    return res.status(200).json({ success: true, distributor: model.toSafeDistributor(updated) });
  } catch (error) {
    console.error('[Distribution] Admin update distributor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * DELETE /distribution/admin/distributors/:id  (admin token)
 */
exports.deleteDistributor = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const distributor = await model.findDistributorById(req.params.id);
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

    await model.deleteDistributor(distributor.id);
    await AuditService.logAction(caller.id, 'dist_delete_distributor', distributor.id, { company_name: distributor.company_name });
    return res.status(200).json({ success: true, message: 'Distributor deleted. Marketers disabled, unused codes revoked.' });
  } catch (error) {
    console.error('[Distribution] Admin delete distributor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Marketer Management (Admin) ──────────────────────────────────

/**
 * GET /distribution/admin/marketers  (admin token)
 * Optional query param: ?distributor_id=xxx
 */
exports.listMarketers = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { distributor_id } = req.query;
    if (distributor_id) {
      const marketers = await model.listMarketersByDistributor(distributor_id);
      return res.status(200).json({ success: true, marketers: marketers.map((m) => model.toSafeMarketer(m)) });
    }

    // No filter: gather across all distributors.
    const distributors = await model.listDistributors();
    const lists = await Promise.all(distributors.map((d) => model.listMarketersByDistributor(d.id)));
    const all = lists.flat();
    return res.status(200).json({ success: true, marketers: all.map((m) => model.toSafeMarketer(m)) });
  } catch (error) {
    console.error('[Distribution] Admin list marketers error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * PATCH /distribution/admin/marketers/:id  (admin token)
 * Body: { status?, name?, phone? }
 */
exports.updateMarketer = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const marketer = await model.findMarketerById(req.params.id);
    if (!marketer) return res.status(404).json({ error: 'Marketer not found' });

    const patch = {};
    const { status, name, phone } = req.body || {};
    if (status != null) {
      if (!['active', 'disabled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use "active" or "disabled".' });
      }
      patch.status = status;
    }
    if (name != null) patch.name = String(name).trim();
    if (phone != null) patch.phone = String(phone).trim() || null;

    const updated = await model.updateMarketer(marketer.id, patch);
    await AuditService.logAction(caller.id, 'dist_update_marketer', marketer.id, patch);
    return res.status(200).json({ success: true, marketer: model.toSafeMarketer(updated) });
  } catch (error) {
    console.error('[Distribution] Admin update marketer error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Device Management (Kill Switch) ──────────────────────────────

/**
 * GET /distribution/admin/devices  (admin token)
 * Optional query: ?distributor_id=xxx
 */
exports.listDevices = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { distributor_id } = req.query;
    const devices = await model.listDevices({ distributorId: distributor_id || null, limit: 2000 });
    return res.status(200).json({
      success: true,
      devices: devices.map((d) => ({
        device_id: d.id,
        device_name: d.device_name,
        owner_name: d.owner_name,
        owner_email: d.owner_email,
        owner_phone: d.owner_phone,
        status: d.status,
        disabled_reason: d.disabled_reason || null,
        disabled_by: d.disabled_by || null,
        app_version: d.app_version,
        activated_at: d.activated_at,
        last_seen_at: d.last_seen_at,
        activation_code: d.activation_code,
        distributor_id: d.distributor_id,
        marketer_id: d.marketer_id,
      })),
    });
  } catch (error) {
    console.error('[Distribution] Admin list devices error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * PATCH /distribution/admin/devices/:deviceId  (admin token)
 * Body: { status, disabled_reason? }
 * This is the kill switch — setting status to "disabled" bricks the TV
 * on its next heartbeat.
 */
exports.updateDevice = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const { deviceId } = req.params;
    const { status, disabled_reason } = req.body || {};

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use "active" or "disabled".' });
    }

    const device = await model.findDeviceById(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const patch = {
      status,
      disabled_reason: status === 'disabled' ? (disabled_reason || 'Disabled by AfroVision admin') : null,
      disabled_by: status === 'disabled' ? req.userId : null,
    };

    const updated = await model.updateDevice(deviceId, patch);
    await AuditService.logAction(caller.id, status === 'disabled' ? 'dist_kill_switch_disable' : 'dist_kill_switch_enable', deviceId, { disabled_reason: patch.disabled_reason, owner_name: device.owner_name });
    return res.status(200).json({
      success: true,
      device: {
        device_id: updated.id,
        status: updated.status,
        disabled_reason: updated.disabled_reason,
        disabled_by: updated.disabled_by,
      },
    });
  } catch (error) {
    console.error('[Distribution] Admin update device error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Settings ─────────────────────────────────────────────────────

/**
 * GET /distribution/admin/settings  (admin token)
 */
exports.getSettings = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const settings = await model.getSettings();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('[Distribution] Admin get settings error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * PATCH /distribution/admin/settings  (admin token)
 * Body: partial settings object
 */
exports.updateSettings = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const allowed = [
      'activation_price_ngn',
      'default_split_percent_afrovision',
      'license_fee_ngn',
      'license_duration_days',
      'qr_whitelist_user_ids',
      'tv_app',
      'imdb_api_key',
      'imdb_api_token',
    ];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid settings fields provided' });
    }

    if (patch.tv_app) {
      const code = Number(patch.tv_app.latest_version_code);
      if (!Number.isInteger(code) || code < 1) {
        return res.status(400).json({ error: 'tv_app.latest_version_code must be a positive integer matching the APK\'s build.gradle versionCode' });
      }
    }

    const updated = await model.updateSettings(patch);
    await AuditService.logAction(caller.id, 'dist_update_settings', 'distribution', { fields: Object.keys(patch) });
    return res.status(200).json({ success: true, settings: updated });
  } catch (error) {
    console.error('[Distribution] Admin update settings error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Messaging (Admin) ──────────────────────────────────────────────

/**
 * POST /distribution/admin/messages  (admin token)
 * Body: { type, title, body, target, allow_reply }
 * target: { scope: 'all'|'distributor'|'device', distributor_id?, device_id? }
 */
exports.createMessage = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const { type, title, body, target, allow_reply } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    const validTypes = ['program_update', 'psa', 'marketing', 'critical'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Use: program_update, psa, marketing, or critical' });
    }

    const message = await model.createMessage({
      type: type || 'program_update',
      title: String(title).trim(),
      body: String(body).trim(),
      target: target || { scope: 'all' },
      allowReply: allow_reply !== false,
      createdBy: req.userId,
    });

    await AuditService.logAction(caller.id, 'dist_create_message', message.id, { type: message.type, title: message.title });
    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('[Distribution] Admin create message error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/admin/messages  (admin token)
 * Lists all sent messages with reply counts.
 */
exports.listMessages = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const messages = await model.listMessages(200);
    // Attach reply counts
    const messagesWithReplies = await Promise.all(
      messages.map(async (m) => {
        const replies = await model.listRepliesForMessage(m.id);
        return { ...m, reply_count: replies.length, replies };
      })
    );
    return res.status(200).json({ success: true, messages: messagesWithReplies });
  } catch (error) {
    console.error('[Distribution] Admin list messages error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * GET /distribution/admin/messages/:id/replies  (admin token)
 * View all replies for a specific message.
 */
exports.listMessageReplies = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const message = await model.findMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const replies = await model.listRepliesForMessage(req.params.id);
    return res.status(200).json({ success: true, message, replies });
  } catch (error) {
    console.error('[Distribution] Admin list replies error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ── Ledger ───────────────────────────────────────────────────────

/**
 * GET /distribution/admin/ledger  (admin token)
 * Optional query: ?distributor_id=xxx
 */
exports.getLedger = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { distributor_id } = req.query;
    const entries = distributor_id
      ? await model.listLedgerByDistributor(distributor_id)
      : await model.listAllLedgerEntries(5000);

    return res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error('[Distribution] Admin ledger error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
