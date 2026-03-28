const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./subscription.controller');

const router = Router();

router.get('/plans', ctrl.getPlans);
router.post('/subscribe', authenticateToken, ctrl.subscribe);
router.get('/me', authenticateToken, ctrl.getMySubscription);

module.exports = router;
