const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/summary — admin/reception
router.get('/summary', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [[{ total_reservations }]] = await pool.query(
      "SELECT COUNT(*) AS total_reservations FROM reservations WHERE status != 'cancelled'"
    );
    const [[{ total_revenue }]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM reservations WHERE status = 'checked_out'"
    );
    const [[{ available_rooms }]] = await pool.query(
      "SELECT COUNT(*) AS available_rooms FROM rooms WHERE status = 'available'"
    );
    const [[{ occupied_rooms }]] = await pool.query(
      "SELECT COUNT(*) AS occupied_rooms FROM rooms WHERE status = 'occupied'"
    );
    const [[{ total_rooms }]] = await pool.query(
      "SELECT COUNT(*) AS total_rooms FROM rooms"
    );
    const [[{ todays_checkins }]] = await pool.query(
      "SELECT COUNT(*) AS todays_checkins FROM reservations WHERE check_in_date = CURDATE() AND status IN ('confirmed','checked_in')"
    );
    const [[{ todays_checkouts }]] = await pool.query(
      "SELECT COUNT(*) AS todays_checkouts FROM reservations WHERE check_out_date = CURDATE() AND status = 'checked_in'"
    );
    const [[{ pending_reservations }]] = await pool.query(
      "SELECT COUNT(*) AS pending_reservations FROM reservations WHERE status = 'pending'"
    );

    res.json({
      total_reservations,
      total_revenue,
      available_rooms,
      occupied_rooms,
      total_rooms,
      todays_checkins,
      todays_checkouts,
      pending_reservations,
      occupancy_rate: total_rooms > 0 ? ((occupied_rooms / total_rooms) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/revenue — monthly revenue for past 6 months
router.get('/revenue', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(check_out_date, '%Y-%m') AS month,
        SUM(total_amount) AS revenue,
        COUNT(*) AS checkouts
      FROM reservations
      WHERE status = 'checked_out'
      AND check_out_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(check_out_date, '%Y-%m')
      ORDER BY month ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/rooms — room booking stats
router.get('/rooms', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rm.room_number, rm.room_type, rm.price,
             COUNT(r.reservation_id) AS total_bookings,
             COALESCE(SUM(r.total_amount), 0) AS total_revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id = r.room_id AND r.status != 'cancelled'
      GROUP BY rm.room_id
      ORDER BY total_bookings DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/reservations-by-status
router.get('/by-status', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM reservations
      GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/room-types
router.get('/room-types', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rm.room_type,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount), 0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id = r.room_id AND r.status != 'cancelled'
      GROUP BY rm.room_type
      ORDER BY bookings DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
