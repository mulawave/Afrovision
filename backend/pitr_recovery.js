/**
 * PITR Recovery Script
 * Reads ALL user documents from Firestore at a point-in-time BEFORE the deletion,
 * then writes back the original data for any documents that were deleted or lost data.
 * 
 * Usage: node pitr_recovery.js [--dry-run] [--read-time=ISO_DATE]
 */
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'raven-ai-6ff76',
  });
}
const db = admin.firestore();

// Time BEFORE the deletion happened (deletion was ~04:33 UTC)
const DEFAULT_READ_TIME = '2026-04-04T03:00:00Z';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const readTimeArg = args.find(a => a.startsWith('--read-time='));
  const readTimeStr = readTimeArg ? readTimeArg.split('=')[1] : DEFAULT_READ_TIME;
  const readTime = new Date(readTimeStr);

  console.log('=== PITR Recovery ===');
  console.log('Read time:', readTime.toISOString());
  console.log('Dry run:', dryRun);
  console.log('');

  // Step 1: Read ALL user docs at the PITR timestamp (before deletion)
  console.log('Step 1: Reading users collection at PITR timestamp...');
  const pitrSnapshot = await db.collection('users')
    .get({ readTime: admin.firestore.Timestamp.fromDate(readTime) });

  console.log(`Found ${pitrSnapshot.size} user documents at ${readTimeStr}`);

  // Step 2: Read ALL current user docs
  console.log('\nStep 2: Reading current users collection...');
  const currentSnapshot = await db.collection('users').get();
  const currentDocs = new Map();
  currentSnapshot.forEach(doc => {
    currentDocs.set(doc.id, doc.data());
  });
  console.log(`Found ${currentDocs.size} current user documents`);

  // Step 3: Compare and find what needs restoring
  console.log('\nStep 3: Comparing...');
  const toRestore = []; // docs that were deleted (exist in PITR but not current)
  const toRepair = [];  // docs that exist but lost data (recovered shells)
  const unchanged = []; // docs that are fine

  pitrSnapshot.forEach(doc => {
    const pitrData = doc.data();
    const currentData = currentDocs.get(doc.id);

    if (!currentData) {
      // Document was hard-deleted
      toRestore.push({ id: doc.id, data: pitrData, reason: 'hard-deleted' });
    } else if (currentData._recovered) {
      // Document exists but was recovered with incomplete data
      // Check if PITR version has more data
      const pitrFields = Object.keys(pitrData).length;
      const currentFields = Object.keys(currentData).filter(k => !k.startsWith('_')).length;
      if (pitrFields > currentFields) {
        toRepair.push({ id: doc.id, pitrData, currentData, reason: 'recovered-shell' });
      } else {
        unchanged.push(doc.id);
      }
    } else {
      unchanged.push(doc.id);
    }
  });

  console.log(`\nResults:`);
  console.log(`  To restore (hard-deleted): ${toRestore.length}`);
  console.log(`  To repair (recovered shells): ${toRepair.length}`);
  console.log(`  Unchanged: ${unchanged.length}`);

  // Show what will be restored
  if (toRestore.length > 0) {
    console.log('\n--- Documents to RESTORE (were hard-deleted) ---');
    for (const item of toRestore) {
      const email = item.data.email || item.data.emailLower || '?';
      const name = item.data.firstName || item.data.name || '?';
      const fields = Object.keys(item.data).length;
      console.log(`  ${item.id.substring(0, 12)}... email=${email} name=${name} fields=${fields}`);
    }
  }

  if (toRepair.length > 0) {
    console.log('\n--- Documents to REPAIR (recovered with incomplete data) ---');
    for (const item of toRepair) {
      const email = item.pitrData.email || item.pitrData.emailLower || '?';
      const name = item.pitrData.firstName || item.pitrData.name || '?';
      const pitrFields = Object.keys(item.pitrData).length;
      const currentFields = Object.keys(item.currentData).filter(k => !k.startsWith('_')).length;
      console.log(`  ${item.id.substring(0, 12)}... email=${email} name=${name} pitr_fields=${pitrFields} current_fields=${currentFields}`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] No changes written. Remove --dry-run to apply.');
    return;
  }

  // Step 4: Write back the original data
  if (toRestore.length === 0 && toRepair.length === 0) {
    console.log('\nNothing to restore or repair!');
    return;
  }

  console.log('\nStep 4: Writing restored data...');
  const batch_size = 500; // Firestore batch limit
  let restored = 0;
  let repaired = 0;

  // Process restores in batches
  const allWrites = [...toRestore.map(r => ({ ...r, type: 'restore' })), ...toRepair.map(r => ({ ...r, type: 'repair' }))];

  for (let i = 0; i < allWrites.length; i += batch_size) {
    const batch = db.batch();
    const chunk = allWrites.slice(i, i + batch_size);

    for (const item of chunk) {
      const ref = db.collection('users').doc(item.id);
      if (item.type === 'restore') {
        // Full restore — write exactly the PITR data plus a recovery marker
        const writeData = { ...item.data, _pitr_restored: true, _pitr_restored_at: new Date().toISOString(), _pitr_read_time: readTimeStr };
        batch.set(ref, writeData);
        restored++;
      } else {
        // Repair — merge the PITR data over current (preserving recovery markers)
        const writeData = { ...item.pitrData, _pitr_repaired: true, _pitr_repaired_at: new Date().toISOString(), _pitr_read_time: readTimeStr };
        batch.set(ref, writeData, { merge: true });
        repaired++;
      }
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / batch_size) + 1}: wrote ${chunk.length} documents`);
  }

  console.log(`\nDone! Restored: ${restored}, Repaired: ${repaired}`);
  console.log('Run the admin /users/reload endpoint to refresh the in-memory cache.');
}

main().catch(err => {
  console.error('PITR Recovery failed:', err);
  process.exit(1);
});
