// backend/src/routes/rooms.js
// Staff room management routes (admin and reception)

const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { logAudit } = require('../utils/audit');
const { today } = require('../utils/dates');

const router = express.Router();

// All room routes require staff authentication (admin or reception)
router.use(verifyToken);
router.use(requireRole('admin', 'reception'));

function parseJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    if (val.trim()) return [val.trim()];
  }
  return [];
}

// ─── Validation Schemas ────────────────────────────────────────────────────────

const roomQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    type: z.string().optional(),
    status: z.enum(['available', 'occupied', 'maintenance']).optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid room ID is required'),
  }),
});

const roomCreateSchema = z.object({
  body: z.object({
    room_number: z.string().trim().min(1, 'room_number is required').max(10, 'room_number max 10 characters'),
    room_type: z.string().trim().min(1, 'room_type is required').max(50, 'room_type max 50 characters'),
    price: z.coerce.number().positive('price must be greater than 0'),
    capacity: z.coerce.number().int().min(1, 'capacity must be at least 1').max(10, 'capacity max 10'),
    status: z.enum(['available', 'occupied', 'maintenance']).default('available'),
    description: z.string().optional().nullable(),
    bed_type: z.string().max(50).optional().nullable(),
    size_sqm: z.coerce.number().int().min(1).optional().nullable(),
    view_label: z.string().max(50).optional().nullable(),
    amenities: z.array(z.string()).default([]),
    images: z.array(z.string().regex(/^\/uploads\//, "Images must be '/uploads/...' paths")).max(8, 'Maximum 8 images').default([]),
  }),
});

const roomUpdateSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Valid room ID is required'),
  }),
  body: z.object({
    room_number: z.string().trim().min(1).max(10).optional(),
    room_type: z.string().trim().min(1).max(50).optional(),
    price: z.coerce.number().positive().optional(),
    capacity: z.coerce.number().int().min(1).max(10).optional(),
    status: z.enum(['available', 'occupied', 'maintenance']).optional(),
    description: z.string().optional().nullable(),
    bed_type: z.string().max(50).optional().nullable(),
    size_sqm: z.coerce.number().int().min(1).optional().nullable(),
    view_label: z.string().max(50).optional().nullable(),
    amenities: z.array(z.string()).optional(),
    images: z.array(z.string().regex(/^\/uploads\//, "Images must be '/uploads/...' paths")).max(8).optional(),
  }),
});

// ─── 1. GET /api/rooms — list rooms (admin, reception) ────────────────────────
router.get(
  '/',
  validate(roomQuerySchema),
  asyncHandler(async (req, res) => {
    const { search, type, status, min_price, max_price, page, limit } = req.query;

    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (room_number LIKE ? OR room_type LIKE ? OR description LIKE ?)';
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    if (type) {
      query += ' AND room_type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (min_price !== undefined) {
      query += ' AND price >= ?';
      params.push(min_price);
    }

    if (max_price !== undefined) {
      query += ' AND price <= ?';
      params.push(max_price);
    }

    query += ' ORDER BY room_number ASC';

    if (limit) {
      const lim = Math.max(1, limit);
      const p = Math.max(1, page || 1);
      const offset = (p - 1) * lim;
      query += ' LIMIT ? OFFSET ?';
      params.push(lim, offset);
    }

    const [rows] = await pool.query(query, params);

    const formatted = rows.map((r) => ({
      ...r,
      price: Number(Number(r.price).toFixed(2)),
      capacity: Number(r.capacity),
      amenities: parseJsonArray(r.amenities),
      images: parseJsonArray(r.images),
    }));

    res.json(formatted);
  })
);

// ─── 2. GET /api/rooms/:id — room details (admin, reception) ──────────────────
router.get(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.', errors: [] });
    }

    const r = rows[0];
    res.json({
      ...r,
      price: Number(Number(r.price).toFixed(2)),
      capacity: Number(r.capacity),
      amenities: parseJsonArray(r.amenities),
      images: parseJsonArray(r.images),
    });
  })
);

