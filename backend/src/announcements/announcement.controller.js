const AnnouncementModel = require('./announcement.model');

/**
 * Announcement controller.
 *
 * Public:  GET  /announcements          — get active announcements (public)
 *          GET  /announcements/:id      — get single announcement (public)
 *
 * Admin:   GET    /announcements/admin/list            — list all announcements
 *          POST   /announcements/admin/create          — create announcement
 *          PATCH  /announcements/admin/:id             — update announcement
 *          PATCH  /announcements/admin/:id/enable      — enable announcement
 *          PATCH  /announcements/admin/:id/disable     — disable announcement
 *          DELETE /announcements/admin/:id             — delete announcement
 */

/* ── Public ───────────────────────────────────────────────────── */

async function getActiveAnnouncements(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const announcements = await AnnouncementModel.getActive(limit);
    res.json({ items: announcements, total: announcements.length });
  } catch (err) {
    console.error('[Announcement] getActive error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
}

async function getAnnouncementById(req, res) {
  try {
    const announcement = await AnnouncementModel.findById(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    console.error('[Announcement] getById error:', err);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
}

/* ── Admin ────────────────────────────────────────────────────── */

async function adminListAnnouncements(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const announcements = await AnnouncementModel.getAll({ includeInactive });
    res.json({ items: announcements, total: announcements.length });
  } catch (err) {
    console.error('[Announcement] adminList error:', err);
    res.status(500).json({ error: 'Failed to list announcements' });
  }
}

async function adminCreateAnnouncement(req, res) {
  try {
    const { title, body, icon, color, priority } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Body is required' });
    
    const announcement = await AnnouncementModel.create({
      title: title.trim(),
      body: body.trim(),
      icon: icon || 'campaign',
      color: color || '#FF9800',
      priority: priority || 'normal',
      createdBy: req.userId,
    });
    res.status(201).json(announcement);
  } catch (err) {
    console.error('[Announcement] adminCreate error:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
}

async function adminUpdateAnnouncement(req, res) {
  try {
    const { title, body, icon, color, priority, is_active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (body !== undefined) updates.body = body.trim();
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (priority !== undefined) updates.priority = priority;
    if (is_active !== undefined) updates.is_active = is_active;
    
    const announcement = await AnnouncementModel.update(req.params.id, updates);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    console.error('[Announcement] adminUpdate error:', err);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
}

async function adminEnableAnnouncement(req, res) {
  try {
    const announcement = await AnnouncementModel.enable(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    console.error('[Announcement] adminEnable error:', err);
    res.status(500).json({ error: 'Failed to enable announcement' });
  }
}

async function adminDisableAnnouncement(req, res) {
  try {
    const announcement = await AnnouncementModel.disable(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    console.error('[Announcement] adminDisable error:', err);
    res.status(500).json({ error: 'Failed to disable announcement' });
  }
}

async function adminDeleteAnnouncement(req, res) {
  try {
    const announcement = await AnnouncementModel.findAnyById(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    
    const db = require('../utils/firestore').getFirestore();
    await db.collection('announcements').doc(req.params.id).delete();
    
    const AnnouncementModel = require('./announcement.model');
    AnnouncementModel.removeCachedAnnouncement(announcement);
    
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error('[Announcement] adminDelete error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
}

module.exports = {
  getActiveAnnouncements,
  getAnnouncementById,
  adminListAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminEnableAnnouncement,
  adminDisableAnnouncement,
  adminDeleteAnnouncement,
};
