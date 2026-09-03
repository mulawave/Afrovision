const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.GCS_BUCKET;
// KYC identity documents live in a separate, dedicated private bucket — this
// is a hard bucket-level isolation (not just a path prefix) so the main
// media bucket (which is publicly readable) can never expose identity
// documents. Deliberately does NOT fall back to BUCKET_NAME: if this env
// var is ever missing, KYC uploads must fail loudly rather than silently
// land in the public bucket.
const KYC_BUCKET_NAME = process.env.GCS_KYC_BUCKET;
const storage = new Storage();

function getBucket() {
  if (!BUCKET_NAME) {
    throw new Error('GCS_BUCKET environment variable is required for GCS operations');
  }
  return storage.bucket(BUCKET_NAME);
}

function getKycBucket() {
  if (!KYC_BUCKET_NAME) {
    throw new Error('GCS_KYC_BUCKET environment variable is required for KYC uploads — refusing to fall back to the public media bucket');
  }
  return storage.bucket(KYC_BUCKET_NAME);
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
 * Upload a KYC identity document to the dedicated, private KYC bucket.
 * Deliberately isolated from uploadToGCS() / the main media bucket.
 * @param {Buffer} buffer - File contents
 * @param {string} filename - Destination filename (e.g. "uuid.jpg")
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public (bucket-relative) URL — private unless
 *   the KYC bucket is separately granted access.
 */
async function uploadKycDocToGCSBucket(buffer, filename, contentType) {
  const bucket = getKycBucket();
  const blob = bucket.file(filename);

  await blob.save(buffer, {
    contentType,
    resumable: false,
  });

  return `https://storage.googleapis.com/${KYC_BUCKET_NAME}/${filename}`;
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
 * Extract the KYC GCS object path from a full public URL.
 * Returns null if the URL is not a GCS URL for the dedicated KYC bucket.
 */
function extractKycGCSPath(url) {
  if (!url || !KYC_BUCKET_NAME) return null;
  const prefix = `https://storage.googleapis.com/${KYC_BUCKET_NAME}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}

/**
 * Generate a signed URL for reading a KYC identity document from the
 * dedicated, private KYC bucket. The main media bucket helper is not reused
 * because the KYC bucket is a separate, non-public bucket.
 * @param {string} filename - Object path in the KYC bucket
 * @param {number} [expiresMinutes=60] - URL validity in minutes
 * @returns {Promise<string>} Signed read URL
 */
async function generateKycSignedReadUrl(filename, expiresMinutes = 60) {
  const bucket = getKycBucket();
  const blob = bucket.file(filename);
  const [url] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });
  return url;
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
 * @param {string} [origin] - Browser origin (e.g. "https://afrovision.online").
 *   REQUIRED for browser uploads: GCS binds the resumable session to this origin
 *   and only then includes Access-Control-Allow-Origin headers on session requests.
 * @returns {Promise<{sessionUrl: string, publicUrl: string}>}
 */
async function createResumableUploadSession(filename, contentType, origin) {
  const bucket = getBucket();
  const blob = bucket.file(filename);
  const options = {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
  };
  if (origin) {
    options.origin = origin;
  }
  const [sessionUrl] = await blob.createResumableUpload(options);
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
 * Set metadata for a GCS file (e.g. Content-Disposition for inline display).
 * @param {string} filename - Object path in bucket
 * @param {object} metadata - Metadata to set (e.g. { contentDisposition: 'inline' })
 * @returns {Promise<void>}
 */
async function setGCSObjectMetadata(filename, metadata) {
  const bucket = getBucket();
  const file = bucket.file(filename);
  await file.setMetadata(metadata);
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

// ─── Signed read-URL cache ───────────────────────────────────────────────────
// generateSignedReadUrl() calls GCS's IAM signBlob API (network round-trip)
// under Application Default Credentials. For live HLS segments, every viewer
// re-signing the same segment causes massive duplicate latency. This cache
// lets concurrent viewers reuse one signed URL per object until it's close
// to expiry.
const SIGNED_URL_CACHE_MAX_ENTRIES = 5000;
const SIGNED_URL_CACHE_SAFETY_MS = 2 * 60 * 1000; // refresh 2 min before real expiry
const signedUrlCache = new Map(); // objectPath -> { url, expiresAt }

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of signedUrlCache) {
    if (entry.expiresAt <= now) signedUrlCache.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Same as generateSignedReadUrl, but caches the result in-memory so that
 * concurrent requests for the same object (e.g. many viewers watching the
 * same live channel segment) reuse a single signed URL instead of each
 * triggering a separate IAM signBlob call.
 * @param {string} filename - Object path in bucket
 * @param {number} [expiresMinutes=30] - URL validity in minutes
 * @returns {Promise<string>} Signed read URL
 */
async function getCachedSignedReadUrl(filename, expiresMinutes = 30) {
  const now = Date.now();
  const cached = signedUrlCache.get(filename);
  if (cached && cached.expiresAt - SIGNED_URL_CACHE_SAFETY_MS > now) {
    return cached.url;
  }

  const url = await generateSignedReadUrl(filename, expiresMinutes);
  const expiresAt = now + expiresMinutes * 60 * 1000;

  if (signedUrlCache.size >= SIGNED_URL_CACHE_MAX_ENTRIES && !signedUrlCache.has(filename)) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (oldestKey !== undefined) signedUrlCache.delete(oldestKey);
  }
  signedUrlCache.set(filename, { url, expiresAt });

  return url;
}

/**
 * Resolve a raw media URL into a client-playable URL.
 * The media bucket is publicly readable, so GCS URLs are already directly
 * playable — no signing needed. Kept as an async function so existing
 * callers (which `await` it) don't need to change.
 * @param {string} rawUrl - Original stored URL
 * @returns {Promise<string>} Playable URL
 */
async function resolvePlayableUrl(rawUrl) {
  return rawUrl;
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
  getKycBucket,
  uploadToGCS,
  uploadKycDocToGCSBucket,
  deleteFromGCS,
  extractGCSPath,
  extractKycGCSPath,
  downloadFromGCS,
  generateSignedUploadUrl,
  generateSignedReadUrl,
  generateKycSignedReadUrl,
  getCachedSignedReadUrl,
  resolvePlayableUrl,
  createResumableUploadSession,
  getGCSObjectMetadata,
  setGCSObjectMetadata,
  BUCKET_NAME,
  KYC_BUCKET_NAME,
};
