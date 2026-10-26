// backend/src/services/reports.js
// Enterprise Reports Service (admin-only metrics engine)
// Uses recursive CTE for night expansion, strict parameter validation, comparison calculations,
// SARGable index-optimized queries, and exact metric definitions.

const pool = require('../config/db');
const env = require('../config/env');
const { today, addDays, nightsBetween, isValidDateString } = require('../utils/dates');

// Exact metric definitions as required by specification
const METRIC_DEFINITIONS = {
  available_room_nights:
    '(number of rooms not in maintenance at report time, filtered by room_type) x days in range. Note in the definitions that past maintenance periods are not recorded.',
  sold_room_nights:
    'nights in range belonging to reservations with status checked_in or checked_out.',
  forecast_room_nights:
    'the same for status confirmed (shown separately, never added to sold).',
  room_revenue:
    'sum of nightly_rate over sold nights (earned revenue, no tax).',
  occupancy_pct:
    'sold_room_nights / available_room_nights x 100.',
  adr:
    'room_revenue / sold_room_nights (0 when no nights).',
  revpar:
    'room_revenue / available_room_nights.',
  cash_collected:
    'sum of payment rows minus refund rows with created_at (hotel timezone date) inside the range. payment_method_breakdown groups the same rows.',
  outstanding_balance:
    '(as of today, ignores the range) = sum over reservations with status checked_in or checked_out of (total_amount - net paid) where positive.',
  reservations_created:
    'reservations whose created_at date is in range; broken down by status and by booking_source.',
  cancellation_rate_pct:
    'cancelled / reservations_created x 100 (cohort = created in range).',
  no_show_count:
    'counted the same way (reservations whose created_at date is in range with status no_show).',
  avg_lead_time_days:
    'average of (check_in_date - created_at date) for non-cancelled reservations created in range.',
  avg_length_of_stay:
    'average nights of reservations checked out in range.',
  online_vs_reception:
    'counts and share by booking_source for reservations created in range.',
  customers:
    "a customer is 'new' when their first ever reservation was created in range and 'returning' otherwise (counting customers with a non-cancelled reservation created in range); repeat_rate_pct = returning / all x 100; avg_booking_value = average total_amount of those reservations; top room types by bookings.",
};

/**
 * Returns ISO timestamp with hotel timezone (+05:30)
 */
function getHotelTimestampNow() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.HOTEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const p = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

/**
 * Shifts date by -1 year handling leap years
 */
