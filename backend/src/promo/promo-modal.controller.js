const User = require('../users/user.model');
const PromoModalService = require('./promo-modal.service');
const AuditService = require('../admin/audit.service');

function requireAdmin(req, res) {
  const caller = User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

// ─── Public: GET /promo-modal ────────────────────────────

async function getPromoModal(req, res) {
  try {
    const config = await PromoModalService.getConfig();
    // Public endpoint only returns config if enabled
    if (!config.enabled) {
      return res.json({ promo_modal: null });
    }
    // Strip internal/sensitive fields from public response
    const { updated_by, updated_at, ...publicConfig } = config;
    res.json({ promo_modal: publicConfig });
  } catch (err) {
    console.error('[PromoModal] getPromoModal error:', err.message);
    res.status(500).json({ error: 'Failed to load promo modal' });
  }
}

// ─── Admin: GET /admin/promo-modal ───────────────────────

async function adminGetPromoModal(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const config = await PromoModalService.getConfig();
    res.json({ promo_modal: config });
  } catch (err) {
    console.error('[PromoModal] adminGet error:', err.message);
    res.status(500).json({ error: 'Failed to load promo modal config' });
  }
}

// ─── Admin: PATCH /admin/promo-modal ─────────────────────

async function adminUpdatePromoModal(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;
  try {
    const saved = await PromoModalService.saveConfig(req.body, caller.id);
    await AuditService.logAction(caller.id, 'update_promo_modal', 'promo_modal', {
      enabled: saved.enabled,
      title: saved.title,
    });
    res.json({ promo_modal: saved });
  } catch (err) {
    console.error('[PromoModal] adminUpdate error:', err.message);
    res.status(500).json({ error: 'Failed to update promo modal' });
  }
}

// ─── Admin: POST /admin/promo-modal/image ────────────────

async function adminUploadPromoImage(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    // Use GCS URL attached by uploadSingleToGCS middleware
    res.json({ image_url: req.file.gcsUrl, file_name: req.file.filename });
  } catch (err) {
    console.error('[PromoModal] uploadImage error:', err.message);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

module.exports = {
  getPromoModal,
  adminGetPromoModal,
  adminUpdatePromoModal,
  adminUploadPromoImage,
};
