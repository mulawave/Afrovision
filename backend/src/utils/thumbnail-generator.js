const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const { extractGCSPath, generateSignedReadUrl } = require('./gcs');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';
const THUMBNAIL_TIMEOUT_MS = Number(process.env.THUMBNAIL_TIMEOUT_MS || '15000');
const PENDING_JOB_TTL_MS = 60_000; // Ignore new requests for a wave while a job is "in flight"
const FAILED_RETRY_TTL_MS = 300_000; // Retry failed generations only every 5 minutes

const inFlight = new Set();
const queuedWaveIds = new Set();
const pendingQueue = [];
let activeJobs = 0;
const MAX_CONCURRENT_JOBS = 2;

/**
 * Deterministic public GCS URL for a wave thumbnail.
 * @param {string} waveId
 * @returns {string}
 */
function getThumbnailUrl(waveId) {
  return `https://storage.googleapis.com/${BUCKET_NAME}/waves/thumbnails/${waveId}.jpg`;
}

function getThumbnailPath(waveId) {
  return `waves/thumbnails/${waveId}.jpg`;
}

/**
 * Update the wave's thumbnail job status using set-merge so we never throw
 * if the document is missing or concurrently updated.
 */
async function setStatus(waveId, status, extra = {}) {
  try {
    const Wave = require('../wave/wave.model');
    await Wave.updateThumbnailStatus(waveId, {
      thumbnail_status: status,
      ...extra,
    });
  } catch (err) {
    console.error(`[ThumbnailGenerator] Failed to update status for ${waveId}:`, err.message);
  }
}

/**
 * Generate a thumbnail from a GCS-hosted video and stream it to GCS.
 *
 * Cost / reliability improvements over the previous version:
 *   - Writes the JPEG to /tmp first, then streams the file to GCS, keeping
 *     memory usage flat instead of buffering the whole image in a byte array.
 *   - 15s hard timeout (configurable) so a single bad video can't pin a
 *     Cloud Run request for 45s.
 *   - Marks thumbnail_status in Firestore (pending / ready / failed) so the
 *     client prefetch endpoint can return quickly and avoid duplicate ffmpeg runs.
 *   - Sets Cache-Control on the stored object so repeated feed loads are served
 *     by GCS edge cache and don't hit the backend.
 *
 * @param {string} videoUrl - GCS URL of the video
 * @param {string} waveId - Wave ID
 * @returns {Promise<string|null>} - Public thumbnail URL or null
 */
async function generateThumbnail(videoUrl, waveId) {
  if (inFlight.has(waveId)) {
    console.log(`[ThumbnailGenerator] Generation already in flight for wave ${waveId}`);
    return null;
  }

  inFlight.add(waveId);
  const tmpFile = path.join('/tmp', `thumb-${waveId}.jpg`);

  try {
    console.log(`[ThumbnailGenerator] Generating thumbnail for wave ${waveId}`);
    await setStatus(waveId, 'pending', { thumbnail_started_at: Date.now() });

    const gcsPath = extractGCSPath(videoUrl);
    if (!gcsPath) {
      throw new Error(`Invalid GCS URL: ${videoUrl}`);
    }

    // Short-lived signed URL for FFmpeg input. 5 minutes is more than enough
    // for a single-frame seek/read.
    const signedVideoUrl = await generateSignedReadUrl(gcsPath, 5);

    const thumbnailFileName = getThumbnailPath(waveId);
    const thumbnailFile = storage.bucket(BUCKET_NAME).file(thumbnailFileName);

    await Promise.race([
      new Promise((resolve, reject) => {
        ffmpeg(signedVideoUrl)
          .inputOptions(['-ss', '1'])
          .outputOptions([
            '-vf', 'scale=540:-2',
            '-q:v', '3',
            '-vframes', '1',
          ])
          .output(tmpFile)
          .on('end', resolve)
          .on('error', reject)
          .run();
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`ffmpeg thumbnail timeout after ${THUMBNAIL_TIMEOUT_MS}ms`)),
          THUMBNAIL_TIMEOUT_MS,
        ),
      ),
    ]);

    const stats = await fs.promises.stat(tmpFile);
    if (stats.size === 0) {
      throw new Error('ffmpeg produced empty output');
    }

    // Stream the thumbnail file to GCS with long-term caching.
    await pipeline(
      fs.createReadStream(tmpFile),
      thumbnailFile.createWriteStream({
        contentType: 'image/jpeg',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      }),
    );

    const thumbnailUrl = getThumbnailUrl(waveId);
    await setStatus(waveId, 'ready', {
      thumbnail_url: thumbnailUrl,
      thumbnail_generated_at: Date.now(),
      thumbnail_error: null,
      thumbnail_failed_at: null,
    });

    console.log(`[ThumbnailGenerator] Thumbnail generated for wave ${waveId}: ${thumbnailUrl}`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`[ThumbnailGenerator] Failed to generate thumbnail for wave ${waveId}:`, error.message);
    await setStatus(waveId, 'failed', {
      thumbnail_error: error.message,
      thumbnail_failed_at: Date.now(),
    });
    return null;
  } finally {
    inFlight.delete(waveId);
    try {
      await fs.promises.unlink(tmpFile);
    } catch (_) {
      // /tmp file may not exist; ignore cleanup errors
    }
  }
}

