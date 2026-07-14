const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./payment.controller');
const googlePlayCtrl = require('./google_play.controller');

const router = Router();

router.get('/providers', authenticateToken, ctrl.getProviders);
router.post('/checkout/initialize', authenticateToken, ctrl.initializeCheckout);
router.post('/checkout/:id/verify', authenticateToken, ctrl.verifyCheckout);
router.post('/google-play/verify', authenticateToken, googlePlayCtrl.verifyGooglePlayPurchase);

module.exports = router;
