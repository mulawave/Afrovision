const User = require('../users/user.model');
const Vpt = require('./vpt.model');
const Ledger = require('./ledger.model');
const Distribution = require('./distribution.service');
const PoolService = require('./pool.service');
const SwapService = require('./swap.service');

function getBalance(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: user.vpt_balance,
    transactions: Vpt.getByUser(req.userId),
  });
}

function getTransactions(req, res) {
  const transactions = Vpt.getByUser(req.userId);
  res.json({ transactions });
}

function getLedger(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const entries = Ledger.getByUser(req.userId);
  res.json({ ledger: entries });
}

function getDistributionQueue(req, res) {
  const user = User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const queue = Distribution.getCreatorQueue(req.userId);
  res.json({ queue });
}

// ─── ADMIN ENDPOINTS ────────────────────────────────────

function requireAdmin(req, res) {
  const user = User.findById(req.userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return null; }
  if (user.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
  return user;
}

function getQueueStats(req, res) {
  if (!requireAdmin(req, res)) return;
  const stats = Distribution.getQueueStats();
  res.json({ stats });
}

function getLedgerStats(req, res) {
  if (!requireAdmin(req, res)) return;
  const stats = Ledger.getStats();
  res.json({ stats });
}

function getFullLedger(req, res) {
  if (!requireAdmin(req, res)) return;
  const limit = parseInt(req.query.limit) || 50;
  const entries = Ledger.getRecent(limit);
  res.json({ ledger: entries });
}

function getBatchHistory(req, res) {
  if (!requireAdmin(req, res)) return;
  const limit = parseInt(req.query.limit) || 20;
  const batches = Distribution.getBatchHistory(limit);
  res.json({ batches });
}

function getFailedBatches(req, res) {
  if (!requireAdmin(req, res)) return;
  const batches = Distribution.getFailedBatches();
  res.json({ batches });
}

async function triggerBatchProcess(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await Distribution.processBatch();
    res.json({ result });
  } catch (err) {
    console.error('[VPT] Batch process error');
    res.status(500).json({ error: 'Batch processing failed' });
  }
}

async function retryBatch(req, res) {
  if (!requireAdmin(req, res)) return;
  const { batchId } = req.params;
  try {
    const result = await Distribution.retryBatch(batchId);
    if (result.error) return res.status(400).json(result);
    res.json({ result });
  } catch (err) {
    console.error('[VPT] Retry error');
    res.status(500).json({ error: 'Retry failed' });
  }
}

async function getTreasuryBalance(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const balance = await SwapService.getTreasuryBalance();
    res.json({ treasury: balance });
  } catch (err) {
    console.error('[VPT] Treasury balance error');
    res.status(500).json({ error: 'Failed to fetch treasury balance' });
  }
}

async function getBlockchainPreflight(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const readiness = await SwapService.getBlockchainReadiness();
    res.json({ readiness });
  } catch (err) {
    console.error('[VPT] Blockchain preflight error');
    res.status(500).json({ error: 'Failed to evaluate blockchain readiness' });
  }
}

// ─── COMMUNITY POOL ENDPOINTS ───────────────────────────

async function getPoolStats(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const stats = await PoolService.getPoolStats();
    res.json({ stats });
  } catch (err) {
    console.error('[VPT] Pool stats error');
    res.status(500).json({ error: 'Failed to fetch pool stats' });
  }
}

async function triggerViewerRewards(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await PoolService.distributeViewerRewards();
    res.json({ result });
  } catch (err) {
    console.error('[VPT] Viewer reward distribution error');
    res.status(500).json({ error: 'Viewer reward distribution failed' });
  }
}

function getPoolDistributions(req, res) {
  if (!requireAdmin(req, res)) return;
  const limit = parseInt(req.query.limit) || 20;
  const history = PoolService.getDistributionHistory(limit);
  res.json({ distributions: history });
}

function getPoolDistribution(req, res) {
  if (!requireAdmin(req, res)) return;
  const dist = PoolService.getDistributionById(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Distribution not found' });
  res.json({ distribution: dist });
}

module.exports = {
  getBalance,
  getTransactions,
  getLedger,
  getDistributionQueue,
  getQueueStats,
  getLedgerStats,
  getFullLedger,
  getBatchHistory,
  getFailedBatches,
  triggerBatchProcess,
  retryBatch,
  getTreasuryBalance,
  getBlockchainPreflight,
  getPoolStats,
  triggerViewerRewards,
  getPoolDistributions,
  getPoolDistribution,
};
