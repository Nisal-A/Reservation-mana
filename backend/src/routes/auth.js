const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const env = require('../config/env');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-test-ip'] || req.ip,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts from this IP, please try again after 15 minutes.', errors: [] },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts from this IP, please try again after 15 minutes.', errors: [] },
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, 'Username must be 3-30 characters long and contain only letters, numbers, and underscores'),
  password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, 'Password must be at least 8 characters long and contain both letters and numbers'),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().or(z.literal('')),
});

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await pool.query(
    'SELECT user_id, username, password, role, is_active FROM users WHERE username = ?',
    [username]
  );
  if (rows.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials.', errors: [] });
  }

  const user = rows[0];

  if (!user.is_active) {
    return res.status(401).json({ message: 'User account is inactive. Please contact administration.', errors: [] });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials.', errors: [] });
  }

  // Update last_login_at
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

  // If customer, get customer details
  let customerData = null;
  if (user.role === 'customer') {
    const [custRows] = await pool.query(
      'SELECT customer_id, user_id, name, email, phone, created_at FROM customers WHERE user_id = ?',
      [user.user_id]
    );
    if (custRows.length > 0) customerData = custRows[0];
  }

  const token = jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      customer_id: customerData ? customerData.customer_id : null,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  res.json({
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      is_active: Boolean(user.is_active),
      customer_id: customerData ? customerData.customer_id : null,
      name: customerData ? customerData.name : user.username,
    },
  });
}));

// GET /api/auth/me
router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  const [userRows] = await pool.query(
    'SELECT user_id, username, role, is_active, last_login_at, created_at FROM users WHERE user_id = ?',
    [req.user.user_id]
  );

  if (userRows.length === 0) {
    return res.status(404).json({ message: 'User not found.', errors: [] });
  }

  const freshUser = {
    ...userRows[0],
    is_active: Boolean(userRows[0].is_active),
  };

  let customerRecord = null;
  const [custRows] = await pool.query(
    'SELECT customer_id, user_id, name, email, phone, created_at FROM customers WHERE user_id = ?',
    [req.user.user_id]
  );
  if (custRows.length > 0) {
    customerRecord = custRows[0];
  }

  res.json({
    user: freshUser,
    customer: customerRecord,
  });
}));

// POST /api/auth/register (Customer self-registration)
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { username, password, name, email, phone } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check existing username
    const [existing] = await conn.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Username already taken.', errors: [] });
    }

    // Check existing email
    const [existingEmail] = await conn.query('SELECT customer_id FROM customers WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email already registered.', errors: [] });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [userResult] = await conn.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'customer']
    );

    const userId = userResult.insertId;

    await conn.query(
      'INSERT INTO customers (user_id, name, email, phone) VALUES (?, ?, ?, ?)',
      [userId, name, email, phone || null]
    );

    await conn.commit();
    res.status(201).json({ message: 'Registration successful. Please log in.' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
