// backend/src/routes/reportExport.js
// Enterprise Reports Export API (admin only, rate-limited to 20 requests per minute)
// Supports CSV, XLSX, and PDF exports for all 8 report domains.

const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const env = require('../config/env');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const reportsService = require('../services/reports');
const { today, nightsBetween } = require('../utils/dates');

const router = express.Router();

// ─── 1. RATE LIMITER (20 requests per minute) ─────────────────────────────────
const exportRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many export requests. Maximum 20 exports per minute.',
      errors: ['Rate limit exceeded. Please wait a minute before requesting another export.'],
    });
  },
});

// Admin-only protection + Rate Limiter
router.use(verifyToken, requireRole('admin'), exportRateLimiter);

// ─── 2. VALIDATION SCHEMA ─────────────────────────────────────────────────────
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateMessage = "Invalid date format. Expected 'YYYY-MM-DD'";

const exportQuerySchema = z.object({
  query: z
    .object({
      report: z.enum([
        'overview',
        'revenue',
        'occupancy',
        'rooms',
        'reservations',
        'customers',
        'payments',
        'operations',
      ]),
      format: z.enum(['csv', 'xlsx', 'pdf']),
      from: z.string().regex(dateRegex, dateMessage).optional(),
      to: z.string().regex(dateRegex, dateMessage).optional(),
      compare: z.enum(['none', 'previous_period', 'previous_year']).default('none'),
      room_type: z.string().optional(),
      source: z.enum(['online', 'reception', 'admin']).optional(),
      status: z
        .enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
        .optional(),
      payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
      q: z.string().optional(),
      sort: z.string().optional(),
      sort_dir: z.enum(['asc', 'desc']).optional(),
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
    )
    .refine(
      (q) => {
        if (q.from && q.to) {
          const days = nightsBetween(q.from, q.to) + 1;
          return days <= 366;
        }
        return true;
      },
      {
        message: 'Date range cannot exceed 366 days (1 year). Please select a narrower date range.',
        path: ['from'],
      }
    ),
});

// ─── 3. HELPERS ───────────────────────────────────────────────────────────────
const HOTEL_NAME = env.HOTEL_NAME || 'LuxeStay';

function getColomboTimestamp() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.HOTEL_TIMEZONE || 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const p = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (${env.HOTEL_TIMEZONE || 'Asia/Colombo'})`;
}

function formatFilterString(q) {
  const parts = [];
  if (q.room_type) parts.push(`Room Type: ${q.room_type}`);
  if (q.source) parts.push(`Source: ${q.source.toUpperCase()}`);
  if (q.status) parts.push(`Status: ${q.status.replace(/_/g, ' ')}`);
  if (q.payment_status) parts.push(`Payment: ${q.payment_status}`);
  if (q.q && q.q.trim()) parts.push(`Search: "${q.q.trim()}"`);
  if (q.compare && q.compare !== 'none') parts.push(`Comparison: ${q.compare.replace(/_/g, ' ')}`);
  return parts.length > 0 ? parts.join(' | ') : 'None (All)';
}

function formatSafeFilename(report, from, to, format) {
  const f = from || today();
  const t = to || today();
  const safeBase = `luxestay-${report}-${f}_${t}`.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
  return `${safeBase}.${format}`;
}

// CSV cell sanitizer protecting against CSV / formula injection attacks
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Any cell that starts with =, +, -, @, \t, or \r is prefixed with a single quote
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function formatNumber(val, decimals = 2) {
  const n = Number(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── 4. DATA FETCHERS FOR REPORTS ─────────────────────────────────────────────
async function fetchExportReportData(query) {
  const { report } = query;

  switch (report) {
    case 'reservations': {
      // Fetch drilldown rows uncapped
      const resData = await reportsService.getReservationsDrilldown(pool, {
        ...query,
        limit: 50001,
        page: 1,
      });

      const totalCount = resData.data.totals.total_count;
      if (totalCount > 50000) {
        const err = new Error('Export exceeds 50,000 row limit. Please narrow your filters.');
        err.statusCode = 413;
        throw err;
      }

      const rows = resData.data.rows;
      const totals = resData.data.totals;

      const title = 'Reservations Report';
      const kpis = [
        ['Total Bookings', totals.total_count],
        ['Total Nights', totals.total_nights],
        ['Total Amount (LKR)', totals.total_amount],
        ['Total Net Paid (LKR)', totals.total_net_paid],
        ['Outstanding Balance (LKR)', totals.total_balance],
      ];

      const headers = [
        'Booking Ref',
        'Guest Name',
        'Email',
        'Phone',
        'Room',
        'Room Type',
        'Check In',
        'Check Out',
        'Nights',
        'Guests',
        'Rate (LKR)',
        'Total (LKR)',
        'Net Paid (LKR)',
        'Balance (LKR)',
        'Status',
        'Payment Status',
        'Source',
        'Created At',
      ];

      const tableRows = rows.map((r) => [
        r.booking_ref,
        r.guest_name,
        r.guest_email || '—',
        r.guest_phone || '—',
        r.room_number,
        r.room_type,
        r.check_in_date,
        r.check_out_date,
        Number(r.nights),
        Number(r.guests),
        Number(r.nightly_rate),
        Number(r.total_amount),
        Number(r.net_paid),
        Number(r.balance),
        r.status,
        r.payment_status,
        r.booking_source,
        r.created_at,
      ]);

      const totalsRow = [
        'TOTALS',
        `${totals.total_count} bookings`,
        '',
        '',
        '',
        '',
        '',
        '',
        totals.total_nights,
        '',
        '',
        totals.total_amount,
        totals.total_net_paid,
        totals.total_balance,
        '',
        '',
        '',
        '',
      ];

      const moneyCols = [10, 11, 12, 13];
      const dateCols = [6, 7];
      const pdfColWidths = [55, 95, 60, 52, 52, 25, 55, 65, 60, 60, 50, 45];
      // For PDF we select the key 12 columns so they fit cleanly in landscape:
      const pdfHeaders = [
        'Ref',
        'Guest Name',
        'Room',
        'Check In',
        'Check Out',
        'Nts',
        'Rate (LKR)',
        'Total (LKR)',
        'Paid (LKR)',
        'Bal (LKR)',
        'Status',
        'Source',
      ];
      const pdfRows = rows.map((r) => [
        r.booking_ref,
        r.guest_name,
        `Room ${r.room_number}`,
        r.check_in_date,
        r.check_out_date,
        r.nights,
        formatNumber(r.nightly_rate),
        formatNumber(r.total_amount),
        formatNumber(r.net_paid),
        formatNumber(r.balance),
        r.status,
        r.booking_source,
      ]);
      const pdfTotalsRow = [
        'TOTALS',
        `${totals.total_count} bookings`,
        '',
        '',
        '',
        totals.total_nights,
        '',
        formatNumber(totals.total_amount),
        formatNumber(totals.total_net_paid),
        formatNumber(totals.total_balance),
        '',
        '',
      ];

      return {
        title,
        range: resData.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols,
        dateCols,
        pdfHeaders,
        pdfRows,
        pdfTotalsRow,
        pdfColWidths,
      };
    }

    case 'revenue': {
      const [trendRes, overviewRes] = await Promise.all([
        reportsService.getRevenueTrend(pool, query),
        reportsService.getOverview(pool, query),
      ]);

      const intervals = trendRes.data || [];
      const ov = overviewRes.data || {};

      let sumRoomRev = 0;
      let sumCash = 0;
      intervals.forEach((item) => {
        sumRoomRev += Number(item.room_revenue || 0);
        sumCash += Number(item.cash_collected || 0);
      });
      sumRoomRev = Number(sumRoomRev.toFixed(2));
      sumCash = Number(sumCash.toFixed(2));

      const title = 'Revenue & Settlements Report';
      const kpis = [
        ['Room Revenue (LKR)', ov.room_revenue || 0],
        ['Cash Collected (LKR)', ov.cash_collected || 0],
        ['ADR (LKR)', ov.adr || 0],
        ['RevPAR (LKR)', ov.revpar || 0],
        ['Sold Room Nights', ov.sold_room_nights || 0],
      ];

      const headers = [
        'Period / Interval',
        'Earned Room Revenue (LKR)',
        'Cash Settlements (LKR)',
        'Net Cash Inflow (LKR)',
      ];

      const tableRows = intervals.map((it) => [
        it.label,
        Number(it.room_revenue),
        Number(it.cash_collected),
        Number(it.cash_collected),
      ]);

      const totalsRow = ['TOTALS', sumRoomRev, sumCash, sumCash];

      return {
        title,
        range: trendRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [1, 2, 3],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: intervals.map((it) => [
          it.label,
          formatNumber(it.room_revenue),
          formatNumber(it.cash_collected),
          formatNumber(it.cash_collected),
        ]),
        pdfTotalsRow: ['TOTALS', formatNumber(sumRoomRev), formatNumber(sumCash), formatNumber(sumCash)],
        pdfColWidths: [180, 200, 200, 200],
      };
    }

    case 'occupancy': {
      const [occRes, overviewRes] = await Promise.all([
        reportsService.getOccupancyTrend(pool, query),
        reportsService.getOverview(pool, query),
      ]);

      const daysList = occRes.data || [];
      const ov = overviewRes.data || {};

      let totalAvail = 0;
      let totalSold = 0;
      let totalFore = 0;
      daysList.forEach((d) => {
        totalAvail += Number(d.available_nights || 0);
        totalSold += Number(d.sold_nights || 0);
        totalFore += Number(d.forecast_nights || 0);
      });

      const title = 'Occupancy Report';
      const kpis = [
        ['Average Occupancy %', `${ov.occupancy_pct || 0}%`],
        ['Sold Room Nights', ov.sold_room_nights || 0],
        ['Forecast Nights (Confirmed)', ov.forecast_room_nights || 0],
        ['Available Room Nights', ov.available_room_nights || 0],
      ];

      const headers = [
        'Date',
        'Available Room Nights',
        'Sold Room Nights',
        'Forecast Nights (Confirmed)',
        'Occupancy %',
      ];

      const tableRows = daysList.map((d) => [
        d.date,
        Number(d.available_nights),
        Number(d.sold_nights),
        Number(d.forecast_nights),
        `${d.occupancy_pct}%`,
      ]);

      const totalsRow = [
        'TOTALS / AVERAGE',
        totalAvail,
        totalSold,
        totalFore,
        `${ov.occupancy_pct || 0}%`,
      ];

      return {
        title,
        range: occRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [],
        dateCols: [0],
        pdfHeaders: headers,
        pdfRows: daysList.map((d) => [
          d.date,
          d.available_nights,
          d.sold_nights,
          d.forecast_nights,
          `${d.occupancy_pct}%`,
        ]),
        pdfTotalsRow: [
          'TOTALS / AVERAGE',
          totalAvail,
          totalSold,
          totalFore,
          `${ov.occupancy_pct || 0}%`,
        ],
        pdfColWidths: [140, 160, 160, 180, 140],
      };
    }

    case 'rooms': {
      const roomPerfRes = await reportsService.getRoomPerformance(pool, query);
      const rooms = roomPerfRes.data.rooms || [];

      let totalSoldNights = 0;
      let totalRev = 0;
      rooms.forEach((rm) => {
        totalSoldNights += Number(rm.sold_nights || 0);
        totalRev += Number(rm.room_revenue || 0);
      });
      totalRev = Number(totalRev.toFixed(2));

      const title = 'Room Inventory Performance Report';
      const kpis = [
        ['Hotel Average Occupancy %', `${roomPerfRes.data.hotel_average_occupancy_pct || 0}%`],
        ['Total Room Inventory', rooms.length],
        ['Total Sold Nights', totalSoldNights],
        ['Total Room Revenue (LKR)', totalRev],
      ];

      const headers = [
        'Room Number',
        'Room Type',
        'Status',
        'Sold Nights',
        'Occupancy %',
        'ADR (LKR)',
        'Room Revenue (LKR)',
        'Performance Flag',
      ];

      const tableRows = rooms.map((rm) => [
        rm.room_number,
        rm.room_type,
        rm.status,
        Number(rm.sold_nights),
        `${rm.occupancy_pct}%`,
        Number(rm.adr),
        Number(rm.room_revenue),
        rm.underperforming ? 'Underperforming' : 'Normal',
      ]);

      const totalsRow = [
        'TOTALS',
        '',
        '',
        totalSoldNights,
        `${roomPerfRes.data.hotel_average_occupancy_pct || 0}%`,
        '',
        totalRev,
        '',
      ];

      return {
        title,
        range: roomPerfRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [5, 6],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: rooms.map((rm) => [
          rm.room_number,
          rm.room_type,
          rm.status,
          rm.sold_nights,
          `${rm.occupancy_pct}%`,
          formatNumber(rm.adr),
          formatNumber(rm.room_revenue),
          rm.underperforming ? 'Underperforming' : 'Normal',
        ]),
        pdfTotalsRow: [
          'TOTALS',
          '',
          '',
          totalSoldNights,
          `${roomPerfRes.data.hotel_average_occupancy_pct || 0}%`,
          '',
          formatNumber(totalRev),
          '',
        ],
        pdfColWidths: [60, 120, 70, 70, 80, 100, 130, 150],
      };
    }

    case 'customers': {
      const custRes = await reportsService.getCustomersReport(pool, query);
      const custData = custRes.data || {};
      const customers = custData.all_customers || custData.top_customers || [];

      let totalBookings = 0;
      let totalSpent = 0;
      customers.forEach((c) => {
        totalBookings += Number(c.reservations_count || 0);
        totalSpent += Number(c.total_spent || 0);
      });
      totalSpent = Number(totalSpent.toFixed(2));

      const title = 'Customer Analytics Report';
      const kpis = [
        ['Total Active Customers', custData.total_active_customers || 0],
        ['New Customers', custData.new_customers_count || 0],
        ['Returning Customers', custData.returning_customers_count || 0],
        ['Repeat Rate %', `${custData.repeat_rate_pct || 0}%`],
        ['Avg Booking Value (LKR)', custData.avg_booking_value || 0],
      ];

      const headers = [
        'Customer ID',
        'Customer Name',
        'Email',
        'Phone',
        'Guest Type',
        'Bookings in Period',
        'Total Spent (LKR)',
      ];

      const tableRows = customers.map((c) => [
        c.customer_id,
        c.name,
        c.email || '—',
        c.phone || '—',
        c.is_new ? 'New' : 'Returning',
        Number(c.reservations_count),
        Number(c.total_spent),
      ]);

      const totalsRow = [
        'TOTALS',
        `${customers.length} guests`,
        '',
        '',
        '',
        totalBookings,
        totalSpent,
      ];

      return {
        title,
        range: custRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [6],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: customers.map((c) => [
          c.customer_id,
          c.name,
          c.email || '—',
          c.phone || '—',
          c.is_new ? 'New' : 'Returning',
          c.reservations_count,
          formatNumber(c.total_spent),
        ]),
        pdfTotalsRow: ['TOTALS', `${customers.length} guests`, '', '', '', totalBookings, formatNumber(totalSpent)],
        pdfColWidths: [70, 140, 170, 100, 80, 90, 130],
      };
    }

    case 'payments': {
      const payRes = await reportsService.getPaymentsReport(pool, query);
      const payData = payRes.data || {};
      const txs = payData.all_transactions || payData.recent_transactions || [];

      const title = 'Payments & Settlements Report';
      const kpis = [
        ['Net Cash Collected (LKR)', payData.cash_collected || 0],
        ['Total Payments (LKR)', payData.total_payments_amount || 0],
        ['Total Refunds (LKR)', payData.total_refunds_amount || 0],
        ['Payments Count', payData.payments_count || 0],
        ['Refunds Count', payData.refunds_count || 0],
      ];

      const headers = [
        'Payment ID',
        'Booking Ref',
        'Guest Name',
        'Amount (LKR)',
        'Method',
        'Kind',
        'Status',
        'Timestamp',
      ];

      const tableRows = txs.map((tx) => [
        tx.payment_id,
        tx.booking_ref,
        tx.guest_name,
        Number(tx.amount),
        tx.method,
        tx.kind,
        tx.status,
        tx.created_at,
      ]);

      const totalsRow = ['TOTALS', '', '', Number(payData.cash_collected || 0), '', '', '', ''];

      return {
        title,
        range: payRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [3],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: txs.map((tx) => [
          tx.payment_id,
          tx.booking_ref,
          tx.guest_name,
          formatNumber(tx.amount),
          tx.method,
          tx.kind,
          tx.status,
          tx.created_at,
        ]),
        pdfTotalsRow: ['TOTALS', '', '', formatNumber(payData.cash_collected || 0), '', '', '', ''],
        pdfColWidths: [60, 70, 140, 90, 80, 70, 70, 200],
      };
    }

    case 'operations': {
      const opsRes = await reportsService.getOperationsReport(pool, query);
      const opsData = opsRes.data || {};
      const unpaid = opsData.unpaid_bills || [];

      let totalAmount = 0;
      let totalPaid = 0;
      let totalBalance = 0;
      unpaid.forEach((u) => {
        totalAmount += Number(u.total_amount || 0);
        totalPaid += Number(u.net_paid || 0);
        totalBalance += Number(u.balance || 0);
      });
      totalAmount = Number(totalAmount.toFixed(2));
      totalPaid = Number(totalPaid.toFixed(2));
      totalBalance = Number(totalBalance.toFixed(2));

      const title = 'Operations & Unpaid Folios Report';
      const kpis = [
        ['Arrivals Today', opsData.counts?.arrivals_today || 0],
        ['Departures Today', opsData.counts?.departures_today || 0],
        ['In House Guests', opsData.counts?.in_house || 0],
        ['Unpaid Folios Count', opsData.counts?.unpaid_bills_count || 0],
        ['Total Outstanding Balance (LKR)', totalBalance],
      ];

      const headers = [
        'Booking Ref',
        'Guest Name',
        'Phone',
        'Room',
        'Room Type',
        'Status',
        'Payment Status',
        'Total (LKR)',
        'Net Paid (LKR)',
        'Balance (LKR)',
      ];

      const tableRows = unpaid.map((u) => [
        u.booking_ref,
        u.guest_name,
        u.phone || '—',
        u.room_number,
        u.room_type,
        u.status,
        u.payment_status,
        Number(u.total_amount),
        Number(u.net_paid),
        Number(u.balance),
      ]);

      const totalsRow = [
        'TOTALS',
        `${unpaid.length} unpaid folios`,
        '',
        '',
        '',
        '',
        '',
        totalAmount,
        totalPaid,
        totalBalance,
      ];

      return {
        title,
        range: opsRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [7, 8, 9],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: unpaid.map((u) => [
          u.booking_ref,
          u.guest_name,
          u.phone || '—',
          `Room ${u.room_number}`,
          u.room_type,
          u.status,
          u.payment_status,
          formatNumber(u.total_amount),
          formatNumber(u.net_paid),
          formatNumber(u.balance),
        ]),
        pdfTotalsRow: [
          'TOTALS',
          `${unpaid.length} folios`,
          '',
          '',
          '',
          '',
          '',
          formatNumber(totalAmount),
          formatNumber(totalPaid),
          formatNumber(totalBalance),
        ],
        pdfColWidths: [70, 110, 90, 50, 80, 70, 70, 80, 80, 80],
      };
    }

    case 'overview':
    default: {
      const ovRes = await reportsService.getOverview(pool, query);
      const ov = ovRes.data || {};

      const title = 'Executive Management Overview Report';
      const kpis = [
        ['Room Revenue (LKR)', ov.room_revenue || 0],
        ['Cash Collected (LKR)', ov.cash_collected || 0],
        ['Average Occupancy %', `${ov.occupancy_pct || 0}%`],
        ['ADR (LKR)', ov.adr || 0],
        ['RevPAR (LKR)', ov.revpar || 0],
        ['Reservations Created', ov.reservations_created?.total || 0],
        ['Cancellation Rate %', `${ov.cancellation_rate_pct || 0}%`],
        ['Outstanding Balance (LKR)', ov.outstanding_balance || 0],
      ];

      const headers = ['Category', 'Metric / Channel', 'Count or Value (LKR)', 'Share / Details'];

      const tableRows = [];
      // Status breakdown
      Object.entries(ov.reservations_created?.by_status || {}).forEach(([st, cnt]) => {
        tableRows.push(['Booking Status', st.replace(/_/g, ' '), cnt, '']);
      });
      // Source breakdown
      Object.entries(ov.reservations_created?.by_source || {}).forEach(([src, cnt]) => {
        tableRows.push(['Booking Source', src.toUpperCase(), cnt, '']);
      });
      // Payment methods
      Object.entries(ov.payment_method_breakdown || {}).forEach(([m, amt]) => {
        tableRows.push(['Payment Method', m.replace(/_/g, ' '), Number(amt), 'Net Collected']);
      });

      const totalsRow = ['TOTALS', 'Active Period Summary', '', ''];

      return {
        title,
        range: ovRes.range,
        kpis,
        headers,
        tableRows,
        totalsRow,
        moneyCols: [2],
        dateCols: [],
        pdfHeaders: headers,
        pdfRows: tableRows.map((r) => [
          r[0],
          r[1],
          typeof r[2] === 'number' ? formatNumber(r[2]) : String(r[2]),
          r[3],
        ]),
        pdfTotalsRow: ['TOTALS', 'Active Period Summary', '', ''],
        pdfColWidths: [180, 220, 180, 200],
      };
    }
  }
}

// ─── 5. GENERATE CSV ──────────────────────────────────────────────────────────
function generateCSV({ title, range, query, kpis, headers, tableRows, totalsRow }) {
  const lines = [];

  // Header metadata
  lines.push(sanitizeCsvCell(`${HOTEL_NAME} Hotel`));
  lines.push(sanitizeCsvCell(title));
  lines.push(
    sanitizeCsvCell(
      range
        ? `Date Range: ${range.from} to ${range.to} (${range.days} days)`
        : `Date: ${today()}`
    )
  );
  lines.push(sanitizeCsvCell(`Active Filters: ${formatFilterString(query)}`));
  lines.push(sanitizeCsvCell(`Generated At: ${getColomboTimestamp()}`));
  lines.push(''); // empty line

  // KPI Summary
  lines.push(sanitizeCsvCell('KEY PERFORMANCE INDICATORS:'));
  kpis.forEach(([k, v]) => {
    lines.push(`${sanitizeCsvCell(k)},${sanitizeCsvCell(v)}`);
  });
  lines.push(''); // empty line

  // Table header
  lines.push(headers.map(sanitizeCsvCell).join(','));

  // Data rows
  tableRows.forEach((row) => {
    lines.push(row.map(sanitizeCsvCell).join(','));
  });

  // Totals row
  if (totalsRow && totalsRow.length > 0) {
    lines.push(totalsRow.map(sanitizeCsvCell).join(','));
  }

  // UTF-8 BOM + CSV lines
  return '\uFEFF' + lines.join('\r\n');
}

// ─── 6. GENERATE XLSX ─────────────────────────────────────────────────────────
function generateXLSX({ title, range, query, kpis, headers, tableRows, totalsRow, moneyCols, dateCols }) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryAoa = [
    [`${HOTEL_NAME} Hotel`],
    [title],
    [range ? `Date Range: ${range.from} to ${range.to} (${range.days} days)` : `Date: ${today()}`],
    [`Active Filters: ${formatFilterString(query)}`],
    [`Generated At: ${getColomboTimestamp()}`],
    [],
    ['KEY PERFORMANCE INDICATORS', 'VALUE'],
  ];

  kpis.forEach(([k, v]) => {
    summaryAoa.push([k, v]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  summaryWs['!cols'] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // 2. Data Sheet
  const dataAoa = [headers];

  tableRows.forEach((row) => {
    // Sanitize string cells to prevent Excel formula injection
    const sanitized = row.map((cell) => {
      if (typeof cell === 'string' && /^[=\+\-@\t\r]/.test(cell)) {
        return `'${cell}`;
      }
      return cell;
    });
    dataAoa.push(sanitized);
  });

  if (totalsRow && totalsRow.length > 0) {
    dataAoa.push(totalsRow);
  }

  const dataWs = XLSX.utils.aoa_to_sheet(dataAoa);

  // Freeze header row
  dataWs['!views'] = [{ state: 'frozen', ySplit: 1 }];
  dataWs['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Set number formats for money and date columns
  const rangeRef = XLSX.utils.decode_range(dataWs['!ref'] || 'A1:A1');
  for (let R = 1; R <= rangeRef.e.r; ++R) {
    for (let C = 0; C <= rangeRef.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = dataWs[cellAddress];
      if (!cell) continue;

      if (moneyCols.includes(C) && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = '#,##0.00';
      } else if (dateCols.includes(C) && typeof cell.v === 'string' && dateRegex.test(cell.v)) {
        cell.t = 's';
      }
    }
  }

  // Sensible column widths
  dataWs['!cols'] = headers.map((h, colIdx) => {
    let maxLen = h.length;
    for (let r = 0; r < Math.min(tableRows.length, 100); r++) {
      const val = tableRows[r][colIdx];
      if (val != null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 11), 35) };
  });

  XLSX.utils.book_append_sheet(wb, dataWs, 'Data');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── 7. GENERATE PDF ──────────────────────────────────────────────────────────
