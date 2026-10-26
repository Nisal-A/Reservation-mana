const request = require('supertest');
const app = require('../src/server');
const { pool, cleanDb, closeDb } = require('./helpers/db');
const {
  createStaffUser,
  createCustomer,
  createRoom,
  createReservation,
  createPayment,
} = require('./helpers/factories');

describe('6. Reports Engine Test Suite', () => {
  let adminToken;

  beforeEach(async () => {
    await cleanDb();
    const admin = await createStaffUser('admin');
    adminToken = admin.token;
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('verifies report metrics against independently calculated values from raw rows', async () => {
    /**
     * HAND-BUILT FIXTURE SPECIFICATION:
     *
     * 1. Rooms:
     *    - Room 1: room_number '101', room_type 'Standard', price 15,000
     *    - Room 2: room_number '102', room_type 'Deluxe', price 20,000
     *
     * 2. Range:
     *    - from: '2026-10-01' to '2026-10-31' (31 days in October)
     *    - available_room_nights = 2 rooms * 31 days = 62
     *
     * 3. Reservations:
     *    - Res 1: Customer 1, Room 1 (Standard, 15k). Created '2026-09-25 10:00:00'.
     *      Dates: '2026-10-05' to '2026-10-09' (4 nights).
     *      Status: 'checked_out'. Nightly rate: 15,000. Total amount: 60,000.
     *      Sold nights in Oct: 4. Room revenue in Oct: 60,000.
     *      Payments: 60,000 payment on 2026-10-05, 5,000 refund on 2026-10-06.
     *      Net cash collected = 55,000. Outstanding balance = 60,000 - 55,000 = 5,000.
     *
     *    - Res 2: Customer 2 (had earlier stay in September, so returning). Room 2 (Deluxe, 20k).
     *      Created '2026-10-20 12:00:00'.
     *      Dates: '2026-10-29' to '2026-11-03' (5 nights total, 3 nights in October, spanning month boundary).
     *      Status: 'confirmed'. Nightly rate: 20,000. Total amount: 100,000.
     *      Forecast nights in Oct: 3. Sold nights in Oct: 0 (confirmed is not sold).
     *      Payment: 40,000 on 2026-10-29.
     *      Lead time: 2026-10-20 to 2026-10-29 = 9 days.
     *      Length of stay: 5 nights. Source: 'reception'.
     *
     *    - Res 3: Customer 3, Room 1 (Standard, 15k). Created '2026-10-10 09:00:00'.
     *      Dates: '2026-10-15' to '2026-10-18' (3 nights).
     *      Status: 'cancelled'. Nightly rate: 15,000. Total amount: 45,000.
     *      Sold nights in Oct: 0. Room revenue: 0. Source: 'online'.
     *
     * 4. Expected Independent Metrics in October:
     *    - sold_room_nights = 4
     *    - available_room_nights = 62
     *    - room_revenue = 60,000
     *    - occupancy_pct = (4 / 62) * 100 = 6.45%
     *    - adr = 60,000 / 4 = 15,000
     *    - revpar = 60,000 / 62 = 967.74
     *    - cash_collected = 60,000 - 5,000 + 40,000 = 95,000
     *    - outstanding_balance = 5,000 (from Res 1)
     *    - reservations_created in Oct = 2 (Res 2 and Res 3)
     *    - cancellation_rate_pct = 1 / 2 * 100 = 50.0%
     *    - avg_lead_time_days = 9.0 (Res 2: Oct 20 to Oct 29)
     *    - avg_length_of_stay = 4.0 (Res 1 checked out in Oct)
     *    - customers (non-cancelled created in Oct): new = 0, returning = 1
     */

    // Seed 2 Rooms
    const room1 = await createRoom({
      room_number: '101',
      room_type: 'Standard',
      price: 15000.0,
      status: 'available',
    });

    const room2 = await createRoom({
      room_number: '102',
      room_type: 'Deluxe',
      price: 20000.0,
      status: 'available',
    });

    // Seed Customers
    const cust1 = await createCustomer({ name: 'Alice Customer', email: 'alice@test.com' });
    const cust2 = await createCustomer({ name: 'Bob Returning', email: 'bob@test.com' });
    const cust3 = await createCustomer({ name: 'Charlie Cancel', email: 'charlie@test.com' });

    // Customer 2 prior stay in September to establish returning customer status
    const priorRes = await createReservation({
      customer_id: cust2.customer_id,
      room_id: room2.room_id,
      check_in_date: '2026-09-01',
      check_out_date: '2026-09-04',
      status: 'checked_out',
      total_amount: 60000.0,
      created_at: '2026-08-20 10:00:00',
    });

    // Fully pay the September reservation in September so it has 0 outstanding balance
    await createPayment({
      reservation_id: priorRes.reservation_id,
      amount: 60000.0,
      kind: 'payment',
      method: 'cash',
      created_at: '2026-09-01 10:00:00',
    });

    // Res 1: Oct 5 to Oct 9 (4 nights), checked_out, total 60,000
    const res1 = await createReservation({
      customer_id: cust1.customer_id,
      room_id: room1.room_id,
      check_in_date: '2026-10-05',
      check_out_date: '2026-10-09',
      nightly_rate: 15000.0,
      total_amount: 60000.0,
      status: 'checked_out',
      booking_source: 'online',
      created_at: '2026-09-25 10:00:00',
    });

    // Res 1 payments: 60k payment, 5k refund
    await createPayment({
      reservation_id: res1.reservation_id,
      amount: 60000.0,
      kind: 'payment',
      method: 'cash',
      created_at: '2026-10-05 12:00:00',
    });

    await createPayment({
      reservation_id: res1.reservation_id,
      amount: 5000.0,
      kind: 'refund',
      method: 'cash',
      created_at: '2026-10-06 14:00:00',
    });

    // Res 2: Oct 29 to Nov 03 (5 nights, 3 in Oct), confirmed, total 100,000
    const res2 = await createReservation({
      customer_id: cust2.customer_id,
      room_id: room2.room_id,
      check_in_date: '2026-10-29',
      check_out_date: '2026-11-03',
      nightly_rate: 20000.0,
      total_amount: 100000.0,
      status: 'confirmed',
      booking_source: 'reception',
      created_at: '2026-10-20 12:00:00',
    });

    // Res 2 payment: 40k
    await createPayment({
      reservation_id: res2.reservation_id,
      amount: 40000.0,
      kind: 'payment',
      method: 'card',
      created_at: '2026-10-29 15:00:00',
    });

    // Res 3: Oct 15 to Oct 18 (3 nights), cancelled
    await createReservation({
      customer_id: cust3.customer_id,
      room_id: room1.room_id,
      check_in_date: '2026-10-15',
      check_out_date: '2026-10-18',
      nightly_rate: 15000.0,
      total_amount: 45000.0,
      status: 'cancelled',
      booking_source: 'online',
      created_at: '2026-10-10 09:00:00',
    });

    // ─── Assertions Against /api/reports/overview ───
    const overviewRes = await request(app)
      .get('/api/reports/overview?from=2026-10-01&to=2026-10-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewRes.status).toBe(200);
    const data = overviewRes.body.data;

    expect(data.sold_room_nights).toBe(4);
    expect(data.available_room_nights).toBe(62);
    expect(data.room_revenue).toBe(60000);
    expect(data.occupancy_pct).toBeCloseTo(6.45, 1);
    expect(data.adr).toBe(15000);
    expect(data.revpar).toBeCloseTo(967.74, 1);
    expect(data.cash_collected).toBe(95000);
    expect(data.outstanding_balance).toBe(5000);
    expect(data.cancellation_rate_pct).toBe(50.0);
    expect(data.avg_lead_time_days).toBe(9);
    expect(data.avg_length_of_stay).toBe(4);
    expect(data.customers.new_customers_count).toBe(0);
    expect(data.customers.returning_customers_count).toBe(1);

    // ─── Assertions with Filters ───
    // Filter room_type = 'Standard' (only Room 1 has 31 available nights)
    const filteredRoomRes = await request(app)
      .get('/api/reports/overview?from=2026-10-01&to=2026-10-31&room_type=Standard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filteredRoomRes.body.data.available_room_nights).toBe(31);

    // Filter source = 'reception' (only Res 2 was reception, created in Oct)
    const filteredSourceRes = await request(app)
      .get('/api/reports/overview?from=2026-10-01&to=2026-10-31&source=reception')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filteredSourceRes.body.data.reservations_created.total).toBe(1);

    // ─── Assertions with compare=previous_period ───
    const compareRes = await request(app)
      .get('/api/reports/overview?from=2026-10-01&to=2026-10-31&compare=previous_period')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(compareRes.status).toBe(200);
    expect(compareRes.body.range).toEqual({ from: '2026-10-01', to: '2026-10-31', days: 31 });
    expect(compareRes.body.compare_range).toEqual({ from: '2026-08-31', to: '2026-09-30', days: 31 });
    expect(compareRes.body).toHaveProperty('previous');
  });
});
