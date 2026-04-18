const DistQueue = require('./distribution.model');
const Batch = require('./batch.model');
const SwapService = require('./swap.service');
const Ledger = require('./ledger.model');
const WalletService = require('../wallet/wallet.service');
const WalletModel = require('../wallet/wallet.model');
const User = require('../users/user.model');
const Vpt = require('./vpt.model');
const NotificationService = require('../notifications/notification.service');

/**
 * Distribution Engine — the core economic pipeline.
 *
 * Flow:
 * queueVPT → createBatch → executeSwap → distribute → complete
 *
 * Rules:
 * - Ledger = source of truth (every step logged)
 * - Batched swaps only (no per-user swaps)
 * - Per-item failure isolation (one failure doesn't block others)
 * - Batch-level retry (max 3 attempts)
 * - Server-generated timestamps only
 */

// ─── QUEUE ──────────────────────────────────────────────

/**
 * Queue a vPT conversion for a creator.
 * Called after plan payment → split → extraction.
 */
async function queueVPT(creatorUid, ngnAmount, referenceId) {
  const item = await DistQueue.create({
    creatorUid,
    ngnValue: ngnAmount,
    referenceId,
  });

  await Ledger.create({
    uid: creatorUid,
    type: 'VPT_QUEUE',
    amount_ngn: ngnAmount,
    status: 'success',
    meta: { queue_id: item.id, reference_id: referenceId },
    description: `Queued ₦${ngnAmount} for vPT conversion`,
  });

  return item;
}

// ─── BATCH CREATION ─────────────────────────────────────

/**
 * Step 1: Create a batch from all pending queue items.
 * Links each queue item to the batch via batch_id.
 */
async function createBatch() {
  const pending = DistQueue.getPending();

  // Also pick up retryable failed items
  const retryable = DistQueue.getRetryable();
  for (const item of retryable) {
    await DistQueue.resetForRetry(item.id);
  }

  // Gather all eligible items
  const items = [...pending, ...retryable.filter((r) => r.status === 'pending')];

  if (items.length === 0) {
    return null;
  }

  const totalNGN = items.reduce((sum, item) => sum + item.ngn_value, 0);
  const itemIds = items.map((item) => item.id);

  const batch = await Batch.create({ totalNGN, itemIds });

  // Link each item to this batch
  for (const item of items) {
    await DistQueue.assignToBatch(item.id, batch.id);
  }

  return batch;
}

// ─── SWAP EXECUTION ─────────────────────────────────────

/**
 * Step 2: Execute the PancakeSwap for a batch.
 * Converts NGN → BNB → vPT via market.
 */
async function executeSwap(batch) {
  const totalBNB = await SwapService.convertNGNtoBNB(batch.total_ngn);

  // Log swap initiation
  const swapLedger = await Ledger.create({
    uid: null,
    type: 'VPT_SWAP',
    amount_ngn: batch.total_ngn,
    status: 'pending',
    meta: { batch_id: batch.id, total_bnb: totalBNB, item_count: batch.item_count },
    description: `Batch ${batch.id}: ₦${batch.total_ngn} → ${totalBNB} BNB (${batch.item_count} items)`,
  });

  try {
    const result = await SwapService.buyVPT(totalBNB);

    // Update batch
    await Batch.setSwapped(batch.id, {
      totalBNB,
      totalVPT: result.vptAmount,
      totalVPTWei: result.vptAmountWei,
      txHash: result.txHash,
    });

    // Update ledger entry to success
    await Ledger.updateStatus(swapLedger.id, 'success', {
      amount_vpt: result.vptAmount,
      amount_vpt_wei: result.vptAmountWei,
      tx_hash: result.txHash,
    });

    return { ...result, totalBNB };

  } catch (err) {
    await Batch.setFailed(batch.id);

    // Mark all batch items as failed
    const items = DistQueue.getByBatch(batch.id);
    for (const item of items) {
      await DistQueue.setFailed(item.id);
    }

    await Ledger.updateStatus(swapLedger.id, 'failed', {
      meta: { ...swapLedger.meta, error: err.message },
    });

    await Ledger.create({
      uid: null,
      type: 'SWAP_FAILED',
      amount_ngn: batch.total_ngn,
      status: 'failed',
      meta: { batch_id: batch.id, error: err.message, retry_count: batch.retry_count },
      description: `Batch swap failed: ${err.message}`,
    });

    return { error: err.message };
  }
}

