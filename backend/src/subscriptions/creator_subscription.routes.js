const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const { blockMinors } = require('../users/restriction.middleware');
const ctrl = require('./creator_subscription.controller');

const router = Router();

// Subscriber endpoints
router.post('/creator/subscribe', authenticateToken, blockMinors, ctrl.subscribe);
router.delete('/creator/:id/cancel', authenticateToken, ctrl.cancelSubscription);
router.get('/creator/mine', authenticateToken, ctrl.getMySubscriptions);
router.get('/creator/subscribers', authenticateToken, ctrl.getCreatorSubscribers);
router.get('/creator/check/:creatorUid', authenticateToken, ctrl.checkSubscription);

module.exports = router;
