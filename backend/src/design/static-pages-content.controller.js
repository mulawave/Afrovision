const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const StaticPagesService = require('./static-pages-content.service');

function requireAdmin(req, res) {
  const caller = User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return caller;
}

function getErrorStatus(error) {
  if (error.message && error.message.startsWith('Firestore unavailable')) return 503;
  if (error.message && (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('unsupported slug'))) return 400;
  return 500;
}

async function getAdminPageContent(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const { slug } = req.params;
    const content = await StaticPagesService.getAdminPageContent(slug);
    res.json({ slug, content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function updateAdminPageContent(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  if (!req.body || typeof req.body.content !== 'object' || Array.isArray(req.body.content)) {
    return res.status(400).json({ error: 'content object is required' });
  }

  try {
    const { slug } = req.params;
    const content = await StaticPagesService.savePageContent(slug, req.body.content, caller.id);
    await AuditService.logAction(caller.id, 'update_static_page_content', slug, {
      fields: Object.keys(content),
    });
    res.json({ slug, content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function getPublicPageContent(req, res) {
  try {
    const { slug } = req.params;
    const content = await StaticPagesService.getPublicPageContent(slug);
    res.json({ slug, content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function listPageSlugs(req, res) {
  try {
    res.json({ slugs: StaticPagesService.ALLOWED_SLUGS });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

module.exports = {
  getAdminPageContent,
  updateAdminPageContent,
  getPublicPageContent,
  listPageSlugs,
};
