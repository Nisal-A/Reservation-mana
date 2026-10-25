// backend/src/services/quote.js
// Price quotation service for reservations

const pool = require('../config/db');
const { today, isValidDateString, nightsBetween, addDays } = require('../utils/dates');
const { MAX_STAY_NIGHTS, MAX_ADVANCE_DAYS } = require('./config/rules');

/**
 * Validates dates and calculates the price quote from room nightly rate.
 * Nothing from client is trusted except room id and dates.
 * Price = nights x room.price.
 */
async function quote(roomId, checkIn, checkOut, conn = pool) {
  if (!isValidDateString(checkIn) || !isValidDateString(checkOut)) {
    const err = new Error('Invalid date format. Expected YYYY-MM-DD.');
    err.status = 400;
    throw err;
  }

  const todayStr = today();

  if (checkIn < todayStr) {
    const err = new Error('Check-in date cannot be in the past.');
    err.status = 400;
    throw err;
  }

  if (checkOut <= checkIn) {
    const err = new Error('Check-out date must be after check-in date.');
    err.status = 400;
    throw err;
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) {
    const err = new Error('Stay must be at least 1 night.');
    err.status = 400;
    throw err;
  }

  if (nights > MAX_STAY_NIGHTS) {
    const err = new Error(`Maximum stay is ${MAX_STAY_NIGHTS} nights.`);
    err.status = 400;
    throw err;
  }

  const maxAdvance = addDays(todayStr, MAX_ADVANCE_DAYS);
  if (checkIn > maxAdvance) {
    const err = new Error(`Check-in date cannot be more than ${MAX_ADVANCE_DAYS} days in advance.`);
    err.status = 400;
    throw err;
  }

  const [rows] = await conn.query(
    'SELECT room_id, price, status FROM rooms WHERE room_id = ?',
    [roomId]
  );

  if (rows.length === 0) {
    const err = new Error('Room not found.');
    err.status = 404;
    throw err;
  }

  const room = rows[0];
  if (room.status === 'maintenance') {
    const err = new Error('Room is currently under maintenance.');
    err.status = 400;
    throw err;
  }

  const nightlyRate = Number(room.price);
  const total = Number((nights * nightlyRate).toFixed(2));

  return {
    nights,
    nightly_rate: Number(nightlyRate.toFixed(2)),
    total,
  };
}

module.exports = {
  quote,
};
