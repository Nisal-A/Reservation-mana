// backend/src/routes/frontdesk.js
// Frontdesk summary endpoints for staff (admin and reception)

const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { today, nightsBetween } = require('../utils/dates');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('admin', 'reception'));

function formatRow(r) {
  const totalAmount = Number(Number(r.total_amount).toFixed(2));
  const totalPaid = Number(Number(r.total_paid || 0).toFixed(2));
  const balance = Number(Math.max(0, totalAmount - totalPaid).toFixed(2));

  return {
    reservation_id: r.reservation_id,
    booking_ref: r.booking_ref,
    guest_name: r.guest_name,
    name: r.guest_name,
    phone: r.phone || '—',
    guest_phone: r.phone || '—',
    guest_email: r.guest_email || '—',
    room_number: r.room_number,
    room_type: r.room_type,
    dates: `${r.check_in_date} to ${r.check_out_date}`,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: nightsBetween(r.check_in_date, r.check_out_date),
    guests: r.guests,
    remark: r.remark,
    booking_source: r.booking_source,
    nightly_rate: Number(Number(r.nightly_rate).toFixed(2)),
    total_amount: totalAmount,
    paid_amount: totalPaid,
    balance,
    status: r.status,
    payment_status: r.payment_status,
    created_at: r.created_at,
  };
}

/**
 * GET /api/frontdesk/summary
 * Returns counts and lists for arrivals, departures, in_house, pending, and outstanding
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const todayStr = today();

    const baseSelect = `
      SELECT
        r.reservation_id,
        r.booking_ref,
        r.status,
        DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
        DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
        r.nightly_rate,
        r.total_amount,
        r.payment_status,
        r.remark,
        r.guests,
        r.booking_source,
        r.created_at,
        c.name AS guest_name,
        c.phone AS phone,
        c.email AS guest_email,
        rm.room_number,
        rm.room_type,
        COALESCE(SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0) AS total_paid
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      LEFT JOIN payments p ON r.reservation_id = p.reservation_id
    `;

    // 1. Arrivals: confirmed, check_in_date = today
    const [arrivalsRows] = await pool.query(
      `
      ${baseSelect}
      WHERE r.status = 'confirmed' AND r.check_in_date = ?
      GROUP BY r.reservation_id
      ORDER BY rm.room_number ASC, r.created_at ASC
      `,
      [todayStr]
    );

    // 2. Departures: checked_in, check_out_date = today
    const [departuresRows] = await pool.query(
      `
      ${baseSelect}
      WHERE r.status = 'checked_in' AND r.check_out_date = ?
      GROUP BY r.reservation_id
      ORDER BY rm.room_number ASC
      `,
      [todayStr]
    );

    // 3. In House: checked_in
    const [inHouseRows] = await pool.query(
      `
      ${baseSelect}
      WHERE r.status = 'checked_in'
      GROUP BY r.reservation_id
      ORDER BY rm.room_number ASC
      `
    );

    // 4. Pending: status pending, oldest first
    const [pendingRows] = await pool.query(
      `
      ${baseSelect}
      WHERE r.status = 'pending'
      GROUP BY r.reservation_id
      ORDER BY r.created_at ASC
      `
    );

    // 5. Outstanding: non-cancelled, status in ('checked_in', 'checked_out'), balance > 0, largest first, limit 10
    const [outstandingRowsRaw] = await pool.query(
      `
      ${baseSelect}
      WHERE r.status NOT IN ('cancelled', 'no_show')
        AND r.status IN ('checked_in', 'checked_out')
      GROUP BY r.reservation_id
      `
    );

    const formattedArrivals = arrivalsRows.map(formatRow);
    const formattedDepartures = departuresRows.map(formatRow);
    const formattedInHouse = inHouseRows.map(formatRow);
    const formattedPending = pendingRows.map(formatRow);
    const formattedOutstandingAll = outstandingRowsRaw
      .map(formatRow)
      .filter((row) => row.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const formattedOutstanding = formattedOutstandingAll.slice(0, 10);

    const totalOutstandingAmount = Number(
      formattedOutstandingAll.reduce((sum, item) => sum + item.balance, 0).toFixed(2)
    );

    res.json({
      today: todayStr,
      counts: {
        arrivals: formattedArrivals.length,
        departures: formattedDepartures.length,
        in_house: formattedInHouse.length,
        pending: formattedPending.length,
        outstanding: totalOutstandingAmount,
        outstanding_count: formattedOutstandingAll.length,
      },
      arrivals: formattedArrivals,
      departures: formattedDepartures,
      in_house: formattedInHouse,
      pending: formattedPending,
      outstanding: formattedOutstanding,
    });
  })
);

module.exports = router;
