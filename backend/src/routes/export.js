/**
 * export.js — Report Export API
 * Generates PDF, Excel, and CSV reports.
 */
const express  = require('express');
const pool     = require('../config/db');
const XLSX     = require('xlsx');
const PDFDoc   = require('pdfkit');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireRole('admin', 'reception'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

function toExcel(headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function writePDF(res, title, headers, rows) {
  const doc = new PDFDoc({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s/g,'_')}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).fillColor('#d4a843').text('🏨 LuxeStay Hotel', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).fillColor('#333').text(title, { align: 'center' });
  doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  // Table header
  const colWidth = (doc.page.width - 80) / headers.length;
  let x = 40;
  doc.fontSize(9).fillColor('#fff');
  doc.rect(40, doc.y, doc.page.width - 80, 20).fill('#1a2235');
  headers.forEach(h => {
    doc.fillColor('#d4a843').text(h, x + 4, doc.y - 14, { width: colWidth - 8 });
    x += colWidth;
  });
  doc.moveDown(0.5);

  // Table rows
  rows.forEach((row, i) => {
    x = 40;
    const y = doc.y;
    if (i % 2 === 0) doc.rect(40, y, doc.page.width - 80, 18).fill('#f8f9fc');
    doc.fillColor('#333');
    row.forEach(cell => {
      doc.fontSize(8).text(String(cell ?? ''), x + 4, y + 4, { width: colWidth - 8, ellipsis: true });
      x += colWidth;
    });
    doc.y = y + 18;
    if (doc.y > doc.page.height - 60) doc.addPage();
  });

  doc.end();
}

// ─── Reservations Export ─────────────────────────────────────────────────────
router.get('/reservations', async (req, res) => {
  try {
    const { format = 'csv', from, to } = req.query;
    let query = `
      SELECT r.reservation_id, c.name AS guest, rm.room_number, rm.room_type,
             r.check_in_date, r.check_out_date, r.status,
             r.total_amount, r.payment_method, r.created_at
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE 1=1
    `;
    const params = [];
    if (from) { query += ' AND r.check_in_date >= ?'; params.push(from); }
    if (to)   { query += ' AND r.check_in_date <= ?'; params.push(to);   }
    query += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(query, params);
    const headers = ['ID','Guest','Room','Type','Check-In','Check-Out','Status','Amount','Payment','Created'];
    const data = rows.map(r => [r.reservation_id, r.guest, r.room_number, r.room_type, r.check_in_date, r.check_out_date, r.status, r.total_amount, r.payment_method, r.created_at]);

    if (format === 'pdf') { writePDF(res, 'Reservations Report', headers, data); return; }
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="reservations.xlsx"');
      return res.send(toExcel(headers, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reservations.csv"');
    res.send(toCSV(headers, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Revenue Export ──────────────────────────────────────────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const { format = 'csv', month, year } = req.query;
    let query = `
      SELECT DATE_FORMAT(r.check_out_date,'%Y-%m') AS period,
             COUNT(*) AS checkouts,
             SUM(r.total_amount) AS revenue
      FROM reservations r
      WHERE r.status = 'checked_out'
    `;
    const params = [];
    if (month) { query += ' AND MONTH(r.check_out_date)=?'; params.push(month); }
    if (year)  { query += ' AND YEAR(r.check_out_date)=?';  params.push(year); }
    query += ' GROUP BY period ORDER BY period ASC';

    const [rows] = await pool.query(query, params);
    const headers = ['Period', 'Checkouts', 'Revenue ($)'];
    const data = rows.map(r => [r.period, r.checkouts, Number(r.revenue).toFixed(2)]);

    if (format === 'pdf') { writePDF(res, 'Revenue Report', headers, data); return; }
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="revenue.xlsx"');
      return res.send(toExcel(headers, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue.csv"');
    res.send(toCSV(headers, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Customers Export ────────────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const [rows] = await pool.query(`
      SELECT c.customer_id, c.name, c.email, c.phone,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount),0) AS total_spend,
             c.created_at
      FROM customers c
      LEFT JOIN reservations r ON c.customer_id = r.customer_id AND r.status != 'cancelled'
      GROUP BY c.customer_id
      ORDER BY total_spend DESC
    `);
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Bookings', 'Total Spend ($)', 'Registered'];
    const data = rows.map(r => [r.customer_id, r.name, r.email, r.phone, r.bookings, Number(r.total_spend).toFixed(2), r.created_at]);

    if (format === 'pdf') { writePDF(res, 'Customer Report', headers, data); return; }
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"');
      return res.send(toExcel(headers, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(toCSV(headers, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Rooms Export ────────────────────────────────────────────────────────────
router.get('/rooms', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const [rows] = await pool.query(`
      SELECT rm.room_id, rm.room_number, rm.room_type, rm.price, rm.status,
             COUNT(r.reservation_id) AS bookings,
             COALESCE(SUM(r.total_amount),0) AS revenue
      FROM rooms rm
      LEFT JOIN reservations r ON rm.room_id=r.room_id AND r.status != 'cancelled'
      GROUP BY rm.room_id
      ORDER BY rm.room_number ASC
    `);
    const headers = ['ID','Room #','Type','Price/Night','Status','Bookings','Revenue ($)'];
    const data = rows.map(r => [r.room_id, r.room_number, r.room_type, r.price, r.status, r.bookings, Number(r.revenue).toFixed(2)]);

    if (format === 'pdf') { writePDF(res, 'Room Performance Report', headers, data); return; }
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="rooms.xlsx"');
      return res.send(toExcel(headers, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rooms.csv"');
    res.send(toCSV(headers, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── Attendance Export ───────────────────────────────────────────────────────
router.get('/attendance', async (req, res) => {
  try {
    const { format = 'csv', month, year } = req.query;
    let query = `
      SELECT u.username, u.role, a.date, a.clock_in, a.clock_out,
             a.total_hours, a.status
      FROM attendance a
      JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (month) { query += ' AND MONTH(a.date)=?'; params.push(month); }
    if (year)  { query += ' AND YEAR(a.date)=?';  params.push(year); }
    query += ' ORDER BY a.date DESC, u.username ASC';

    const [rows] = await pool.query(query, params);
    const headers = ['Employee', 'Role', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status'];
    const data = rows.map(r => [r.username, r.role, r.date, r.clock_in, r.clock_out, r.total_hours, r.status]);

    if (format === 'pdf') { writePDF(res, 'Attendance Report', headers, data); return; }
    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance.xlsx"');
      return res.send(toExcel(headers, data));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    res.send(toCSV(headers, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
