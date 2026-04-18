const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.GCS_BUCKET;
if (!BUCKET_NAME) {
  throw new Error('GCS_BUCKET environment variable is required for GCS operations');
}
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Upload a buffer to GCS and return the public URL.
 * @param {Buffer} buffer - File contents
 * @param {string} filename - Destination filename (e.g. "images/uuid.png")
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL
 */
async function uploadToGCS(buffer, filename, contentType) {
  const blob = bucket.file(filename);

  await blob.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
}

/**
 * Delete a file from GCS.
 * @param {string} filename - The object path in the bucket
 */
async function deleteFromGCS(filename) {
  try {
    await bucket.file(filename).delete();
  } catch (err) {
    if (err.code !== 404) throw err;
  }
}

/**
 * Extract the GCS object path from a full public URL.
 * Returns null if the URL is not a GCS URL for our bucket.
 */
function extractGCSPath(url) {
  if (!url) return null;
  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}

/**
 * Generate a signed URL for direct client upload to GCS.
 * @param {string} filename - Destination path in bucket (e.g. "videos/uuid.mp4")
 * @param {string} contentType - MIME type the client will upload
 * @param {number} [expiresMinutes=30] - URL validity in minutes
 * @returns {Promise<{signedUrl: string, publicUrl: string}>}
 */
async function generateSignedUploadUrl(filename, contentType, expiresMinutes = 30) {
  const blob = bucket.file(filename);
  const [url] = await blob.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresMinutes * 60 * 1000,
    contentType,
  });
  return {
    signedUrl: url,
    publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`,
  };
}

module.exports = { uploadToGCS, deleteFromGCS, extractGCSPath, generateSignedUploadUrl, BUCKET_NAME };
