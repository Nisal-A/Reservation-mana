// backend/src/services/availability.js
// Availability checks and concurrency locking for rooms and reservations

const pool = require('../config/db');
const { BLOCKING_STATUSES } = require('./config/rules');

/**
 * Find all rooms available for the given dates, guests, and filters.
 */
async function findAvailableRooms({
  checkIn,
  checkOut,
  guests,
  roomType,
  minPrice,
  maxPrice,
  page,
  limit,
}) {
  let query = `
    SELECT r.*
    FROM rooms r
    WHERE r.status != 'maintenance'
  `;
  const params = [];

  if (guests !== undefined && guests !== null && !isNaN(guests)) {
    query += ' AND r.capacity >= ?';
    params.push(Number(guests));
  }

  if (roomType) {
    query += ' AND r.room_type = ?';
    params.push(roomType);
  }

  if (minPrice !== undefined && minPrice !== null && !isNaN(minPrice)) {
    query += ' AND r.price >= ?';
    params.push(Number(minPrice));
  }

  if (maxPrice !== undefined && maxPrice !== null && !isNaN(maxPrice)) {
    query += ' AND r.price <= ?';
    params.push(Number(maxPrice));
  }

  // Blocking overlap condition:
  // existing.check_in_date < requested check_out AND existing.check_out_date > requested check_in
  const placeholders = BLOCKING_STATUSES.map(() => '?').join(', ');
  query += `
    AND NOT EXISTS (
      SELECT 1 FROM reservations res
      WHERE res.room_id = r.room_id
        AND res.status IN (${placeholders})
        AND res.check_in_date < ?
        AND res.check_out_date > ?
    )
  `;
  params.push(...BLOCKING_STATUSES, checkOut, checkIn);

  query += ' ORDER BY r.room_number ASC';

  if (limit) {
    const lim = Math.max(1, parseInt(limit, 10));
    const p = Math.max(1, parseInt(page, 10) || 1);
    const offset = (p - 1) * lim;
    query += ' LIMIT ? OFFSET ?';
    params.push(lim, offset);
  }

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Assert room is bookable inside a transaction with row-level locking (FOR UPDATE).
 * Rechecks overlapping bookings under lock to guarantee exactly one booking succeeds.
 */
async function assertRoomBookable(conn, roomId, checkIn, checkOut, guests, excludeReservationId = null) {
  // 1. Lock room row
  const [roomRows] = await conn.query(
    'SELECT * FROM rooms WHERE room_id = ? FOR UPDATE',
    [roomId]
  );

  if (roomRows.length === 0) {
    const err = new Error('Room not found.');
    err.status = 404;
    throw err;
  }

  const room = roomRows[0];
  if (room.status === 'maintenance') {
    const err = new Error('Room is currently under maintenance.');
    err.status = 400;
    throw err;
  }

  if (guests && Number(room.capacity) < Number(guests)) {
    const err = new Error(`Room capacity (${room.capacity}) is insufficient for ${guests} guests.`);
    err.status = 400;
    throw err;
  }

  // 2. Recheck overlap query under row lock
  const placeholders = BLOCKING_STATUSES.map(() => '?').join(', ');
  let overlapQuery = `
    SELECT reservation_id, booking_ref
    FROM reservations
    WHERE room_id = ?
      AND status IN (${placeholders})
      AND check_in_date < ?
      AND check_out_date > ?
  `;
  const overlapParams = [roomId, ...BLOCKING_STATUSES, checkOut, checkIn];

  if (excludeReservationId) {
    overlapQuery += ' AND reservation_id != ?';
    overlapParams.push(excludeReservationId);
  }

  overlapQuery += ' FOR UPDATE';

  const [overlapping] = await conn.query(overlapQuery, overlapParams);

  if (overlapping.length > 0) {
    const err = new Error('Room is already booked for the selected dates.');
    err.status = 409;
    throw err;
  }

  return room;
}

module.exports = {
  findAvailableRooms,
  assertRoomBookable,
};
