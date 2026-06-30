const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Customer Profile Route (Customer only)
router.put('/profile', verifyToken, requireRole('customer'), async (req, res) => {
    const { name, phone, password } = req.body;
    try {
        const [customer] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [req.user.user_id]);
        if (customer.length === 0) return res.status(404).json({ message: 'Customer not found.' });

        await pool.query(
            'UPDATE customers SET name = ?, phone = ? WHERE user_id = ?',
            [name || customer[0].name, phone !== undefined ? phone : customer[0].phone, req.user.user_id]
        );

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.user_id]);
        }

        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Customer Management Routes (Receptionist/Admin) ---
// We can use a middleware that checks if role is 'admin' or 'reception'
const requireStaff = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'reception') return next();
    return res.status(403).json({ message: 'Access denied. Staff only.' });
};

// GET /api/customers
router.get('/', verifyToken, requireStaff, async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM customers';
        let params = [];
        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/customers
router.post('/', verifyToken, requireStaff, async (req, res) => {
    const { name, email, phone } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });

    try {
        const [existingEmail] = await pool.query('SELECT customer_id FROM customers WHERE email = ?', [email]);
        if (existingEmail.length > 0) return res.status(409).json({ message: 'Email already registered.' });

        // We can create a customer without a user_id if receptionist adds them (guest check-in)
        // or we could generate a default user for them. Let's just create a customer record with user_id = null
        const [result] = await pool.query(
            'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
            [name, email, phone || null]
        );
        res.status(201).json({ customer_id: result.insertId, name, email, phone });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/customers/:id
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const [existing] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ message: 'Customer not found.' });

        await pool.query(
            'UPDATE customers SET name = ?, email = ?, phone = ? WHERE customer_id = ?',
            [name || existing[0].name, email || existing[0].email, phone !== undefined ? phone : existing[0].phone, req.params.id]
        );
        res.json({ message: 'Customer updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/customers/:id
router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    try {
        const [existing] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ message: 'Customer not found.' });

        await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
