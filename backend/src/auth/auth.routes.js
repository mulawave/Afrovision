const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./auth.controller');
const tvSessionCtrl = require('./tv_session.controller');

const router = Router();

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/pak-login', ctrl.pakLogin);
router.post('/wallet-login', ctrl.walletLogin);
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/logout', ctrl.logout);

// Android TV account linking (QR code pairing)
router.post('/tv/session', tvSessionCtrl.createSession);
router.get('/tv/session/:id/status', tvSessionCtrl.getSessionStatus);
router.post('/tv/session/:id/confirm', authenticateToken, tvSessionCtrl.confirmSession);

module.exports = router;
