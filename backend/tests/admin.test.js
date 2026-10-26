const request = require('supertest');
const app = require('../src/server');
const { pool, cleanDb, closeDb } = require('./helpers/db');
const {
  createStaffUser,
  createCustomerUser,
  createRoom,
  createReservation,
} = require('./helpers/factories');

describe('5. Admin & Security Test Suite', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('admin cannot delete or demote themselves, and cannot remove the last active admin', async () => {
    // Create first admin (this is the only active admin initially)
    const adminA = await createStaffUser('admin', { username: 'admin_primary' });

    // 1. Admin A attempts to delete themselves -> 409 Conflict
    const selfDeleteRes = await request(app)
      .delete(`/api/users/${adminA.user.user_id}`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(selfDeleteRes.status).toBe(409);
    expect(selfDeleteRes.body.message).toMatch(/cannot delete their own account/i);

    // 2. Admin A attempts to demote themselves -> 409 Conflict
    const selfDemoteRes = await request(app)
      .put(`/api/users/${adminA.user.user_id}`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ role: 'reception' });
    expect(selfDemoteRes.status).toBe(409);
    expect(selfDemoteRes.body.message).toMatch(/demote/i);

    // 3. Admin A attempts to deactivate themselves -> 409 Conflict
    const selfDeactivateRes = await request(app)
      .patch(`/api/users/${adminA.user.user_id}/active`)
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ is_active: false });
    expect(selfDeactivateRes.status).toBe(409);
    expect(selfDeactivateRes.body.message).toMatch(/cannot deactivate their own account/i);

    // 3. Last active admin cannot be removed:
    // Create Admin B as the ONLY active admin (Admin A is set inactive in DB)
    const adminB = await createStaffUser('admin', { username: 'admin_secondary' });
    await pool.query('UPDATE users SET is_active = 0 WHERE user_id = ?', [adminA.user.user_id]);

    // Admin B is the only active admin. Admin B attempts to delete themselves -> 409
    const deleteSelfRes = await request(app)
      .delete(`/api/users/${adminB.user.user_id}`)
      .set('Authorization', `Bearer ${adminB.token}`);
    expect(deleteSelfRes.status).toBe(409);
    expect(deleteSelfRes.body.message).toMatch(/cannot delete their own account/i);

    // Admin B attempts to deactivate themselves -> 409
    const deactivateSelfRes = await request(app)
      .patch(`/api/users/${adminB.user.user_id}/active`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .send({ is_active: false });
    expect(deactivateSelfRes.status).toBe(409);
    expect(deactivateSelfRes.body.message).toMatch(/cannot deactivate/i);
  });

  it('cannot set maintenance on a room with a future confirmed booking', async () => {
    const admin = await createStaffUser('admin');
    const customer = await createCustomerUser();
    const room = await createRoom({
      room_number: '601',
      status: 'available',
    });

    // Create a future confirmed booking
    await createReservation({
      customer_id: customer.customer.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-11-20',
      check_out_date: '2026-11-25',
      status: 'confirmed',
    });

    // Admin tries to set room status to 'maintenance'
    const res = await request(app)
      .put(`/api/rooms/${room.room_id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'maintenance' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/maintenance.*refused/i);
    expect(res.body).toHaveProperty('conflicting_reservations');
    expect(res.body.conflicting_reservations.length).toBeGreaterThan(0);
  });

  it('cannot delete a room or customer with history', async () => {
    const admin = await createStaffUser('admin');
    const customer = await createCustomerUser();
    const room = await createRoom({ room_number: '602' });

    // Create reservation linking customer and room
    await createReservation({
      customer_id: customer.customer.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-10-01',
      check_out_date: '2026-10-03',
      status: 'checked_out',
    });

    // 1. Admin tries to delete the room with history -> 409
    const deleteRoomRes = await request(app)
      .delete(`/api/rooms/${room.room_id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteRoomRes.status).toBe(409);
    expect(deleteRoomRes.body.message).toMatch(/history/i);

    // 2. Admin tries to delete the customer with history -> 409
    const deleteCustRes = await request(app)
      .delete(`/api/customers/${customer.customer.customer_id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteCustRes.status).toBe(409);
    expect(deleteCustRes.body.message).toMatch(/history/i);
  });

  it('reception cannot call admin routes', async () => {
    const reception = await createStaffUser('reception');

    const adminOnlyRoutes = [
      { method: 'get', url: '/api/users' },
      { method: 'post', url: '/api/users', body: { username: 'staff1', password: 'Password123!', role: 'reception' } },
      { method: 'post', url: '/api/rooms', body: { room_number: '777', room_type: 'Standard', price: 10000 } },
      { method: 'delete', url: '/api/rooms/1' },
      { method: 'delete', url: '/api/customers/1' },
      { method: 'get', url: '/api/reports/overview?from=2026-10-01&to=2026-10-26' },
      { method: 'get', url: '/api/reports/export?report=overview&format=csv&from=2026-10-01&to=2026-10-26' },
      { method: 'post', url: '/api/reservations/LS-2026-000001/refunds', body: { amount: 1000, method: 'cash', reason: 'Overcharge' } },
      { method: 'patch', url: '/api/reviews/1/approve' },
      { method: 'delete', url: '/api/reviews/1' },
    ];

    for (const r of adminOnlyRoutes) {
      const req = request(app)[r.method](r.url)
        .set('Authorization', `Bearer ${reception.token}`);
      if (r.body) req.send(r.body);
      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/access denied|insufficient permissions/i);
    }
  });

  it('every admin and reception action writes an audit_log row', async () => {
    const admin = await createStaffUser('admin', { username: 'audit_admin' });
    const reception = await createStaffUser('reception', { username: 'audit_reception' });

    // Initial audit count
    const [initial] = await pool.query('SELECT COUNT(*) AS total FROM audit_log');
    const initialCount = Number(initial[0].total);

    // 1. Admin creates a room
    const createRoomRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        room_number: '901',
        room_type: 'Executive Penthouse',
        price: 45000.0,
        capacity: 4,
      });
    expect(createRoomRes.status).toBe(201);
    const newRoomId = createRoomRes.body.room.room_id;

    // 2. Admin creates a user
    const createUserRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        username: 'new_receptionist',
        password: 'Password123!',
        role: 'reception',
      });
    expect(createUserRes.status).toBe(201);

    // 3. Customer creates a pending booking online
    const customer = await createCustomerUser();
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        room_id: newRoomId,
        check_in_date: '2026-11-20',
        check_out_date: '2026-11-22',
        guests: 2,
      });
    expect(createRes.status).toBe(201);
    const bookingRef = createRes.body.booking_ref;

    // 4. Reception confirms the reservation
    const confirmRes = await request(app)
      .patch(`/api/reservations/${bookingRef}/confirm`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(confirmRes.status).toBe(200);

    // Check that audit_log has recorded these actions
    const [finalAudit] = await pool.query('SELECT action, entity, user_id FROM audit_log ORDER BY audit_id ASC');
    expect(finalAudit.length).toBeGreaterThan(initialCount);

    const actions = finalAudit.map((a) => a.action);
    expect(actions).toContain('create_room');
    expect(actions).toContain('create_user');
    expect(actions).toContain('create_reservation');
    expect(actions).toContain('confirm_reservation');
  });
});
