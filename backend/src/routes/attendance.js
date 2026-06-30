/**
 * attendance.js — Employee Attendance System API
 * Handles clock-in/out, breaks, and attendance reports.
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: get today's date string
const today = () => new Date().toISOString().split('T')[0];

// Helper: calculate total hours worked
function calcHours(clockIn, clockOut, breakStart, breakEnd) {
  if (!clockIn || !clockOut) return null;
  let ms = new Date(clockOut) - new Date(clockIn);
  if (breakStart && breakEnd) {
    ms -= (new Date(breakEnd) - new Date(breakStart));
  }
  return parseFloat((ms / 3600000).toFixed(2));
}

// Helper: determine if late (after 09:00)
function isLate(clockInDatetime) {
  const t = new Date(clockInDatetime);
  return t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 0);
}

// ─── Clock In ────────────────────────────────────────────────────────────────
router.post('/clock-in', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = today();
    const now = new Date();

    // Check if already clocked in today
    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE user_id=? AND date=?', [userId, dateStr]
    );

    if (existing.length > 0 && existing[0].clock_in) {
      return res.status(400).json({ message: 'Already clocked in today.' });
    }

    const status = isLate(now) ? 'late' : 'present';

    if (existing.length > 0) {
      await pool.query(
        'UPDATE attendance SET clock_in=?, status=? WHERE user_id=? AND date=?',
        [now, status, userId, dateStr]
      );
    } else {
      await pool.query(
        'INSERT INTO attendance (user_id, date, clock_in, status) VALUES (?,?,?,?)',
        [userId, dateStr, now, status]
      );
    }

    res.json({ message: 'Clocked in successfully.', clock_in: now, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Clock Out ───────────────────────────────────────────────────────────────
router.post('/clock-out', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = today();
    const now = new Date();

    const [rows] = await pool.query(
      'SELECT * FROM attendance WHERE user_id=? AND date=?', [userId, dateStr]
    );
    if (rows.length === 0 || !rows[0].clock_in) {
      return res.status(400).json({ message: 'Not clocked in today.' });
    }
    if (rows[0].clock_out) {
      return res.status(400).json({ message: 'Already clocked out.' });
    }

    const record = rows[0];
    const totalHours = calcHours(record.clock_in, now, record.break_start, record.break_end);

    await pool.query(
      'UPDATE attendance SET clock_out=?, total_hours=? WHERE user_id=? AND date=?',
      [now, totalHours, userId, dateStr]
    );

    res.json({ message: 'Clocked out successfully.', clock_out: now, total_hours: totalHours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Break Start ─────────────────────────────────────────────────────────────
router.post('/break-start', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = today();
    const now = new Date();

    const [rows] = await pool.query(
      'SELECT * FROM attendance WHERE user_id=? AND date=?', [userId, dateStr]
    );
    if (rows.length === 0 || !rows[0].clock_in) {
      return res.status(400).json({ message: 'Not clocked in.' });
    }
    if (rows[0].break_start) {
      return res.status(400).json({ message: 'Break already started.' });
    }

    await pool.query(
      'UPDATE attendance SET break_start=? WHERE user_id=? AND date=?',
      [now, userId, dateStr]
    );
    res.json({ message: 'Break started.', break_start: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Break End ───────────────────────────────────────────────────────────────
router.post('/break-end', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = today();
    const now = new Date();

    const [rows] = await pool.query(
      'SELECT * FROM attendance WHERE user_id=? AND date=?', [userId, dateStr]
    );
    if (rows.length === 0 || !rows[0].break_start) {
      return res.status(400).json({ message: 'Break not started.' });
    }
    if (rows[0].break_end) {
      return res.status(400).json({ message: 'Break already ended.' });
    }

    await pool.query(
      'UPDATE attendance SET break_end=? WHERE user_id=? AND date=?',
      [now, userId, dateStr]
    );
    res.json({ message: 'Break ended.', break_end: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Get My Today ─────────────────────────────────────────────────────────────
router.get('/today', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM attendance WHERE user_id=? AND date=?',
      [req.user.id, today()]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── My History ──────────────────────────────────────────────────────────────
router.get('/my', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = 'SELECT * FROM attendance WHERE user_id=?';
    const params = [req.user.id];
    if (month && year) {
      query += ' AND MONTH(date)=? AND YEAR(date)=?';
      params.push(month, year);
    }
    query += ' ORDER BY date DESC LIMIT 60';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── All Staff Attendance (Admin) ────────────────────────────────────────────
router.get('/all', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { date, month, year } = req.query;
    let query = `
      SELECT a.*, u.username, u.role
      FROM attendance a
      JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (date)  { query += ' AND a.date=?'; params.push(date); }
    if (month) { query += ' AND MONTH(a.date)=?'; params.push(month); }
    if (year)  { query += ' AND YEAR(a.date)=?'; params.push(year); }
    query += ' ORDER BY a.date DESC, u.username ASC LIMIT 200';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Today's Summary (Admin) ─────────────────────────────────────────────────
router.get('/summary', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [[{ staff_count }]] = await pool.query(
      "SELECT COUNT(*) AS staff_count FROM users WHERE role IN ('admin','reception')"
    );
    const [[{ present }]] = await pool.query(
      "SELECT COUNT(*) AS present FROM attendance WHERE date=CURDATE() AND status IN ('present','late')"
    );
    const [[{ late }]] = await pool.query(
      "SELECT COUNT(*) AS late FROM attendance WHERE date=CURDATE() AND status='late'"
    );

    res.json({
      total_staff: staff_count,
      present,
      late,
      absent: staff_count - present,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
