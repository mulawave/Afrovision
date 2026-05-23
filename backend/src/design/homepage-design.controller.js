const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const HomepageDesignService = require('./homepage-design.service');

async function requireAdmin(req, res) {
  const caller = await User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return caller;
}

function getErrorStatus(error) {
  if (error.message.startsWith('Firestore unavailable')) return 503;
  if (error.message.includes('required') || error.message.includes('invalid')) return 400;
  return 500;
}

async function getHomepageDesign(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  try {
    const design = await HomepageDesignService.getAdminHomepageDesign();
    res.json({ design });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function updateHomepageDesign(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (!req.body || typeof req.body.design !== 'object' || Array.isArray(req.body.design)) {
    return res.status(400).json({ error: 'design object is required' });
  }

  try {
    const design = await HomepageDesignService.saveHomepageDesign(req.body.design, caller.id);
    await AuditService.logAction(caller.id, 'update_homepage_design', 'homepage', {
      sections: Object.keys(design),
    });
    res.json({ design });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function uploadHomepageAsset(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const imageUrl = req.file.gcsUrl;

  try {
    await AuditService.logAction(caller.id, 'upload_homepage_asset', 'homepage', {
      image_url: imageUrl,
      file_name: req.file.filename,
      original_name: req.file.originalname,
    });
    res.status(201).json({ image_url: imageUrl, file_name: req.file.filename });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function uploadBrandingAsset(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const field = req.query.field;
  if (field !== 'logo_url' && field !== 'favicon_url') {
    return res.status(400).json({ error: 'field must be logo_url or favicon_url' });
  }

  const imageUrl = req.file.gcsUrl;

  try {
    const design = await HomepageDesignService.getAdminHomepageDesign();
    design.branding = design.branding || { logo_url: null, favicon_url: null };
    design.branding[field] = imageUrl;
    await HomepageDesignService.saveHomepageDesign(design, caller.id);

    await AuditService.logAction(caller.id, 'upload_branding_asset', 'homepage', {
      field,
      image_url: imageUrl,
      file_name: req.file.filename,
      original_name: req.file.originalname,
    });
    res.status(201).json({ image_url: imageUrl, field, file_name: req.file.filename });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function getHomepageContent(req, res) {
  try {
    const homepage = await HomepageDesignService.getPublicHomepageContent();
    res.json({ homepage });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

module.exports = {
  getHomepageDesign,
  updateHomepageDesign,
  uploadHomepageAsset,
  uploadBrandingAsset,
  getHomepageContent,
};