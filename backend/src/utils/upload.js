const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadToGCS } = require('./gcs');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpg, png, and webp files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Middleware: after multer places the file in memory, upload it to GCS.
 * Attaches `req.file.gcsUrl` with the public URL.
 * Works for `upload.single()`.
 */
async function uploadSingleToGCS(req, res, next) {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `images/${crypto.randomUUID()}${ext}`;
    const url = await uploadToGCS(req.file.buffer, filename, req.file.mimetype);
    req.file.gcsUrl = url;
    req.file.filename = filename;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: after multer places files in memory, upload them to GCS.
 * Works for `upload.fields()`. Attaches `gcsUrl` on each file object.
 */
async function uploadFieldsToGCS(req, res, next) {
  if (!req.files) return next();
  try {
    for (const fieldName of Object.keys(req.files)) {
      for (const file of req.files[fieldName]) {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `images/${crypto.randomUUID()}${ext}`;
        const url = await uploadToGCS(file.buffer, filename, file.mimetype);
        file.gcsUrl = url;
        file.filename = filename;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, uploadSingleToGCS, uploadFieldsToGCS };