// ─── DISTRIBUTION ───────────────────────────────────────

/**
 * Step 3: Distribute vPT to each creator in the batch.
 * Per-item failure isolation — one fail doesn't block others.
 */
async function distribute(batch) {
  const items = DistQueue.getByBatch(batch.id);
  const totalVPT = batch.total_vpt;
  const totalVPTWei = BigInt(batch.total_vpt_wei || '0');
  let distributed = 0;
  let allocatedWei = 0n;
  const results = [];

  for (const [index, item] of items.entries()) {
    // Skip already completed (e.g., from partial retry)
    if (item.status === 'completed') {
      distributed++;
      continue;
    }

    let vptAmountWei;
    if (index === items.length - 1) {
      vptAmountWei = totalVPTWei - allocatedWei;
    } else {
      vptAmountWei = (totalVPTWei * BigInt(item.ngn_value)) / BigInt(batch.total_ngn);
      allocatedWei += vptAmountWei;
    }

    const vptAmount = await SwapService.formatTokenAmount(vptAmountWei);
    const vptAmountWeiString = vptAmountWei.toString();

    // Get creator's wallet address
    const wallet = WalletModel.findByUserId(item.creator_uid);
    if (!wallet || wallet.status !== 'active') {
      await DistQueue.setFailed(item.id);
      await Ledger.create({
        uid: item.creator_uid,
        type: 'DISTRIBUTION_FAILED',
        amount_vpt: vptAmount,
        amount_vpt_wei: vptAmountWeiString,
        status: 'failed',
        meta: { batch_id: batch.id, queue_id: item.id, reason: 'no_active_wallet' },
        description: `No active wallet for user ${item.creator_uid}`,
      });
      results.push({ id: item.id, uid: item.creator_uid, vptAmount, vptAmountWei: vptAmountWeiString, status: 'failed', error: 'no_active_wallet' });
      continue;
    }

    try {
      const tx = await SwapService.sendVPT(wallet.bsc_address, vptAmountWeiString);

      // Update in-app vPT balance
      await User.adjustVptBalance(item.creator_uid, vptAmount);

      // Log vPT transaction record
      await Vpt.create({
        userId: item.creator_uid,
        type: 'vpt_distribution',
        amount: vptAmount,
        amountWei: vptAmountWeiString,
        description: `vPT distribution: ₦${item.ngn_value} → ${vptAmount} vPT`,
      });

      // Mark queue item completed
      await DistQueue.setCompleted(item.id, tx.txHash, vptAmount, vptAmountWeiString);

      // Ledger entry for this distribution
      await Ledger.create({
        uid: item.creator_uid,
        type: 'VPT_DISTRIBUTION',
        amount_vpt: vptAmount,
        amount_vpt_wei: vptAmountWeiString,
        tx_hash: tx.txHash,
        status: 'success',
        meta: { batch_id: batch.id, queue_id: item.id, wallet: wallet.bsc_address },
        description: `${vptAmount} vPT → ${wallet.bsc_address}`,
      });

      distributed++;
      results.push({ id: item.id, uid: item.creator_uid, vptAmount, vptAmountWei: vptAmountWeiString, status: 'completed', txHash: tx.txHash });

      // Notify creator about vPT distribution
      NotificationService.notifyUser(item.creator_uid, {
        title: '🚀 vPT Distributed!',
        body: `${vptAmount} vPT (₦${item.ngn_value}) has been sent to your wallet`,
        type: 'vpt_distributed',
        link: '/wallet',
        data: {
          batch_id: batch.id,
          amount_vpt: String(vptAmount),
          amount_ngn: String(item.ngn_value),
          tx_hash: tx.txHash,
        },
      }).catch((err) => console.error('[Distribution] notification error:', err.message));

    } catch (err) {
      // Isolate failure — don't block other distributions
      await DistQueue.setFailed(item.id);

      await Ledger.create({
        uid: item.creator_uid,
        type: 'DISTRIBUTION_FAILED',
        amount_vpt: vptAmount,
        amount_vpt_wei: vptAmountWeiString,
        status: 'failed',
        meta: { batch_id: batch.id, queue_id: item.id, error: err.message },
        description: `Distribution failed: ${err.message}`,
      });

      results.push({ id: item.id, uid: item.creator_uid, vptAmount, vptAmountWei: vptAmountWeiString, status: 'failed', error: err.message });
    }
  }

  // Mark batch as distributed (even if some items failed — they retry independently)
  await Batch.setDistributed(batch.id);

  return { distributed, total: items.length, results };
}

