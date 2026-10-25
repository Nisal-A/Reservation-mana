// backend/src/middleware/upload.js
// Secure multer configuration for image uploads (.jpg, .jpeg, .png, .webp only, 5MB max, random filenames)

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const defaultUploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(defaultUploadDir)) {
  fs.mkdirSync(defaultUploadDir, { recursive: true });
}

function createUploader(destinationDir = defaultUploadDir) {
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const randomHex = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomHex}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!ALLOWED_EXTS.has(ext) || !ALLOWED_MIMES.has(mime)) {
      const err = new Error('Invalid file type. Only .jpg, .jpeg, .png, and .webp files are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  };

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
  });
}

module.exports = {
  createUploader,
  ALLOWED_EXTS,
  ALLOWED_MIMES,
};
