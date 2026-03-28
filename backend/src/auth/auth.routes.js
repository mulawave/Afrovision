const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./auth.controller');

const router = Router();

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', authenticateToken, ctrl.me);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/logout', ctrl.logout);

module.exports = router;
