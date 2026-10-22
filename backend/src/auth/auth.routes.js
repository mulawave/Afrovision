const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const { authLimiter } = require('../utils/rate_limit');
const ctrl = require('./auth.controller');
const tvSessionCtrl = require('./tv_session.controller');

const router = Router();

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
// OMS signs in with its Firebase ID token (same Firebase project) and gets a
// waves-only token. See firebaseLogin.
router.post('/firebase', authLimiter, ctrl.firebaseLogin);
// OMS server-to-server login/refresh (no captcha/Play Integrity available there),
// gated by a pre-shared secret header instead. Same oms_waves-scoped token as /firebase.
router.post('/oms-login', authLimiter, ctrl.requireOmsSharedSecret, ctrl.omsLogin);
router.post('/oms-refresh', authLimiter, ctrl.requireOmsSharedSecret, ctrl.omsRefresh);
// Pets & Care's backend relay, same server-to-server pattern as oms-login,
// its own secret header/setting. Returns a petcare_waves-scoped token.
router.post('/petcare-login', authLimiter, ctrl.requirePetcareSharedSecret, ctrl.petcareLogin);
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
