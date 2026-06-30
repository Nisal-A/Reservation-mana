/**
 * reviews.js — Customer Reviews API
 * Only customers who completed a stay can review.
 * Admin can approve/reject/delete reviews.
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer for review images
const uploadDir = path.join(__dirname, '../../public/uploads/reviews');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `review_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// ─── POST submit review (customer only) ──────────────────────────────────────
router.post('/', verifyToken, requireRole('customer'), upload.single('image'), async (req, res) => {
  const { reservation_id, rating, review_text } = req.body;
  if (!reservation_id || !rating) {
    return res.status(400).json({ message: 'reservation_id and rating are required.' });
  }

  try {
    // Verify reservation belongs to this customer and is checked_out
    const [resRows] = await pool.query(
      `SELECT r.*, c.customer_id FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       JOIN users u ON c.user_id = u.user_id
       WHERE r.reservation_id = ? AND u.user_id = ? AND r.status = 'checked_out'`,
      [reservation_id, req.user.id]
    );

    if (resRows.length === 0) {
      return res.status(403).json({ message: 'You can only review completed reservations.' });
    }

    const reservation = resRows[0];

    // Check if already reviewed
    const [existing] = await pool.query(
      'SELECT review_id FROM reviews WHERE reservation_id=?', [reservation_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You have already reviewed this reservation.' });
    }

    const imageUrl = req.file ? `/uploads/reviews/${req.file.filename}` : null;

    const [result] = await pool.query(
      'INSERT INTO reviews (reservation_id, customer_id, room_id, rating, review_text, image_url) VALUES (?,?,?,?,?,?)',
      [reservation_id, reservation.customer_id, reservation.room_id, rating, review_text || null, imageUrl]
    );

    res.status(201).json({ message: 'Review submitted successfully! It will appear after admin approval.', review_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET all reviews (admin sees all; customer sees own) ──────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, room_id } = req.query;
    let query = `
      SELECT rv.*, c.name AS customer_name, rm.room_number, rm.room_type
      FROM reviews rv
      JOIN customers c ON rv.customer_id = c.customer_id
      JOIN rooms rm ON rv.room_id = rm.room_id
      WHERE 1=1
    `;
    const params = [];

    // Customers only see their own
    if (req.user.role === 'customer') {
      query += ' AND c.user_id = ?'; params.push(req.user.id);
    }
    if (status)  { query += ' AND rv.status=?';  params.push(status); }
    if (room_id) { query += ' AND rv.room_id=?'; params.push(room_id); }
    query += ' ORDER BY rv.created_at DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET reviews for a specific room (any authenticated user) ─────────────────
router.get('/room/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rv.*, c.name AS customer_name
      FROM reviews rv
      JOIN customers c ON rv.customer_id = c.customer_id
      WHERE rv.room_id = ? AND rv.status = 'approved'
      ORDER BY rv.created_at DESC
      LIMIT 20
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET eligibility — which reservations can a customer review ───────────────
router.get('/eligible', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.reservation_id, r.check_in_date, r.check_out_date,
             rm.room_number, rm.room_type,
             (SELECT COUNT(*) FROM reviews rv WHERE rv.reservation_id = r.reservation_id) AS reviewed
      FROM reservations r
      JOIN rooms rm ON r.room_id = rm.room_id
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN users u ON c.user_id = u.user_id
      WHERE r.status = 'checked_out' AND u.user_id = ?
      ORDER BY r.check_out_date DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PATCH approve ────────────────────────────────────────────────────────────
router.patch('/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query("UPDATE reviews SET status='approved', admin_note=? WHERE review_id=?",
      [req.body.admin_note || null, req.params.id]);
    res.json({ message: 'Review approved.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PATCH reject ─────────────────────────────────────────────────────────────
router.patch('/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query("UPDATE reviews SET status='rejected', admin_note=? WHERE review_id=?",
      [req.body.admin_note || null, req.params.id]);
    res.json({ message: 'Review rejected.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE review_id=?', [req.params.id]);
    res.json({ message: 'Review deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET room summary (avg rating + count) ────────────────────────────────────
router.get('/summary/rooms', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT room_id,
             ROUND(AVG(rating),1) AS avg_rating,
             COUNT(*) AS review_count
      FROM reviews
      WHERE status = 'approved'
      GROUP BY room_id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
