const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const { authLimiter } = require('../utils/rate_limit');
const ctrl = require('./auth.controller');
const tvSessionCtrl = require('./tv_session.controller');

const router = Router();

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.post('/pak-login', authLimiter, ctrl.pakLogin);
router.post('/wallet-login', authLimiter, ctrl.walletLogin);
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, ctrl.resetPassword);
router.post('/logout', ctrl.logout);

// Android TV account linking (QR code pairing)
router.post('/tv/session', tvSessionCtrl.createSession);
router.get('/tv/session/:id/status', tvSessionCtrl.getSessionStatus);
router.post('/tv/session/:id/confirm', authenticateToken, tvSessionCtrl.confirmSession);

module.exports = router;
