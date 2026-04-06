const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./notification.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.listMine);
router.get('/unread-count', authenticateToken, ctrl.getUnreadCount);
router.patch('/:id/read', authenticateToken, ctrl.markRead);
router.patch('/:id/unread', authenticateToken, ctrl.markUnread);
router.patch('/:id/archive', authenticateToken, ctrl.archive);
router.patch('/:id/unarchive', authenticateToken, ctrl.unarchive);
router.delete('/:id', authenticateToken, ctrl.remove);
router.post('/mark-all-read', authenticateToken, ctrl.markAllRead);
router.post('/bulk', authenticateToken, ctrl.bulkUpdate);
router.delete('/clear/archived', authenticateToken, ctrl.clearArchived);

// Admin-only endpoints (admin check is enforced inside the controller)
router.post('/send-user', authenticateToken, ctrl.sendToUser);
router.post('/broadcast', authenticateToken, ctrl.broadcastAll);

module.exports = router;
