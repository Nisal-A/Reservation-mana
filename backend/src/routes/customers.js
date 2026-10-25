// backend/src/routes/customers.js
// Customer routes: profile, history, and staff management

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const phoneRegex = /^[0-9+() -]{7,20}$/;

// ─── Validation Schemas ────────────────────────────────────────────────────────

const listCustomersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: z.string().trim().email('Valid email is required'),
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional().nullable(),
  }),
});

const updateCustomerSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid customer ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email('Valid email is required').optional(),
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional().nullable(),
  }),
});

const customerProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional().nullable(),
    password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, 'Password must be at least 8 characters long and contain both letters and numbers').optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid customer ID is required'),
  }),
});

// ─── 1. GET /api/customers/me — logged-in customer's profile ───────────────────
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req, res) => {
    let customer = null;

    if (req.user.customer_id) {
      const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.user.customer_id]);
      if (rows.length > 0) customer = rows[0];
    }

    if (!customer && req.user.user_id) {
      const [rows] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [req.user.user_id]);
      if (rows.length > 0) customer = rows[0];
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer record not found.', errors: [] });
    }

    res.json(customer);
  })
);

// ─── 2. PUT /api/customers/profile — customer profile update ───────────────────
router.put(
  '/profile',
  verifyToken,
  requireRole('customer'),
  validate(customerProfileSchema),
  asyncHandler(async (req, res) => {
    const { name, phone, password } = req.body;

    const [rows] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [req.user.user_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.', errors: [] });
    }

    const current = rows[0];

    await pool.query(
      'UPDATE customers SET name = ?, phone = ? WHERE user_id = ?',
      [name || current.name, phone !== undefined ? phone : current.phone, req.user.user_id]
    );

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.user_id]);
    }

    res.json({ message: 'Profile updated successfully.' });
  })
);

// ─── 3. GET /api/customers/:id/history — reservation history ───────────────────
router.get(
  '/:id/history',
  verifyToken,
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;

    // Customers may only read their own reservations
    if (req.user.role === 'customer') {
      let isOwner = req.user.customer_id === customerId;
      if (!isOwner) {
        const [ownerRows] = await pool.query('SELECT customer_id FROM customers WHERE user_id = ?', [req.user.user_id]);
        if (ownerRows.length > 0 && ownerRows[0].customer_id === customerId) {
          isOwner = true;
        }
      }
      if (!isOwner) {
        return res.status(403).json({ message: 'Access denied. You may only view your own history.', errors: [] });
      }
    }

    const [rows] = await pool.query(
      `SELECT r.reservation_id, r.booking_ref, r.room_id,
              DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
              DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
              r.total_amount, r.status, r.payment_status, r.payment_method, r.remark, r.created_at,
              rm.room_number, rm.room_type, rm.price AS nightly_rate
       FROM reservations r
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.customer_id = ?
       ORDER BY r.check_in_date DESC, r.created_at DESC`,
      [customerId]
    );

    const formatted = rows.map((r) => ({
      ...r,
      total_amount: Number(Number(r.total_amount).toFixed(2)),
      nightly_rate: Number(Number(r.nightly_rate).toFixed(2)),
    }));

    res.json(formatted);
  })
);

// ─── 4. GET /api/customers — staff list customers with search & pagination ─────
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(listCustomersSchema),
  asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query;

    let query = 'SELECT c.*, u.username, u.is_active FROM customers c LEFT JOIN users u ON c.user_id = u.user_id WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    query += ' ORDER BY c.created_at DESC';

    const p = Math.max(1, page || 1);
    const lim = Math.max(1, limit || 50);
    const offset = (p - 1) * lim;
    query += ' LIMIT ? OFFSET ?';
    params.push(lim, offset);

    const [rows] = await pool.query(query, params);
    res.json(rows);
  })
);

// ─── 5. POST /api/customers — staff create customer ────────────────────────────
router.post(
  '/',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone } = req.body;

    const [existing] = await pool.query('SELECT customer_id FROM customers WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered.', errors: [] });
    }

    const [result] = await pool.query(
      'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
      [name, email, phone || null]
    );

    res.status(201).json({
      customer_id: result.insertId,
      name,
      email,
      phone: phone || null,
      message: 'Customer created successfully.',
    });
  })
);

// ─── 6. PUT /api/customers/:id — staff update customer ─────────────────────────
router.put(
  '/:id',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const { name, email, phone } = req.body;

    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.', errors: [] });
    }

    const current = rows[0];

    if (email && email !== current.email) {
      const [dup] = await pool.query(
        'SELECT customer_id FROM customers WHERE email = ? AND customer_id != ?',
        [email, customerId]
      );
      if (dup.length > 0) {
        return res.status(409).json({ message: 'Email already registered.', errors: [] });
      }
    }

    await pool.query(
      'UPDATE customers SET name = ?, email = ?, phone = ? WHERE customer_id = ?',
      [
        name || current.name,
        email || current.email,
        phone !== undefined ? phone : current.phone,
        customerId,
      ]
    );

    res.json({ message: 'Customer updated successfully.' });
  })
);

// ─── 7. DELETE /api/customers/:id — admin delete customer ──────────────────────
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;

    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.', errors: [] });
    }

    const customer = rows[0];

    // Refused with 409 when the customer has any reservations
    const [resRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM reservations WHERE customer_id = ?',
      [customerId]
    );

    if (resRows[0].total > 0) {
      return res.status(409).json({
        message: 'Cannot delete customer with reservation history.',
        errors: [],
      });
    }

    await pool.query('DELETE FROM customers WHERE customer_id = ?', [customerId]);

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'delete_customer',
      entity: 'customer',
      entityId: customerId,
      details: { name: customer.name, email: customer.email },
    });

    res.json({ message: 'Customer deleted successfully.' });
  })
);

module.exports = router;
