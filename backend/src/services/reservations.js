// backend/src/services/reservations.js
// Core reservation business logic and transaction service

const pool = require('../config/db');
const env = require('../config/env');
const { quote } = require('./quote');
const { assertRoomBookable } = require('./availability');
const { logAudit } = require('../utils/audit');
const { today, nightsBetween, getHotelTimestamp } = require('../utils/dates');
const { CANCEL_WINDOW_HOURS } = require('./config/rules');

/**
 * Fetch full reservation details by ID or reference including room and customer info.
 */
async function fetchFullReservation(connOrPool, identifier, byId = false) {
  const query = `
    SELECT
      r.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      rm.room_number,
      rm.room_type,
      rm.price AS room_price,
      rm.capacity AS room_capacity,
      rm.bed_type AS room_bed_type,
      rm.size_sqm AS room_size_sqm,
      rm.view_label AS room_view_label
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE ${byId ? 'r.reservation_id = ?' : 'r.booking_ref = ?'}
  `;
  const [rows] = await connOrPool.query(query, [identifier]);
  return rows[0] || null;
}

/**
 * Resolve existing customer ID or create a new customer record.
 */
async function resolveOrCreateCustomer(conn, { customerId, customer }) {
  if (customerId) {
    const [rows] = await conn.query(
      'SELECT customer_id, name, email, phone FROM customers WHERE customer_id = ?',
      [customerId]
    );
    if (rows.length === 0) {
      const err = new Error('Customer not found.');
      err.status = 404;
      throw err;
    }
    return rows[0].customer_id;
  }

  if (customer && customer.email) {
    const [existing] = await conn.query(
      'SELECT customer_id FROM customers WHERE email = ?',
      [customer.email]
    );
    if (existing.length > 0) {
      return existing[0].customer_id;
    }

    const [res] = await conn.query(
      'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
      [customer.name, customer.email, customer.phone || null]
    );
    return res.insertId;
  }

  const err = new Error('Valid customer_id or customer { name, email, phone } is required.');
  err.status = 400;
  throw err;
}

/**
 * Create a new reservation inside a transaction.
 */
