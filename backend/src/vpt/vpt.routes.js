const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const ctrl = require('./vpt.controller');

const router = Router();

// Creator endpoints
router.get('/balance', authenticateToken, ctrl.getBalance);
router.get('/transactions', authenticateToken, ctrl.getTransactions);
router.get('/ledger', authenticateToken, ctrl.getLedger);
router.get('/queue', authenticateToken, ctrl.getDistributionQueue);

// Admin endpoints
router.get('/admin/stats', authenticateToken, ctrl.getQueueStats);
router.get('/admin/ledger-stats', authenticateToken, ctrl.getLedgerStats);
router.get('/admin/ledger', authenticateToken, ctrl.getFullLedger);
router.get('/admin/batches', authenticateToken, ctrl.getBatchHistory);
router.get('/admin/batches/failed', authenticateToken, ctrl.getFailedBatches);
router.post('/admin/process-batch', authenticateToken, ctrl.triggerBatchProcess);
router.post('/admin/batches/:batchId/retry', authenticateToken, ctrl.retryBatch);
router.get('/admin/treasury', authenticateToken, ctrl.getTreasuryBalance);

module.exports = router;