function shiftOneYearBack(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetYear = y - 1;
  if (m === 2 && d === 29) {
    const isLeap =
      (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
    return `${targetYear}-02-${isLeap ? '29' : '28'}`;
  }
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Resolve range and compare range
 */
function resolveRangeAndCompare(fromInput, toInput, compare = 'none') {
  const toStr = toInput || today();
  const fromStr = fromInput || addDays(toStr, -29);

  if (!isValidDateString(fromStr) || !isValidDateString(toStr)) {
    throw new Error("Invalid date format. Expected 'YYYY-MM-DD'");
  }
  if (fromStr > toStr) {
    throw new Error("'to' date must be greater than or equal to 'from' date");
  }

  const days = nightsBetween(fromStr, toStr) + 1;
  if (days > 366) {
    throw new Error('Date range cannot exceed 366 days');
  }

  const range = { from: fromStr, to: toStr, days };
  let compare_range = null;

  if (compare === 'previous_period') {
    const compareTo = addDays(fromStr, -1);
    const compareFrom = addDays(compareTo, -(days - 1));
    compare_range = {
      from: compareFrom,
      to: compareTo,
      days: nightsBetween(compareFrom, compareTo) + 1,
    };
  } else if (compare === 'previous_year') {
    const compareFrom = shiftOneYearBack(fromStr);
    const compareTo = shiftOneYearBack(toStr);
    compare_range = {
      from: compareFrom,
      to: compareTo,
      days: nightsBetween(compareFrom, compareTo) + 1,
    };
  }

  return { range, compare_range };
}

/**
 * Calculate delta_pct = ((current - previous) / previous) * 100
 */
function calcDelta(current, previous) {
  const curr = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev === 0) {
    return curr === 0 ? 0 : 100;
  }
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

/**
 * Build SQL fragment for recursive night table CTE
 */
function buildNightCte(from, to, roomType, source) {
  let whereFilters = '';
  const params = [from, to, to, from];

  if (roomType) {
    whereFilters += ' AND rm.room_type = ?';
    params.push(roomType);
  }
  if (source) {
    whereFilters += ' AND r.booking_source = ?';
    params.push(source);
  }

  const cteSql = `
    WITH RECURSIVE reservation_nights AS (
      SELECT
        r.reservation_id,
        r.booking_ref,
        r.room_id,
        r.customer_id,
        r.status,
        r.booking_source,
        r.nightly_rate,
        r.check_in_date,
        r.check_out_date,
        GREATEST(r.check_in_date, ?) AS night_date,
        LEAST(DATE_SUB(r.check_out_date, INTERVAL 1 DAY), ?) AS last_night
      FROM reservations r FORCE INDEX (idx_reservations_status_checkin)
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.check_in_date < r.check_out_date
        AND r.status IN ('confirmed', 'checked_in', 'checked_out')
        AND r.check_in_date <= ?
        AND r.check_out_date > ?
        ${whereFilters}

      UNION ALL

      SELECT
        reservation_id,
        booking_ref,
        room_id,
        customer_id,
        status,
        booking_source,
        nightly_rate,
        check_in_date,
        check_out_date,
        DATE_ADD(night_date, INTERVAL 1 DAY) AS night_date,
        last_night
      FROM reservation_nights
      WHERE night_date < last_night
    )
  `;

  return { cteSql, params };
}

/**
 * 1. Overview KPIs for a single range
 */
async function fetchOverviewData(connOrPool, { from, to, days, room_type, source }) {
  // A. Available room nights
  let roomCountQuery = "SELECT COUNT(*) AS total FROM rooms WHERE status != 'maintenance'";
  const roomCountParams = [];
  if (room_type) {
    roomCountQuery += ' AND room_type = ?';
    roomCountParams.push(room_type);
  }
  const [[{ total: activeRooms }]] = await connOrPool.query(roomCountQuery, roomCountParams);
  const available_room_nights = Number(activeRooms) * days;

  // B. Night-based metrics via CTE
  const { cteSql, params: cteParams } = buildNightCte(from, to, room_type, source);
  const nightMetricsQuery = `
    ${cteSql}
    SELECT
      COUNT(CASE WHEN status IN ('checked_in', 'checked_out') THEN 1 END) AS sold_room_nights,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS forecast_room_nights,
      COALESCE(SUM(CASE WHEN status IN ('checked_in', 'checked_out') THEN nightly_rate ELSE 0 END), 0) AS room_revenue
    FROM reservation_nights
  `;
  const [[nightRes]] = await connOrPool.query(nightMetricsQuery, cteParams);

  const sold_room_nights = Number(nightRes.sold_room_nights || 0);
  const forecast_room_nights = Number(nightRes.forecast_room_nights || 0);
  const room_revenue = Number(Number(nightRes.room_revenue || 0).toFixed(2));

  // Occupancy, ADR, RevPAR
  const occupancy_pct =
    available_room_nights > 0
      ? Number(((sold_room_nights / available_room_nights) * 100).toFixed(2))
      : 0;

  const adr =
    sold_room_nights > 0
      ? Number((room_revenue / sold_room_nights).toFixed(2))
      : 0;

  const revpar =
    available_room_nights > 0
      ? Number((room_revenue / available_room_nights).toFixed(2))
      : 0;

  // C. Cash collected & payment method breakdown (hotel timezone date inside range)
  const nextDay = addDays(to, 1);
  let paymentsQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0) AS cash_collected
    FROM payments p FORCE INDEX (idx_payments_created)
    JOIN reservations r ON p.reservation_id = r.reservation_id
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE p.created_at >= ? AND p.created_at < ?
  `;
  const paymentParams = [`${from} 00:00:00`, `${nextDay} 00:00:00`];
  if (room_type) {
    paymentsQuery += ' AND rm.room_type = ?';
    paymentParams.push(room_type);
  }
  if (source) {
    paymentsQuery += ' AND r.booking_source = ?';
    paymentParams.push(source);
  }
  const [[payRes]] = await connOrPool.query(paymentsQuery, paymentParams);
  const cash_collected = Number(Number(payRes.cash_collected || 0).toFixed(2));

  // Breakdown by method
  let breakdownQuery = `
    SELECT
      p.method,
      COALESCE(SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0) AS amount,
      COUNT(*) AS count
    FROM payments p FORCE INDEX (idx_payments_created)
    JOIN reservations r ON p.reservation_id = r.reservation_id
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE p.created_at >= ? AND p.created_at < ?
  `;
  const breakdownParams = [`${from} 00:00:00`, `${nextDay} 00:00:00`];
  if (room_type) {
    breakdownQuery += ' AND rm.room_type = ?';
    breakdownParams.push(room_type);
  }
  if (source) {
    breakdownQuery += ' AND r.booking_source = ?';
    breakdownParams.push(source);
  }
  breakdownQuery += ' GROUP BY p.method';
  const [breakdownRows] = await connOrPool.query(breakdownQuery, breakdownParams);

  const payment_method_breakdown = {
    cash: 0,
    card: 0,
    bank_transfer: 0,
    online: 0,
  };
  breakdownRows.forEach((row) => {
    if (payment_method_breakdown[row.method] !== undefined) {
      payment_method_breakdown[row.method] = Number(Number(row.amount || 0).toFixed(2));
    }
  });

  // D. Outstanding balance (as of today, ignores range)
  let outQuery = `
    SELECT
      COALESCE(SUM(
        GREATEST(
          r.total_amount - COALESCE((
            SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
            FROM payments p
            WHERE p.reservation_id = r.reservation_id
          ), 0),
          0
        )
      ), 0) AS outstanding
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.status IN ('checked_in', 'checked_out')
  `;
  const outParams = [];
  if (room_type) {
    outQuery += ' AND rm.room_type = ?';
    outParams.push(room_type);
  }
  if (source) {
    outQuery += ' AND r.booking_source = ?';
    outParams.push(source);
  }
  const [[outRes]] = await connOrPool.query(outQuery, outParams);
  const outstanding_balance = Number(Number(outRes.outstanding || 0).toFixed(2));

  // E. Reservations created in range
  let createdQuery = `
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending,
      COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) AS confirmed,
      COUNT(CASE WHEN r.status = 'checked_in' THEN 1 END) AS checked_in,
      COUNT(CASE WHEN r.status = 'checked_out' THEN 1 END) AS checked_out,
      COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS cancelled,
      COUNT(CASE WHEN r.status = 'no_show' THEN 1 END) AS no_show,
      COUNT(CASE WHEN r.booking_source = 'online' THEN 1 END) AS src_online,
      COUNT(CASE WHEN r.booking_source = 'reception' THEN 1 END) AS src_reception,
      COUNT(CASE WHEN r.booking_source = 'admin' THEN 1 END) AS src_admin,
      AVG(CASE WHEN r.status != 'cancelled' THEN DATEDIFF(r.check_in_date, DATE(r.created_at)) END) AS avg_lead_time
    FROM reservations r FORCE INDEX (idx_reservations_created)
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.created_at >= ? AND r.created_at < ?
  `;
  const createdParams = [`${from} 00:00:00`, `${nextDay} 00:00:00`];
  if (room_type) {
    createdQuery += ' AND rm.room_type = ?';
    createdParams.push(room_type);
  }
  if (source) {
    createdQuery += ' AND r.booking_source = ?';
    createdParams.push(source);
  }
  const [[cRes]] = await connOrPool.query(createdQuery, createdParams);

  const totalCreated = Number(cRes.total || 0);
  const cancelledCreated = Number(cRes.cancelled || 0);
  const noShowCreated = Number(cRes.no_show || 0);

  const cancellation_rate_pct =
    totalCreated > 0
      ? Number(((cancelledCreated / totalCreated) * 100).toFixed(2))
      : 0;

  const avg_lead_time_days =
    cRes.avg_lead_time != null ? Number(Number(cRes.avg_lead_time).toFixed(1)) : 0;

  // F. Average length of stay for reservations checked out in range
  let checkoutQuery = `
    SELECT AVG(DATEDIFF(r.check_out_date, r.check_in_date)) AS avg_stay
    FROM reservations r FORCE INDEX (idx_reservations_checkout)
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.status = 'checked_out'
      AND r.check_out_date >= ?
      AND r.check_out_date <= ?
  `;
  const checkoutParams = [from, to];
  if (room_type) {
    checkoutQuery += ' AND rm.room_type = ?';
    checkoutParams.push(room_type);
  }
  if (source) {
    checkoutQuery += ' AND r.booking_source = ?';
    checkoutParams.push(source);
  }
  const [[stayRes]] = await connOrPool.query(checkoutQuery, checkoutParams);
  const avg_length_of_stay =
    stayRes.avg_stay != null ? Number(Number(stayRes.avg_stay).toFixed(1)) : 0;

  // G. Online vs Reception share
  const online_vs_reception = {
    online: {
      count: Number(cRes.src_online || 0),
      share_pct:
        totalCreated > 0
          ? Number(((Number(cRes.src_online || 0) / totalCreated) * 100).toFixed(1))
          : 0,
    },
    reception: {
      count: Number(cRes.src_reception || 0),
      share_pct:
        totalCreated > 0
          ? Number(((Number(cRes.src_reception || 0) / totalCreated) * 100).toFixed(1))
          : 0,
    },
    admin: {
      count: Number(cRes.src_admin || 0),
      share_pct:
        totalCreated > 0
          ? Number(((Number(cRes.src_admin || 0) / totalCreated) * 100).toFixed(1))
          : 0,
    },
  };

  // H. Customers metrics
  let custQuery = `
    SELECT
      r.customer_id,
      r.total_amount,
      r.created_at,
      rm.room_type,
      (SELECT MIN(r0.created_at) FROM reservations r0 WHERE r0.customer_id = r.customer_id) AS first_created_at
    FROM reservations r FORCE INDEX (idx_reservations_created)
    JOIN rooms rm ON r.room_id = rm.room_id
    WHERE r.created_at >= ? AND r.created_at < ?
      AND r.status != 'cancelled'
  `;
  const custParams = [`${from} 00:00:00`, `${nextDay} 00:00:00`];
  if (room_type) {
    custQuery += ' AND rm.room_type = ?';
    custParams.push(room_type);
  }
  if (source) {
    custQuery += ' AND r.booking_source = ?';
    custParams.push(source);
  }
  const [custRows] = await connOrPool.query(custQuery, custParams);

  // Group by distinct customer
  const customerMap = new Map();
  let totalCustBookingValue = 0;
  const roomTypeCounts = {};

  for (const row of custRows) {
    totalCustBookingValue += Number(row.total_amount || 0);
    roomTypeCounts[row.room_type] = (roomTypeCounts[row.room_type] || 0) + 1;

    if (!customerMap.has(row.customer_id)) {
      const firstDateStr = new Date(row.first_created_at)
        .toISOString()
        .slice(0, 10);
      const isNew = firstDateStr >= from && firstDateStr <= to;
      customerMap.set(row.customer_id, isNew);
    }
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  for (const isNew of customerMap.values()) {
    if (isNew) newCustomers++;
    else returningCustomers++;
  }
  const totalActiveCustomers = newCustomers + returningCustomers;
  const repeat_rate_pct =
    totalActiveCustomers > 0
      ? Number(((returningCustomers / totalActiveCustomers) * 100).toFixed(1))
      : 0;
  const avg_booking_value =
    custRows.length > 0
      ? Number((totalCustBookingValue / custRows.length).toFixed(2))
      : 0;

  const top_room_types = Object.entries(roomTypeCounts)
    .map(([type, count]) => ({ room_type: type, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings);

  return {
    available_room_nights,
    sold_room_nights,
    forecast_room_nights,
    room_revenue,
    occupancy_pct,
    adr,
    revpar,
    cash_collected,
    payment_method_breakdown,
    outstanding_balance,
    reservations_created: {
      total: totalCreated,
      by_status: {
        pending: Number(cRes.pending || 0),
        confirmed: Number(cRes.confirmed || 0),
        checked_in: Number(cRes.checked_in || 0),
        checked_out: Number(cRes.checked_out || 0),
        cancelled: cancelledCreated,
        no_show: noShowCreated,
      },
      by_source: {
        online: Number(cRes.src_online || 0),
        reception: Number(cRes.src_reception || 0),
        admin: Number(cRes.src_admin || 0),
      },
    },
    cancellation_rate_pct,
    no_show_count: noShowCreated,
    avg_lead_time_days,
    avg_length_of_stay,
    online_vs_reception,
    customers: {
      new_customers_count: newCustomers,
      returning_customers_count: returningCustomers,
      total_active_customers: totalActiveCustomers,
      repeat_rate_pct,
      avg_booking_value,
      top_room_types,
    },
  };
}

/**
 * Attaches delta_pct to all KPI metrics in data compared to previous
 */
function attachDeltas(data, prev) {
  if (!prev) return data;

  const result = { ...data };

  result.available_room_nights_delta_pct = calcDelta(
    data.available_room_nights,
    prev.available_room_nights
  );
  result.sold_room_nights_delta_pct = calcDelta(
    data.sold_room_nights,
    prev.sold_room_nights
  );
  result.forecast_room_nights_delta_pct = calcDelta(
    data.forecast_room_nights,
    prev.forecast_room_nights
  );
  result.room_revenue_delta_pct = calcDelta(data.room_revenue, prev.room_revenue);
  result.occupancy_pct_delta_pct = calcDelta(data.occupancy_pct, prev.occupancy_pct);
  result.adr_delta_pct = calcDelta(data.adr, prev.adr);
  result.revpar_delta_pct = calcDelta(data.revpar, prev.revpar);
  result.cash_collected_delta_pct = calcDelta(data.cash_collected, prev.cash_collected);
  result.cancellation_rate_pct_delta_pct = calcDelta(
    data.cancellation_rate_pct,
    prev.cancellation_rate_pct
  );
  result.no_show_count_delta_pct = calcDelta(data.no_show_count, prev.no_show_count);
  result.avg_lead_time_days_delta_pct = calcDelta(
    data.avg_lead_time_days,
    prev.avg_lead_time_days
  );
  result.avg_length_of_stay_delta_pct = calcDelta(
    data.avg_length_of_stay,
    prev.avg_length_of_stay
  );

  return result;
}

// ─── SERVICE METHODS ─────────────────────────────────────────────────────────

module.exports = {
  getDefinitions() {
    return METRIC_DEFINITIONS;
  },

  resolveRangeAndCompare,

  /**
   * 1. GET /api/reports/overview
   */
  async getOverview(connOrPool, { from, to, compare = 'none', room_type, source }) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const data = await fetchOverviewData(connOrPool, {
      from: range.from,
      to: range.to,
      days: range.days,
      room_type,
      source,
    });

    let previous = null;
    let dataWithDeltas = data;

    if (compare_range) {
      previous = await fetchOverviewData(connOrPool, {
        from: compare_range.from,
        to: compare_range.to,
        days: compare_range.days,
        room_type,
        source,
      });
      dataWithDeltas = attachDeltas(data, previous);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data: dataWithDeltas,
      previous,
    };
  },

  /**
   * 2. GET /api/reports/revenue-trend
   */
  async getRevenueTrend(
    connOrPool,
    { from, to, compare = 'none', room_type, source, granularity }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    let chosenGranularity = granularity;
    if (!chosenGranularity) {
      if (range.days <= 31) chosenGranularity = 'day';
      else if (range.days <= 90) chosenGranularity = 'week';
      else chosenGranularity = 'month';
    }

    const fetchTrend = async (r) => {
      // Build date intervals
      const intervals = [];
      let cur = r.from;

      if (chosenGranularity === 'day') {
        for (let i = 0; i < r.days; i++) {
          const d = addDays(r.from, i);
          intervals.push({ start: d, end: d, label: d });
        }
      } else if (chosenGranularity === 'week') {
        while (cur <= r.to) {
          const wEnd = addDays(cur, 6) > r.to ? r.to : addDays(cur, 6);
          intervals.push({ start: cur, end: wEnd, label: `${cur} to ${wEnd}` });
          cur = addDays(wEnd, 1);
        }
      } else {
        // month
        while (cur <= r.to) {
          const [y, m] = cur.split('-').map(Number);
          const lastDayOfCurMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const monthEndStr = `${y}-${String(m).padStart(2, '0')}-${String(
            lastDayOfCurMonth
          ).padStart(2, '0')}`;
          const mEnd = monthEndStr > r.to ? r.to : monthEndStr;
          intervals.push({
            start: cur,
            end: mEnd,
            label: `${y}-${String(m).padStart(2, '0')}`,
          });
          cur = addDays(mEnd, 1);
        }
      }

      // Fetch all sold nights in range
      const { cteSql, params: cteParams } = buildNightCte(r.from, r.to, room_type, source);
      const [nightsRows] = await connOrPool.query(
        `
        ${cteSql}
        SELECT
          night_date,
          COALESCE(SUM(nightly_rate), 0) AS revenue
        FROM reservation_nights
        WHERE status IN ('checked_in', 'checked_out')
        GROUP BY night_date
      `,
        cteParams
      );

      const revByDate = new Map();
      nightsRows.forEach((row) => {
        const dStr =
          typeof row.night_date === 'string'
            ? row.night_date.slice(0, 10)
            : new Date(row.night_date).toISOString().slice(0, 10);
        revByDate.set(dStr, Number(row.revenue));
      });

      // Fetch all payments in range
      const nextDay = addDays(r.to, 1);
      let paySql = `
        SELECT
          DATE(p.created_at) AS pay_date,
          COALESCE(SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0) AS net_cash
        FROM payments p FORCE INDEX (idx_payments_created)
        JOIN reservations r ON p.reservation_id = r.reservation_id
        JOIN rooms rm ON r.room_id = rm.room_id
        WHERE p.created_at >= ? AND p.created_at < ?
      `;
      const payParams = [`${r.from} 00:00:00`, `${nextDay} 00:00:00`];
      if (room_type) {
        paySql += ' AND rm.room_type = ?';
        payParams.push(room_type);
      }
      if (source) {
        paySql += ' AND r.booking_source = ?';
        payParams.push(source);
      }
      paySql += ' GROUP BY DATE(p.created_at)';
      const [payRows] = await connOrPool.query(paySql, payParams);

      const cashByDate = new Map();
      payRows.forEach((row) => {
        const dStr =
          typeof row.pay_date === 'string'
            ? row.pay_date.slice(0, 10)
            : new Date(row.pay_date).toISOString().slice(0, 10);
        cashByDate.set(dStr, Number(row.net_cash));
      });

      // Aggregate into intervals
      return intervals.map((interval) => {
        let periodRev = 0;
        let periodCash = 0;
        let d = interval.start;
        while (d <= interval.end) {
          periodRev += revByDate.get(d) || 0;
          periodCash += cashByDate.get(d) || 0;
          d = addDays(d, 1);
        }
        return {
          label: interval.label,
          start_date: interval.start,
          end_date: interval.end,
          room_revenue: Number(periodRev.toFixed(2)),
          cash_collected: Number(periodCash.toFixed(2)),
        };
      });
    };

    const dataSeries = await fetchTrend(range);
    let previousSeries = null;
    if (compare_range) {
      previousSeries = await fetchTrend(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      granularity: chosenGranularity,
      generated_at: getHotelTimestampNow(),
      data: dataSeries,
      previous: previousSeries,
    };
  },

  /**
   * 3. GET /api/reports/occupancy-trend
   */
  async getOccupancyTrend(
    connOrPool,
    { from, to, compare = 'none', room_type, source }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const fetchOcc = async (r) => {
      // Active rooms count
      let roomCountQuery = "SELECT COUNT(*) AS total FROM rooms WHERE status != 'maintenance'";
      const roomParams = [];
      if (room_type) {
        roomCountQuery += ' AND room_type = ?';
        roomParams.push(room_type);
      }
      const [[{ total: activeRooms }]] = await connOrPool.query(roomCountQuery, roomParams);
      const totalRoomsAvailable = Number(activeRooms);

      // Night CTE
      const { cteSql, params: cteParams } = buildNightCte(r.from, r.to, room_type, source);
      const [nights] = await connOrPool.query(
        `
        ${cteSql}
        SELECT
          night_date,
          COUNT(CASE WHEN status IN ('checked_in', 'checked_out') THEN 1 END) AS sold,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS forecast
        FROM reservation_nights
        GROUP BY night_date
      `,
        cteParams
      );

      const nightMap = new Map();
      nights.forEach((row) => {
        const dStr =
          typeof row.night_date === 'string'
            ? row.night_date.slice(0, 10)
            : new Date(row.night_date).toISOString().slice(0, 10);
        nightMap.set(dStr, {
          sold: Number(row.sold),
          forecast: Number(row.forecast),
        });
      });

      const series = [];
      for (let i = 0; i < r.days; i++) {
        const dStr = addDays(r.from, i);
        const counts = nightMap.get(dStr) || { sold: 0, forecast: 0 };
        const occPct =
          totalRoomsAvailable > 0
            ? Number(((counts.sold / totalRoomsAvailable) * 100).toFixed(2))
            : 0;

        series.push({
          date: dStr,
          available_nights: totalRoomsAvailable,
          sold_nights: counts.sold,
          forecast_nights: counts.forecast,
          occupancy_pct: occPct,
        });
      }
      return series;
    };

    const data = await fetchOcc(range);
    let previous = null;
    if (compare_range) {
      previous = await fetchOcc(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data,
      previous,
    };
  },

  /**
   * 4. GET /api/reports/reservations-summary
   */
  async getReservationsSummary(
    connOrPool,
    { from, to, compare = 'none', room_type, source }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const fetchSummary = async (r) => {
      const nextDay = addDays(r.to, 1);
      let query = `
        SELECT
          DATE(r.created_at) AS create_date,
          r.status,
          r.booking_source,
          COUNT(*) AS count
        FROM reservations r FORCE INDEX (idx_reservations_created)
        JOIN rooms rm ON r.room_id = rm.room_id
        WHERE r.created_at >= ? AND r.created_at < ?
      `;
      const params = [`${r.from} 00:00:00`, `${nextDay} 00:00:00`];
      if (room_type) {
        query += ' AND rm.room_type = ?';
        params.push(room_type);
      }
      if (source) {
        query += ' AND r.booking_source = ?';
        params.push(source);
      }
      query += ' GROUP BY DATE(r.created_at), r.status, r.booking_source';
      const [rows] = await connOrPool.query(query, params);

      let total = 0;
      const byStatus = {
        pending: 0,
        confirmed: 0,
        checked_in: 0,
        checked_out: 0,
        cancelled: 0,
        no_show: 0,
      };
      const bySource = {
        online: 0,
        reception: 0,
        admin: 0,
      };
      const dailyMap = new Map();

      rows.forEach((row) => {
        const c = Number(row.count);
        total += c;
        if (byStatus[row.status] !== undefined) byStatus[row.status] += c;
        if (bySource[row.booking_source] !== undefined) bySource[row.booking_source] += c;

        const dStr =
          typeof row.create_date === 'string'
            ? row.create_date.slice(0, 10)
            : new Date(row.create_date).toISOString().slice(0, 10);
        dailyMap.set(dStr, (dailyMap.get(dStr) || 0) + c);
      });

      const dailyCreated = [];
      for (let i = 0; i < r.days; i++) {
        const dStr = addDays(r.from, i);
        dailyCreated.push({
          date: dStr,
          created_count: dailyMap.get(dStr) || 0,
        });
      }

      const cancellation_rate_pct =
        total > 0 ? Number(((byStatus.cancelled / total) * 100).toFixed(2)) : 0;

      return {
        total_created: total,
        by_status: byStatus,
        by_source: bySource,
        cancellation_rate_pct,
        no_show_count: byStatus.no_show,
        created_per_day: dailyCreated,
      };
    };

    const data = await fetchSummary(range);
    let previous = null;
    if (compare_range) {
      previous = await fetchSummary(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data,
      previous,
    };
  },

  /**
   * 5. GET /api/reports/room-performance
   */
  async getRoomPerformance(
    connOrPool,
    { from, to, compare = 'none', room_type, source }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const fetchPerformance = async (r) => {
      // 1. Fetch all rooms
      let roomsSql = 'SELECT room_id, room_number, room_type, status, price FROM rooms WHERE 1=1';
      const rParams = [];
      if (room_type) {
        roomsSql += ' AND room_type = ?';
        rParams.push(room_type);
      }
      roomsSql += ' ORDER BY room_number ASC';
      const [rooms] = await connOrPool.query(roomsSql, rParams);

      // 2. Fetch sold nights & revenue per room
      const { cteSql, params: cteParams } = buildNightCte(r.from, r.to, room_type, source);
      const [nightStats] = await connOrPool.query(
        `
        ${cteSql}
        SELECT
          room_id,
          COUNT(CASE WHEN status IN ('checked_in', 'checked_out') THEN 1 END) AS sold_nights,
          COALESCE(SUM(CASE WHEN status IN ('checked_in', 'checked_out') THEN nightly_rate ELSE 0 END), 0) AS room_revenue,
          COUNT(DISTINCT CASE WHEN status IN ('checked_in', 'checked_out') THEN reservation_id END) AS bookings
        FROM reservation_nights
        GROUP BY room_id
      `,
        cteParams
      );

      const statsMap = new Map();
      nightStats.forEach((row) => {
        statsMap.set(row.room_id, {
          sold_nights: Number(row.sold_nights || 0),
          room_revenue: Number(row.room_revenue || 0),
          bookings: Number(row.bookings || 0),
        });
      });

      // Hotel totals
      let totalHotelAvailableNights = 0;
      let totalHotelSoldNights = 0;
      let totalHotelRevenue = 0;

      const roomRows = rooms.map((rm) => {
        const isMaint = rm.status === 'maintenance';
        const availNights = isMaint ? 0 : r.days;
        const st = statsMap.get(rm.room_id) || {
          sold_nights: 0,
          room_revenue: 0,
          bookings: 0,
        };

        const occPct =
          availNights > 0
            ? Number(((st.sold_nights / availNights) * 100).toFixed(2))
            : 0;

        const adrVal =
          st.sold_nights > 0
            ? Number((st.room_revenue / st.sold_nights).toFixed(2))
            : 0;

        totalHotelAvailableNights += availNights;
        totalHotelSoldNights += st.sold_nights;
        totalHotelRevenue += st.room_revenue;

        return {
          room_id: rm.room_id,
          room_number: rm.room_number,
          room_type: rm.room_type,
          status: rm.status,
          base_price: Number(Number(rm.price).toFixed(2)),
          available_nights: availNights,
          sold_nights: st.sold_nights,
          occupancy_pct: occPct,
          room_revenue: Number(st.room_revenue.toFixed(2)),
          adr: adrVal,
          bookings: st.bookings,
        };
      });

      const hotelAvgOccupancy =
        totalHotelAvailableNights > 0
          ? Number(((totalHotelSoldNights / totalHotelAvailableNights) * 100).toFixed(2))
          : 0;

      // Flag rooms whose occupancy is below 50% of the hotel average as underperforming
      const underperformingThreshold = hotelAvgOccupancy * 0.5;
      roomRows.forEach((row) => {
        row.underperforming =
          row.available_nights > 0 && row.occupancy_pct < underperformingThreshold;
      });

      // Group by room type
      const typeMap = new Map();
      roomRows.forEach((rRow) => {
        if (!typeMap.has(rRow.room_type)) {
          typeMap.set(rRow.room_type, {
            room_type: rRow.room_type,
            rooms_count: 0,
            available_nights: 0,
            sold_nights: 0,
            room_revenue: 0,
            bookings: 0,
          });
        }
        const t = typeMap.get(rRow.room_type);
        t.rooms_count += 1;
        t.available_nights += rRow.available_nights;
        t.sold_nights += rRow.sold_nights;
        t.room_revenue += rRow.room_revenue;
        t.bookings += rRow.bookings;
      });

      const roomTypeRows = Array.from(typeMap.values()).map((t) => ({
        room_type: t.room_type,
        rooms_count: t.rooms_count,
        available_nights: t.available_nights,
        sold_nights: t.sold_nights,
        occupancy_pct:
          t.available_nights > 0
            ? Number(((t.sold_nights / t.available_nights) * 100).toFixed(2))
            : 0,
        room_revenue: Number(t.room_revenue.toFixed(2)),
        adr:
          t.sold_nights > 0
            ? Number((t.room_revenue / t.sold_nights).toFixed(2))
            : 0,
        bookings: t.bookings,
      }));

      return {
        hotel_average_occupancy_pct: hotelAvgOccupancy,
        underperforming_threshold_pct: Number(underperformingThreshold.toFixed(2)),
        total_rooms: rooms.length,
        rooms: roomRows,
        room_types: roomTypeRows,
      };
    };

    const data = await fetchPerformance(range);
    let previous = null;
    if (compare_range) {
      previous = await fetchPerformance(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data,
      previous,
    };
  },

  /**
   * 6. GET /api/reports/customers
   */
  async getCustomersReport(
    connOrPool,
    { from, to, compare = 'none', room_type, source }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const fetchCust = async (r) => {
      const nextDay = addDays(r.to, 1);
      let query = `
        SELECT
          r.reservation_id,
          r.customer_id,
          c.name AS customer_name,
          c.email,
          c.phone,
          r.total_amount,
          rm.room_type,
          (SELECT MIN(r0.created_at) FROM reservations r0 WHERE r0.customer_id = r.customer_id) AS first_created_at
        FROM reservations r FORCE INDEX (idx_reservations_created)
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN rooms rm ON r.room_id = rm.room_id
        WHERE r.created_at >= ? AND r.created_at < ?
          AND r.status != 'cancelled'
      `;
      const params = [`${r.from} 00:00:00`, `${nextDay} 00:00:00`];
      if (room_type) {
        query += ' AND rm.room_type = ?';
        params.push(room_type);
      }
      if (source) {
        query += ' AND r.booking_source = ?';
        params.push(source);
      }
      const [rows] = await connOrPool.query(query, params);

      const customerMap = new Map();
      let totalBookingValue = 0;
      const roomTypeCounts = {};

      for (const row of rows) {
        totalBookingValue += Number(row.total_amount || 0);
        roomTypeCounts[row.room_type] = (roomTypeCounts[row.room_type] || 0) + 1;

        if (!customerMap.has(row.customer_id)) {
          const firstDateStr = new Date(row.first_created_at)
            .toISOString()
            .slice(0, 10);
          const isNew = firstDateStr >= r.from && firstDateStr <= r.to;

          customerMap.set(row.customer_id, {
            customer_id: row.customer_id,
            name: row.customer_name,
            email: row.email,
            phone: row.phone,
            is_new: isNew,
            reservations_count: 0,
            total_spent: 0,
          });
        }

        const cEntry = customerMap.get(row.customer_id);
        cEntry.reservations_count += 1;
        cEntry.total_spent += Number(row.total_amount || 0);
      }

      let newCount = 0;
      let retCount = 0;
      customerMap.forEach((entry) => {
        if (entry.is_new) newCount++;
        else retCount++;
        entry.total_spent = Number(entry.total_spent.toFixed(2));
      });

      const totalActive = newCount + retCount;
      const repeat_rate_pct =
        totalActive > 0 ? Number(((retCount / totalActive) * 100).toFixed(1)) : 0;
      const avg_booking_value =
        rows.length > 0 ? Number((totalBookingValue / rows.length).toFixed(2)) : 0;

      const top_room_types = Object.entries(roomTypeCounts)
        .map(([type, count]) => ({ room_type: type, bookings: count }))
        .sort((a, b) => b.bookings - a.bookings);

      const top_customers = Array.from(customerMap.values())
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);

      return {
        new_customers_count: newCount,
        returning_customers_count: retCount,
        total_active_customers: totalActive,
        repeat_rate_pct,
        avg_booking_value,
        top_room_types,
        top_customers,
      };
    };

    const data = await fetchCust(range);
    let previous = null;
    if (compare_range) {
      previous = await fetchCust(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data,
      previous,
    };
  },

  /**
   * 7. GET /api/reports/payments
   */
  async getPaymentsReport(
    connOrPool,
    { from, to, compare = 'none', room_type, source }
  ) {
    const { range, compare_range } = resolveRangeAndCompare(from, to, compare);

    const fetchPay = async (r) => {
      const nextDay = addDays(r.to, 1);
      let query = `
        SELECT
          p.payment_id,
          p.amount,
          p.kind,
          p.method,
          p.reference,
          p.note,
          DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          r.booking_ref,
          c.name AS customer_name
        FROM payments p FORCE INDEX (idx_payments_created)
        JOIN reservations r ON p.reservation_id = r.reservation_id
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN rooms rm ON r.room_id = rm.room_id
        WHERE p.created_at >= ? AND p.created_at < ?
      `;
      const params = [`${r.from} 00:00:00`, `${nextDay} 00:00:00`];
      if (room_type) {
        query += ' AND rm.room_type = ?';
        params.push(room_type);
      }
      if (source) {
        query += ' AND r.booking_source = ?';
        params.push(source);
      }
      query += ' ORDER BY p.created_at DESC';

      const [rows] = await connOrPool.query(query, params);

      let paymentsTotal = 0;
      let refundsTotal = 0;
      let paymentsCount = 0;
      let refundsCount = 0;

      const breakdown = {
        cash: 0,
        card: 0,
        bank_transfer: 0,
        online: 0,
      };

      for (const row of rows) {
        const amt = Number(row.amount);
        if (row.kind === 'payment') {
          paymentsTotal += amt;
          paymentsCount++;
          if (breakdown[row.method] !== undefined) breakdown[row.method] += amt;
        } else if (row.kind === 'refund') {
          refundsTotal += amt;
          refundsCount++;
          if (breakdown[row.method] !== undefined) breakdown[row.method] -= amt;
        }
      }

      const cash_collected = Number((paymentsTotal - refundsTotal).toFixed(2));

      return {
        cash_collected,
        total_payments_amount: Number(paymentsTotal.toFixed(2)),
        total_refunds_amount: Number(refundsTotal.toFixed(2)),
        payments_count: paymentsCount,
        refunds_count: refundsCount,
        payment_method_breakdown: {
          cash: Number(breakdown.cash.toFixed(2)),
          card: Number(breakdown.card.toFixed(2)),
          bank_transfer: Number(breakdown.bank_transfer.toFixed(2)),
          online: Number(breakdown.online.toFixed(2)),
        },
        recent_transactions: rows.slice(0, 50).map((rRow) => ({
          ...rRow,
          amount: Number(Number(rRow.amount).toFixed(2)),
        })),
      };
    };

    const data = await fetchPay(range);
    let previous = null;
    if (compare_range) {
      previous = await fetchPay(compare_range);
    }

    return {
      range,
      compare_range,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data,
      previous,
    };
  },

  /**
   * 8. GET /api/reports/operations
   */
  async getOperationsReport(connOrPool, { room_type, source } = {}) {
    const todayStr = today();

    // 1. Arrivals today
    let arrivalsSql = `
      SELECT
        r.reservation_id, r.booking_ref, c.name AS guest_name, c.phone,
        rm.room_number, rm.room_type, r.check_in_date, r.check_out_date,
        r.status, r.total_amount
      FROM reservations r FORCE INDEX (idx_reservations_status_checkin)
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.check_in_date = ? AND r.status = 'confirmed'
    `;
    const arrParams = [todayStr];
    if (room_type) {
      arrivalsSql += ' AND rm.room_type = ?';
      arrParams.push(room_type);
    }
    if (source) {
      arrivalsSql += ' AND r.booking_source = ?';
      arrParams.push(source);
    }
    arrivalsSql += ' ORDER BY rm.room_number ASC';
    const [arrivals] = await connOrPool.query(arrivalsSql, arrParams);

    // 2. Departures today
    let depSql = `
      SELECT
        r.reservation_id, r.booking_ref, c.name AS guest_name, c.phone,
        rm.room_number, rm.room_type, r.check_in_date, r.check_out_date,
        r.status, r.total_amount
      FROM reservations r FORCE INDEX (idx_reservations_checkout)
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.check_out_date = ? AND r.status = 'checked_in'
    `;
    const depParams = [todayStr];
    if (room_type) {
      depSql += ' AND rm.room_type = ?';
      depParams.push(room_type);
    }
    if (source) {
      depSql += ' AND r.booking_source = ?';
      depParams.push(source);
    }
    depSql += ' ORDER BY rm.room_number ASC';
    const [departures] = await connOrPool.query(depSql, depParams);

    // 3. In-house guests
    let inHouseSql = `
      SELECT
        r.reservation_id, r.booking_ref, c.name AS guest_name, c.phone,
        rm.room_number, rm.room_type, r.check_in_date, r.check_out_date,
        r.status, r.total_amount
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.status = 'checked_in'
    `;
    const ihParams = [];
    if (room_type) {
      inHouseSql += ' AND rm.room_type = ?';
      ihParams.push(room_type);
    }
    if (source) {
      inHouseSql += ' AND r.booking_source = ?';
      ihParams.push(source);
    }
    inHouseSql += ' ORDER BY rm.room_number ASC';
    const [inHouse] = await connOrPool.query(inHouseSql, ihParams);

    // 4. Unpaid bills with positive balance
    let unpaidSql = `
      SELECT
        r.reservation_id, r.booking_ref, c.name AS guest_name, c.phone,
        rm.room_number, rm.room_type, r.status, r.payment_status,
        r.total_amount,
        COALESCE((
          SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
          FROM payments p WHERE p.reservation_id = r.reservation_id
        ), 0) AS net_paid
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.status IN ('checked_in', 'checked_out')
    `;
    const upParams = [];
    if (room_type) {
      unpaidSql += ' AND rm.room_type = ?';
      upParams.push(room_type);
    }
    if (source) {
      unpaidSql += ' AND r.booking_source = ?';
      upParams.push(source);
    }
    const [upRows] = await connOrPool.query(unpaidSql, upParams);

    const unpaidBills = [];
    upRows.forEach((row) => {
      const tot = Number(row.total_amount);
      const paid = Number(row.net_paid);
      const bal = Number((tot - paid).toFixed(2));
      if (bal > 0) {
        unpaidBills.push({
          reservation_id: row.reservation_id,
          booking_ref: row.booking_ref,
          guest_name: row.guest_name,
          phone: row.phone,
          room_number: row.room_number,
          room_type: row.room_type,
          status: row.status,
          payment_status: row.payment_status,
          total_amount: tot,
          net_paid: paid,
          balance: bal,
        });
      }
    });

    unpaidBills.sort((a, b) => b.balance - a.balance);

    // 5. Reconciliation list: stored payment_status vs calculated from payments
    let reconSql = `
      SELECT
        r.reservation_id,
        r.booking_ref,
        c.name AS guest_name,
        r.status AS reservation_status,
        r.payment_status AS stored_payment_status,
        r.total_amount,
        COALESCE((
          SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
          FROM payments p WHERE p.reservation_id = r.reservation_id
        ), 0) AS net_paid
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      WHERE r.status != 'cancelled'
    `;
    const [reconRows] = await connOrPool.query(reconSql);

    const reconciliationDiscrepancies = [];
    reconRows.forEach((rRow) => {
      const tot = Number(rRow.total_amount);
      const netPaid = Number(rRow.net_paid);

      let expectedStatus = 'unpaid';
      if (netPaid >= tot && tot > 0) {
        expectedStatus = 'paid';
      } else if (netPaid > 0 && netPaid < tot) {
        expectedStatus = 'partial';
      } else if (netPaid <= 0) {
        expectedStatus = 'unpaid';
      }

      if (rRow.stored_payment_status !== expectedStatus) {
        reconciliationDiscrepancies.push({
          reservation_id: rRow.reservation_id,
          booking_ref: rRow.booking_ref,
          guest_name: rRow.guest_name,
          reservation_status: rRow.reservation_status,
          stored_payment_status: rRow.stored_payment_status,
          expected_payment_status: expectedStatus,
          total_amount: tot,
          net_paid: netPaid,
          balance: Number((tot - netPaid).toFixed(2)),
          discrepancy: `Stored status '${rRow.stored_payment_status}' but net paid is LKR ${netPaid.toFixed(
            2
          )} of total LKR ${tot.toFixed(2)} (expected '${expectedStatus}')`,
        });
      }
    });

    return {
      range: { from: todayStr, to: todayStr, days: 1 },
      compare_range: null,
      filters: { room_type: room_type || null, source: source || null },
      generated_at: getHotelTimestampNow(),
      data: {
        today: todayStr,
        arrivals_today_count: arrivals.length,
        arrivals_today: arrivals,
        departures_today_count: departures.length,
        departures_today: departures,
        in_house_count: inHouse.length,
        in_house: inHouse,
        unpaid_bills_count: unpaidBills.length,
        unpaid_bills: unpaidBills,
        reconciliation_discrepancies_count: reconciliationDiscrepancies.length,
        reconciliation_discrepancies: reconciliationDiscrepancies,
      },
      previous: null,
    };
  },

  /**
   * 9. GET /api/reports/reservations
   * Drill-down table: filters status, payment_status, source, room_type, q; sort; page, limit up to 100
   * returns rows plus totals for the filtered set
   */
  async getReservationsDrilldown(
    connOrPool,
    {
      from,
      to,
      status,
      payment_status,
      source,
      room_type,
      q,
      sort = 'created_at',
      sort_dir = 'desc',
      page = 1,
      limit = 50,
    }
  ) {
    const { range } = resolveRangeAndCompare(from, to, 'none');
    const nextDay = addDays(range.to, 1);

    const lim = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
    const p = Math.max(1, parseInt(page, 10) || 1);
    const offset = (p - 1) * lim;

    let baseFilter = `
      WHERE (
        (r.created_at >= ? AND r.created_at < ?)
        OR (r.check_in_date <= ? AND r.check_out_date >= ?)
      )
    `;
    const filterParams = [
      `${range.from} 00:00:00`,
      `${nextDay} 00:00:00`,
      range.to,
      range.from,
    ];

    if (status) {
      baseFilter += ' AND r.status = ?';
      filterParams.push(status);
    }
    if (payment_status) {
      baseFilter += ' AND r.payment_status = ?';
      filterParams.push(payment_status);
    }
    if (source) {
      baseFilter += ' AND r.booking_source = ?';
      filterParams.push(source);
    }
    if (room_type) {
      baseFilter += ' AND rm.room_type = ?';
      filterParams.push(room_type);
    }
    if (q) {
      const wildcard = `%${q.trim()}%`;
      baseFilter += `
        AND (
          r.booking_ref LIKE ?
          OR c.name LIKE ?
          OR c.email LIKE ?
          OR c.phone LIKE ?
          OR rm.room_number LIKE ?
        )
      `;
      filterParams.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    // 1. Totals query
    const totalsQuery = `
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(r.total_amount), 0) AS total_amount,
        COALESCE(SUM(DATEDIFF(r.check_out_date, r.check_in_date)), 0) AS total_nights,
        COALESCE(SUM(
          COALESCE((
            SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
            FROM payments p WHERE p.reservation_id = r.reservation_id
          ), 0)
        ), 0) AS total_net_paid
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      ${baseFilter}
    `;
    const [[totalsRes]] = await connOrPool.query(totalsQuery, filterParams);

    const totalCount = Number(totalsRes.total_count || 0);
    const totalAmount = Number(Number(totalsRes.total_amount || 0).toFixed(2));
    const totalNetPaid = Number(Number(totalsRes.total_net_paid || 0).toFixed(2));
    const totalBalance = Number((totalAmount - totalNetPaid).toFixed(2));
    const totalNights = Number(totalsRes.total_nights || 0);

    // 2. Rows query
    const validSortFields = {
      created_at: 'r.created_at',
      check_in_date: 'r.check_in_date',
      check_out_date: 'r.check_out_date',
      total_amount: 'r.total_amount',
      booking_ref: 'r.booking_ref',
      guest_name: 'c.name',
      room_number: 'rm.room_number',
    };
    const sortColumn = validSortFields[sort] || 'r.created_at';
    const direction = String(sort_dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const rowsQuery = `
      SELECT
        r.reservation_id,
        r.booking_ref,
        c.customer_id,
        c.name AS guest_name,
        c.email AS guest_email,
        c.phone AS guest_phone,
        rm.room_id,
        rm.room_number,
        rm.room_type,
        DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
        DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
        DATEDIFF(r.check_out_date, r.check_in_date) AS nights,
        r.guests,
        r.nightly_rate,
        r.total_amount,
        r.status,
        r.payment_status,
        r.booking_source,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        COALESCE((
          SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
          FROM payments p WHERE p.reservation_id = r.reservation_id
        ), 0) AS net_paid
      FROM reservations r
      JOIN customers c ON r.customer_id = c.customer_id
      JOIN rooms rm ON r.room_id = rm.room_id
      ${baseFilter}
      ORDER BY ${sortColumn} ${direction}
      LIMIT ? OFFSET ?
    `;

    const rowParams = [...filterParams, lim, offset];
    const [rows] = await connOrPool.query(rowsQuery, rowParams);

    const formattedRows = rows.map((rRow) => {
      const tot = Number(rRow.total_amount);
      const paid = Number(rRow.net_paid);
      return {
        ...rRow,
        nightly_rate: Number(Number(rRow.nightly_rate).toFixed(2)),
        total_amount: tot,
        net_paid: paid,
        balance: Number((tot - paid).toFixed(2)),
        nights: Number(rRow.nights),
        guests: Number(rRow.guests),
      };
    });

    return {
      range,
      compare_range: null,
      filters: {
        status: status || null,
        payment_status: payment_status || null,
        source: source || null,
        room_type: room_type || null,
        q: q || null,
      },
      generated_at: getHotelTimestampNow(),
      data: {
        rows: formattedRows,
        totals: {
          total_count: totalCount,
          total_amount: totalAmount,
          total_net_paid: totalNetPaid,
          total_balance: totalBalance,
          total_nights: totalNights,
        },
        pagination: {
          page: p,
          limit: lim,
          total_pages: Math.max(1, Math.ceil(totalCount / lim)),
          total_count: totalCount,
        },
      },
      previous: null,
    };
  },
};
