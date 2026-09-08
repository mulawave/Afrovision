const User = require('../users/user.model');
const Hero = require('./media_center_heroes.model');
const AuditService = require('../admin/audit.service');

async function requireAdmin(req, res) {
  const caller = await User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

function serialize(hero) {
  if (!hero) return null;
  return {
    id: hero.id,
    title: hero.title,
    subtitle: hero.subtitle || '',
    image_url: hero.image_url,
    link_type: hero.link_type,
    link_target: hero.link_target,
    priority: hero.priority,
    is_active: hero.is_active,
    starts_at: hero.starts_at,
    ends_at: hero.ends_at,
    created_at: hero.created_at,
    created_by: hero.created_by,
    updated_at: hero.updated_at,
    updated_by: hero.updated_by,
  };
}

// ── Public: GET /media-center/heroes ─────────────────────────────
async function listHeroes(req, res) {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(20, requestedLimit))
      : 6;
    const heroes = await Hero.listPublicActive({ limit });
    res.json({
      data: { heroes: heroes.map(serialize) },
    });
  } catch (err) {
    console.error('[MediaCenterHeroes] listHeroes:', err.message);
    res.status(500).json({ error: 'Failed to load heroes' });
  }
}

// ── Admin: GET /admin/media-center/heroes ────────────────────────
async function adminListHeroes(req, res) {
  if (!(await requireAdmin(req, res))) return;
  try {
    const heroes = await Hero.listAll();
    res.json({ heroes: heroes.map(serialize) });
  } catch (err) {
    console.error('[MediaCenterHeroes] adminListHeroes:', err.message);
    res.status(500).json({ error: 'Failed to load heroes' });
  }
}

// ── Admin: POST /admin/media-center/heroes ───────────────────────
async function adminCreateHero(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const created = await Hero.create(req.body || {}, { adminId: caller.id });
    await AuditService.logAction(caller.id, 'create_media_center_hero', created.id, {
      title: created.title,
      link_type: created.link_type,
    });
    res.status(201).json({ hero: serialize(created) });
  } catch (err) {
    console.error('[MediaCenterHeroes] adminCreateHero:', err.message);
    res.status(500).json({ error: 'Failed to create hero' });
  }
}

// ── Admin: PATCH /admin/media-center/heroes/:id ──────────────────
async function adminUpdateHero(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const updated = await Hero.update(req.params.id, req.body || {}, {
      adminId: caller.id,
    });
    if (!updated) return res.status(404).json({ error: 'Hero not found' });
    await AuditService.logAction(caller.id, 'update_media_center_hero', updated.id, {
      title: updated.title,
      is_active: updated.is_active,
    });
    res.json({ hero: serialize(updated) });
  } catch (err) {
    console.error('[MediaCenterHeroes] adminUpdateHero:', err.message);
    res.status(500).json({ error: 'Failed to update hero' });
  }
}

// ── Admin: DELETE /admin/media-center/heroes/:id ─────────────────
async function adminDeleteHero(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  try {
    const existing = await Hero.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Hero not found' });
    await Hero.remove(existing.id);
    await AuditService.logAction(caller.id, 'delete_media_center_hero', existing.id, {
      title: existing.title,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[MediaCenterHeroes] adminDeleteHero:', err.message);
    res.status(500).json({ error: 'Failed to delete hero' });
  }
}

module.exports = {
  listHeroes,
  adminListHeroes,
  adminCreateHero,
  adminUpdateHero,
  adminDeleteHero,
};
