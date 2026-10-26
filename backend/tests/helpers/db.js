process.env.NODE_ENV = 'test';
const pool = require('../../src/config/db');

async function cleanDb() {
  if (pool.pool.config.connectionConfig.database !== 'hotel_reservation_test') {
    throw new Error(`CRITICAL SAFETY ERROR: Attempted cleanDb() on database "${pool.pool.config.connectionConfig.database}" instead of "hotel_reservation_test"!`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE audit_log');
    await conn.query('TRUNCATE TABLE payments');
    await conn.query('TRUNCATE TABLE reviews');
    await conn.query('TRUNCATE TABLE reservations');
    await conn.query('TRUNCATE TABLE customers');
    await conn.query('TRUNCATE TABLE rooms');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  pool,
  cleanDb,
  closeDb,
};
