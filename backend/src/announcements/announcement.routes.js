const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../utils/jwt');
const ctrl = require('./announcement.controller');

const router = Router();

// Public routes
router.get('/', optionalAuth, ctrl.getActiveAnnouncements);
router.get('/:id', optionalAuth, ctrl.getAnnouncementById);

// Admin routes
router.get('/admin/list', authenticateToken, ctrl.adminListAnnouncements);
router.post('/admin/create', authenticateToken, ctrl.adminCreateAnnouncement);
router.patch('/admin/:id', authenticateToken, ctrl.adminUpdateAnnouncement);
router.patch('/admin/:id/enable', authenticateToken, ctrl.adminEnableAnnouncement);
router.patch('/admin/:id/disable', authenticateToken, ctrl.adminDisableAnnouncement);
router.delete('/admin/:id', authenticateToken, ctrl.adminDeleteAnnouncement);

module.exports = router;
