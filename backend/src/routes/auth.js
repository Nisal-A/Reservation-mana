const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If customer, get customer details
    let customerData = null;
    if (user.role === 'customer') {
      const [custRows] = await pool.query(
        'SELECT * FROM customers WHERE user_id = ?',
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
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        customer_id: customerData ? customerData.customer_id : null,
        name: customerData ? customerData.name : user.username,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/register (Customer self-registration)
router.post('/register', async (req, res) => {
  const { username, password, name, email, phone } = req.body;
  if (!username || !password || !name || !email) {
    return res.status(400).json({ message: 'Username, password, name, and email are required.' });
  }

  try {
    // Check existing username
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username already taken.' });
    }

    // Check existing email
    const [existingEmail] = await pool.query('SELECT customer_id FROM customers WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'customer']
    );

    const userId = userResult.insertId;

    await pool.query(
      'INSERT INTO customers (user_id, name, email, phone) VALUES (?, ?, ?, ?)',
      [userId, name, email, phone || null]
    );

    res.status(201).json({ message: 'Registration successful. Please log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
