const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./payment.controller');

const router = Router();

router.get('/providers', authenticateToken, ctrl.getProviders);
router.post('/checkout/initialize', authenticateToken, ctrl.initializeCheckout);
router.post('/checkout/:id/verify', authenticateToken, ctrl.verifyCheckout);

module.exports = router;
