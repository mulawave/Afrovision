/**
 * AV-EXC-091 — Safe backfill for exclusive channels and entitlements.
 *
 * Backfills legacy records for:
 * 1) channels (type=exclusive) missing exclusive fee metadata defaults
 * 2) exclusive_channel_access documents missing lifecycle-tracking fields
 *
 * Safety defaults:
 * - dry-run mode by default
 * - write mode requires explicit --execute and --confirm=BACKFILL_EXCLUSIVE_091
 *
 * Usage (from backend/):
 *   node scripts/backfill_exclusive_channel_fields.js
 *   node scripts/backfill_exclusive_channel_fields.js --dry-run --limit=200
 *   node scripts/backfill_exclusive_channel_fields.js --execute --confirm=BACKFILL_EXCLUSIVE_091
 */

'use strict';

const { getFirestore } = require('../src/utils/firestore');

const CONFIRMATION_TOKEN = 'BACKFILL_EXCLUSIVE_091';
const CHANNELS_COLLECTION = 'channels';
const ACCESS_COLLECTION = 'exclusive_channel_access';
const BATCH_SIZE = 400;

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const limitArg = argv.find((entry) => entry.startsWith('--limit='));
  const confirmArg = argv.find((entry) => entry.startsWith('--confirm='));

  const dryRunExplicit = args.has('--dry-run');
  const execute = args.has('--execute');
  const help = args.has('--help') || args.has('-h');

  let limit = null;
  if (limitArg) {
    const raw = Number(limitArg.split('=')[1]);
    if (!Number.isInteger(raw) || raw < 1) {
      throw new Error('limit must be a positive integer');
    }
    limit = raw;
  }

  const confirmation = confirmArg ? String(confirmArg.split('=')[1] || '').trim() : '';

  const dryRun = execute ? false : true;
  if (dryRunExplicit) {
    return {
      dryRun: true,
      execute: false,
      limit,
      confirmation,
      help,
    };
  }

  return {
    dryRun,
    execute,
    limit,
    confirmation,
    help,
  };
}

function getHelpText() {
  return [
    'AV-EXC-091 exclusive backfill utility',
    '',
    'Options:',
    '  --dry-run                           Preview changes only (default mode)',
    '  --execute                           Apply changes (requires confirmation token)',
    '  --confirm=BACKFILL_EXCLUSIVE_091    Required with --execute',
    '  --limit=<n>                         Process at most n docs per collection',
    '  --help                              Show this help',
  ].join('\n');
}

function ensureSafeExecution(options) {
  if (!options.execute) return;

  if (options.confirmation !== CONFIRMATION_TOKEN) {
    throw new Error(
      `Write execution requires --confirm=${CONFIRMATION_TOKEN}. Use --dry-run first.`,
    );
  }
}

function buildChannelBackfillPatch(docData) {
  const updates = {};

  if (docData.exclusive_monthly_fee_ngn === undefined) {
    updates.exclusive_monthly_fee_ngn = 0;
  } else {
    const normalizedFee = Math.max(0, Number(docData.exclusive_monthly_fee_ngn) || 0);
    if (normalizedFee !== docData.exclusive_monthly_fee_ngn) {
      updates.exclusive_monthly_fee_ngn = normalizedFee;
    }
  }

  if (docData.exclusive_fee_currency === undefined || docData.exclusive_fee_currency === null || docData.exclusive_fee_currency === '') {
    updates.exclusive_fee_currency = 'NGN';
  }

  if (docData.exclusive_fee_last_updated_at === undefined) {
    updates.exclusive_fee_last_updated_at = null;
  }

  if (docData.exclusive_fee_last_updated_by === undefined) {
    updates.exclusive_fee_last_updated_by = null;
  }

  return updates;
}

