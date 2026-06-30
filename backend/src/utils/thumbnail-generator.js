const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const { generateSignedUploadUrl, generateSignedReadUrl, extractGCSPath } = require('./gcs');
const path = require('path');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';

/**
 * Generate a thumbnail from a video URL
 * @param {string} videoUrl - URL of the video (GCS or public URL)
 * @param {string} waveId - Wave ID for naming the thumbnail
 * @returns {Promise<string>} - URL of the generated thumbnail
 */
async function generateThumbnail(videoUrl, waveId) {
  try {
    console.log(`[ThumbnailGenerator] Generating thumbnail for wave ${waveId}`);
    
    // Extract GCS path if it's a GCS URL
    const gcsPath = extractGCSPath(videoUrl);
    if (!gcsPath) {
      console.error('[ThumbnailGenerator] Invalid GCS URL:', videoUrl);
      return null;
    }

    // Download video to temp location
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(gcsPath);
    
    // Generate thumbnail filename
    const thumbnailFileName = `waves/thumbnails/${waveId}.jpg`;
    const thumbnailFile = bucket.file(thumbnailFileName);

    // Use ffmpeg to generate thumbnail from video
    // We'll extract a frame at 1 second (or 10% of duration if shorter)
    // Use pipe output to avoid filesystem write issues in Cloud Run
    const { Readable } = require('stream');
    
    const thumbnailBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      ffmpeg(file.createReadStream())
        .inputOptions('-ss', '0')
        .outputOptions([
          '-vf', 'scale=320:-2',
          '-q:v', '5',
          '-vframes', '1',
          '-f', 'image2pipe',
        ])
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', (err) => {
          console.error('[ThumbnailGenerator] FFmpeg error:', err);
          reject(err);
        })
        .pipe()
        .on('data', (chunk) => chunks.push(chunk));
    });

    // Upload thumbnail to GCS from buffer
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    // Generate signed URL for thumbnail (valid for 6 days - GCS max is 7 days)
    // generateSignedReadUrl expects minutes, not seconds
    const thumbnailUrl = await generateSignedReadUrl(thumbnailFileName, 8640);
    
    console.log(`[ThumbnailGenerator] Thumbnail generated for wave ${waveId}: ${thumbnailUrl}`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`[ThumbnailGenerator] Failed to generate thumbnail for wave ${waveId}:`, error);
    return null;
  }
}

/**
 * Generate thumbnail asynchronously (fire and forget) with retry logic.
 * Retries up to 3 times with exponential backoff on failure.
 * @param {string} videoUrl - URL of the video
 * @param {string} waveId - Wave ID
 * @param {number} [retries=3] - Number of retry attempts
 */
async function generateThumbnailAsync(videoUrl, waveId, retries = 3) {
  // Run in background without blocking
  setImmediate(async () => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const thumbnailUrl = await generateThumbnail(videoUrl, waveId);
        if (thumbnailUrl) {
          // Update wave with thumbnail URL
          const Wave = require('../wave/wave.model');
          await Wave.update(waveId, { thumbnail_url: thumbnailUrl });
          console.log(`[ThumbnailGenerator] Updated wave ${waveId} with thumbnail (attempt ${attempt})`);
          return;
        }
      } catch (error) {
        console.error(`[ThumbnailGenerator] Async thumbnail generation failed for wave ${waveId} (attempt ${attempt}/${retries}):`, error.message);
        if (attempt < retries) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.error(`[ThumbnailGenerator] All ${retries} attempts failed for wave ${waveId}`);
  });
}

/**
 * Synchronously generate and store a thumbnail for a wave.
 * Used by the admin regeneration endpoint.
 * Returns the thumbnail URL or null.
 * @param {string} videoUrl
 * @param {string} waveId
 * @returns {Promise<string|null>}
 */
async function generateAndStoreThumbnail(videoUrl, waveId) {
  try {
    const thumbnailUrl = await generateThumbnail(videoUrl, waveId);
    if (thumbnailUrl) {
      const Wave = require('../wave/wave.model');
      await Wave.update(waveId, { thumbnail_url: thumbnailUrl });
      return thumbnailUrl;
    }
    return null;
  } catch (error) {
    console.error(`[ThumbnailGenerator] generateAndStoreThumbnail failed for wave ${waveId}:`, error);
    return null;
  }
}

module.exports = {
  generateThumbnail,
  generateThumbnailAsync,
  generateAndStoreThumbnail,
};
