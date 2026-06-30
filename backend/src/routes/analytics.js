/**
 * analytics.js — Advanced Analytics API
 * Provides optimized endpoints for the admin analytics dashboard.
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireRole('admin', 'reception'));

// GET /api/analytics/overview — All KPI cards in one request
router.get('/overview', async (req, res) => {
  try {
    const [[totalRevenue]]      = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out'");
    const [[todayRevenue]]      = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out' AND DATE(check_out_date)=CURDATE()");
    const [[monthRevenue]]      = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out' AND MONTH(check_out_date)=MONTH(CURDATE()) AND YEAR(check_out_date)=YEAR(CURDATE())");
    const [[totalRes]]          = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status != 'cancelled'");
    const [[activeGuests]]      = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status='checked_in'");
    const [[availableRooms]]    = await pool.query("SELECT COUNT(*) AS v FROM rooms WHERE status='available'");
    const [[occupiedRooms]]     = await pool.query("SELECT COUNT(*) AS v FROM rooms WHERE status='occupied'");
    const [[pendingRes]]        = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status='pending'");
    const [[totalRooms]]        = await pool.query("SELECT COUNT(*) AS v FROM rooms");
    const [[totalCustomers]]    = await pool.query("SELECT COUNT(*) AS v FROM customers");
    const [[avgRating]]         = await pool.query("SELECT COALESCE(AVG(rating),0) AS v FROM reviews WHERE status='approved'");
    const [[todayCheckins]]     = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE check_in_date=CURDATE() AND status IN ('confirmed','checked_in')");
    const [[todayCheckouts]]    = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE check_out_date=CURDATE() AND status='checked_in'");

    const occupancyRate = totalRooms.v > 0 ? ((occupiedRooms.v / totalRooms.v) * 100).toFixed(1) : 0;

    res.json({
      total_revenue:      Number(totalRevenue.v),
      today_revenue:      Number(todayRevenue.v),
      month_revenue:      Number(monthRevenue.v),
      total_reservations: totalRes.v,
      active_guests:      activeGuests.v,
      available_rooms:    availableRooms.v,
      occupied_rooms:     occupiedRooms.v,
      pending_reservations: pendingRes.v,
      total_rooms:        totalRooms.v,
      total_customers:    totalCustomers.v,
      avg_rating:         Number(avgRating.v).toFixed(1),
      occupancy_rate:     occupancyRate,
      today_checkins:     todayCheckins.v,
      today_checkouts:    todayCheckouts.v,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/analytics/revenue-monthly — Last 12 months
router.get('/revenue-monthly', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(check_out_date,'%Y-%m') AS month,
             SUM(total_amount) AS revenue,
             COUNT(*) AS checkouts
      FROM reservations
      WHERE status='checked_out'
        AND check_out_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(check_out_date,'%Y-%m')
      ORDER BY month ASC
    `);
    res.json(rows.map(r => ({ ...r, revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/reservations-monthly — Last 12 months
router.get('/reservations-monthly', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             COUNT(*) AS total,
             SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM reservations
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at,'%Y-%m')
      ORDER BY month ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/occupancy-rate — Daily for last 30 days
router.get('/occupancy-rate', async (req, res) => {
  try {
    const [[{ total_rooms }]] = await pool.query('SELECT COUNT(*) AS total_rooms FROM rooms');
    const [rows] = await pool.query(`
      SELECT DATE(check_in_date) AS date,
             COUNT(DISTINCT room_id) AS occupied_count
      FROM reservations
      WHERE status IN ('checked_in','checked_out')
        AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(check_in_date)
      ORDER BY date ASC
    `);
    res.json(rows.map(r => ({
      date: r.date,
      occupancy_rate: total_rooms > 0 ? ((r.occupied_count / total_rooms) * 100).toFixed(1) : 0,
    })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/room-type-popularity
router.get('/room-type-popularity', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rm.room_type,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount),0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id=r.room_id AND r.status != 'cancelled'
      GROUP BY rm.room_type
      ORDER BY bookings DESC
    `);
    res.json(rows.map(r => ({ ...r, revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/cancellation-rate — Monthly
router.get('/cancellation-rate', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             COUNT(*) AS total,
             SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM reservations
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at,'%Y-%m')
      ORDER BY month ASC
    `);
    res.json(rows.map(r => ({
      month: r.month,
      cancellation_rate: r.total > 0 ? ((r.cancelled / r.total) * 100).toFixed(1) : 0,
    })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/avg-stay
router.get('/avg-stay', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(check_out_date,'%Y-%m') AS month,
             ROUND(AVG(DATEDIFF(check_out_date, check_in_date)),1) AS avg_nights
      FROM reservations
      WHERE status='checked_out'
        AND check_out_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(check_out_date,'%Y-%m')
      ORDER BY month ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/top-customers
router.get('/top-customers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.name, c.email,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount),0) AS total_spend
      FROM customers c
      JOIN reservations r ON c.customer_id=r.customer_id AND r.status='checked_out'
      GROUP BY c.customer_id
      ORDER BY total_spend DESC
      LIMIT 10
    `);
    res.json(rows.map(r => ({ ...r, total_spend: Number(r.total_spend) })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/analytics/revenue-by-room-type
router.get('/revenue-by-room-type', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rm.room_type, COALESCE(SUM(r.total_amount),0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id=r.room_id AND r.status='checked_out'
      GROUP BY rm.room_type
      ORDER BY revenue DESC
    `);
    res.json(rows.map(r => ({ ...r, revenue: Number(r.revenue) })));
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

module.exports = router;
