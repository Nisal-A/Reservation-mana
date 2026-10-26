const request = require('supertest');
const app = require('../src/server');
const { pool, cleanDb, closeDb } = require('./helpers/db');
const { createUser } = require('./helpers/factories');

describe('1. Auth Test Suite', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('customer can register, log in, and call /api/auth/me', async () => {
    const registerPayload = {
      username: 'john_doe_99',
      password: 'SecurePassword123!',
      name: 'John Doe',
      email: 'john.doe@luxestay.test',
      phone: '+94771234567',
    };

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send(registerPayload);

    expect(regRes.status).toBe(201);
    expect(regRes.body.message).toMatch(/registration successful/i);

    // 2. Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: registerPayload.username,
        password: registerPayload.password,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    const token = loginRes.body.token;

    // 3. Call /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toHaveProperty('user');
    expect(meRes.body.user.username).toBe(registerPayload.username);
    expect(meRes.body.user.role).toBe('customer');
    expect(meRes.body).toHaveProperty('customer');
    expect(meRes.body.customer.email).toBe(registerPayload.email);
  });

  it('wrong password gives 401', async () => {
    const user = await createUser({
      username: 'valid_user',
      password: 'CorrectPassword123!',
      role: 'customer',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: user.username,
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('inactive user gives 401', async () => {
    const user = await createUser({
      username: 'inactive_guest',
      password: 'Password123!',
      role: 'customer',
      is_active: 0,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: user.username,
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/inactive/i);
  });

  it('the 11th login attempt in 15 minutes gives 429', async () => {
    const user = await createUser({
      username: 'rate_limit_target',
      password: 'ValidPassword123!',
    });

    const testIp = '10.99.1.55';

    // Send 10 attempts
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-test-ip', testIp)
        .send({
          username: user.username,
          password: 'IncorrectPassword',
        });
      expect(res.status).toBe(401);
    }

    // 11th attempt must receive 429
    const eleventhRes = await request(app)
      .post('/api/auth/login')
      .set('x-test-ip', testIp)
      .send({
        username: user.username,
        password: 'IncorrectPassword',
      });

    expect(eleventhRes.status).toBe(429);
    expect(eleventhRes.body.message).toMatch(/too many attempts/i);
  });
});
