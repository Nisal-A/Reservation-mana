const request = require('supertest');
const app = require('../src/server');
const { cleanDb, closeDb } = require('./helpers/db');
const { createCustomerUser, createStaffUser, createRoom } = require('./helpers/factories');
const { today, addDays } = require('../src/utils/dates');

describe('4. Frontdesk Full Lifecycle Test Suite', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('the full flow: online booking, confirm, early check-in refused, check-in on check-in date, partial payment, check-out refused with balance, final payment, check-out, room available again, payment_status paid', async () => {
    const customer = await createCustomerUser();
    const reception = await createStaffUser('reception');
    const roomEarly = await createRoom({ room_number: '500', price: 15000.0 });
    const room = await createRoom({
      room_number: '501',
      price: 15000.0,
      status: 'available',
    });

    const todayStr = today();
    const tomorrowStr = addDays(todayStr, 1);
    const dayAfterTomorrowStr = addDays(todayStr, 2);

    // ─── 1. Early Check-in Refusal Scenario ───
    // Customer books roomEarly for tomorrow -> day after tomorrow
    const futureBookingRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        room_id: roomEarly.room_id,
        check_in_date: tomorrowStr,
        check_out_date: dayAfterTomorrowStr,
        guests: 1,
      });
    expect(futureBookingRes.status).toBe(201);
    const futureRef = futureBookingRes.body.booking_ref;

    // Staff confirms future booking
    const confirmFutureRes = await request(app)
      .patch(`/api/reservations/${futureRef}/confirm`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(confirmFutureRes.status).toBe(200);

    // Early check-in must be refused today (before check-in date)
    const earlyCheckInRes = await request(app)
      .patch(`/api/reservations/${futureRef}/check-in`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ id_verified: true });
    expect(earlyCheckInRes.status).toBe(400);
    expect(earlyCheckInRes.body.message).toMatch(/before the check-in date/i);

    // ─── 2. Full Standard Flow for Today's Stay ───
    // Step A: Online booking for today
    const bookRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        room_id: room.room_id,
        check_in_date: todayStr,
        check_out_date: dayAfterTomorrowStr, // 2 nights x 15000 = 30000
        guests: 2,
      });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.status).toBe('pending');
    expect(bookRes.body.payment_status).toBe('unpaid');
    const bookingRef = bookRes.body.booking_ref;

    // Step B: Staff confirms booking
    const confirmRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/confirm`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('confirmed');

    // Step C: Check-in on the check-in date
    const checkInRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/check-in`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ id_verified: true });
    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.status).toBe('checked_in');

    // Verify room status changed to 'occupied'
    const roomOccupiedRes = await request(app)
      .get(`/api/rooms/${room.room_id}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(roomOccupiedRes.body.status).toBe('occupied');

    // Step D: Partial payment (LKR 10,000 out of 30,000)
    const partialPayRes = await request(app)
      .post(`/api/reservations/${bookingRef}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        amount: 10000.0,
        method: 'cash',
        note: 'Deposit on arrival',
      });
    expect(partialPayRes.status).toBe(201);
    expect(partialPayRes.body.bill.payment_status).toBe('partial');
    expect(Number(partialPayRes.body.bill.balance)).toBe(20000.0);

    // Step E: Check-out refused with balance
    const prematureCheckOutRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/check-out`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(prematureCheckOutRes.status).toBe(409);
    expect(prematureCheckOutRes.body.message).toMatch(/unpaid balance/i);

    // Step F: Final payment of the remaining LKR 20,000
    const finalPayRes = await request(app)
      .post(`/api/reservations/${bookingRef}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        amount: 20000.0,
        method: 'card',
        reference: 'TXN-CARD-998811',
        note: 'Settling remaining balance at checkout',
      });
    expect(finalPayRes.status).toBe(201);
    expect(finalPayRes.body.bill.payment_status).toBe('paid');
    expect(Number(finalPayRes.body.bill.balance)).toBe(0.0);

    // Step G: Check-out successfully
    const checkOutRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/check-out`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.status).toBe('checked_out');
    expect(checkOutRes.body.payment_status).toBe('paid');

    // Step H: Room is available again
    const roomAvailableRes = await request(app)
      .get(`/api/rooms/${room.room_id}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(roomAvailableRes.body.status).toBe('available');
  });
});
