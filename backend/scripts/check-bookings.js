// backend/scripts/check-bookings.js
// Acceptance test suite verifying reservation rules via the real HTTP API

const http = require('http');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
const env = require('../src/config/env');
const app = require('../src/server');
const { today, addDays } = require('../src/utils/dates');

async function ensureTestUsers() {
  // Ensure customer A
  let [custA] = await pool.query("SELECT * FROM users WHERE username = 'test_cust_a'");
  let userAId;
  if (custA.length === 0) {
    const [res] = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ('test_cust_a', 'hash123', 'customer')"
    );
    userAId = res.insertId;
  } else {
    userAId = custA[0].user_id;
  }

  let [custRowA] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [userAId]);
  let custAId;
  if (custRowA.length === 0) {
    const [res] = await pool.query(
      "INSERT INTO customers (user_id, name, email, phone) VALUES (?, 'Customer A', 'cust_a@example.com', '1111111111')",
      [userAId]
    );
    custAId = res.insertId;
  } else {
    custAId = custRowA[0].customer_id;
  }

  // Ensure customer B
  let [custB] = await pool.query("SELECT * FROM users WHERE username = 'test_cust_b'");
  let userBId;
  if (custB.length === 0) {
    const [res] = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ('test_cust_b', 'hash123', 'customer')"
    );
    userBId = res.insertId;
  } else {
    userBId = custB[0].user_id;
  }

  let [custRowB] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [userBId]);
  let custBId;
  if (custRowB.length === 0) {
    const [res] = await pool.query(
      "INSERT INTO customers (user_id, name, email, phone) VALUES (?, 'Customer B', 'cust_b@example.com', '2222222222')",
      [userBId]
    );
    custBId = res.insertId;
  } else {
    custBId = custRowB[0].customer_id;
  }

  // Ensure staff (admin)
  let [staff] = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  const staffUserId = staff.length > 0 ? staff[0].user_id : 1;

  const tokenA = jwt.sign(
    { user_id: userAId, username: 'test_cust_a', role: 'customer', customer_id: custAId },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenB = jwt.sign(
    { user_id: userBId, username: 'test_cust_b', role: 'customer', customer_id: custBId },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenStaff = jwt.sign(
    { user_id: staffUserId, username: 'admin', role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return {
    tokenA,
    tokenB,
    tokenStaff,
    custAId,
    custBId,
  };
}

async function request(baseUrl, { method = 'GET', path, token, body }) {
  const url = new URL(path, baseUrl);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = { raw: data };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Acceptance Test Suite...');

  // 1. Start server on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running on ${baseUrl}`);

  try {
    const { tokenA, tokenB, tokenStaff, custAId } = await ensureTestUsers();

    // Pick a test room
    const [rooms] = await pool.query("SELECT * FROM rooms WHERE status != 'maintenance' LIMIT 2");
    if (rooms.length === 0) {
      throw new Error('No rooms found in database for testing.');
    }
    const testRoom = rooms[0];
    const testRoom2 = rooms.length > 1 ? rooms[1] : rooms[0];
    console.log(`🏨 Using Room ID: ${testRoom.room_id} (${testRoom.room_number})`);

    // Clean up any test reservations from previous runs on far future dates
    const farInCheck = addDays(today(), 120);
    const farOutCheck = addDays(today(), 122);
    await pool.query(
      'DELETE FROM reservations WHERE room_id = ? AND check_in_date = ? AND check_out_date = ?',
      [testRoom.room_id, farInCheck, farOutCheck]
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 1: 20 parallel POST requests for the same room and dates give exactly
    // one 201 and nineteen 409
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: 20 parallel POST requests concurrency ---');
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(baseUrl, {
          method: 'POST',
          path: '/api/reservations',
          token: tokenA,
          body: {
            room_id: testRoom.room_id,
            check_in_date: farInCheck,
            check_out_date: farOutCheck,
            guests: 1,
            remark: `Parallel test booking ${i}`,
          },
        })
      );
    }

    const results = await Promise.all(promises);
    const count201 = results.filter((r) => r.status === 201).length;
    const count409 = results.filter((r) => r.status === 409).length;

    console.log(`Results: ${count201} x 201 Created, ${count409} x 409 Conflict`);
    if (count201 !== 1 || count409 !== 19) {
      throw new Error(`Test 1 Failed: Expected exactly 1 x 201 and 19 x 409, got ${count201} x 201 and ${count409} x 409`);
    }
    console.log('✅ Test 1 Passed: Exactly one 201 and nineteen 409 returned.');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: a past check-in date gives 400
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Past check-in date gives 400 ---');
    const pastRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/reservations',
      token: tokenA,
      body: {
        room_id: testRoom.room_id,
        check_in_date: '2020-01-01',
        check_out_date: '2020-01-03',
        guests: 1,
      },
    });

    console.log(`Status: ${pastRes.status}, Message: ${pastRes.data?.message}`);
    if (pastRes.status !== 400) {
      throw new Error(`Test 2 Failed: Expected 400, got ${pastRes.status}`);
    }
    console.log('✅ Test 2 Passed: Past check-in date correctly returned 400.');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: customer B requesting customer A's reference gets 404
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- Test 3: Customer B requesting Customer A's reference gets 404 ---");
    const successfulBooking = results.find((r) => r.status === 201).data;
    const bookingRefA = successfulBooking.booking_ref;

    const crossCustRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/reservations/my/${bookingRefA}`,
      token: tokenB,
    });

    console.log(`Status: ${crossCustRes.status}`);
    if (crossCustRes.status !== 404) {
      throw new Error(`Test 3 Failed: Expected 404 for cross-customer booking access, got ${crossCustRes.status}`);
    }
    console.log("✅ Test 3 Passed: Customer B requesting Customer A's booking returned 404.");

    // ──────────────────────────────────────────────────────────────────────────
    // Test 4: a customer cancelling inside the cancellation window gets 400 with a clear message
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Cancel inside cancellation window gives 400 ---');
    // Create a booking with check_in_date = today()
    const todayCheckIn = today();
    const todayCheckOut = addDays(today(), 2);

    // Free room for today if needed
    await pool.query(
      'DELETE FROM reservations WHERE room_id = ? AND check_in_date = ? AND check_out_date = ?',
      [testRoom2.room_id, todayCheckIn, todayCheckOut]
    );

    const urgentBookingRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/reservations',
      token: tokenA,
      body: {
        room_id: testRoom2.room_id,
        check_in_date: todayCheckIn,
        check_out_date: todayCheckOut,
        guests: 1,
      },
    });

    if (urgentBookingRes.status !== 201) {
      throw new Error(`Failed to create urgent booking for test 4: ${JSON.stringify(urgentBookingRes.data)}`);
    }

    const urgentRef = urgentBookingRes.data.booking_ref;

    // Customer A attempts to cancel inside the cancellation window
    const cancelRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/reservations/${urgentRef}/cancel`,
      token: tokenA,
      body: {},
    });

    console.log(`Status: ${cancelRes.status}, Message: ${cancelRes.data?.message}`);
    if (cancelRes.status !== 400 || !cancelRes.data?.message?.toLowerCase().includes('cancellation')) {
      throw new Error(`Test 4 Failed: Expected 400 with cancellation message, got status ${cancelRes.status}: ${JSON.stringify(cancelRes.data)}`);
    }
    console.log('✅ Test 4 Passed: Customer cancelling inside cancellation window returned 400 with clear message.');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 5: check-in before the check-in date gives 400
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Check-in before check-in date gives 400 ---');
    // Create a confirmed booking via staff for future date
    const futureCheckIn = addDays(today(), 10);
    const futureCheckOut = addDays(today(), 12);

    await pool.query(
      'DELETE FROM reservations WHERE room_id = ? AND check_in_date = ? AND check_out_date = ?',
      [testRoom.room_id, futureCheckIn, futureCheckOut]
    );

    const futureBookingRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/reservations/staff',
      token: tokenStaff,
      body: {
        customer_id: custAId,
        room_id: testRoom.room_id,
        check_in_date: futureCheckIn,
        check_out_date: futureCheckOut,
        guests: 1,
      },
    });

    if (futureBookingRes.status !== 201) {
      throw new Error(`Failed to create future staff booking for test 5: ${JSON.stringify(futureBookingRes.data)}`);
    }

    const futureRef = futureBookingRes.data.booking_ref;

    // Attempt staff check-in before check-in date
    const earlyCheckInRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/reservations/${futureRef}/check-in`,
      token: tokenStaff,
      body: {},
    });

    console.log(`Status: ${earlyCheckInRes.status}, Message: ${earlyCheckInRes.data?.message}`);
    if (earlyCheckInRes.status !== 400) {
      throw new Error(`Test 5 Failed: Expected 400 for early check-in, got ${earlyCheckInRes.status}`);
    }
    console.log('✅ Test 5 Passed: Early check-in correctly returned 400.');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 6: check-out with an unpaid balance gives 409
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Check-out with an unpaid balance gives 409 ---');
    // Confirm urgentBookingRes so it can be checked in
    await request(baseUrl, {
      method: 'PATCH',
      path: `/api/reservations/${urgentRef}/confirm`,
      token: tokenStaff,
      body: {},
    });

    // Process check-in (valid because check_in_date is today())
    const checkInRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/reservations/${urgentRef}/check-in`,
      token: tokenStaff,
      body: {},
    });

    if (checkInRes.status !== 200) {
      throw new Error(`Failed to check in reservation for test 6: ${JSON.stringify(checkInRes.data)}`);
    }

    // Now attempt check-out with unpaid balance
    const checkOutRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/reservations/${urgentRef}/check-out`,
      token: tokenStaff,
      body: {},
    });

    console.log(`Status: ${checkOutRes.status}, Balance: ${checkOutRes.data?.balance}, Message: ${checkOutRes.data?.message}`);
    if (checkOutRes.status !== 409 || checkOutRes.data?.balance === undefined) {
      throw new Error(`Test 6 Failed: Expected 409 with balance, got status ${checkOutRes.status}: ${JSON.stringify(checkOutRes.data)}`);
    }
    console.log(`✅ Test 6 Passed: Check-out with unpaid balance returned 409 with balance (${checkOutRes.data.balance}).`);

    console.log('\n🎉 ALL 6 ACCEPTANCE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
    await pool.end();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Acceptance test suite failed:', err);
  process.exit(1);
});
