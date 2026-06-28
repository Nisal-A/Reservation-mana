const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms — all rooms (any authenticated user)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (status) { query += ' AND status = ?'; params.push(status); }
    if (type)   { query += ' AND room_type = ?'; params.push(type); }

    query += ' ORDER BY room_number ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/rooms/available — check availability for date range (authenticated)
router.get('/available', verifyToken, async (req, res) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ message: 'check_in and check_out dates are required.' });
  }

  try {
    const query = `
      SELECT r.* FROM rooms r
      WHERE r.status != 'maintenance'
      AND r.room_id NOT IN (
        SELECT res.room_id FROM reservations res
        WHERE res.status NOT IN ('cancelled', 'checked_out')
        AND NOT (res.check_out_date <= ? OR res.check_in_date >= ?)
      )
      ORDER BY r.room_type, r.price ASC
    `;
    const [rows] = await pool.query(query, [check_in, check_out]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/rooms/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Room not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/rooms — Admin only
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { room_number, room_type, price, status, description, image_url } = req.body;
  if (!room_number || !room_type || !price) {
    return res.status(400).json({ message: 'room_number, room_type, and price are required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO rooms (room_number, room_type, price, status, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [room_number, room_type, price, status || 'available', description || null, image_url || null]
    );
    const [newRoom] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [result.insertId]);
    res.status(201).json(newRoom[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Room number already exists.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/rooms/:id — Admin only
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { room_number, room_type, price, status, description, image_url } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Room not found.' });

    await pool.query(
      `UPDATE rooms SET 
        room_number = ?, room_type = ?, price = ?, status = ?, description = ?, image_url = ?
       WHERE room_id = ?`,
      [
        room_number || existing[0].room_number,
        room_type   || existing[0].room_type,
        price       || existing[0].price,
        status      || existing[0].status,
        description !== undefined ? description : existing[0].description,
        image_url   !== undefined ? image_url   : existing[0].image_url,
        req.params.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/rooms/:id — Admin only
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Room not found.' });

    // Check active reservations
    const [active] = await pool.query(
      `SELECT reservation_id FROM reservations 
       WHERE room_id = ? AND status IN ('pending','confirmed','checked_in')`,
      [req.params.id]
    );
    if (active.length > 0) {
      return res.status(409).json({ message: 'Cannot delete room with active reservations.' });
    }

    await pool.query('DELETE FROM rooms WHERE room_id = ?', [req.params.id]);
    res.json({ message: 'Room deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
