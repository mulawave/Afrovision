const User = require('../users/user.model');
const Vpt = require('./vpt.model');
const Ledger = require('./ledger.model');
const Distribution = require('./distribution.service');
const PoolService = require('./pool.service');
const SwapService = require('./swap.service');

async function getBalance(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: user.vpt,
    transactions: await Vpt.getByUser(req.userId),
  });
}

async function getTransactions(req, res) {
  const transactions = await Vpt.getByUser(req.userId);
  res.json({ transactions });
}

async function getLedger(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const entries = await Ledger.getByUser(req.userId);
  res.json({ ledger: entries });
}

async function getDistributionQueue(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const queue = await Distribution.getCreatorQueue(req.userId);
  res.json({ queue });
}

// ─── ADMIN ENDPOINTS ────────────────────────────────────

async function requireAdmin(req, res) {
  const user = await User.findById(req.userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return null; }
  if (user.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
  return user;
}

async function getQueueStats(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const stats = await Distribution.getQueueStats();
  res.json({ stats });
}

async function getLedgerStats(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const stats = await Ledger.getStats();
  res.json({ stats });
}

async function getFullLedger(req, res) {
  if (!(await requireAdmin(req, res))) return;
  try {
    const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : null;
    const page = await Ledger.getPage({ limit: req.query.limit, before: req.query.before, type });
    res.json({ ledger: page.items, nextBefore: page.nextBefore });
  } catch (err) {
    console.error('[VPT] ledger page error', err.message);
    res.status(500).json({ error: 'Failed to load ledger' });
  }
}

async function getBatchHistory(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const limit = parseInt(req.query.limit) || 20;
  const batches = await Distribution.getBatchHistory(limit);
  res.json({ batches });
}

async function getFailedBatches(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const batches = await Distribution.getFailedBatches();
  res.json({ batches });
}

async function triggerBatchProcess(req, res) {
  if (!(await requireAdmin(req, res))) return;
  try {
    const result = await Distribution.processBatch();
    res.json({ result });
  } catch (err) {
    console.error('[VPT] Batch process error');
    res.status(500).json({ error: 'Batch processing failed' });
  }
}

async function retryBatch(req, res) {
  if (!(await requireAdmin(req, res))) return;
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
  if (!(await requireAdmin(req, res))) return;
  try {
    const balance = await SwapService.getTreasuryBalance();
    res.json({ treasury: balance });
  } catch (err) {
    console.error('[VPT] Treasury balance error');
    res.status(500).json({ error: 'Failed to fetch treasury balance' });
  }
}

async function getBlockchainPreflight(req, res) {
  if (!(await requireAdmin(req, res))) return;

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

// ─── OPERATIONS POOL ENDPOINTS ──────────────────────────

async function getOperationsPoolStats(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const pool = await PoolService.getOperationsPoolBalance();
    res.json({ stats: { pool } });
  } catch (err) {
    console.error('[VPT] Operations pool stats error');
    res.status(500).json({ error: 'Failed to fetch operations pool stats' });
  }
}

// ─── RBD POOL ENDPOINTS ────────────────────────────────

async function getRbdPoolStats(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const pool = await PoolService.getRbdPoolBalance();
    res.json({ stats: { pool } });
  } catch (err) {
    console.error('[VPT] RBD pool stats error');
    res.status(500).json({ error: 'Failed to fetch RBD pool stats' });
  }
}

async function triggerViewerRewards(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await PoolService.runScheduledDistribution({
      trigger: `admin:${req.userId}`,
      force: req.body?.force === true,
    });
    res.json({ result });
  } catch (err) {
    console.error('[VPT] Viewer reward distribution error');
    res.status(500).json({ error: 'Viewer reward distribution failed' });
  }
}

async function getPoolDistributions(req, res) {
  if (!requireAdmin(req, res)) return;
  const limit = parseInt(req.query.limit) || 20;
  const history = await PoolService.getDistributionHistory(limit);
  res.json({ distributions: history });
}

async function getPoolDistribution(req, res) {
  if (!requireAdmin(req, res)) return;
  const dist = await PoolService.getDistributionById(req.params.id);
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
  getOperationsPoolStats,
  getRbdPoolStats,
  triggerViewerRewards,
  getPoolDistributions,
  getPoolDistribution,
};
