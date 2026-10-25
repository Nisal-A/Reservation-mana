// backend/src/services/config/rules.js
// Business rules and configuration for reservations

const MAX_STAY_NIGHTS = 30;
const MAX_ADVANCE_DAYS = 365;
const CANCEL_WINDOW_HOURS = process.env.CANCEL_WINDOW_HOURS
  ? parseInt(process.env.CANCEL_WINDOW_HOURS, 10)
  : 24;
const BLOCKING_STATUSES = ['pending', 'confirmed', 'checked_in'];

module.exports = {
  MAX_STAY_NIGHTS,
  MAX_ADVANCE_DAYS,
  CANCEL_WINDOW_HOURS,
  BLOCKING_STATUSES,
};
