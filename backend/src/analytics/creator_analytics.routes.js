const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./creator_analytics.controller');

const router = Router();

// Creator-facing endpoints (authenticated as any user — backend verifies ownership)
router.get('/stats', authenticateToken, ctrl.getMyStats);
router.get('/streams', authenticateToken, ctrl.getMyStreams);
router.get('/supporters', authenticateToken, ctrl.getMyTopSupporters);
router.get('/channel', authenticateToken, ctrl.getChannelAnalytics);
router.post('/streams/end', authenticateToken, ctrl.endMyStream);
router.get('/admin/:uid/stats', authenticateToken, ctrl.adminGetCreatorStats);

module.exports = router;