function generatePDF(res, { title, range, query, pdfHeaders, pdfRows, pdfTotalsRow, pdfColWidths }, safeFilename) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    bufferPages: true,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const maxY = pageHeight - 45; // Leave space for footer

  // Draw Page Header
  const drawPageHeader = () => {
    doc.save();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#997028').text(`${HOTEL_NAME} Hotel`, margin, 24);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a2235').text(title, margin + 180, 26);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        `Range: ${range ? `${range.from} to ${range.to}` : today()} | Generated: ${getColomboTimestamp()}`,
        margin,
        42,
        { width: contentWidth, align: 'left' }
      );
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(margin, 54).lineTo(pageWidth - margin, 54).stroke();
    doc.restore();
  };

  // Draw Table Header
  const drawTableHeader = (startY) => {
    doc.save();
    doc.rect(margin, startY, contentWidth, 20).fill('#1a2235');
    let x = margin;
    pdfHeaders.forEach((h, i) => {
      const colW = pdfColWidths[i] || 60;
      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor('#d4a843')
        .text(h, x + 3, startY + 5, { width: colW - 6, align: 'left', lineBreak: false });
      x += colW;
    });
    doc.restore();
    return startY + 20;
  };

  // Start Page 1
  drawPageHeader();

  // Active filters note
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#444444')
    .text(`Applied Filters: ${formatFilterString(query)}`, margin, 60, { width: contentWidth });

  let currentY = drawTableHeader(76);

  // Table Rows loop
  pdfRows.forEach((row, rowIdx) => {
    // Check if new page needed
    if (currentY + 18 > maxY) {
      doc.addPage();
      drawPageHeader();
      currentY = drawTableHeader(64);
    }

    doc.save();
    // Alternating zebra fill
    if (rowIdx % 2 === 1) {
      doc.rect(margin, currentY, contentWidth, 16).fill('#f8f9fc');
    }

    let x = margin;
    row.forEach((cellVal, colIdx) => {
      const colW = pdfColWidths[colIdx] || 60;
      const textVal = cellVal != null ? String(cellVal) : '';
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#2d3748')
        .text(textVal, x + 3, currentY + 4, { width: colW - 6, align: 'left', lineBreak: false });
      x += colW;
    });

    doc.restore();
    currentY += 16;
  });

  // Totals Row
  if (pdfTotalsRow && pdfTotalsRow.length > 0) {
    if (currentY + 22 > maxY) {
      doc.addPage();
      drawPageHeader();
      currentY = drawTableHeader(64);
    }

    doc.save();
    doc.rect(margin, currentY, contentWidth, 20).fill('#e8e4dc');
    doc.strokeColor('#997028').lineWidth(1).moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();

    let x = margin;
    pdfTotalsRow.forEach((tVal, colIdx) => {
      const colW = pdfColWidths[colIdx] || 60;
      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor('#1a2235')
        .text(String(tVal || ''), x + 3, currentY + 5, { width: colW - 6, align: 'left', lineBreak: false });
      x += colW;
    });

    doc.restore();
  }

  // Two-pass page numbering
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.save();
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(margin, pageHeight - 28)
      .lineTo(pageWidth - margin, pageHeight - 28)
      .stroke();
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor('#718096')
      .text(`${HOTEL_NAME} Hotel — Confidential Management Report`, margin, pageHeight - 22, {
        align: 'left',
      });
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor('#718096')
      .text(`Page ${i + 1} of ${pageCount}`, margin, pageHeight - 22, {
        align: 'right',
        width: contentWidth,
      });
    doc.restore();
  }

  doc.end();
}

// ─── 8. GET /api/reports/export ───────────────────────────────────────────────
router.get(
  '/',
  validate(exportQuerySchema),
  asyncHandler(async (req, res) => {
    const { report, format, from, to } = req.query;

    const data = await fetchExportReportData(req.query);

    const safeFilename = formatSafeFilename(report, from, to, format);

    if (format === 'csv') {
      const csv = generateCSV({ ...data, query: req.query });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      return res.send(csv);
    }

    if (format === 'xlsx') {
      const buffer = generateXLSX({ ...data, query: req.query });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      return res.send(buffer);
    }

    if (format === 'pdf') {
      return generatePDF(res, { ...data, query: req.query }, safeFilename);
    }
  })
);

module.exports = router;
