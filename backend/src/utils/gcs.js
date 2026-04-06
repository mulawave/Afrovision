const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';
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

module.exports = { uploadToGCS, deleteFromGCS, extractGCSPath, BUCKET_NAME };
