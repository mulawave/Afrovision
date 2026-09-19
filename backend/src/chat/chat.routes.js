/**
 * Chat Routes
 * Mounted at /chat with standard user JWT auth, for the web/mobile apps
 * whenever they add a UI for this. The TV app reaches the same handlers
 * through device-token routes under /distribution/tv/chat (see
 * distribution/distribution.routes.js), which resolve req.chatUserId from
 * the device's owner_user_id instead of a user JWT.
 */

const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./chat.controller');

const router = Router();

function attachChatUser(req, res, next) {
  req.chatUserId = req.user?.id || null;
  next();
}

router.get('/pin', authenticateToken, attachChatUser, ctrl.getMyPin);
router.post('/pin/regenerate', authenticateToken, attachChatUser, ctrl.regeneratePin);
router.post('/connections', authenticateToken, attachChatUser, ctrl.requestConnection);
router.get('/connections', authenticateToken, attachChatUser, ctrl.listConnections);
router.post('/connections/:id/respond', authenticateToken, attachChatUser, ctrl.respondToConnection);
router.get('/connections/:connectionId/messages', authenticateToken, attachChatUser, ctrl.listMessages);
router.post('/connections/:connectionId/messages', authenticateToken, attachChatUser, ctrl.sendMessage);
router.post('/connections/:connectionId/read', authenticateToken, attachChatUser, ctrl.markConnectionRead);
router.get('/unread-summary', authenticateToken, attachChatUser, ctrl.getUnreadSummary);

module.exports = router;
