// backend/src/routes/upload.js
// Admin image upload route (up to 8 images per request)

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');

const router = express.Router();
const uploader = createUploader();

// POST /api/upload — upload room images (admin only)
router.post(
  '/',
  verifyToken,
  requireRole('admin'),
  (req, res, next) => {
    uploader.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message, errors: [] });
      }
      next();
    });
  },
  (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'No file uploaded.', errors: [] });
    }

    if (files.length > 8) {
      return res.status(400).json({ message: 'Maximum 8 files allowed in one request.', errors: [] });
    }

    const paths = files.map((f) => `/uploads/${f.filename}`);

    res.status(200).json({
      imageUrl: paths[0],
      imageUrls: paths,
      paths,
    });
  }
);

module.exports = router;
