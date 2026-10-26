const request = require('supertest');
const app = require('../src/server');
const { cleanDb, closeDb } = require('./helpers/db');
const { createCustomerUser, createRoom } = require('./helpers/factories');

describe('2. Booking Test Suite', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('customer books an available room (201, status pending, booking_ref format LS-YYYY-NNNNNN, total = nights x rate computed by the server even when the client sends a different price)', async () => {
    const { token } = await createCustomerUser();
    const room = await createRoom({
      room_number: '101',
      price: 18000.0,
      capacity: 3,
    });

    const checkInDate = '2026-11-10';
    const checkOutDate = '2026-11-13'; // 3 nights

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id: room.room_id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests: 2,
        // Client attempts to send a fraudulent price
        total_amount: 100.0,
        price: 50.0,
        nightly_rate: 10.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.booking_ref).toMatch(/^LS-\d{4}-\d{6}$/);

    // Expected total = 3 nights x 18000 = 54000
    expect(Number(res.body.nightly_rate)).toBe(18000.0);
    expect(Number(res.body.total_amount)).toBe(54000.0);
  });

  it('invalid and past dates give 400', async () => {
    const { token } = await createCustomerUser();
    const room = await createRoom();

    // 1. Past check-in date
    const pastRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id: room.room_id,
        check_in_date: '2020-01-01',
        check_out_date: '2020-01-05',
        guests: 1,
      });
    expect(pastRes.status).toBe(400);
    expect(pastRes.body.message).toMatch(/past/i);

    // 2. Checkout before or same as check-in
    const invalidRangeRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id: room.room_id,
        check_in_date: '2026-11-15',
        check_out_date: '2026-11-12',
        guests: 1,
      });
    expect(invalidRangeRes.status).toBe(400);

    // 3. Invalid date string
    const malformedRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id: room.room_id,
        check_in_date: 'not-a-date',
        check_out_date: '2026-11-20',
        guests: 1,
      });
    expect(malformedRes.status).toBe(400);
  });

  it('capacity exceeded gives 400', async () => {
    const { token } = await createCustomerUser();
    const room = await createRoom({
      capacity: 2,
    });

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_id: room.room_id,
        check_in_date: '2026-11-10',
        check_out_date: '2026-11-12',
        guests: 5,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/capacity/i);
  });

  it('20 parallel bookings of one room and dates produce exactly one 201 and nineteen 409', async () => {
    const room = await createRoom({
      room_number: '201',
      price: 20000.0,
      capacity: 4,
    });

    const checkInDate = '2026-11-20';
    const checkOutDate = '2026-11-25';

    // Create 20 unique customers and tokens
    const customers = [];
    for (let i = 0; i < 20; i++) {
      const c = await createCustomerUser({
        username: `parallel_user_${i}_${Date.now()}`,
        email: `parallel_${i}_${Date.now()}@luxestay.test`,
      });
      customers.push(c);
    }

    // Launch all 20 booking requests concurrently
    const promises = customers.map((c) =>
      request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${c.token}`)
        .send({
          room_id: room.room_id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          guests: 2,
        })
    );

    const responses = await Promise.all(promises);

    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(19);
  });

  it('a cancelled booking frees the dates', async () => {
    const customerA = await createCustomerUser();
    const customerB = await createCustomerUser();
    const room = await createRoom({ room_number: '301' });

    const checkInDate = '2026-12-01';
    const checkOutDate = '2026-12-05';

    // 1. Customer A books
    const bookRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerA.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests: 1,
      });
    expect(bookRes.status).toBe(201);
    const bookingRef = bookRes.body.booking_ref;

    // 2. Customer B attempts to book same room and dates -> 409 Conflict
    const conflictRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerB.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests: 1,
      });
    expect(conflictRes.status).toBe(409);

    // 3. Customer A cancels the booking
    const cancelRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/cancel`)
      .set('Authorization', `Bearer ${customerA.token}`)
      .send({ reason: 'Trip postponed' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');

    // 4. Customer B books now that dates are freed -> 201 Created
    const retryRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customerB.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests: 1,
      });
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.status).toBe('pending');
  });

  it('a booking that ends on the day another starts does not conflict', async () => {
    const customer1 = await createCustomerUser();
    const customer2 = await createCustomerUser();
    const room = await createRoom({ room_number: '401' });

    // Stay 1: Nov 10 to Nov 13 (checks out on Nov 13)
    const res1 = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customer1.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: '2026-11-10',
        check_out_date: '2026-11-13',
        guests: 1,
      });
    expect(res1.status).toBe(201);

    // Stay 2: Nov 13 to Nov 15 (checks in on Nov 13)
    const res2 = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customer2.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: '2026-11-13',
        check_out_date: '2026-11-15',
        guests: 1,
      });
    expect(res2.status).toBe(201);
  });
});
