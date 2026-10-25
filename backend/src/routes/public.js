// backend/src/routes/public.js
// Public unauthenticated endpoints with 120 req/min rate limiting

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const pool = require('../config/db');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { findAvailableRooms } = require('../services/availability');
const { quote } = require('../services/quote');
const { nightsBetween, isValidDateString } = require('../utils/dates');

const router = express.Router();

// Public rate limiter: 120 requests per minute per IP
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.', errors: [] },
});

router.use(publicLimiter);

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

// ─── Query Schemas ─────────────────────────────────────────────────────────────

const publicRoomsQuerySchema = z.object({
  query: z.object({
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    guests: z.coerce.number().int().min(1).optional(),
    type: z.string().optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional(),
    sort: z.enum(['price_asc', 'price_desc', 'capacity']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

const quoteQuerySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in must be YYYY-MM-DD'),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_out must be YYYY-MM-DD'),
    guests: z.coerce.number().int().min(1).optional(),
  }),
});

// ─── 1. GET /api/public/rooms ─────────────────────────────────────────────────
router.get(
  '/rooms',
  validate(publicRoomsQuerySchema),
  asyncHandler(async (req, res) => {
    const {
      check_in,
      check_out,
      guests,
      type,
      min_price,
      max_price,
      sort,
      page,
      limit,
    } = req.query;

    let rawRooms = [];
    let hasDates = Boolean(check_in && check_out);

    if (hasDates) {
      if (check_out <= check_in) {
        return res.status(400).json({
          message: 'check_out date must be after check_in date.',
          errors: [],
        });
      }

      rawRooms = await findAvailableRooms({
        checkIn: check_in,
        checkOut: check_out,
        guests,
        roomType: type,
        minPrice: min_price,
        maxPrice: max_price,
      });
    } else {
      let query = "SELECT * FROM rooms WHERE status != 'maintenance'";
      const params = [];

      if (guests) {
        query += ' AND capacity >= ?';
        params.push(guests);
      }
      if (type) {
        query += ' AND room_type = ?';
        params.push(type);
      }
      if (min_price !== undefined) {
        query += ' AND price >= ?';
        params.push(min_price);
      }
      if (max_price !== undefined) {
        query += ' AND price <= ?';
        params.push(max_price);
      }

      const [rows] = await pool.query(query, params);
      rawRooms = rows;
    }

    // Fetch review statistics for all rooms in a single query
    const [statsRows] = await pool.query(`
      SELECT
        room_id,
        COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
        COUNT(review_id) AS review_count
      FROM reviews
      WHERE status = 'approved'
      GROUP BY room_id
    `);

    const statsMap = new Map();
    statsRows.forEach((s) => {
      statsMap.set(s.room_id, {
        average_rating: Number(s.average_rating),
        review_count: Number(s.review_count),
      });
    });

    const nights = hasDates ? nightsBetween(check_in, check_out) : 0;

    const items = rawRooms.map((r) => {
      const stats = statsMap.get(r.room_id) || { average_rating: 0, review_count: 0 };
      const pricePerNight = Number(Number(r.price).toFixed(2));
      const imagesArr = parseJsonArray(r.images);
      if (imagesArr.length === 0 && r.image_url) {
        imagesArr.push(r.image_url);
      }

      const item = {
        room_id: r.room_id,
        room_type: r.room_type,
        description: r.description || '',
        capacity: Number(r.capacity),
        bed_type: r.bed_type || 'Queen',
        size_sqm: r.size_sqm ? Number(r.size_sqm) : 25,
        view_label: r.view_label || 'City View',
        amenities: parseJsonArray(r.amenities),
        images: imagesArr,
        price_per_night: pricePerNight,
        average_rating: stats.average_rating,
        review_count: stats.review_count,
      };

      if (hasDates) {
        item.nights = nights;
        item.total = Number((nights * pricePerNight).toFixed(2));
      }

      // NEVER return room_number of a specific room on public endpoints
      return item;
    });

    // Apply sorting
    if (sort === 'price_asc') {
      items.sort((a, b) => a.price_per_night - b.price_per_night);
    } else if (sort === 'price_desc') {
      items.sort((a, b) => b.price_per_night - a.price_per_night);
    } else if (sort === 'capacity') {
      items.sort((a, b) => b.capacity - a.capacity);
    }

    const total = items.length;
    const p = Math.max(1, page || 1);
    const lim = Math.max(1, limit || 50);
    const paginated = items.slice((p - 1) * lim, p * lim);

    res.set('X-Total-Count', String(total));
    res.json(paginated);
  })
);

