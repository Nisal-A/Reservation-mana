// backend/src/routes/reviews.js
// Customer Reviews API

const express = require('express');
const path = require('path');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// All reviews endpoints require authentication
router.use(verifyToken);

// Multer uploader for review images (.jpg, .jpeg, .png, .webp, 5MB, random filenames)
const reviewUploadDir = path.join(__dirname, '../../public/uploads/reviews');
const reviewUploader = createUploader(reviewUploadDir);

async function resolveCustomerId(user) {
  if (user.customer_id) return user.customer_id;
  if (user.user_id) {
    const [rows] = await pool.query('SELECT customer_id FROM customers WHERE user_id = ?', [user.user_id]);
    if (rows.length > 0) return rows[0].customer_id;
  }
  return null;
}

// ─── Validation Schemas ────────────────────────────────────────────────────────

const reviewBodySchema = z.object({
  reservation_id: z.coerce.number().int().positive('Valid reservation_id is required'),
  rating: z.coerce.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  review_text: z.string().trim().max(1000, 'Review text cannot exceed 1000 characters').optional().nullable(),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid review ID is required'),
  }),
});

const adminNoteSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid review ID is required'),
  }),
  body: z.object({
    admin_note: z.string().max(255).optional().nullable(),
  }),
});

// ─── 1. POST /api/reviews — Submit review (Customer only) ───────────────────────
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  (req, res, next) => {
    reviewUploader.single('image')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message, errors: [] });
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const parseResult = reviewBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: parseResult.error.errors[0]?.message || 'Validation failed',
        errors: parseResult.error.errors,
      });
    }

    const { reservation_id, rating, review_text } = parseResult.data;
    const customerId = await resolveCustomerId(req.user);

    if (!customerId) {
      return res.status(403).json({ message: 'No customer profile found for this user.', errors: [] });
    }

    // Verify reservation belongs to this customer
    const [resRows] = await pool.query(
      'SELECT reservation_id, customer_id, room_id, status FROM reservations WHERE reservation_id = ?',
      [reservation_id]
    );

    if (resRows.length === 0 || resRows[0].customer_id !== customerId) {
      return res.status(404).json({ message: 'Reservation not found.', errors: [] });
    }

    const reservation = resRows[0];

    // Only checked_out reservations can be reviewed
    if (reservation.status !== 'checked_out') {
      return res.status(400).json({
        message: 'Only checked out reservations can be reviewed.',
        errors: [],
      });
    }

    // Check if already reviewed (one review per reservation)
    const [existing] = await pool.query(
      'SELECT review_id FROM reviews WHERE reservation_id = ?',
      [reservation_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        message: 'You have already reviewed this reservation.',
        errors: [],
      });
    }

    const imageUrl = req.file ? `/uploads/reviews/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO reviews (reservation_id, customer_id, room_id, rating, review_text, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [reservation_id, customerId, reservation.room_id, rating, review_text || null, imageUrl]
    );

    res.status(201).json({
      message: 'Review submitted successfully! It will appear after admin approval.',
      review_id: result.insertId,
    });
  })
);

// ─── 2. GET /api/reviews — List reviews ────────────────────────────────────────
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { status, room_id } = req.query;

    let query = `
      SELECT rv.*, c.name AS customer_name, rm.room_number, rm.room_type,
             DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
             DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date
      FROM reviews rv
      JOIN customers c ON rv.customer_id = c.customer_id
      JOIN rooms rm ON rv.room_id = rm.room_id
      LEFT JOIN reservations r ON rv.reservation_id = r.reservation_id
      WHERE 1=1
    `;
    const params = [];

    // Customers only see their own reviews
    if (req.user.role === 'customer') {
      const customerId = await resolveCustomerId(req.user);
      query += ' AND rv.customer_id = ?';
      params.push(customerId || 0);
    }

    if (status) {
      query += ' AND rv.status = ?';
      params.push(status);
    }

    if (room_id) {
      query += ' AND rv.room_id = ?';
      params.push(room_id);
    }

    query += ' ORDER BY rv.created_at DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  })
);

// GET /api/reviews/:id — Review detail with isolation
router.get(
  '/:id',
  verifyToken,
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM reviews WHERE review_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found.', errors: [] });
    }
    const review = rows[0];
    if (req.user.role === 'customer') {
      const customerId = await resolveCustomerId(req.user);
      if (review.customer_id !== customerId && review.status !== 'approved') {
        return res.status(404).json({ message: 'Review not found.', errors: [] });
      }
    }
    res.json(review);
  })
);

// ─── 3. GET /api/reviews/eligible — Completed stays eligible for review ────────
router.get(
  '/eligible',
  verifyToken,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    const customerId = await resolveCustomerId(req.user);
    if (!customerId) {
      return res.json([]);
    }

    const [rows] = await pool.query(
      `SELECT r.reservation_id, r.booking_ref,
              DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
              DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
              rm.room_number, rm.room_type,
              (SELECT COUNT(*) FROM reviews rv WHERE rv.reservation_id = r.reservation_id) AS reviewed
       FROM reservations r
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.status = 'checked_out' AND r.customer_id = ?
       ORDER BY r.check_out_date DESC`,
      [customerId]
    );

    res.json(rows);
  })
);

// ─── 4. PATCH /api/reviews/:id/approve (Admin only) ───────────────────────────
router.patch(
  '/:id/approve',
  verifyToken,
  requireRole('admin'),
  validate(adminNoteSchema),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT review_id FROM reviews WHERE review_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found.', errors: [] });
    }

    await pool.query(
      "UPDATE reviews SET status = 'approved', admin_note = ? WHERE review_id = ?",
      [req.body.admin_note || null, req.params.id]
    );

    res.json({ message: 'Review approved.' });
  })
);

// ─── 5. PATCH /api/reviews/:id/reject (Admin only) ────────────────────────────
router.patch(
  '/:id/reject',
  verifyToken,
  requireRole('admin'),
  validate(adminNoteSchema),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT review_id FROM reviews WHERE review_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found.', errors: [] });
    }

    await pool.query(
      "UPDATE reviews SET status = 'rejected', admin_note = ? WHERE review_id = ?",
      [req.body.admin_note || null, req.params.id]
    );

    res.json({ message: 'Review rejected.' });
  })
);

// ─── 6. DELETE /api/reviews/:id (Admin only) ──────────────────────────────────
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT review_id FROM reviews WHERE review_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found.', errors: [] });
    }

    await pool.query('DELETE FROM reviews WHERE review_id = ?', [req.params.id]);
    res.json({ message: 'Review deleted.' });
  })
);

module.exports = router;