async function create({
  customerId,
  customer,
  roomId,
  checkInDate,
  checkOutDate,
  guests = 1,
  remark = null,
  bookingSource = 'online',
  status = 'pending',
  paymentStatus = 'unpaid',
  userId = null,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const resolvedCustomerId = await resolveOrCreateCustomer(conn, { customerId, customer });

    // Lock room and assert bookable under exclusive row lock first
    await assertRoomBookable(conn, roomId, checkInDate, checkOutDate, guests);
    const quoteData = await quote(roomId, checkInDate, checkOutDate, conn);

    const [insertResult] = await conn.query(
      `INSERT INTO reservations (
        customer_id, room_id, check_in_date, check_out_date,
        guests, nightly_rate, total_amount, status,
        booking_source, payment_status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedCustomerId,
        roomId,
        checkInDate,
        checkOutDate,
        guests,
        quoteData.nightly_rate,
        quoteData.total,
        status,
        bookingSource,
        paymentStatus,
        remark || null,
      ]
    );

    const resId = insertResult.insertId;
    const year = today().slice(0, 4);
    const bookingRef = `LS-${year}-${String(resId).padStart(6, '0')}`;

    await conn.query(
      'UPDATE reservations SET booking_ref = ? WHERE reservation_id = ?',
      [bookingRef, resId]
    );

    await logAudit(conn, {
      userId,
      action: 'create_reservation',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        reservation_id: resId,
        booking_ref: bookingRef,
        room_id: roomId,
        customer_id: resolvedCustomerId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests,
        total_amount: quoteData.total,
        booking_source: bookingSource,
        status,
      },
    });

    await conn.commit();

    return await fetchFullReservation(conn, bookingRef);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Confirm a pending reservation (staff action).
 */
async function confirm({ bookingRef, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE booking_ref = ? FOR UPDATE',
      [bookingRef]
    );

    if (rows.length === 0) {
      const err = new Error('Reservation not found.');
      err.status = 404;
      throw err;
    }

    const reservation = rows[0];
    if (reservation.status !== 'pending') {
      const err = new Error(`Cannot confirm reservation with status: ${reservation.status}`);
      err.status = 400;
      throw err;
    }

    await conn.query(
      "UPDATE reservations SET status = 'confirmed' WHERE reservation_id = ?",
      [reservation.reservation_id]
    );

    await logAudit(conn, {
      userId,
      action: 'confirm_reservation',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        previous_status: 'pending',
        new_status: 'confirmed',
      },
    });

    await conn.commit();

    return await fetchFullReservation(conn, bookingRef);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Cancel a reservation (customer or staff).
 */
async function cancel({ bookingRef, userId, userRole, customerId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE booking_ref = ? FOR UPDATE',
      [bookingRef]
    );

    if (rows.length === 0) {
      const err = new Error('Reservation not found.');
      err.status = 404;
      throw err;
    }

    const reservation = rows[0];

    // Customer security: can only cancel their own reservation
    if (userRole === 'customer') {
      if (reservation.customer_id !== customerId) {
        const err = new Error('Reservation not found.');
        err.status = 404;
        throw err;
      }

      // Check cancellation window:
      // Must be before CANCEL_WINDOW_HOURS prior to check-in date at 00:00 in hotel timezone
      const checkInMidnight = getHotelTimestamp(reservation.check_in_date, '00:00:00', env.HOTEL_TIMEZONE);
      const deadline = new Date(checkInMidnight.getTime() - CANCEL_WINDOW_HOURS * 3600 * 1000);

      if (new Date() >= deadline) {
        const err = new Error(
          `Cancellation window has passed. Reservations cannot be cancelled within ${CANCEL_WINDOW_HOURS} hours of check-in.`
        );
        err.status = 400;
        throw err;
      }
    }

    // Cancellation is allowed for pending or confirmed status
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      const err = new Error(`Cannot cancel reservation with status: ${reservation.status}`);
      err.status = 400;
      throw err;
    }

    // Calculate total payments made to compute refund_due
    const [payRows] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount WHEN kind = 'refund' THEN -amount ELSE 0 END), 0) AS total_paid
       FROM payments
       WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );

    const totalPaid = Number(payRows[0].total_paid || 0);
    const refundDue = totalPaid > 0 ? Number(totalPaid.toFixed(2)) : 0;

    await conn.query(
      `UPDATE reservations
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = ?
       WHERE reservation_id = ?`,
      [userId || null, reservation.reservation_id]
    );

    await logAudit(conn, {
      userId,
      action: 'cancel_reservation',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        cancelled_by_role: userRole,
        refund_due: refundDue,
        previous_status: reservation.status,
      },
    });

    await conn.commit();

    const updated = await fetchFullReservation(conn, bookingRef);
    return {
      ...updated,
      refund_due: refundDue,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Mark a confirmed reservation as no-show (staff action).
 * Only allowed for confirmed reservations whose check_in_date is before today().
 */
async function markNoShow({ bookingRef, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE booking_ref = ? FOR UPDATE',
      [bookingRef]
    );

    if (rows.length === 0) {
      const err = new Error('Reservation not found.');
      err.status = 404;
      throw err;
    }

    const reservation = rows[0];

    if (reservation.status !== 'confirmed') {
      const err = new Error(`Only confirmed reservations can be marked as no-show. Current status: ${reservation.status}`);
      err.status = 400;
      throw err;
    }

    const todayStr = today();
    if (reservation.check_in_date >= todayStr) {
      const err = new Error(`Cannot mark as no-show. Check-in date (${reservation.check_in_date}) must be before today (${todayStr}).`);
      err.status = 400;
      throw err;
    }

    await conn.query(
      "UPDATE reservations SET status = 'no_show' WHERE reservation_id = ?",
      [reservation.reservation_id]
    );

    await logAudit(conn, {
      userId,
      action: 'mark_no_show',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        previous_status: 'confirmed',
        new_status: 'no_show',
      },
    });

    await conn.commit();

    return await fetchFullReservation(conn, bookingRef);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Check-in a guest (staff action).
 * Only status 'confirmed'; today() must be >= check_in_date and < check_out_date;
 * Room must not be in maintenance and not held by another checked_in reservation.
 */
async function checkIn({ bookingRef, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE booking_ref = ? FOR UPDATE',
      [bookingRef]
    );

    if (rows.length === 0) {
      const err = new Error('Reservation not found.');
      err.status = 404;
      throw err;
    }

    const reservation = rows[0];

    if (reservation.status !== 'confirmed') {
      const err = new Error(`Cannot check in. Current status: ${reservation.status}`);
      err.status = 400;
      throw err;
    }

    const todayStr = today();
    if (todayStr < reservation.check_in_date) {
      const err = new Error(`Cannot check in before the check-in date (${reservation.check_in_date}).`);
      err.status = 400;
      throw err;
    }

    if (todayStr >= reservation.check_out_date) {
      const err = new Error(`Cannot check in. Check-out date (${reservation.check_out_date}) has passed or is today.`);
      err.status = 400;
      throw err;
    }

    // Lock room
    const [roomRows] = await conn.query(
      'SELECT * FROM rooms WHERE room_id = ? FOR UPDATE',
      [reservation.room_id]
    );

    if (roomRows.length === 0) {
      const err = new Error('Room not found.');
      err.status = 404;
      throw err;
    }

    const room = roomRows[0];
    if (room.status === 'maintenance') {
      const err = new Error('Cannot check in. Room is currently under maintenance.');
      err.status = 400;
      throw err;
    }

    // Check if room holds another checked_in reservation
    const [occupiedRows] = await conn.query(
      `SELECT reservation_id, booking_ref FROM reservations
       WHERE room_id = ? AND status = 'checked_in' AND reservation_id != ?`,
      [reservation.room_id, reservation.reservation_id]
    );

    if (occupiedRows.length > 0) {
      const err = new Error('Room is currently occupied by another reservation.');
      err.status = 409;
      throw err;
    }

    await conn.query(
      `UPDATE reservations
       SET status = 'checked_in',
           checked_in_at = NOW()
       WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );

    await conn.query(
      "UPDATE rooms SET status = 'occupied' WHERE room_id = ?",
      [reservation.room_id]
    );

    await logAudit(conn, {
      userId,
      action: 'check_in',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        room_id: reservation.room_id,
        checked_in_at: new Date().toISOString(),
      },
    });

    await conn.commit();

    return await fetchFullReservation(conn, bookingRef);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Check-out a guest (staff action).
 * Only status 'checked_in'; balance must be 0 (returns 409 with balance otherwise).
 * Sets status 'checked_out', checked_out_at, and room.status = 'available'.
 * Total is NEVER recalculated.
 */
async function checkOut({ bookingRef, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM reservations WHERE booking_ref = ? FOR UPDATE',
      [bookingRef]
    );

    if (rows.length === 0) {
      const err = new Error('Reservation not found.');
      err.status = 404;
      throw err;
    }

    const reservation = rows[0];

    if (reservation.status !== 'checked_in') {
      const err = new Error(`Cannot check out. Current status: ${reservation.status}`);
      err.status = 400;
      throw err;
    }

    // Compute balance from payments table
    const [payRows] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount WHEN kind = 'refund' THEN -amount ELSE 0 END), 0) AS total_paid
       FROM payments
       WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );

    const totalPaid = Number(payRows[0].total_paid || 0);
    const totalAmount = Number(reservation.total_amount);
    const balance = Number((totalAmount - totalPaid).toFixed(2));

    if (balance > 0) {
      const err = new Error(`Cannot check out with an unpaid balance of LKR ${balance.toFixed(2)}.`);
      err.status = 409;
      err.balance = balance;
      throw err;
    }

    await conn.query(
      `UPDATE reservations
       SET status = 'checked_out',
           checked_out_at = NOW()
       WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );

    await conn.query(
      "UPDATE rooms SET status = 'available' WHERE room_id = ?",
      [reservation.room_id]
    );

    await logAudit(conn, {
      userId,
      action: 'check_out',
      entity: 'reservation',
      entityId: bookingRef,
      details: {
        room_id: reservation.room_id,
        total_amount: totalAmount,
        total_paid: totalPaid,
        balance,
      },
    });

    await conn.commit();

    return await fetchFullReservation(conn, bookingRef);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get staff detailed view of a reservation: customer, room, payments, and bill.
 */
async function getStaffDetail(bookingRef) {
  const reservation = await fetchFullReservation(pool, bookingRef);
  if (!reservation) return null;

  const [payments] = await pool.query(
    'SELECT * FROM payments WHERE reservation_id = ? ORDER BY created_at ASC',
    [reservation.reservation_id]
  );

  const totalPaid = payments.reduce((sum, p) => {
    const amt = Number(p.amount);
    return p.kind === 'refund' ? sum - amt : sum + amt;
  }, 0);

  const totalAmount = Number(reservation.total_amount);
  const balance = Number(Math.max(0, totalAmount - totalPaid).toFixed(2));
  const nights = nightsBetween(reservation.check_in_date, reservation.check_out_date);

  const bill = {
    nights,
    nightly_rate: Number(reservation.nightly_rate),
    total_amount: totalAmount,
    paid_amount: Number(totalPaid.toFixed(2)),
    balance,
    currency: 'LKR',
  };

  const customer = {
    customer_id: reservation.customer_id,
    name: reservation.customer_name,
    email: reservation.customer_email,
    phone: reservation.customer_phone,
  };

  const room = {
    room_id: reservation.room_id,
    room_number: reservation.room_number,
    room_type: reservation.room_type,
    price: Number(reservation.room_price),
    capacity: reservation.room_capacity,
    bed_type: reservation.room_bed_type,
    size_sqm: reservation.room_size_sqm,
    view_label: reservation.room_view_label,
  };

  return {
    ...reservation,
    customer,
    room,
    payments,
    bill,
  };
}

/**
 * List reservations for staff with filters, pagination, and total count.
 */
async function listStaffReservations({
  q,
  status,
  source,
  payment_status,
  room_id,
  room_type,
  from,
  to,
  page = 1,
  limit = 20,
}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * lim;

  let where = 'WHERE 1=1';
  const params = [];

  if (q) {
    where += ` AND (
      r.booking_ref LIKE ? OR
      c.name LIKE ? OR
      c.email LIKE ? OR
      c.phone LIKE ? OR
      rm.room_number LIKE ?
    )`;
    const wildcard = `%${q}%`;
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
  }

  if (status) {
    where += ' AND r.status = ?';
    params.push(status);
  }

  if (source) {
    where += ' AND r.booking_source = ?';
    params.push(source);
  }

  if (payment_status) {
    where += ' AND r.payment_status = ?';
    params.push(payment_status);
  }

  if (room_id) {
    where += ' AND r.room_id = ?';
    params.push(Number(room_id));
  }

  if (room_type) {
    where += ' AND rm.room_type = ?';
    params.push(room_type);
  }

  // Stays overlapping [from, to]
  if (from && to) {
    where += ' AND r.check_in_date < ? AND r.check_out_date > ?';
    params.push(to, from);
  } else if (from) {
    where += ' AND r.check_out_date > ?';
    params.push(from);
  } else if (to) {
    where += ' AND r.check_in_date < ?';
    params.push(to);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN rooms rm ON r.room_id = rm.room_id
    ${where}
  `;
  const [[{ total }]] = await pool.query(countQuery, params);

  const dataQuery = `
    SELECT
      r.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      rm.room_number,
      rm.room_type,
      rm.price AS room_price,
      COALESCE((
        SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
        FROM payments p
        WHERE p.reservation_id = r.reservation_id
      ), 0) AS total_paid
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN rooms rm ON r.room_id = rm.room_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [data] = await pool.query(dataQuery, [...params, lim, offset]);

  const formattedData = data.map((r) => {
    const total = Number(Number(r.total_amount).toFixed(2));
    const paid = Number(Number(r.total_paid || 0).toFixed(2));
    const balance = Number(Math.max(0, total - paid).toFixed(2));
    return {
      ...r,
      total_amount: total,
      paid_amount: paid,
      balance,
    };
  });

  return {
    data: formattedData,
    page: p,
    limit: lim,
    total: Number(total),
  };
}

/**
 * Compute whether a reservation can be cancelled and its deadline.
 * Follows the exact same rule as the cancel endpoint:
 * - Must be pending or confirmed
 * - Must be prior to CANCEL_WINDOW_HOURS before check-in date 00:00 in hotel timezone
 */
function computeCancellationPolicy(reservation) {
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    return {
      can_cancel: false,
      cancel_deadline: null,
    };
  }

  const checkInMidnight = getHotelTimestamp(reservation.check_in_date, '00:00:00', env.HOTEL_TIMEZONE);
  const deadline = new Date(checkInMidnight.getTime() - CANCEL_WINDOW_HOURS * 3600 * 1000);
  const can_cancel = new Date() < deadline;

  return {
    can_cancel,
    cancel_deadline: deadline.toISOString(),
  };
}

/**
 * List own reservations for a customer.
 */
async function listCustomerReservations(customerId) {
  const query = `
    SELECT
      r.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      rm.room_number,
      rm.room_type,
      rm.price AS room_price,
      rm.capacity AS room_capacity,
      rm.bed_type AS room_bed_type,
      rm.size_sqm AS room_size_sqm,
      rm.view_label AS room_view_label,
      rm.images AS room_images,
      rm.image_url AS room_image_url
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.customer_id = ?
    ORDER BY r.created_at DESC
  `;
  const [rows] = await pool.query(query, [customerId]);
  return rows.map((r) => ({
    ...r,
    ...computeCancellationPolicy(r),
  }));
}

/**
 * Get customer's own reservation by reference.
 * Returns null if not found or belongs to someone else (producing 404).
 */
async function getCustomerReservation(bookingRef, customerId) {
  const query = `
    SELECT
      r.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      rm.room_number,
      rm.room_type,
      rm.price AS room_price,
      rm.capacity AS room_capacity,
      rm.bed_type AS room_bed_type,
      rm.size_sqm AS room_size_sqm,
      rm.view_label AS room_view_label,
      rm.images AS room_images,
      rm.image_url AS room_image_url
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.booking_ref = ? AND r.customer_id = ?
  `;
  const [rows] = await pool.query(query, [bookingRef, customerId]);
  if (rows.length === 0) return null;
  const res = rows[0];
  return {
    ...res,
    ...computeCancellationPolicy(res),
  };
}

module.exports = {
  fetchFullReservation,
  create,
  confirm,
  cancel,
  markNoShow,
  checkIn,
  checkOut,
  getStaffDetail,
  listStaffReservations,
  listCustomerReservations,
  getCustomerReservation,
};
