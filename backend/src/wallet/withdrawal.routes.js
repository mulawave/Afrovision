const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./withdrawal.controller');

// User endpoints
router.get('/', authenticateToken, ctrl.getMyWithdrawals);
router.post('/request', authenticateToken, ctrl.requestWithdrawal);

// Admin endpoints
router.get('/all', authenticateToken, ctrl.getAllWithdrawals);
router.post('/:id/approve', authenticateToken, ctrl.approveWithdrawal);
router.post('/:id/reject', authenticateToken, ctrl.rejectWithdrawal);
router.post('/fund', authenticateToken, ctrl.fundWallet);
router.post('/reverse', authenticateToken, ctrl.createReversal);

// Admin financial queries
router.get('/admin/user/:uid/transactions', authenticateToken, ctrl.getUserTransactions);
router.get('/admin/channel/:channelId/earnings', authenticateToken, ctrl.getChannelEarnings);
router.get('/admin/system-totals', authenticateToken, ctrl.getSystemTotals);

module.exports = router;
