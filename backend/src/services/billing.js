// backend/src/services/billing.js
// Billing calculations and payment status management

const pool = require('../config/db');

/**
 * Calculate bill for a reservation.
 * Returns { total, paid, refunded, balance, payment_status, payments[] }
 * where balance = total - paid + refunded.
 */
async function getBill(connOrPool, reservationId) {
  const [resRows] = await connOrPool.query(
    'SELECT reservation_id, booking_ref, total_amount, payment_status FROM reservations WHERE reservation_id = ?',
    [reservationId]
  );

  if (resRows.length === 0) {
    const err = new Error('Reservation not found.');
    err.status = 404;
    throw err;
  }

  const reservation = resRows[0];
  const total = Number(Number(reservation.total_amount).toFixed(2));

  const [payments] = await connOrPool.query(
    `SELECT payment_id, reservation_id, amount, kind, method, reference, note, recorded_by, created_at
     FROM payments
     WHERE reservation_id = ?
     ORDER BY created_at ASC`,
    [reservationId]
  );

  let paid = 0;
  let refunded = 0;

  for (const p of payments) {
    const amt = Number(p.amount);
    p.amount = Number(amt.toFixed(2));
    if (p.kind === 'refund') {
      refunded += amt;
    } else {
      paid += amt;
    }
  }

  paid = Number(paid.toFixed(2));
  refunded = Number(refunded.toFixed(2));
  const balance = Number(Math.max(0, total - paid + refunded).toFixed(2));

  return {
    total,
    paid,
    refunded,
    balance,
    payment_status: reservation.payment_status,
    payments,
  };
}

/**
 * Recalculate and update the reservation payment_status:
 * - 'unpaid' when net paid = 0
 * - 'partial' when 0 < net paid < total
 * - 'paid' when net paid >= total
 * - 'refunded' when net paid = 0 and a refund exists
 * Runs inside caller's transaction.
 */
async function recalcPaymentStatus(conn, reservationId) {
  const [resRows] = await conn.query(
    'SELECT reservation_id, total_amount FROM reservations WHERE reservation_id = ? FOR UPDATE',
    [reservationId]
  );

  if (resRows.length === 0) {
    const err = new Error('Reservation not found.');
    err.status = 404;
    throw err;
  }

  const total = Number(resRows[0].total_amount);

  const [sums] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0) AS refunded
     FROM payments
     WHERE reservation_id = ?`,
    [reservationId]
  );

  const paid = Number(sums[0].paid || 0);
  const refunded = Number(sums[0].refunded || 0);
  const netPaid = Number((paid - refunded).toFixed(2));

  let newStatus = 'unpaid';
  if (netPaid <= 0 && refunded > 0) {
    newStatus = 'refunded';
  } else if (netPaid === 0) {
    newStatus = 'unpaid';
  } else if (netPaid > 0 && netPaid < total) {
    newStatus = 'partial';
  } else if (netPaid >= total) {
    newStatus = 'paid';
  }

  await conn.query(
    'UPDATE reservations SET payment_status = ? WHERE reservation_id = ?',
    [newStatus, reservationId]
  );

  return newStatus;
}

module.exports = {
  getBill,
  recalcPaymentStatus,
};
