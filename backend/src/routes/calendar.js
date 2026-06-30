/**
 * calendar.js — Room Availability Calendar API
 * GET /api/calendar?year=YYYY&month=MM
 * Returns all rooms with their reservation status per day of the month.
 * Admin & Reception roles only (guest names visible).
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar
router.get('/', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    // Build first and last day of the requested month
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay  = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch all rooms (with optional filters)
    const { room_type, room_number, floor } = req.query;
    let roomQuery = 'SELECT room_id, room_number, room_type, status, floor FROM rooms WHERE 1=1';
    const roomParams = [];
    if (room_type)   { roomQuery += ' AND room_type = ?';   roomParams.push(room_type); }
    if (room_number) { roomQuery += ' AND room_number = ?'; roomParams.push(room_number); }
    if (floor)       { roomQuery += ' AND floor = ?';       roomParams.push(floor); }
    roomQuery += ' ORDER BY room_number ASC';

    const [rooms] = await pool.query(roomQuery, roomParams);

    // Fetch reservations that overlap with the month
    const [reservations] = await pool.query(`
      SELECT r.reservation_id, r.room_id, r.check_in_date, r.check_out_date,
             r.status, c.name AS guest_name
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.status NOT IN ('cancelled')
        AND r.check_in_date <= ? AND r.check_out_date >= ?
      ORDER BY r.check_in_date ASC
    `, [lastDay, firstDay]);

    // Build a map: room_id -> reservations[]
    const resByRoom = {};
    for (const res of reservations) {
      if (!resByRoom[res.room_id]) resByRoom[res.room_id] = [];
      resByRoom[res.room_id].push(res);
    }

    // Build day-status for each room across the month
    const daysInMonth = new Date(year, month, 0).getDate();

    const calendarData = rooms.map((room) => {
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dateStr = date.toISOString().split('T')[0];

        // Find if any reservation covers this day
        const res = (resByRoom[room.room_id] || []).find((r) => {
          return dateStr >= r.check_in_date.toISOString?.().split('T')[0] || r.check_in_date.slice(0,10)
            && dateStr < (r.check_out_date.toISOString?.().split('T')[0] || r.check_out_date.slice(0,10));
        });

        let dayStatus = room.status;
        let guestName = null;

        if (res) {
          const cin  = typeof res.check_in_date  === 'string' ? res.check_in_date  : res.check_in_date.toISOString().split('T')[0];
          const cout = typeof res.check_out_date === 'string' ? res.check_out_date : res.check_out_date.toISOString().split('T')[0];
          if (dateStr >= cin && dateStr < cout) {
            dayStatus = res.status === 'checked_in' ? 'occupied' : 'reserved';
            guestName = res.guest_name;
          }
        }

        days.push({ date: dateStr, day: d, status: dayStatus, guest_name: guestName });
      }

      return {
        room_id: room.room_id,
        room_number: room.room_number,
        room_type: room.room_type,
        base_status: room.status,
        days,
        reservations: (resByRoom[room.room_id] || []).map(r => ({
          reservation_id: r.reservation_id,
          check_in_date:  typeof r.check_in_date  === 'string' ? r.check_in_date  : r.check_in_date.toISOString().split('T')[0],
          check_out_date: typeof r.check_out_date === 'string' ? r.check_out_date : r.check_out_date.toISOString().split('T')[0],
          status: r.status,
          guest_name: r.guest_name,
        })),
      };
    });

    res.json({ year, month, days_in_month: daysInMonth, rooms: calendarData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
