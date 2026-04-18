const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./wallet.controller');

const router = Router();

router.get('/me', authenticateToken, ctrl.getMyWallet);
router.post('/create', authenticateToken, ctrl.createMyWallet);

// External wallet endpoints
router.get('/scan-balance/:address', authenticateToken, ctrl.scanBalance);
router.post('/import-address', authenticateToken, ctrl.importAddress);
router.post('/connect-external', authenticateToken, ctrl.connectExternal);
router.delete('/disconnect-external', authenticateToken, ctrl.disconnectExternal);
router.get('/connected', authenticateToken, ctrl.getConnected);
router.post('/transfer', authenticateToken, ctrl.transfer);

module.exports = router;
