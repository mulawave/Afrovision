const User = require('../users/user.model');
const AuditService = require('../admin/audit.service');
const ChallengeContentService = require('./challenge-content.service');

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
  if (error.message && (error.message.includes('required') || error.message.includes('invalid'))) return 400;
  return 500;
}

async function getAdminChallengeContent(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  try {
    const content = await ChallengeContentService.getAdminChallengeContent();
    res.json({ content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function updateAdminChallengeContent(req, res) {
  const caller = requireAdmin(req, res);
  if (!caller) return;

  if (!req.body || typeof req.body.content !== 'object' || Array.isArray(req.body.content)) {
    return res.status(400).json({ error: 'content object is required' });
  }

  try {
    const content = await ChallengeContentService.saveChallengeContent(req.body.content, caller.id);
    await AuditService.logAction(caller.id, 'update_challenge_content', 'challenge', {
      fields: Object.keys(content),
    });
    res.json({ content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

async function getPublicChallengeContent(req, res) {
  try {
    const content = await ChallengeContentService.getPublicChallengeContent();
    res.json({ content });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
}

module.exports = {
  getAdminChallengeContent,
  updateAdminChallengeContent,
  getPublicChallengeContent,
};
