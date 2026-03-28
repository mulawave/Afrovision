const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./user.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getProfile);
router.put('/update-profile', authenticateToken, ctrl.updateProfile);
router.patch('/currency', authenticateToken, ctrl.updateCurrency);
router.post('/request-creator', authenticateToken, ctrl.requestCreator);

module.exports = router;
