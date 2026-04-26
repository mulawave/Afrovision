const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./reputation.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getMyReputation);
router.get('/leaderboard', ctrl.getLeaderboard);
router.get('/user/:userId', ctrl.getUserReputation);

module.exports = router;