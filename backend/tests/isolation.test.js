const request = require('supertest');
const app = require('../src/server');
const { cleanDb, closeDb } = require('./helpers/db');
const {
  createCustomerUser,
  createRoom,
  createReservation,
  createReview,
} = require('./helpers/factories');

describe('3. Multi-Tenant and Role Isolation Test Suite', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it("customer B gets 404 for customer A's reservation, bill, cancel and review", async () => {
    const customerA = await createCustomerUser({ username: 'cust_a' });
    const customerB = await createCustomerUser({ username: 'cust_b' });
    const room = await createRoom();

    // Create reservation for customer A
    const resA = await createReservation({
      customer_id: customerA.customer.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-11-15',
      check_out_date: '2026-11-18',
      status: 'pending',
    });

    // 1. Customer B attempts to get Customer A's reservation
    const getRes = await request(app)
      .get(`/api/reservations/my/${resA.booking_ref}`)
      .set('Authorization', `Bearer ${customerB.token}`);
    expect(getRes.status).toBe(404);

    // 2. Customer B attempts to access Customer A's bill
    // In customer portal, bill is fetched through the reservation endpoint
    const billRes = await request(app)
      .get(`/api/reservations/my/${resA.booking_ref}`)
      .set('Authorization', `Bearer ${customerB.token}`);
    expect(billRes.status).toBe(404);

    // 3. Customer B attempts to cancel Customer A's reservation
    const cancelRes = await request(app)
      .patch(`/api/reservations/${resA.booking_ref}/cancel`)
      .set('Authorization', `Bearer ${customerB.token}`)
      .send({ reason: 'Malicious cancellation' });
    expect(cancelRes.status).toBe(404);

    // 4. Create an unapproved/pending review for Customer A
    const reviewA = await createReview({
      customer_id: customerA.customer.customer_id,
      room_id: room.room_id,
      reservation_id: resA.reservation_id,
      is_approved: 0,
    });

    // Customer B attempts to fetch Customer A's review
    const reviewRes = await request(app)
      .get(`/api/reviews/${reviewA.review_id}`)
      .set('Authorization', `Bearer ${customerB.token}`);
    expect(reviewRes.status).toBe(404);

    // Customer B attempts to submit a review for Customer A's reservation
    const submitReviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerB.token}`)
      .send({
        reservation_id: resA.reservation_id,
        rating: 5,
        review_text: 'Trying to review another guest booking',
      });
    expect(submitReviewRes.status).toBe(404);
  });

  it('customers get 403 on every staff route', async () => {
    const customer = await createCustomerUser();

    const staffRoutes = [
      { method: 'get', url: '/api/users' },
      { method: 'post', url: '/api/users', body: { username: 'test_admin', password: 'Password123!', role: 'admin' } },
      { method: 'get', url: '/api/reservations' },
      { method: 'post', url: '/api/rooms', body: { room_number: '999', room_type: 'Test', price: 10000 } },
      { method: 'get', url: '/api/reports/overview?from=2026-10-01&to=2026-10-26' },
      { method: 'get', url: '/api/reports/export?report=overview&format=csv&from=2026-10-01&to=2026-10-26' },
      { method: 'get', url: '/api/frontdesk/summary' },
      { method: 'patch', url: '/api/reservations/LS-2026-000001/confirm' },
      { method: 'patch', url: '/api/reservations/LS-2026-000001/check-in' },
      { method: 'patch', url: '/api/reservations/LS-2026-000001/check-out' },
      { method: 'post', url: '/api/reservations/LS-2026-000001/payments', body: { amount: 1000, method: 'cash' } },
    ];

    for (const r of staffRoutes) {
      const req = request(app)[r.method](r.url)
        .set('Authorization', `Bearer ${customer.token}`);
      if (r.body) req.send(r.body);
      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/access denied|insufficient permissions/i);
    }
  });

  it('unauthenticated calls to protected routes give 401', async () => {
    const protectedRoutes = [
      { method: 'get', url: '/api/auth/me' },
      { method: 'get', url: '/api/reservations/my' },
      { method: 'get', url: '/api/reservations' },
      { method: 'get', url: '/api/rooms' },
      { method: 'get', url: '/api/users' },
      { method: 'get', url: '/api/reports/overview?from=2026-10-01&to=2026-10-26' },
      { method: 'get', url: '/api/frontdesk/summary' },
      { method: 'get', url: '/api/reviews' },
    ];

    for (const r of protectedRoutes) {
      const res = await request(app)[r.method](r.url);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/access denied|no token provided/i);
    }
  });
});
