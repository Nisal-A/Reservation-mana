// 004_reservations_upgrade.js
// Upgrade reservations table with new fields, backfills, and RESTRICT foreign keys

module.exports = {
  async up(pool) {
    // 1. Check existing columns to conditionally drop legacy price breakdown columns
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
    `);
    const colNames = new Set(cols.map((c) => c.COLUMN_NAME));

    // 2. Add new columns
    await pool.query(`
      ALTER TABLE reservations
        ADD COLUMN booking_ref VARCHAR(20) NULL,
        ADD UNIQUE KEY uq_reservations_booking_ref (booking_ref),
        ADD COLUMN guests TINYINT NOT NULL DEFAULT 1,
        ADD COLUMN nightly_rate DECIMAL(10,2) NULL,
        ADD COLUMN booking_source ENUM('online','reception','admin') NOT NULL DEFAULT 'reception',
        ADD COLUMN payment_status ENUM('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
        ADD COLUMN cancelled_at DATETIME NULL,
        ADD COLUMN cancelled_by INT NULL,
        ADD COLUMN checked_in_at DATETIME NULL,
        ADD COLUMN checked_out_at DATETIME NULL
    `);

    // 3. Extend status ENUM with 'no_show'
    await pool.query(`
      ALTER TABLE reservations
      MODIFY COLUMN status ENUM('pending','confirmed','checked_in','checked_out','cancelled','no_show') NOT NULL DEFAULT 'pending'
    `);

    // 4. Drop legacy price breakdown columns if present
    const colsToDrop = ['base_amount', 'surcharge_amount', 'discount_amount', 'tax_amount', 'price_breakdown'];
    for (const col of colsToDrop) {
      if (colNames.has(col)) {
        await pool.query(`ALTER TABLE reservations DROP COLUMN \`${col}\``);
      }
    }

    // 5. Backfill booking_ref and nightly_rate
    await pool.query(`
      UPDATE reservations
      SET booking_ref = CONCAT('LS-', YEAR(created_at), '-', LPAD(reservation_id, 6, '0'))
      WHERE booking_ref IS NULL
    `);

    await pool.query(`
      UPDATE reservations
      SET nightly_rate = CASE
        WHEN DATEDIFF(check_out_date, check_in_date) > 0 THEN ROUND(total_amount / DATEDIFF(check_out_date, check_in_date), 2)
        ELSE total_amount
      END
      WHERE nightly_rate IS NULL
    `);

    // 6. Make booking_ref and nightly_rate NOT NULL
    await pool.query(`
      ALTER TABLE reservations
      MODIFY COLUMN booking_ref VARCHAR(20) NOT NULL
    `);

    await pool.query(`
      ALTER TABLE reservations
      MODIFY COLUMN nightly_rate DECIMAL(10,2) NOT NULL
    `);

    // 7. Look up FK names in information_schema and update to ON DELETE RESTRICT
    const [fks] = await pool.query(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reservations'
        AND REFERENCED_TABLE_NAME IN ('customers', 'rooms')
    `);

    for (const fk of fks) {
      await pool.query(`ALTER TABLE reservations DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      if (fk.REFERENCED_TABLE_NAME === 'customers') {
        await pool.query(`
          ALTER TABLE reservations
          ADD CONSTRAINT fk_reservations_customer
          FOREIGN KEY (${fk.COLUMN_NAME}) REFERENCES customers(customer_id)
          ON DELETE RESTRICT
        `);
      } else if (fk.REFERENCED_TABLE_NAME === 'rooms') {
        await pool.query(`
          ALTER TABLE reservations
          ADD CONSTRAINT fk_reservations_room
          FOREIGN KEY (${fk.COLUMN_NAME}) REFERENCES rooms(room_id)
          ON DELETE RESTRICT
        `);
      }
    }
  },
};
