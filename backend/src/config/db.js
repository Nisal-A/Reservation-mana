const mysql = require('mysql2/promise');
const env = require('./env');

function getTimezoneOffset(timeZone) {
  if (!timeZone) return '+00:00';
  if (/^[+-]\d{2}:\d{2}$/.test(timeZone) || timeZone === 'Z') return timeZone;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzPart && tzPart.startsWith('GMT')) {
      return tzPart.replace('GMT', '');
    }
  } catch {
    // fallback
  }
  return '+00:00';
}

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  dateStrings: ['DATE'],
  timezone: getTimezoneOffset(env.HOTEL_TIMEZONE),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
