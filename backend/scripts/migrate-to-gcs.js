/**
 * Migrate existing uploaded files from local disk to Google Cloud Storage.
 * Also updates Firestore references that use /uploads/ paths to GCS URLs.
 *
 * Usage: node scripts/migrate-to-gcs.js
 *   --dry-run   Show what would be uploaded without actually doing it
 *   --skip-db   Only upload files, don't update database references
 */

const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');

const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);
const firestore = new Firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DB = process.argv.includes('--skip-db');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.ico', '.gif'];
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

function getGCSFolder(ext) {
  if (VIDEO_EXTS.includes(ext)) return 'videos';
  return 'images';
}

async function migrateFiles() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('No uploads directory found — nothing to migrate.');
    return {};
  }

  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    return stat.isFile();
  });

  console.log(`Found ${files.length} files in uploads/`);
  const urlMap = {}; // old path → new GCS URL

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const folder = getGCSFolder(ext);
    const gcsPath = `${folder}/${file}`;
    const gcsUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;
    const oldPath = `/uploads/${file}`;

    urlMap[oldPath] = gcsUrl;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] ${oldPath} → ${gcsUrl}`);
      continue;
    }

    // Check if already exists in GCS
    const [exists] = await bucket.file(gcsPath).exists();
    if (exists) {
      console.log(`  [SKIP] ${gcsPath} already exists in GCS`);
      continue;
    }

    const localPath = path.join(UPLOADS_DIR, file);
    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
    console.log(`  [UPLOADED] ${oldPath} → ${gcsPath}`);
  }

  return urlMap;
}

async function updateFirestoreReferences(urlMap) {
  if (SKIP_DB || DRY_RUN) {
    if (DRY_RUN) console.log('\n[DRY RUN] Would update Firestore references');
    return;
  }

  console.log('\nUpdating Firestore references...');

  // 1. Homepage design (site_design/homepage) — branding + hero slides
  try {
    const designDoc = await firestore.doc('site_design/homepage').get();
    if (designDoc.exists) {
      const data = designDoc.data();
      let changed = false;
      const updated = JSON.parse(JSON.stringify(data));

      // Branding
      if (updated.branding) {
        for (const field of ['logo_url', 'favicon_url']) {
          if (updated.branding[field] && urlMap[updated.branding[field]]) {
            updated.branding[field] = urlMap[updated.branding[field]];
            changed = true;
          }
        }
      }

      // Hero slides
      if (updated.hero?.slides) {
        for (const slide of updated.hero.slides) {
          if (slide.image_url && urlMap[slide.image_url]) {
            slide.image_url = urlMap[slide.image_url];
            changed = true;
          }
        }
      }

      if (changed) {
        await firestore.doc('site_design/homepage').set(updated, { merge: true });
        console.log('  [UPDATED] site_design/homepage');
      } else {
        console.log('  [NO CHANGE] site_design/homepage');
      }
    }
  } catch (err) {
    console.error('  [ERROR] site_design/homepage:', err.message);
  }

  // 2. Channels — logo_url, banner_url
  try {
    const channelsSnap = await firestore.collection('channels').get();
    let channelCount = 0;
    for (const doc of channelsSnap.docs) {
      const data = doc.data();
      const updates = {};
      if (data.logo_url && urlMap[data.logo_url]) {
        updates.logo_url = urlMap[data.logo_url];
      }
      if (data.banner_url && urlMap[data.banner_url]) {
        updates.banner_url = urlMap[data.banner_url];
      }
      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        channelCount++;
      }
    }
    console.log(`  [UPDATED] ${channelCount} channel documents`);
  } catch (err) {
    console.error('  [ERROR] channels:', err.message);
  }

  // 3. Videos — video_url, thumbnail_url
  try {
    const videosSnap = await firestore.collection('videos').get();
    let videoCount = 0;
    for (const doc of videosSnap.docs) {
      const data = doc.data();
      const updates = {};
      if (data.video_url && urlMap[data.video_url]) {
        updates.video_url = urlMap[data.video_url];
      }
      if (data.thumbnail_url && urlMap[data.thumbnail_url]) {
        updates.thumbnail_url = urlMap[data.thumbnail_url];
      }
      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        videoCount++;
      }
    }
    console.log(`  [UPDATED] ${videoCount} video documents`);
  } catch (err) {
    console.error('  [ERROR] videos:', err.message);
  }
}

async function main() {
  console.log(`=== AfroVision Media Migration to GCS ===`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  if (DRY_RUN) console.log('MODE: DRY RUN (no changes will be made)\n');
  else console.log('');

  const urlMap = await migrateFiles();
  const mappedCount = Object.keys(urlMap).length;

  if (mappedCount > 0 && !SKIP_DB) {
    await updateFirestoreReferences(urlMap);
  }

  console.log(`\n=== Migration complete (${mappedCount} files processed) ===`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
