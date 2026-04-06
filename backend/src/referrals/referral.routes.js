const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./referral.controller');

const router = Router();

router.get('/my-code', authenticateToken, ctrl.getMyCode);
router.get('/dashboard', authenticateToken, ctrl.getDashboard);
router.post('/apply', authenticateToken, ctrl.applyReferral);

module.exports = router;
