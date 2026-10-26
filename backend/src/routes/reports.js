// backend/src/routes/reports.js
// Enterprise Reports API (admin only)
// All endpoints protected with verifyToken + requireRole('admin')
// Validated with Zod schemas and backed by backend/src/services/reports.js

const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const reportsService = require('../services/reports');

const router = express.Router();

// All routes require admin role
router.use(verifyToken, requireRole('admin'));

// ─── VALIDATION SCHEMAS ──────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateMessage = "Invalid date format. Expected 'YYYY-MM-DD'";

const commonQuerySchema = z.object({
  query: z
    .object({
      from: z.string().regex(dateRegex, dateMessage).optional(),
      to: z.string().regex(dateRegex, dateMessage).optional(),
      compare: z.enum(['none', 'previous_period', 'previous_year']).default('none'),
      room_type: z.string().optional(),
      source: z.enum(['online', 'reception', 'admin']).optional(),
    })
    .refine(
      (q) => {
        if (q.from && q.to) {
          return q.to >= q.from;
        }
        return true;
      },
      {
        message: "'to' date must be greater than or equal to 'from' date",
        path: ['to'],
      }
    ),
});

const revenueTrendQuerySchema = z.object({
  query: z
    .object({
      from: z.string().regex(dateRegex, dateMessage).optional(),
      to: z.string().regex(dateRegex, dateMessage).optional(),
      compare: z.enum(['none', 'previous_period', 'previous_year']).default('none'),
      room_type: z.string().optional(),
      source: z.enum(['online', 'reception', 'admin']).optional(),
      granularity: z.enum(['day', 'week', 'month']).optional(),
    })
    .refine(
      (q) => {
        if (q.from && q.to) {
          return q.to >= q.from;
        }
        return true;
      },
      {
        message: "'to' date must be greater than or equal to 'from' date",
        path: ['to'],
      }
    ),
});

const operationsQuerySchema = z.object({
  query: z.object({
    room_type: z.string().optional(),
    source: z.enum(['online', 'reception', 'admin']).optional(),
  }),
});

const reservationsDrilldownQuerySchema = z.object({
  query: z
    .object({
      from: z.string().regex(dateRegex, dateMessage).optional(),
      to: z.string().regex(dateRegex, dateMessage).optional(),
      status: z
        .enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
        .optional(),
      payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
      source: z.enum(['online', 'reception', 'admin']).optional(),
      room_type: z.string().optional(),
      q: z.string().optional(),
      sort: z.string().optional(),
      sort_dir: z.enum(['asc', 'desc']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .refine(
      (q) => {
        if (q.from && q.to) {
          return q.to >= q.from;
        }
        return true;
      },
      {
        message: "'to' date must be greater than or equal to 'from' date",
        path: ['to'],
      }
    ),
});

// ─── 1. GET /api/reports/overview ─────────────────────────────────────────────
router.get(
  '/overview',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getOverview(pool, req.query);
    res.json(result);
  })
);

// ─── 2. GET /api/reports/revenue-trend ────────────────────────────────────────
router.get(
  '/revenue-trend',
  validate(revenueTrendQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getRevenueTrend(pool, req.query);
    res.json(result);
  })
);

// ─── 3. GET /api/reports/occupancy-trend ──────────────────────────────────────
router.get(
  '/occupancy-trend',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getOccupancyTrend(pool, req.query);
    res.json(result);
  })
);

// ─── 4. GET /api/reports/reservations-summary ─────────────────────────────────
router.get(
  '/reservations-summary',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getReservationsSummary(pool, req.query);
    res.json(result);
  })
);

// ─── 5. GET /api/reports/room-performance ─────────────────────────────────────
router.get(
  '/room-performance',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getRoomPerformance(pool, req.query);
    res.json(result);
  })
);

// ─── 6. GET /api/reports/customers ───────────────────────────────────────────
router.get(
  '/customers',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getCustomersReport(pool, req.query);
    res.json(result);
  })
);

// ─── 7. GET /api/reports/payments ────────────────────────────────────────────
router.get(
  '/payments',
  validate(commonQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getPaymentsReport(pool, req.query);
    res.json(result);
  })
);

// ─── 8. GET /api/reports/operations ──────────────────────────────────────────
router.get(
  '/operations',
  validate(operationsQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getOperationsReport(pool, req.query);
    res.json(result);
  })
);

// ─── 9. GET /api/reports/reservations ─────────────────────────────────────────
router.get(
  '/reservations',
  validate(reservationsDrilldownQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await reportsService.getReservationsDrilldown(pool, req.query);
    res.json(result);
  })
);

// ─── 10. GET /api/reports/definitions ─────────────────────────────────────────
router.get('/definitions', (req, res) => {
  const definitions = reportsService.getDefinitions();
  res.json({
    range: null,
    compare_range: null,
    filters: null,
    generated_at: new Date().toISOString(),
    data: definitions,
    definitions,
    previous: null,
  });
});

module.exports = router;
