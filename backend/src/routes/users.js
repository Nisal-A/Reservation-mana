const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(verifyToken, requireRole('admin'));

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT user_id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required.' });
  }

  try {
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ message: 'Username already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    res.status(201).json({ user_id: result.insertId, username, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  const { username, password, role } = req.body;
  
  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found.' });
    if (username && username !== existing[0].username) {
        const [dup] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
        if (dup.length > 0) return res.status(409).json({ message: 'Username already taken.' });
    }

    let hashedPassword = existing[0].password;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    await pool.query(
      'UPDATE users SET username = ?, password = ?, role = ? WHERE user_id = ?',
      [username || existing[0].username, hashedPassword, role || existing[0].role, req.params.id]
    );

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found.' });

    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
