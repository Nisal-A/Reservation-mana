/**
 * pricing.js — Dynamic Pricing Engine API
 * Manages pricing rules and calculates price breakdowns for reservations.
 */
const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAX_RATE = 0.10; // 10% tax

/**
 * Calculate number of nights between two dates.
 */
function calcNights(checkIn, checkOut) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay);
}

/**
 * Determine if a date (YYYY-MM-DD) falls on a weekend.
 */
function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

/**
 * Calculate the full price breakdown for a given room and date range.
 * Returns { base_amount, surcharge_amount, discount_amount, tax_amount, total_amount, breakdown }
 */
async function calculatePrice(roomId, checkIn, checkOut) {
  // Get room details
  const [roomRows] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
  if (roomRows.length === 0) throw new Error('Room not found');
  const room = roomRows[0];
  const nights = calcNights(checkIn, checkOut);
  if (nights <= 0) throw new Error('Invalid date range');

  const baseAmount = parseFloat(room.price) * nights;

  // Get active pricing rules
  const [rules] = await pool.query(
    "SELECT * FROM pricing_rules WHERE is_active = 1"
  );

  let totalSurchargePercent = 0;
  let totalDiscountPercent  = 0;
  const appliedRules = [];

  for (const rule of rules) {
    let applies = false;

    if (rule.rule_type === 'weekend') {
      // Count weekend nights
      let weekendNights = 0;
      const current = new Date(checkIn);
      while (current < new Date(checkOut)) {
        if (isWeekend(current.toISOString().split('T')[0])) weekendNights++;
        current.setDate(current.getDate() + 1);
      }
      if (weekendNights > 0) {
        applies = true;
        const effectiveRate = (rule.value * weekendNights) / nights;
        if (rule.value > 0) totalSurchargePercent += effectiveRate;
        else totalDiscountPercent += Math.abs(effectiveRate);
        appliedRules.push({ name: rule.rule_name, type: 'surcharge', percent: effectiveRate.toFixed(1) });
        continue;
      }
    }

    if (rule.rule_type === 'peak_season' || rule.rule_type === 'off_season') {
      if (rule.start_date && rule.end_date) {
        const cin = new Date(checkIn);
        const sd  = new Date(rule.start_date);
        const ed  = new Date(rule.end_date);
        if (cin >= sd && cin <= ed) applies = true;
      }
    }

    if (rule.rule_type === 'holiday') {
      if (rule.start_date && rule.end_date) {
        const cin = new Date(checkIn);
        if (cin >= new Date(rule.start_date) && cin <= new Date(rule.end_date)) applies = true;
      }
    }

    if (rule.rule_type === 'room_type_multiplier') {
      if (rule.applies_to === room.room_type) applies = true;
    }

    if (applies) {
      if (parseFloat(rule.value) > 0) {
        totalSurchargePercent += parseFloat(rule.value);
        appliedRules.push({ name: rule.rule_name, type: 'surcharge', percent: rule.value });
      } else {
        totalDiscountPercent += Math.abs(parseFloat(rule.value));
        appliedRules.push({ name: rule.rule_name, type: 'discount', percent: Math.abs(rule.value) });
      }
    }
  }

  const surchargeAmount = parseFloat(((baseAmount * totalSurchargePercent) / 100).toFixed(2));
  const discountAmount  = parseFloat(((baseAmount * totalDiscountPercent)  / 100).toFixed(2));
  const subtotal        = baseAmount + surchargeAmount - discountAmount;
  const taxAmount       = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const totalAmount     = parseFloat((subtotal + taxAmount).toFixed(2));

  return {
    nights,
    base_price_per_night: parseFloat(room.price),
    base_amount:      parseFloat(baseAmount.toFixed(2)),
    surcharge_amount: surchargeAmount,
    discount_amount:  discountAmount,
    tax_amount:       taxAmount,
    total_amount:     totalAmount,
    applied_rules:    appliedRules,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/pricing/rules — Admin only
router.get('/rules', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pricing_rules ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/pricing/rules
router.post('/rules', verifyToken, requireRole('admin'), async (req, res) => {
  const { rule_name, rule_type, value, applies_to, start_date, end_date } = req.body;
  if (!rule_name || !rule_type || value === undefined) {
    return res.status(400).json({ message: 'rule_name, rule_type, and value are required.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO pricing_rules (rule_name, rule_type, value, applies_to, start_date, end_date) VALUES (?,?,?,?,?,?)',
      [rule_name, rule_type, value, applies_to || null, start_date || null, end_date || null]
    );
    const [newRule] = await pool.query('SELECT * FROM pricing_rules WHERE rule_id = ?', [result.insertId]);
    res.status(201).json(newRule[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/pricing/rules/:id
router.put('/rules/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { rule_name, rule_type, value, applies_to, start_date, end_date, is_active } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM pricing_rules WHERE rule_id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Rule not found.' });

    await pool.query(
      'UPDATE pricing_rules SET rule_name=?, rule_type=?, value=?, applies_to=?, start_date=?, end_date=?, is_active=? WHERE rule_id=?',
      [
        rule_name  ?? existing[0].rule_name,
        rule_type  ?? existing[0].rule_type,
        value      ?? existing[0].value,
        applies_to ?? existing[0].applies_to,
        start_date ?? existing[0].start_date,
        end_date   ?? existing[0].end_date,
        is_active  ?? existing[0].is_active,
        req.params.id,
      ]
    );
    const [updated] = await pool.query('SELECT * FROM pricing_rules WHERE rule_id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/pricing/rules/:id
router.delete('/rules/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pricing_rules WHERE rule_id = ?', [req.params.id]);
    res.json({ message: 'Rule deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/pricing/calculate — Any authenticated user
router.post('/calculate', verifyToken, async (req, res) => {
  const { room_id, check_in_date, check_out_date } = req.body;
  if (!room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ message: 'room_id, check_in_date, check_out_date required.' });
  }
  try {
    const breakdown = await calculatePrice(room_id, check_in_date, check_out_date);
    res.json(breakdown);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = { router, calculatePrice };