function buildAccessBackfillPatch(docData, now = Date.now()) {
  const updates = {};

  if (docData.reminder_sent_at === undefined) {
    updates.reminder_sent_at = {};
  }

  if (docData.lifecycle_flags === undefined) {
    updates.lifecycle_flags = {};
  }

  if (docData.expiry_notified_at === undefined) {
    updates.expiry_notified_at = null;
  }

  if (docData.monthly_fee_ngn !== undefined) {
    const normalizedMonthly = Math.max(0, Number(docData.monthly_fee_ngn) || 0);
    if (normalizedMonthly !== docData.monthly_fee_ngn) {
      updates.monthly_fee_ngn = normalizedMonthly;
    }
  } else {
    updates.monthly_fee_ngn = 0;
  }

  if (docData.source_payment_id === undefined) {
    updates.source_payment_id = null;
  }

  const expiresAt = Number(docData.expires_at || 0);
  if (docData.status === 'active' && Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) {
    updates.status = 'expired';
    if (docData.expired_at === undefined || docData.expired_at === null) {
      updates.expired_at = expiresAt;
    }
  }

  return updates;
}

function summarizePatch(docId, updates) {
  return {
    id: docId,
    fields: Object.keys(updates),
  };
}

async function collectChannelPatches(db, limit = null) {
  const snapshot = await db.collection(CHANNELS_COLLECTION)
    .where('type', '==', 'exclusive')
    .get();

  const docs = limit === null ? snapshot.docs : snapshot.docs.slice(0, limit);
  const patches = [];

  for (const doc of docs) {
    const updates = buildChannelBackfillPatch(doc.data() || {});
    if (Object.keys(updates).length > 0) {
      patches.push({ ref: doc.ref, id: doc.id, updates });
    }
  }

  return {
    scanned: docs.length,
    patches,
  };
}

async function collectAccessPatches(db, limit = null) {
  const snapshot = await db.collection(ACCESS_COLLECTION).get();
  const docs = limit === null ? snapshot.docs : snapshot.docs.slice(0, limit);
  const patches = [];

  for (const doc of docs) {
    const updates = buildAccessBackfillPatch(doc.data() || {});
    if (Object.keys(updates).length > 0) {
      patches.push({ ref: doc.ref, id: doc.id, updates });
    }
  }

  return {
    scanned: docs.length,
    patches,
  };
}

async function applyPatchesInBatches(patches) {
  if (!patches.length) return 0;

  const db = getFirestore();
  let updated = 0;

  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const chunk = patches.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const patch of chunk) {
      batch.update(patch.ref, patch.updates);
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`[exclusive-backfill] Applied ${updated}/${patches.length}`);
  }

  return updated;
}

async function run(options = parseArgs()) {
  if (options.help) {
    console.log(getHelpText());
    return {
      help: true,
    };
  }

  ensureSafeExecution(options);

  const db = getFirestore();
  const mode = options.dryRun ? 'DRY-RUN' : 'EXECUTE';
  console.log(`[exclusive-backfill] Mode=${mode} limit=${options.limit === null ? 'all' : options.limit}`);

  const [channelsResult, accessResult] = await Promise.all([
    collectChannelPatches(db, options.limit),
    collectAccessPatches(db, options.limit),
  ]);

  const channelPreview = channelsResult.patches.slice(0, 10).map((patch) => summarizePatch(patch.id, patch.updates));
  const accessPreview = accessResult.patches.slice(0, 10).map((patch) => summarizePatch(patch.id, patch.updates));

  const summary = {
    mode,
    channels: {
      scanned: channelsResult.scanned,
      to_update: channelsResult.patches.length,
      preview: channelPreview,
    },
    access: {
      scanned: accessResult.scanned,
      to_update: accessResult.patches.length,
      preview: accessPreview,
    },
  };

  console.log('[exclusive-backfill] Summary:');
  console.log(JSON.stringify(summary, null, 2));

  if (options.dryRun) {
    return summary;
  }

  const [channelsUpdated, accessUpdated] = await Promise.all([
    applyPatchesInBatches(channelsResult.patches),
    applyPatchesInBatches(accessResult.patches),
  ]);

  const writeSummary = {
    ...summary,
    channels: {
      ...summary.channels,
      updated: channelsUpdated,
    },
    access: {
      ...summary.access,
      updated: accessUpdated,
    },
  };

  console.log('[exclusive-backfill] Execution complete:');
  console.log(JSON.stringify(writeSummary, null, 2));

  return writeSummary;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[exclusive-backfill] Fatal:', error.message);
      process.exit(1);
    });
}

module.exports = {
  CONFIRMATION_TOKEN,
  parseArgs,
  ensureSafeExecution,
  buildChannelBackfillPatch,
  buildAccessBackfillPatch,
  run,
};