async function _processQueue() {
  while (activeJobs < MAX_CONCURRENT_JOBS && pendingQueue.length > 0) {
    const { videoUrl, waveId } = pendingQueue.shift();
    queuedWaveIds.delete(waveId);
    activeJobs += 1;

    // Run in a detached promise so this loop can keep draining the queue.
    (async () => {
      try {
        await generateThumbnail(videoUrl, waveId);
      } catch (err) {
        console.error(`[ThumbnailGenerator] Queued job failed for ${waveId}:`, err.message);
      } finally {
        activeJobs -= 1;
        _processQueue();
      }
    })();
  }
}

function _enqueueThumbnail(videoUrl, waveId) {
  if (queuedWaveIds.has(waveId) || inFlight.has(waveId)) return;
  queuedWaveIds.add(waveId);
  pendingQueue.push({ videoUrl, waveId });
  _processQueue();
}

/**
 * Generate thumbnail asynchronously and persist status.
 *
 * This function does NOT block on the actual ffmpeg work. It writes the wave
 * status to `pending` and queues the job. A global concurrency limit keeps
 * Cloud Run CPU/memory usage flat when many waves need thumbnails at once
 * (e.g. feed load).
 *
 * @param {string} videoUrl
 * @param {string} waveId
 * @returns {Promise<string|null>}
 */
async function generateThumbnailAsync(videoUrl, waveId) {
  try {
    const Wave = require('../wave/wave.model');
    const wave = await Wave.findById(waveId);

    // If a recent job is already known, don't duplicate work.
    if (wave && wave.thumbnail_status === 'ready' && wave.thumbnail_url) {
      return wave.thumbnail_url;
    }
    if (wave && wave.thumbnail_status === 'pending' && wave.thumbnail_started_at) {
      const age = Date.now() - wave.thumbnail_started_at;
      if (age < PENDING_JOB_TTL_MS) {
        console.log(`[ThumbnailGenerator] Skipping async job for ${waveId}: already pending for ${age}ms`);
        return null;
      }
    }
    if (wave && wave.thumbnail_status === 'failed' && wave.thumbnail_failed_at) {
      const age = Date.now() - wave.thumbnail_failed_at;
      if (age < FAILED_RETRY_TTL_MS) {
        console.log(`[ThumbnailGenerator] Skipping async job for ${waveId}: failed ${age}ms ago`);
        return null;
      }
    }

    // Mark pending immediately so other requests / instances see the lock.
    await setStatus(waveId, 'pending', { thumbnail_started_at: Date.now() });
    _enqueueThumbnail(videoUrl, waveId);
    return null;
  } catch (error) {
    console.error(`[ThumbnailGenerator] Async generation orchestration failed for ${waveId}:`, error.message);
    return null;
  }
}

/**
 * Synchronously generate and store a thumbnail for a wave.
 * Used by the admin regeneration endpoint.
 * @param {string} videoUrl
 * @param {string} waveId
 * @returns {Promise<string|null>}
 */
async function generateAndStoreThumbnail(videoUrl, waveId) {
  return generateThumbnail(videoUrl, waveId);
}

module.exports = {
  getThumbnailUrl,
  generateThumbnail,
  generateThumbnailAsync,
  generateAndStoreThumbnail,
};
