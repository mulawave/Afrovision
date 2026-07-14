const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.GCS_BUCKET;
const storage = new Storage();

function getBucket() {
  if (!BUCKET_NAME) {
    throw new Error('GCS_BUCKET environment variable is required for GCS operations');
  }
  return storage.bucket(BUCKET_NAME);
}

/**
 * Upload a buffer to GCS and return the public URL.
 * @param {Buffer} buffer - File contents
 * @param {string} filename - Destination filename (e.g. "images/uuid.png")
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL
 */
async function uploadToGCS(buffer, filename, contentType) {
  const bucket = getBucket();
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
    const bucket = getBucket();
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
  const bucket = getBucket();
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

/**
 * Create a resumable upload session URL for chunked client uploads.
 * @param {string} filename - Destination path in bucket (e.g. "videos/uuid.mp4")
 * @param {string} contentType - MIME type the client will upload
 * @returns {Promise<{sessionUrl: string, publicUrl: string}>}
 */
async function createResumableUploadSession(filename, contentType) {
  const bucket = getBucket();
  const blob = bucket.file(filename);
  const [sessionUrl] = await blob.createResumableUpload({
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
  });
  return {
    sessionUrl,
    publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`,
  };
}

/**
 * Fetch object metadata for a file path in GCS.
 * @param {string} filename - Object path in bucket
 * @returns {Promise<object|null>} metadata or null when not found
 */
async function getGCSObjectMetadata(filename) {
  const bucket = getBucket();
  const blob = bucket.file(filename);
  try {
    const [metadata] = await blob.getMetadata();
    return metadata || null;
  } catch (err) {
    if (err && (err.code === 404 || err.code === 400)) {
      return null;
    }
    throw err;
  }
}

/**
 * Generate a signed URL for direct client read/download.
 * @param {string} filename - Object path in bucket (e.g. "videos/uuid.mp4")
 * @param {number} [expiresMinutes=60] - URL validity in minutes
 * @returns {Promise<string>} Signed read URL
 */
async function generateSignedReadUrl(filename, expiresMinutes = 60) {
  const bucket = getBucket();
  const blob = bucket.file(filename);
  const [url] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });
  return url;
}

/**
 * Download a file from GCS by its object path.
 * Uses the @google-cloud/storage SDK (service-account credentials via ADC).
 * @param {string} filename - Object path in bucket (e.g. "library/books/uuid.pdf")
 * @returns {Promise<Buffer>}
 */
async function downloadFromGCS(filename) {
  const bucket = getBucket();
  const [contents] = await bucket.file(filename).download();
  return Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
}

module.exports = {
  getBucket,
  uploadToGCS,
  deleteFromGCS,
  extractGCSPath,
  downloadFromGCS,
  generateSignedUploadUrl,
  generateSignedReadUrl,
  createResumableUploadSession,
  getGCSObjectMetadata,
  BUCKET_NAME,
};
