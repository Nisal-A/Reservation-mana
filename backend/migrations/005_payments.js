// 005_payments.js
// Create payments table and backfill checked_out reservations

module.exports = {
  async up(pool) {
    // 1. Ensure legacy reservations.payment_method exists on legacy databases
    const [pmCols] = await pool.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reservations'
        AND COLUMN_NAME = 'payment_method'
    `);
    if (pmCols.length === 0) {
      await pool.query(`
        ALTER TABLE reservations
        ADD COLUMN payment_method ENUM('cash', 'card', 'online') DEFAULT NULL
      `);
    }

    // 2. Create payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        reservation_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        kind ENUM('payment','refund') NOT NULL DEFAULT 'payment',
        method ENUM('cash','card','bank_transfer','online') NOT NULL,
        reference VARCHAR(80) NULL,
        note VARCHAR(255) NULL,
        recorded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_payments_amount CHECK (amount > 0),
        CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE RESTRICT,
        CONSTRAINT fk_payments_user FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);

    // 3. Backfill one payment row for every checked_out reservation
    await pool.query(`
      INSERT INTO payments (reservation_id, amount, kind, method, note, created_at)
      SELECT
        r.reservation_id,
        r.total_amount,
        'payment',
        CASE
          WHEN r.payment_method = 'card' THEN 'card'
          WHEN r.payment_method = 'online' THEN 'online'
          ELSE 'cash'
        END,
        'Backfilled checkout payment',
        r.created_at
      FROM reservations r
      WHERE r.status = 'checked_out'
        AND r.total_amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM payments p WHERE p.reservation_id = r.reservation_id
        )
    `);

    // 4. Set payment_status to 'paid' for checked_out reservations
    await pool.query(`
      UPDATE reservations
      SET payment_status = 'paid'
      WHERE status = 'checked_out'
    `);
  },
};
