const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./wallet.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getMyWallet);
router.post('/create', authenticateToken, ctrl.createMyWallet);

module.exports = router;
