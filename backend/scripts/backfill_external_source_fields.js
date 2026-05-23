/**
 * AV-STR-008 — Backfill External Source Fields
 *
 * Applies default external-source fields to all channel documents that were
 * created before the AV-STR-002 schema extension.
 *
 * Safe to run multiple times — channels that already have `stream_source_mode`
 * are skipped entirely (no writes).
 *
 * Usage (from the backend/ directory):
 *   node scripts/backfill_external_source_fields.js
 *
 * Required env vars (or ADC credentials):
 *   FIREBASE_PROJECT_ID   — GCP/Firebase project ID
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (if not using ADC)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const admin = require('firebase-admin');

// ── Firebase initialisation ───────────────────────────────────────────────
if (!admin.apps.length) {
  const options = {};
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (projectId) options.projectId = projectId;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    ...options,
  });
}

const db = admin.firestore();

// ── Defaults ──────────────────────────────────────────────────────────────
const EXTERNAL_SOURCE_DEFAULTS = {
  stream_source_mode: 'native',
  external_provider: null,
  external_url: null,
  resolved_playback_url: null,
  stream_status: 'unknown',
  last_checked_at: null,
  provider_metadata: null,
};

const COLLECTION = 'channels';
const BATCH_SIZE = 500;

// ── Main ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('[backfill] Fetching all channel documents…');
  const snapshot = await db.collection(COLLECTION).get();
  const total = snapshot.size;

  const toUpdate = snapshot.docs.filter(
    (doc) => doc.data().stream_source_mode === undefined,
  );

  console.log(`[backfill] Total: ${total}  |  Need update: ${toUpdate.length}  |  Already migrated: ${total - toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log('[backfill] Nothing to do. All channels are already up to date.');
    process.exit(0);
  }

  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, EXTERNAL_SOURCE_DEFAULTS);
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`[backfill]   Updated ${updated}/${toUpdate.length}…`);
  }

  console.log(`[backfill] Done. ${updated} channel(s) updated, ${total - toUpdate.length} skipped.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
