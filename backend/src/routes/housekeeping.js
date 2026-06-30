/**
 * housekeeping.js — Housekeeping Management API
 * Manages room cleaning tasks and housekeeping room status transitions.
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Valid housekeeping room statuses
const HK_STATUSES = ['available', 'occupied', 'reserved', 'dirty', 'cleaning', 'ready', 'maintenance'];

// ─── GET all rooms with housekeeping status ───────────────────────────────────
router.get('/rooms', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT r.room_id, r.room_number, r.room_type, r.status, r.floor,
             -- Active task info
             t.task_id, t.status AS task_status, t.priority, t.assigned_to,
             u.username AS assigned_username, t.started_at, t.completed_at
      FROM rooms r
      LEFT JOIN housekeeping_tasks t ON r.room_id = t.room_id
        AND t.status IN ('pending','in_progress')
        AND t.task_id = (
          SELECT MAX(t2.task_id) FROM housekeeping_tasks t2
          WHERE t2.room_id = r.room_id AND t2.status IN ('pending','in_progress')
        )
      LEFT JOIN users u ON t.assigned_to = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND r.status = ?'; params.push(status); }
    query += ' ORDER BY r.room_number ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PATCH room housekeeping status ──────────────────────────────────────────
router.patch('/rooms/:id/status', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  const { status } = req.body;
  if (!HK_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${HK_STATUSES.join(', ')}` });
  }
  try {
    const [existing] = await pool.query('SELECT * FROM rooms WHERE room_id=?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Room not found.' });

    await pool.query('UPDATE rooms SET status=? WHERE room_id=?', [status, req.params.id]);

    // Auto-complete tasks if room becomes available or ready
    if (status === 'available' || status === 'ready') {
      await pool.query(
        "UPDATE housekeeping_tasks SET status='completed', completed_at=NOW() WHERE room_id=? AND status IN ('pending','in_progress')",
        [req.params.id]
      );
    }

    const [updated] = await pool.query('SELECT * FROM rooms WHERE room_id=?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET all tasks ────────────────────────────────────────────────────────────
router.get('/tasks', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const { status, room_id } = req.query;
    let query = `
      SELECT t.*, r.room_number, r.room_type, u.username AS assigned_username
      FROM housekeeping_tasks t
      JOIN rooms r ON t.room_id = r.room_id
      LEFT JOIN users u ON t.assigned_to = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status)  { query += ' AND t.status=?';  params.push(status); }
    if (room_id) { query += ' AND t.room_id=?'; params.push(room_id); }
    query += ' ORDER BY t.created_at DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── POST create task ─────────────────────────────────────────────────────────
router.post('/tasks', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  const { room_id, assigned_to, priority, notes } = req.body;
  if (!room_id) return res.status(400).json({ message: 'room_id is required.' });
  try {
    // Mark room as dirty if not already in a cleaning state
    const [roomRows] = await pool.query('SELECT status FROM rooms WHERE room_id=?', [room_id]);
    if (roomRows.length === 0) return res.status(404).json({ message: 'Room not found.' });

    const [result] = await pool.query(
      'INSERT INTO housekeeping_tasks (room_id, assigned_to, priority, notes) VALUES (?,?,?,?)',
      [room_id, assigned_to || null, priority || 'normal', notes || null]
    );

    // Transition room status to dirty if it's available
    if (roomRows[0].status === 'available') {
      await pool.query("UPDATE rooms SET status='dirty' WHERE room_id=?", [room_id]);
    }

    const [newTask] = await pool.query(
      'SELECT t.*, r.room_number, u.username AS assigned_username FROM housekeeping_tasks t JOIN rooms r ON t.room_id=r.room_id LEFT JOIN users u ON t.assigned_to=u.user_id WHERE t.task_id=?',
      [result.insertId]
    );
    res.status(201).json(newTask[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PUT update task ──────────────────────────────────────────────────────────
router.put('/tasks/:id', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  const { status, assigned_to, priority, notes } = req.body;
  try {
    const [taskRows] = await pool.query('SELECT * FROM housekeeping_tasks WHERE task_id=?', [req.params.id]);
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' });

    const task = taskRows[0];
    const now  = new Date();

    let startedAt   = task.started_at;
    let completedAt = task.completed_at;

    if (status === 'in_progress' && !startedAt) startedAt = now;
    if (status === 'completed')                  completedAt = now;

    await pool.query(
      'UPDATE housekeeping_tasks SET status=?, assigned_to=?, priority=?, notes=?, started_at=?, completed_at=? WHERE task_id=?',
      [
        status      ?? task.status,
        assigned_to ?? task.assigned_to,
        priority    ?? task.priority,
        notes       ?? task.notes,
        startedAt,
        completedAt,
        req.params.id,
      ]
    );

    // Auto-transition room status based on task progress
    if (status === 'in_progress') {
      await pool.query("UPDATE rooms SET status='cleaning' WHERE room_id=? AND status='dirty'", [task.room_id]);
    }
    if (status === 'completed') {
      await pool.query("UPDATE rooms SET status='available' WHERE room_id=? AND status IN ('cleaning','dirty','ready')", [task.room_id]);
    }

    const [updated] = await pool.query(
      'SELECT t.*, r.room_number, u.username AS assigned_username FROM housekeeping_tasks t JOIN rooms r ON t.room_id=r.room_id LEFT JOIN users u ON t.assigned_to=u.user_id WHERE t.task_id=?',
      [req.params.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET dashboard summary ────────────────────────────────────────────────────
router.get('/summary', verifyToken, requireRole('admin', 'reception'), async (req, res) => {
  try {
    const [statusCounts] = await pool.query(
      'SELECT status, COUNT(*) AS count FROM rooms GROUP BY status'
    );
    const [pendingTasks] = await pool.query(
      "SELECT COUNT(*) AS count FROM housekeeping_tasks WHERE status IN ('pending','in_progress')"
    );
    res.json({
      room_status_counts: statusCounts,
      pending_tasks: pendingTasks[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
