// backend/src/routes/reservations.js
// Reservation routes for customer portal and staff (reception & admin)

const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const reservationsService = require('../services/reservations');

const router = express.Router();

// Helper to ensure customer_id is resolved for customer tokens
async function getAuthenticatedCustomerId(req) {
  if (req.user.customer_id) return req.user.customer_id;
  if (req.user.user_id) {
    const [rows] = await pool.query(
      'SELECT customer_id FROM customers WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length > 0) {
      req.user.customer_id = rows[0].customer_id;
      return rows[0].customer_id;
    }
  }
  return null;
}

// ─── Validation Schemas ────────────────────────────────────────────────────────

const customerCreateSchema = z.object({
  body: z.object({
    room_id: z.coerce.number().int().positive('room_id is required'),
    check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in_date must be YYYY-MM-DD'),
    check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_out_date must be YYYY-MM-DD'),
    guests: z.coerce.number().int().min(1).default(1),
    remark: z.string().max(500).optional().nullable(),
  }),
});

const staffCreateSchema = z.object({
  body: z.object({
    customer_id: z.coerce.number().int().positive().optional().nullable(),
    customer: z.object({
      name: z.string().min(1, 'Customer name is required'),
      email: z.string().email('Valid customer email is required'),
      phone: z.string().optional().nullable(),
    }).optional().nullable(),
    room_id: z.coerce.number().int().positive('room_id is required'),
    check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in_date must be YYYY-MM-DD'),
    check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_out_date must be YYYY-MM-DD'),
    guests: z.coerce.number().int().min(1).default(1),
    remark: z.string().max(500).optional().nullable(),
  }).refine((data) => data.customer_id || data.customer, {
    message: 'Either customer_id or customer { name, email, phone } is required',
    path: ['customer_id'],
  }),
});

const refParamSchema = z.object({
  params: z.object({
    ref: z.string().min(1, 'booking_ref is required'),
  }),
});

const staffListQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']).optional(),
    source: z.string().optional(),
    payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
    room_id: z.coerce.number().int().positive().optional(),
    room_type: z.string().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const cancelSchema = z.object({
  params: z.object({
    ref: z.string().min(1, 'booking_ref is required'),
  }),
  body: z.object({
    reason: z.string().max(500).optional().nullable(),
  }).optional(),
});

// Helper for sending service error responses
function handleServiceError(err, res, next) {
  if (err.status) {
    const payload = {
      message: err.message,
      errors: [],
    };
    if (err.balance !== undefined) {
      payload.balance = err.balance;
    }
    return res.status(err.status).json(payload);
  }
  next(err);
}

// ─── 1. POST /api/reservations (customer only) ───────────────────────────────
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  validate(customerCreateSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const customerId = await getAuthenticatedCustomerId(req);
      if (!customerId) {
        return res.status(403).json({ message: 'Customer account not found.', errors: [] });
      }

      const { room_id, check_in_date, check_out_date, guests, remark } = req.body;

      const created = await reservationsService.create({
        customerId,
        roomId: room_id,
        checkInDate: check_in_date,
        checkOutDate: check_out_date,
        guests,
        remark,
        bookingSource: 'online',
        status: 'pending',
        paymentStatus: 'unpaid',
        userId: req.user.user_id,
      });

      return res.status(201).json(created);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 2. POST /api/reservations/staff (admin, reception) ──────────────────────
router.post(
  '/staff',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(staffCreateSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const { customer_id, customer, room_id, check_in_date, check_out_date, guests, remark } = req.body;
      const bookingSource = req.user.role === 'admin' ? 'admin' : 'reception';

      const created = await reservationsService.create({
        customerId: customer_id,
        customer,
        roomId: room_id,
        checkInDate: check_in_date,
        checkOutDate: check_out_date,
        guests,
        remark,
        bookingSource,
        status: 'confirmed',
        paymentStatus: 'unpaid',
        userId: req.user.user_id,
      });

      return res.status(201).json(created);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 3. GET /api/reservations/my (customer only) ─────────────────────────────
router.get(
  '/my',
  verifyToken,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    const customerId = await getAuthenticatedCustomerId(req);
    if (!customerId) {
      return res.status(403).json({ message: 'Customer account not found.', errors: [] });
    }

    const data = await reservationsService.listCustomerReservations(customerId);
    res.json(data);
  })
);

// ─── 4. GET /api/reservations/my/:ref (customer only) ────────────────────────
router.get(
  '/my/:ref',
  verifyToken,
  requireRole('customer'),
  validate(refParamSchema),
  asyncHandler(async (req, res) => {
    const customerId = await getAuthenticatedCustomerId(req);
    if (!customerId) {
      return res.status(403).json({ message: 'Customer account not found.', errors: [] });
    }

    const reservation = await reservationsService.getCustomerReservation(
      req.params.ref,
      customerId
    );

    // Rule: A reference that belongs to someone else returns 404, not 403.
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.', errors: [] });
    }

    res.json(reservation);
  })
);

// ─── 5. GET /api/reservations (admin, reception) ─────────────────────────────
router.get(
  '/',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(staffListQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reservationsService.listStaffReservations(req.query);
    res.json(result);
  })
);

// ─── 6. GET /api/reservations/:ref (staff) ───────────────────────────────────
router.get(
  '/:ref',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(refParamSchema),
  asyncHandler(async (req, res) => {
    const reservation = await reservationsService.getStaffDetail(req.params.ref);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.', errors: [] });
    }
    res.json(reservation);
  })
);

// ─── 7. PATCH /api/reservations/:ref/confirm (staff) ─────────────────────────
router.patch(
  '/:ref/confirm',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(refParamSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const updated = await reservationsService.confirm({
        bookingRef: req.params.ref,
        userId: req.user.user_id,
      });
      res.json(updated);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 8. PATCH /api/reservations/:ref/cancel (customer or staff) ──────────────
router.patch(
  '/:ref/cancel',
  verifyToken,
  validate(cancelSchema),
  asyncHandler(async (req, res, next) => {
    try {
      let customerId = null;
      if (req.user.role === 'customer') {
        customerId = await getAuthenticatedCustomerId(req);
        if (!customerId) {
          return res.status(403).json({ message: 'Customer account not found.', errors: [] });
        }
      }

      const updated = await reservationsService.cancel({
        bookingRef: req.params.ref,
        userId: req.user.user_id,
        userRole: req.user.role,
        customerId,
      });

      res.json(updated);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 9. PATCH /api/reservations/:ref/no-show (staff) ─────────────────────────
router.patch(
  '/:ref/no-show',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(refParamSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const updated = await reservationsService.markNoShow({
        bookingRef: req.params.ref,
        userId: req.user.user_id,
      });
      res.json(updated);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 10. PATCH /api/reservations/:ref/check-in (staff) ────────────────────────
router.patch(
  '/:ref/check-in',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(refParamSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const updated = await reservationsService.checkIn({
        bookingRef: req.params.ref,
        userId: req.user.user_id,
      });
      res.json(updated);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

// ─── 11. PATCH /api/reservations/:ref/check-out (staff) ───────────────────────
router.patch(
  '/:ref/check-out',
  verifyToken,
  requireRole('admin', 'reception'),
  validate(refParamSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const updated = await reservationsService.checkOut({
        bookingRef: req.params.ref,
        userId: req.user.user_id,
      });
      res.json(updated);
    } catch (err) {
      handleServiceError(err, res, next);
    }
  })
);

module.exports = router;
