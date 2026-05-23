const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./channel_subscription.controller');

const router = Router();

// Subscriber endpoints
router.post('/channel/subscribe', authenticateToken, ctrl.subscribe);
router.delete('/channel/:id/cancel', authenticateToken, ctrl.cancel);
router.get('/channel/mine', authenticateToken, ctrl.getMine);
router.get('/channel/check/:channelId', authenticateToken, ctrl.check);
router.get('/channel/subscribers/:channelId', authenticateToken, ctrl.getSubscribers);

module.exports = router;
