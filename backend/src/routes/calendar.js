// backend/src/routes/calendar.js
// Staff Room Availability Calendar API

const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { today, addDays } = require('../utils/dates');

const router = express.Router();

// Staff only
router.use(verifyToken, requireRole('admin', 'reception'));

const calendarQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    room_type: z.string().optional(),
    room_number: z.string().optional(),
  }),
});

router.get(
  '/',
  validate(calendarQuerySchema),
  asyncHandler(async (req, res) => {
    const todayStr = today();
    const [currentYear, currentMonth] = todayStr.split('-').map(Number);

    const year = req.query.year || currentYear;
    const month = req.query.month || currentMonth;

    // Number of days in the requested month (UTC-safe, no timezone shift)
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const monthStr = String(month).padStart(2, '0');
    const firstDay = `${year}-${monthStr}-01`;
    const lastDay = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
    const afterLastDay = addDays(lastDay, 1);

    // Fetch rooms (NO floor column or filter)
    const { room_type, room_number } = req.query;
    let roomQuery = 'SELECT room_id, room_number, room_type, status, price, capacity FROM rooms WHERE 1=1';
    const roomParams = [];

    if (room_type) {
      roomQuery += ' AND room_type = ?';
      roomParams.push(room_type);
    }
    if (room_number) {
      roomQuery += ' AND room_number = ?';
      roomParams.push(room_number);
    }

    roomQuery += ' ORDER BY room_number ASC';
    const [rooms] = await pool.query(roomQuery, roomParams);

    // Fetch active reservations that overlap with this month
    const [reservations] = await pool.query(
      `SELECT r.reservation_id, r.booking_ref, r.room_id,
              DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
              DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
              r.status, c.name AS guest_name
       FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       WHERE r.status IN ('checked_in', 'confirmed', 'pending')
         AND r.check_in_date < ?
         AND r.check_out_date > ?
       ORDER BY
         CASE r.status
           WHEN 'checked_in' THEN 1
           WHEN 'confirmed' THEN 2
           WHEN 'pending' THEN 3
           ELSE 4
         END ASC,
         r.check_in_date ASC`,
      [afterLastDay, firstDay]
    );

    // Group reservations by room_id
    const resByRoom = new Map();
    for (const r of reservations) {
      if (!resByRoom.has(r.room_id)) {
        resByRoom.set(r.room_id, []);
      }
      resByRoom.get(r.room_id).push(r);
    }

    // Build the day grid for each room
    const calendarRooms = rooms.map((room) => {
      const roomReservations = resByRoom.get(room.room_id) || [];
      const days = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;

        // A stay occupies night dateStr if dateStr >= check_in_date AND dateStr < check_out_date
        const matchingRes = roomReservations.find(
          (r) => dateStr >= r.check_in_date && dateStr < r.check_out_date
        );

        let dayStatus;
        let bookingRef = null;
        let guestName = null;

        if (matchingRes) {
          dayStatus = matchingRes.status === 'checked_in' ? 'occupied' : 'reserved';
          bookingRef = matchingRes.booking_ref;
          guestName = matchingRes.guest_name;
        } else if (room.status === 'maintenance') {
          dayStatus = 'maintenance';
        } else {
          dayStatus = 'available';
        }

        days.push({
          date: dateStr,
          day: d,
          status: dayStatus,
          booking_ref: bookingRef,
          guest_name: guestName,
        });
      }

      return {
        room_id: room.room_id,
        room_number: room.room_number,
        room_type: room.room_type,
        base_status: room.status,
        price: Number(Number(room.price).toFixed(2)),
        capacity: Number(room.capacity),
        days,
        reservations: roomReservations.map((r) => ({
          reservation_id: r.reservation_id,
          booking_ref: r.booking_ref,
          check_in_date: r.check_in_date,
          check_out_date: r.check_out_date,
          status: r.status,
          guest_name: r.guest_name,
        })),
      };
    });

    res.json({
      year,
      month,
      days_in_month: daysInMonth,
      rooms: calendarRooms,
    });
  })
);

module.exports = router;