// ─── 2. GET /api/public/rooms/:id ─────────────────────────────────────────────
router.get(
  '/rooms/:id',
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: 'Invalid room ID.', errors: [] });
    }

    const [roomRows] = await pool.query(
      "SELECT * FROM rooms WHERE room_id = ? AND status != 'maintenance'",
      [roomId]
    );

    if (roomRows.length === 0) {
      return res.status(404).json({ message: 'Room not found.', errors: [] });
    }

    const r = roomRows[0];

    // Fetch review statistics
    const [[stats]] = await pool.query(
      `SELECT
         COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
         COUNT(review_id) AS review_count
       FROM reviews
       WHERE room_id = ? AND status = 'approved'`,
      [roomId]
    );

    // Fetch up to 10 approved reviews
    const [reviewRows] = await pool.query(
      `SELECT r.rating, r.review_text AS text, r.created_at AS date, c.name
       FROM reviews r
       JOIN customers c ON r.customer_id = c.customer_id
       WHERE r.room_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [roomId]
    );

    const reviews = reviewRows.map((rev) => ({
      customer_first_name: rev.name ? rev.name.split(' ')[0] : 'Guest',
      rating: Number(rev.rating),
      text: rev.text || '',
      date: rev.date,
    }));

    const imagesArr = parseJsonArray(r.images);
    if (imagesArr.length === 0 && r.image_url) {
      imagesArr.push(r.image_url);
    }

    res.json({
      room_id: r.room_id,
      room_type: r.room_type,
      description: r.description || '',
      capacity: Number(r.capacity),
      bed_type: r.bed_type || 'Queen',
      size_sqm: r.size_sqm ? Number(r.size_sqm) : 25,
      view_label: r.view_label || 'City View',
      amenities: parseJsonArray(r.amenities),
      images: imagesArr,
      price_per_night: Number(Number(r.price).toFixed(2)),
      average_rating: Number(stats?.average_rating || 0),
      review_count: Number(stats?.review_count || 0),
      reviews,
    });
  })
);

// ─── 3. GET /api/public/rooms/:id/quote ────────────────────────────────────────
router.get(
  '/rooms/:id/quote',
  validate(quoteQuerySchema),
  asyncHandler(async (req, res) => {
    const roomId = Number(req.params.id);
    const { check_in, check_out, guests } = req.query;

    try {
      const quoteData = await quote(roomId, check_in, check_out, pool);

      // Check room maintenance and capacity
      const [roomRows] = await pool.query(
        'SELECT status, capacity FROM rooms WHERE room_id = ?',
        [roomId]
      );

      if (roomRows.length === 0) {
        return res.json({
          available: false,
          reason: 'Room not found.',
          nights: 0,
          nightly_rate: 0,
          total: 0,
        });
      }

      const room = roomRows[0];
      if (room.status === 'maintenance') {
        return res.json({
          available: false,
          reason: 'Room is currently under maintenance.',
          nights: quoteData.nights,
          nightly_rate: quoteData.nightly_rate,
          total: quoteData.total,
        });
      }

      if (guests && Number(room.capacity) < Number(guests)) {
        return res.json({
          available: false,
          reason: `Room capacity (${room.capacity}) is insufficient for ${guests} guests.`,
          nights: quoteData.nights,
          nightly_rate: quoteData.nightly_rate,
          total: quoteData.total,
        });
      }

      // Check overlap query without lock
      const [overlaps] = await pool.query(
        `SELECT reservation_id FROM reservations
         WHERE room_id = ?
           AND status IN ('pending', 'confirmed', 'checked_in')
           AND check_in_date < ?
           AND check_out_date > ?
         LIMIT 1`,
        [roomId, check_out, check_in]
      );

      if (overlaps.length > 0) {
        return res.json({
          available: false,
          reason: 'Room is already booked for the selected dates.',
          nights: quoteData.nights,
          nightly_rate: quoteData.nightly_rate,
          total: quoteData.total,
        });
      }

      return res.json({
        available: true,
        reason: null,
        nights: quoteData.nights,
        nightly_rate: quoteData.nightly_rate,
        total: quoteData.total,
      });
    } catch (err) {
      return res.json({
        available: false,
        reason: err.message,
        nights: 0,
        nightly_rate: 0,
        total: 0,
      });
    }
  })
);

// ─── 4. GET /api/public/room-types ─────────────────────────────────────────────
router.get(
  '/room-types',
  asyncHandler(async (req, res) => {
    const [types] = await pool.query(`
      SELECT
        room_type,
        MIN(price) AS from_price,
        MAX(capacity) AS max_capacity
      FROM rooms
      WHERE status != 'maintenance'
      GROUP BY room_type
      ORDER BY from_price ASC
    `);

    // For each room type, find a representative image
    const result = [];
    for (const t of types) {
      const [sampleRoom] = await pool.query(
        "SELECT images, image_url FROM rooms WHERE room_type = ? AND status != 'maintenance' LIMIT 1",
        [t.room_type]
      );

      let image = null;
      if (sampleRoom.length > 0) {
        const arr = parseJsonArray(sampleRoom[0].images);
        image = arr.length > 0 ? arr[0] : (sampleRoom[0].image_url || null);
      }

      result.push({
        room_type: t.room_type,
        from_price: Number(Number(t.from_price).toFixed(2)),
        max_capacity: Number(t.max_capacity),
        image,
      });
    }

    res.json(result);
  })
);

// ─── 5. GET /api/public/testimonials ──────────────────────────────────────────
router.get(
  '/testimonials',
  asyncHandler(async (req, res) => {
    const [reviews] = await pool.query(`
      SELECT
        r.review_id,
        r.rating,
        r.review_text AS text,
        r.created_at AS date,
        c.name,
        rm.room_type
      FROM reviews r
      JOIN customers c ON r.customer_id = c.customer_id
      LEFT JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.status = 'approved' AND r.rating >= 4
      ORDER BY r.created_at DESC
      LIMIT 6
    `);

    const testimonials = reviews.map((rev) => ({
      review_id: rev.review_id,
      customer_first_name: rev.name ? rev.name.split(' ')[0] : 'Guest',
      rating: Number(rev.rating),
      text: rev.text || '',
      room_type: rev.room_type || 'Room',
      date: rev.date,
    }));

    res.json(testimonials);
  })
);

module.exports = router;
