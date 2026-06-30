const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: calculate total amount
const calcTotal = (checkIn, checkOut, pricePerNight) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay);
  return nights * pricePerNight;
};

// Helper: check overlap
const hasOverlap = async (roomId, checkIn, checkOut, excludeId = null) => {
  let query = `
    SELECT reservation_id FROM reservations
    WHERE room_id = ?
    AND status NOT IN ('cancelled', 'checked_out')
    AND NOT (check_out_date <= ? OR check_in_date >= ?)
  `;
  const params = [roomId, checkIn, checkOut];
  if (excludeId) { query += ' AND reservation_id != ?'; params.push(excludeId); }
  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

// GET /api/reservations — admin/reception: all; customer: own
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, room_id, customer_id, search, from_date, to_date } = req.query;

    let query = `
      SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
             rm.room_number, rm.room_type, rm.price AS room_price
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'customer') {
      query += ' AND r.customer_id = ?';
      params.push(req.user.customer_id);
    } else if (customer_id) {
      query += ' AND r.customer_id = ?';
      params.push(customer_id);
    }

    if (status) { query += ' AND r.status = ?'; params.push(status); }
    if (room_id) { query += ' AND r.room_id = ?'; params.push(room_id); }
    if (from_date) { query += ' AND r.check_in_date >= ?'; params.push(from_date); }
    if (to_date)   { query += ' AND r.check_out_date <= ?'; params.push(to_date); }
    if (search && req.user.role !== 'customer') {
      query += ' AND (c.name LIKE ? OR c.email LIKE ? OR rm.room_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reservations/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              rm.room_number, rm.room_type, rm.price AS room_price
       FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.reservation_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Reservation not found.' });

    const res_ = rows[0];
    if (req.user.role === 'customer' && res_.customer_id !== req.user.customer_id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.json(res_);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/reservations — customer self-book or reception/admin create
router.post('/', verifyToken, async (req, res) => {
  const { customer_id, room_id, check_in_date, check_out_date, remark } = req.body;

  const resolvedCustomerId = req.user.role === 'customer' ? req.user.customer_id : customer_id;

  if (!resolvedCustomerId || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ message: 'customer_id, room_id, check_in_date, check_out_date are required.' });
  }

  if (new Date(check_out_date) <= new Date(check_in_date)) {
    return res.status(400).json({ message: 'Check-out must be after check-in.' });
  }

  try {
    // Check room exists and get price
    const [roomRows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [room_id]);
    if (roomRows.length === 0) return res.status(404).json({ message: 'Room not found.' });

    const room = roomRows[0];
    if (room.status === 'maintenance') {
      return res.status(400).json({ message: 'Room is under maintenance.' });
    }

    // Check date overlap
    const overlap = await hasOverlap(room_id, check_in_date, check_out_date);
    if (overlap) {
      return res.status(409).json({ message: 'Room is already booked for the selected dates.' });
    }

    const total = calcTotal(check_in_date, check_out_date, room.price);

    const [result] = await pool.query(
      `INSERT INTO reservations (customer_id, room_id, check_in_date, check_out_date, total_amount, status, remark)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`,
      [resolvedCustomerId, room_id, check_in_date, check_out_date, total, remark || null]
    );

    const [newRes] = await pool.query(
      `SELECT r.*, c.name AS customer_name, rm.room_number, rm.room_type
       FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.reservation_id = ?`,
      [result.insertId]
    );

    res.status(201).json(newRes[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PATCH /api/reservations/:id/cancel
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reservations WHERE reservation_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Reservation not found.' });

    const reservation = rows[0];

    if (req.user.role === 'customer' && reservation.customer_id !== req.user.customer_id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (['checked_in', 'checked_out', 'cancelled'].includes(reservation.status)) {
      return res.status(400).json({ message: `Cannot cancel a reservation with status: ${reservation.status}` });
    }

    await pool.query(
      "UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?",
      [req.params.id]
    );

    // Free room if it was occupied by this reservation specifically
    if (reservation.status === 'checked_in') {
      await pool.query("UPDATE rooms SET status = 'available' WHERE room_id = ?", [reservation.room_id]);
    }

    res.json({ message: 'Reservation cancelled successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PATCH /api/reservations/:id/checkin — reception/admin
router.patch('/:id/checkin', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reservations WHERE reservation_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Reservation not found.' });

    const reservation = rows[0];
    if (reservation.status !== 'confirmed') {
      return res.status(400).json({ message: `Cannot check in. Current status: ${reservation.status}` });
    }

    await pool.query(
      "UPDATE reservations SET status = 'checked_in' WHERE reservation_id = ?",
      [req.params.id]
    );
    await pool.query(
      "UPDATE rooms SET status = 'occupied' WHERE room_id = ?",
      [reservation.room_id]
    );

    res.json({ message: 'Guest checked in successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PATCH /api/reservations/:id/checkout — reception/admin
router.patch('/:id/checkout', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  const { remark, payment_method } = req.body;
  try {
    const [rows] = await pool.query(
      `SELECT r.*, rm.price AS room_price FROM reservations r
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.reservation_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Reservation not found.' });

    const reservation = rows[0];
    if (reservation.status !== 'checked_in') {
      return res.status(400).json({ message: `Cannot check out. Current status: ${reservation.status}` });
    }

    // Recalculate final total
    const finalTotal = calcTotal(reservation.check_in_date, reservation.check_out_date, reservation.room_price);

    await pool.query(
      "UPDATE reservations SET status = 'checked_out', total_amount = ?, remark = COALESCE(?, remark), payment_method = ? WHERE reservation_id = ?",
      [finalTotal, remark || null, payment_method || null, req.params.id]
    );
    await pool.query(
      "UPDATE rooms SET status = 'available' WHERE room_id = ?",
      [reservation.room_id]
    );

    res.json({ message: 'Guest checked out successfully.', total_amount: finalTotal, payment_method });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reservations/customers/list — reception/admin: list all customers
router.get('/customers/list', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
