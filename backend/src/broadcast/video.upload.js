const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadToGCS } = require('../utils/gcs');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.mp4', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only mp4 and webm video files are allowed'));
  }
};

const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
});

/**
 * Middleware: after multer places video in memory, upload to GCS.
 * Attaches `req.file.gcsUrl` with the public URL.
 */
async function uploadVideoToGCS(req, res, next) {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `videos/${crypto.randomUUID()}${ext}`;
    const url = await uploadToGCS(req.file.buffer, filename, req.file.mimetype);
    req.file.gcsUrl = url;
    req.file.filename = filename;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { videoUpload, uploadVideoToGCS };

