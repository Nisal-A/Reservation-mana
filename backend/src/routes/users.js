// backend/src/routes/users.js
// Admin user management routes

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// All routes require admin
router.use(verifyToken, requireRole('admin'));

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const passwordMessage = 'Password must be at least 8 characters long and contain both letters and numbers';

// ─── Validation Schemas ────────────────────────────────────────────────────────

const listUsersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    role: z.enum(['admin', 'reception', 'customer']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

const createUserSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
    password: z.string().regex(passwordRegex, passwordMessage),
    role: z.enum(['admin', 'reception'], {
      errorMap: () => ({ message: "Allowed roles for staff accounts are 'admin' and 'reception' only" }),
    }),
  }),
});

const updateUserSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid user ID is required'),
  }),
  body: z.object({
    username: z.string().trim().min(3).max(30).optional(),
    password: z.string().regex(passwordRegex, passwordMessage).optional(),
    role: z.enum(['admin', 'reception']).optional(),
  }),
});

const activeUserSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid user ID is required'),
  }),
  body: z.object({
    is_active: z.boolean({ required_error: 'is_active boolean is required' }),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid user ID is required'),
  }),
});

async function countActiveAdmins(connOrPool) {
  const [rows] = await connOrPool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1"
  );
  return Number(rows[0]?.total || 0);
}

// ─── 1. GET /api/users — list users ───────────────────────────────────────────
router.get(
  '/',
  validate(listUsersSchema),
  asyncHandler(async (req, res) => {
    const { search, role, page, limit } = req.query;

    let query = 'SELECT user_id, username, role, is_active, last_login_at, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND username LIKE ?';
      params.push(`%${search}%`);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    query += ' ORDER BY created_at DESC';

    const p = Math.max(1, page || 1);
    const lim = Math.max(1, limit || 50);
    const offset = (p - 1) * lim;
    query += ' LIMIT ? OFFSET ?';
    params.push(lim, offset);

    const [rows] = await pool.query(query, params);

    const formatted = rows.map((u) => ({
      ...u,
      is_active: Boolean(u.is_active),
    }));

    res.json(formatted);
  })
);

// ─── 2. POST /api/users — create staff user (admin only) ──────────────────────
router.post(
  '/',
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;

    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username already exists.', errors: [] });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, 1)',
      [username, hashedPassword, role]
    );

    const newUserId = result.insertId;

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'create_user',
      entity: 'user',
      entityId: newUserId,
      details: { username, role },
    });

    res.status(201).json({
      user_id: newUserId,
      username,
      role,
      is_active: true,
      message: 'User created successfully.',
    });
  })
);

// ─── 3. PUT /api/users/:id — update user (admin only) ─────────────────────────
router.put(
  '/:id',
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.id;
    const { username, password, role } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [targetUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.', errors: [] });
    }

    const existing = rows[0];

    // An admin cannot demote their own account
    if (req.user.user_id === targetUserId && role && role !== 'admin') {
      return res.status(409).json({
        message: 'An admin cannot demote their own account.',
        errors: [],
      });
    }

    // The last active admin can never be removed or demoted
    if (existing.role === 'admin' && existing.is_active && role === 'reception') {
      const activeAdmins = await countActiveAdmins(pool);
      if (activeAdmins <= 1) {
        return res.status(409).json({
          message: 'The last active admin cannot be demoted.',
          errors: [],
        });
      }
    }

    // Check duplicate username if changing
    if (username && username !== existing.username) {
      const [dup] = await pool.query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, targetUserId]
      );
      if (dup.length > 0) {
        return res.status(409).json({ message: 'Username already taken.', errors: [] });
      }
    }

    let hashedPassword = existing.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
    }

    await pool.query(
      'UPDATE users SET username = ?, password = ?, role = ? WHERE user_id = ?',
      [username || existing.username, hashedPassword, role || existing.role, targetUserId]
    );

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'update_user',
      entity: 'user',
      entityId: targetUserId,
      details: {
        username: username || existing.username,
        role: role || existing.role,
        passwordChanged: Boolean(password),
      },
    });

    res.json({ message: 'User updated successfully.' });
  })
);

// ─── 4. PATCH /api/users/:id/active — activate / deactivate user ───────────────
router.patch(
  '/:id/active',
  validate(activeUserSchema),
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.id;
    const { is_active } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [targetUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.', errors: [] });
    }

    const existing = rows[0];

    // An admin cannot deactivate their own account
    if (req.user.user_id === targetUserId && is_active === false) {
      return res.status(409).json({
        message: 'An admin cannot deactivate their own account.',
        errors: [],
      });
    }

    // The last active admin can never be deactivated
    if (existing.role === 'admin' && existing.is_active && is_active === false) {
      const activeAdmins = await countActiveAdmins(pool);
      if (activeAdmins <= 1) {
        return res.status(409).json({
          message: 'The last active admin cannot be deactivated.',
          errors: [],
        });
      }
    }

    await pool.query('UPDATE users SET is_active = ? WHERE user_id = ?', [
      is_active ? 1 : 0,
      targetUserId,
    ]);

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'update_user_status',
      entity: 'user',
      entityId: targetUserId,
      details: { is_active },
    });

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`,
      is_active,
    });
  })
);

// ─── 5. DELETE /api/users/:id — delete user ───────────────────────────────────
router.delete(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.id;

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [targetUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.', errors: [] });
    }

    const existing = rows[0];

    // An admin cannot delete their own account
    if (req.user.user_id === targetUserId) {
      return res.status(409).json({
        message: 'An admin cannot delete their own account.',
        errors: [],
      });
    }

    // The last active admin can never be removed
    if (existing.role === 'admin' && existing.is_active) {
      const activeAdmins = await countActiveAdmins(pool);
      if (activeAdmins <= 1) {
        return res.status(409).json({
          message: 'The last active admin can never be removed.',
          errors: [],
        });
      }
    }

    // Hard delete only for users that have no audit_log rows
    const [auditRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM audit_log WHERE user_id = ?',
      [targetUserId]
    );
    if (auditRows[0].total > 0) {
      return res.status(409).json({
        message: 'Cannot delete user with audit history. Please deactivate the user instead.',
        errors: [],
      });
    }

    // Also check if user has a customer record with reservations
    const [custRows] = await pool.query(
      'SELECT customer_id FROM customers WHERE user_id = ?',
      [targetUserId]
    );
    if (custRows.length > 0) {
      const [resRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM reservations WHERE customer_id = ?',
        [custRows[0].customer_id]
      );
      if (resRows[0].total > 0) {
        return res.status(409).json({
          message: 'Cannot delete user with reservation history. Please deactivate the user instead.',
          errors: [],
        });
      }
    }

    await pool.query('DELETE FROM users WHERE user_id = ?', [targetUserId]);

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'delete_user',
      entity: 'user',
      entityId: targetUserId,
      details: { username: existing.username, role: existing.role },
    });

    res.json({ message: 'User deleted successfully.' });
  })
);

module.exports = router;
