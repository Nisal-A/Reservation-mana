require('dotenv').config();
const mysql = require('mysql2/promise');

async function alterDb() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await pool.query("ALTER TABLE reservations ADD COLUMN payment_method ENUM('cash', 'card', 'online') DEFAULT NULL;");
    console.log('Successfully added payment_method column.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('payment_method column already exists.');
    } else {
      console.error('Error altering table:', err);
    }
  } finally {
    process.exit();
  }
}

alterDb();
