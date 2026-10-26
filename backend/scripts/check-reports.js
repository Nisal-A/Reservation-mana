// backend/scripts/check-reports.js
// Self-check script for enterprise reports engine.
// Inserts tagged test data:
// 1 room at LKR 15,000 per night, one checked_out stay 2026-11-10 to 2026-11-13 with payments of LKR 45,000.
// For the range 2026-11-01 to 2026-11-30 it must print:
// sold_room_nights 3, room_revenue 45000, adr 15000, available_room_nights 30, occupancy_pct 10, revpar 1500, cash_collected 45000, outstanding_balance 0.
// Reports any mismatch, cleans up tagged rows, and exits with 0 on success or 1 on mismatch.

const pool = require('../src/config/db');
const reportsService = require('../src/services/reports');

const TAG_TYPE = `TestReportType_${Date.now()}`;
const TAG_ROOM_NUM = `TR-${Math.floor(1000 + Math.random() * 9000)}`;
const TAG_REF = `LS-RPT-${Math.floor(1000 + Math.random() * 9000)}`;

async function runCheck() {
  console.log('=== STARTING REPORTS SELF-CHECK ===');
  let roomId = null;
  let customerId = null;
  let reservationId = null;
  let paymentId = null;

  try {
    // 1. Insert tagged room: 1 room at LKR 15,000/night
    const [roomRes] = await pool.query(
      `INSERT INTO rooms (room_number, room_type, price, status, capacity, description)
       VALUES (?, ?, 15000.00, 'available', 2, 'Temporary report verification room')`,
      [TAG_ROOM_NUM, TAG_TYPE]
    );
    roomId = roomRes.insertId;
    console.log(`✓ Inserted test room #${TAG_ROOM_NUM} (type: ${TAG_TYPE}, rate: 15,000)`);

    // 2. Insert tagged customer
    const [custRes] = await pool.query(
      `INSERT INTO customers (name, email, phone)
       VALUES (?, ?, ?)`,
      [
        'Report Test Guest',
        `report_test_${Date.now()}@example.com`,
        '+94770000000',
      ]
    );
    customerId = custRes.insertId;

    // 3. Insert one checked_out stay: 2026-11-10 to 2026-11-13 (3 nights)
    const [resRes] = await pool.query(
      `INSERT INTO reservations (
        booking_ref, customer_id, room_id, check_in_date, check_out_date,
        guests, nightly_rate, total_amount, status, payment_status, booking_source, created_at
      ) VALUES (?, ?, ?, '2026-11-10', '2026-11-13', 2, 15000.00, 45000.00, 'checked_out', 'paid', 'reception', '2026-11-01 10:00:00')`,
      [TAG_REF, customerId, roomId]
    );
    reservationId = resRes.insertId;
    console.log(`✓ Inserted checked_out stay: ${TAG_REF} (2026-11-10 to 2026-11-13, 3 nights, total: 45,000)`);

    // 4. Insert payment of LKR 45,000
    const [payRes] = await pool.query(
      `INSERT INTO payments (reservation_id, amount, kind, method, reference, created_at)
       VALUES (?, 45000.00, 'payment', 'cash', 'TEST-RCPT-45K', '2026-11-10 12:00:00')`,
      [reservationId]
    );
    paymentId = payRes.insertId;
    console.log(`✓ Inserted payment of LKR 45,000 for reservation ${TAG_REF}`);

    // 5. Query reports service for range 2026-11-01 to 2026-11-30 filtered by the tagged room_type
    const report = await reportsService.getOverview(pool, {
      from: '2026-11-01',
      to: '2026-11-30',
      compare: 'none',
      room_type: TAG_TYPE,
    });

    const m = report.data;

    // Required expected metrics
    const expected = {
      sold_room_nights: 3,
      room_revenue: 45000,
      adr: 15000,
      available_room_nights: 30,
      occupancy_pct: 10,
      revpar: 1500,
      cash_collected: 45000,
      outstanding_balance: 0,
    };

    console.log('\n--- METRICS EXTRACTED ---');
    console.log(
      `sold_room_nights ${m.sold_room_nights}, room_revenue ${m.room_revenue}, adr ${m.adr}, ` +
      `available_room_nights ${m.available_room_nights}, occupancy_pct ${m.occupancy_pct}, ` +
      `revpar ${m.revpar}, cash_collected ${m.cash_collected}, outstanding_balance ${m.outstanding_balance}`
    );

    const mismatches = [];
    for (const [key, expVal] of Object.entries(expected)) {
      const actVal = Number(m[key]);
      if (Math.abs(actVal - expVal) > 0.01) {
        mismatches.push({
          metric: key,
          expected: expVal,
          actual: actVal,
        });
      }
    }

    if (mismatches.length > 0) {
      console.error('\n❌ MISMATCH DETECTED:');
      console.table(mismatches);
      throw new Error(`Self-check failed with ${mismatches.length} mismatch(es)`);
    }

    console.log('\n✓ ALL METRICS MATCH EXACT SPECIFICATION PERFECTLY!');
  } finally {
    // Clean up tagged rows
    console.log('\n--- CLEANING UP TEST DATA ---');
    if (paymentId) {
      await pool.query('DELETE FROM payments WHERE payment_id = ?', [paymentId]);
    }
    if (reservationId) {
      await pool.query('DELETE FROM reservations WHERE reservation_id = ?', [reservationId]);
    }
    if (customerId) {
      await pool.query('DELETE FROM customers WHERE customer_id = ?', [customerId]);
    }
    if (roomId) {
      await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    }
    console.log('✓ Cleaned up test payment, reservation, customer, and room.');
    await pool.end();
  }
}

runCheck()
  .then(() => {
    console.log('\n=== SELF-CHECK COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ SELF-CHECK FAILED:', err.message || err);
    process.exit(1);
  });