// ─── 3. POST /api/rooms — create room (admin only) ────────────────────────────
router.post(
  '/',
  requireRole('admin'),
  validate(roomCreateSchema),
  asyncHandler(async (req, res) => {
    const {
      room_number,
      room_type,
      price,
      capacity,
      status,
      description,
      bed_type,
      size_sqm,
      view_label,
      amenities,
      images,
    } = req.body;

    // Setting status to 'occupied' manually is refused; only check-in does that
    if (status === 'occupied') {
      return res.status(400).json({
        message: "Setting status to 'occupied' manually is refused; only guest check-in can set room status to occupied.",
        errors: [],
      });
    }

    // Check duplicate room number
    const [existing] = await pool.query('SELECT room_id FROM rooms WHERE room_number = ?', [room_number]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Room number already exists.', errors: [] });
    }

    const [result] = await pool.query(
      `INSERT INTO rooms (
        room_number, room_type, price, capacity, status,
        description, bed_type, size_sqm, view_label,
        amenities, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room_number,
        room_type,
        price,
        capacity,
        status || 'available',
        description || null,
        bed_type || 'Queen',
        size_sqm || 25,
        view_label || 'City View',
        JSON.stringify(amenities || []),
        JSON.stringify(images || []),
      ]
    );

    const roomId = result.insertId;

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'create_room',
      entity: 'room',
      entityId: roomId,
      details: { room_number, room_type, price, capacity, status },
    });

    const [created] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    const r = created[0];

    res.status(201).json({
      message: 'Room created successfully.',
      room: {
        ...r,
        price: Number(Number(r.price).toFixed(2)),
        capacity: Number(r.capacity),
        amenities: parseJsonArray(r.amenities),
        images: parseJsonArray(r.images),
      },
    });
  })
);

// ─── 4. PUT /api/rooms/:id — update room (admin only) ─────────────────────────
router.put(
  '/:id',
  requireRole('admin'),
  validate(roomUpdateSchema),
  asyncHandler(async (req, res) => {
    const roomId = req.params.id;
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.', errors: [] });
    }

    const existing = rows[0];
    const {
      room_number,
      room_type,
      price,
      capacity,
      status,
      description,
      bed_type,
      size_sqm,
      view_label,
      amenities,
      images,
    } = req.body;

    // Check status transition rules
    if (status !== undefined) {
      // Rule 1: Setting status to 'occupied' manually is refused; only check-in does that.
      if (status === 'occupied') {
        return res.status(400).json({
          message: "Setting status to 'occupied' manually is refused; only check-in does that.",
          errors: [],
        });
      }

      // Rule 2: Setting 'available' while a checked_in stay exists is refused.
      if (status === 'available') {
        const [activeCheckedIn] = await pool.query(
          "SELECT booking_ref FROM reservations WHERE room_id = ? AND status = 'checked_in'",
          [roomId]
        );
        if (activeCheckedIn.length > 0) {
          return res.status(409).json({
            message: "Setting status to 'available' while a checked_in stay exists is refused.",
            errors: [],
          });
        }
      }

      // Rule 3: Setting status to 'maintenance' is refused with 409 and a list of conflicting booking_refs
      // when the room has a checked_in stay or any pending or confirmed reservation whose check_out_date is after today().
      if (status === 'maintenance') {
        const todayStr = today();
        const [conflicts] = await pool.query(
          `SELECT booking_ref
           FROM reservations
           WHERE room_id = ?
             AND (
               status = 'checked_in'
               OR (status IN ('pending', 'confirmed') AND check_out_date > ?)
             )`,
          [roomId, todayStr]
        );

        if (conflicts.length > 0) {
          const conflictingRefs = conflicts.map((c) => c.booking_ref);
          return res.status(409).json({
            message: "Setting status to 'maintenance' is refused due to active or upcoming reservations.",
            conflicting_reservations: conflictingRefs,
            errors: [],
          });
        }
      }
    }

    // Check duplicate room_number if updated
    if (room_number && room_number !== existing.room_number) {
      const [dup] = await pool.query(
        'SELECT room_id FROM rooms WHERE room_number = ? AND room_id != ?',
        [room_number, roomId]
      );
      if (dup.length > 0) {
        return res.status(409).json({ message: 'Room number already exists.', errors: [] });
      }
    }

    const priceChanged = price !== undefined && Number(price) !== Number(existing.price);

    await pool.query(
      `UPDATE rooms SET
        room_number = COALESCE(?, room_number),
        room_type   = COALESCE(?, room_type),
        price       = COALESCE(?, price),
        capacity    = COALESCE(?, capacity),
        status      = COALESCE(?, status),
        description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END,
        bed_type    = COALESCE(?, bed_type),
        size_sqm    = COALESCE(?, size_sqm),
        view_label  = COALESCE(?, view_label),
        amenities   = CASE WHEN ? IS NOT NULL THEN ? ELSE amenities END,
        images      = CASE WHEN ? IS NOT NULL THEN ? ELSE images END
       WHERE room_id = ?`,
      [
        room_number || null,
        room_type || null,
        price || null,
        capacity || null,
        status || null,
        description !== undefined ? description : null,
        description !== undefined ? description : null,
        bed_type || null,
        size_sqm || null,
        view_label || null,
        amenities !== undefined ? JSON.stringify(amenities) : null,
        amenities !== undefined ? JSON.stringify(amenities) : null,
        images !== undefined ? JSON.stringify(images) : null,
        images !== undefined ? JSON.stringify(images) : null,
        roomId,
      ]
    );

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'update_room',
      entity: 'room',
      entityId: roomId,
      details: { updates: req.body, previous_price: existing.price, new_price: price },
    });

    const [updatedRows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    const updated = updatedRows[0];

    let message = 'Room updated successfully.';
    if (priceChanged) {
      message += ' Changing price never changes existing reservations because they store nightly_rate.';
    }

    res.json({
      message,
      room: {
        ...updated,
        price: Number(Number(updated.price).toFixed(2)),
        capacity: Number(updated.capacity),
        amenities: parseJsonArray(updated.amenities),
        images: parseJsonArray(updated.images),
      },
    });
  })
);

// ─── 5. DELETE /api/rooms/:id — delete room (admin only) ──────────────────────
router.delete(
  '/:id',
  requireRole('admin'),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const roomId = req.params.id;
    const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.', errors: [] });
    }

    const room = rows[0];

    // Deleting a room with any reservation history returns 409 and suggests maintenance instead
    const [resHistory] = await pool.query(
      'SELECT COUNT(*) AS total FROM reservations WHERE room_id = ?',
      [roomId]
    );

    if (resHistory[0].total > 0) {
      return res.status(409).json({
        message: 'Cannot delete room with reservation history. Please set room status to maintenance instead.',
        errors: [],
      });
    }

    await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);

    await logAudit(pool, {
      userId: req.user.user_id,
      action: 'delete_room',
      entity: 'room',
      entityId: roomId,
      details: { room_number: room.room_number, room_type: room.room_type },
    });

    res.json({ message: 'Room deleted successfully.' });
  })
);

module.exports = router;
