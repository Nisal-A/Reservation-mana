// backend/src/routes/analytics.js
// Advanced Analytics API (admin only)

const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { today } = require('../utils/dates');

const router = express.Router();

// Admin only
router.use(verifyToken, requireRole('admin'));

// GET /api/analytics/overview — All KPI cards in one request
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const todayStr = today();

    const [[totalRevenue]] = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out'");
    const [[todayRevenue]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out' AND check_out_date = ?",
      [todayStr]
    );
    const [[monthRevenue]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS v FROM reservations WHERE status='checked_out' AND DATE_FORMAT(check_out_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')",
      [todayStr]
    );
    const [[totalRes]]       = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status != 'cancelled'");
    const [[activeGuests]]   = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status='checked_in'");
    const [[availableRooms]] = await pool.query("SELECT COUNT(*) AS v FROM rooms WHERE status='available'");
    const [[occupiedRooms]]  = await pool.query("SELECT COUNT(*) AS v FROM rooms WHERE status='occupied'");
    const [[pendingRes]]     = await pool.query("SELECT COUNT(*) AS v FROM reservations WHERE status='pending'");
    const [[totalRooms]]     = await pool.query('SELECT COUNT(*) AS v FROM rooms');
    const [[totalCustomers]] = await pool.query('SELECT COUNT(*) AS v FROM customers');
    const [[avgRating]]      = await pool.query("SELECT COALESCE(AVG(rating),0) AS v FROM reviews WHERE status='approved'");
    const [[todayCheckins]]  = await pool.query(
      "SELECT COUNT(*) AS v FROM reservations WHERE check_in_date = ? AND status IN ('confirmed','checked_in')",
      [todayStr]
    );
    const [[todayCheckouts]] = await pool.query(
      "SELECT COUNT(*) AS v FROM reservations WHERE check_out_date = ? AND status='checked_in'",
      [todayStr]
    );

    const occupancyRate = totalRooms.v > 0 ? ((occupiedRooms.v / totalRooms.v) * 100).toFixed(1) : 0;

    res.json({
      total_revenue:        Number(totalRevenue.v),
      today_revenue:        Number(todayRevenue.v),
      month_revenue:        Number(monthRevenue.v),
      total_reservations:   totalRes.v,
      active_guests:        activeGuests.v,
      available_rooms:      availableRooms.v,
      occupied_rooms:       occupiedRooms.v,
      pending_reservations: pendingRes.v,
      total_rooms:          totalRooms.v,
      total_customers:      totalCustomers.v,
      avg_rating:           Number(avgRating.v).toFixed(1),
      occupancy_rate:       occupancyRate,
      today_checkins:       todayCheckins.v,
      today_checkouts:      todayCheckouts.v,
    });
  })
);

// GET /api/analytics/revenue-monthly — Last 12 months
router.get(
  '/revenue-monthly',
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(check_out_date,'%Y-%m') AS month,
              SUM(total_amount) AS revenue,
              COUNT(*) AS checkouts
       FROM reservations
       WHERE status='checked_out'
         AND check_out_date >= DATE_SUB(?, INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(check_out_date,'%Y-%m')
       ORDER BY month ASC`,
      [todayStr]
    );
    res.json(rows.map((r) => ({ ...r, revenue: Number(r.revenue) })));
  })
);

// GET /api/analytics/reservations-monthly — Last 12 months
router.get(
  '/reservations-monthly',
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
              COUNT(*) AS total,
              SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM reservations
       WHERE created_at >= DATE_SUB(?, INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at,'%Y-%m')
       ORDER BY month ASC`,
      [todayStr]
    );
    res.json(rows);
  })
);

// GET /api/analytics/occupancy-rate — Daily for last 30 days
router.get(
  '/occupancy-rate',
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [[{ total_rooms }]] = await pool.query('SELECT COUNT(*) AS total_rooms FROM rooms');
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(check_in_date, '%Y-%m-%d') AS date,
              COUNT(DISTINCT room_id) AS occupied_count
       FROM reservations
       WHERE status IN ('checked_in','checked_out')
         AND check_in_date >= DATE_SUB(?, INTERVAL 30 DAY)
       GROUP BY DATE_FORMAT(check_in_date, '%Y-%m-%d')
       ORDER BY date ASC`,
      [todayStr]
    );
    res.json(
      rows.map((r) => ({
        date: r.date,
        occupancy_rate: total_rooms > 0 ? ((r.occupied_count / total_rooms) * 100).toFixed(1) : 0,
      }))
    );
  })
);

// GET /api/analytics/room-type-popularity
router.get(
  '/room-type-popularity',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT rm.room_type,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount),0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id=r.room_id AND r.status != 'cancelled'
      GROUP BY rm.room_type
      ORDER BY bookings DESC
    `);
    res.json(rows.map((r) => ({ ...r, revenue: Number(r.revenue) })));
  })
);

// GET /api/analytics/cancellation-rate — Monthly
router.get(
  '/cancellation-rate',
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
              COUNT(*) AS total,
              SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM reservations
       WHERE created_at >= DATE_SUB(?, INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at,'%Y-%m')
       ORDER BY month ASC`,
      [todayStr]
    );
    res.json(
      rows.map((r) => ({
        month: r.month,
        cancellation_rate: r.total > 0 ? ((r.cancelled / r.total) * 100).toFixed(1) : 0,
      }))
    );
  })
);

// GET /api/analytics/avg-stay
router.get(
  '/avg-stay',
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(check_out_date,'%Y-%m') AS month,
              ROUND(AVG(DATEDIFF(check_out_date, check_in_date)),1) AS avg_nights
       FROM reservations
       WHERE status='checked_out'
         AND check_out_date >= DATE_SUB(?, INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(check_out_date,'%Y-%m')
       ORDER BY month ASC`,
      [todayStr]
    );
    res.json(rows);
  })
);

// GET /api/analytics/top-customers
router.get(
  '/top-customers',
  asyncHandler(async (req, res) => {
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
    res.json(rows.map((r) => ({ ...r, total_spend: Number(r.total_spend) })));
  })
);

// GET /api/analytics/revenue-by-room-type
router.get(
  '/revenue-by-room-type',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT rm.room_type, COALESCE(SUM(r.total_amount),0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id=r.room_id AND r.status='checked_out'
      GROUP BY rm.room_type
      ORDER BY revenue DESC
    `);
    res.json(rows.map((r) => ({ ...r, revenue: Number(r.revenue) })));
  })
);

module.exports = router;