// ─── FULL PIPELINE ──────────────────────────────────────

/**
 * Complete batch pipeline: create → swap → distribute.
 * Called by admin trigger or cron.
 */
async function processBatch() {
  // Step 1: Create batch
  const batch = await createBatch();
  if (!batch) {
    return { processed: 0, message: 'No pending items' };
  }

  console.log(`[Distribution] Batch ${batch.id}: ${batch.item_count} items, ₦${batch.total_ngn}`);

  // Step 2: Execute swap
  const swapResult = await executeSwap(batch);
  if (swapResult.error) {
    return { processed: 0, batch_id: batch.id, error: swapResult.error };
  }

  console.log(`[Distribution] Swap complete: ${swapResult.vptAmount} vPT (tx: ${swapResult.txHash})`);

  // Step 3: Distribute vPT to creators
  const distResult = await distribute(Batch.findById(batch.id));

  console.log(`[Distribution] Distributed: ${distResult.distributed}/${distResult.total}`);

  return {
    batch_id: batch.id,
    processed: batch.item_count,
    distributed: distResult.distributed,
    total_ngn: batch.total_ngn,
    total_bnb: swapResult.totalBNB,
    total_vpt: swapResult.vptAmount,
    tx_hash: swapResult.txHash,
    results: distResult.results,
  };
}

/**
 * Retry a specific failed batch.
 */
async function retryBatch(batchId) {
  const batch = Batch.findById(batchId);
  if (!batch) return { error: 'Batch not found' };
  if (!Batch.canRetry(batchId)) return { error: 'Max retries exceeded' };

  await Batch.resetForRetry(batchId);

  // Reset all failed items in this batch back to pending
  const items = DistQueue.getByBatch(batchId);
  for (const item of items) {
    if (item.status === 'failed') {
      await DistQueue.resetForRetry(item.id);
      await DistQueue.assignToBatch(item.id, batchId);
    }
  }

  // Re-execute
  const swapResult = await executeSwap(Batch.findById(batchId));
  if (swapResult.error) {
    return { error: swapResult.error, batch_id: batchId };
  }

  const distResult = await distribute(Batch.findById(batchId));
  return {
    batch_id: batchId,
    distributed: distResult.distributed,
    total: distResult.total,
    results: distResult.results,
  };
}

// ─── QUERIES ────────────────────────────────────────────

function getCreatorQueue(creatorUid) {
  return DistQueue.getByCreator(creatorUid);
}

function getQueueStats() {
  return {
    queue: DistQueue.getStats(),
    batches: Batch.getStats(),
  };
}

function getBatchHistory(limit = 20) {
  return Batch.getRecent(limit);
}

function getFailedBatches() {
  return Batch.getFailed();
}

module.exports = {
  queueVPT,
  createBatch,
  executeSwap,
  distribute,
  processBatch,
  retryBatch,
  getCreatorQueue,
  getQueueStats,
  getBatchHistory,
  getFailedBatches,
};
