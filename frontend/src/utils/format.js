// format.js — Currency and date formatting utilities for LuxeStay

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format a number as LKR currency.
 * Shows 2 decimal places only when the amount has cents.
 */
export function formatLKR(n) {
  const num = Number(n);
  if (isNaN(num)) return 'LKR 0';
  const hasCents = (Math.abs(num * 100 - Math.round(num) * 100) >= 0.01) || (num % 1 !== 0);
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(num);
}

/**
 * Format a 'YYYY-MM-DD' date string as e.g. '10 Nov 2026'.
 * Splits the string to avoid timezone shifts and never calls new Date(string) on date-only strings.
 */
export function formatDate(s) {
  if (!s || typeof s !== 'string') return '—';
  const clean = s.split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return s;
  const [year, month, day] = parts;
  const m = MONTH_NAMES[parseInt(month, 10) - 1];
  if (!m) return s;
  return `${day} ${m} ${year}`;
}

/**
 * Format an ISO date-time string in hotel timezone (Asia/Colombo).
 */
export function formatDateTime(isoString, timeZone = 'Asia/Colombo') {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return new Intl.DateTimeFormat('en-LK', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(isoString);
  }
}

/**
 * Calculate integer nights between two 'YYYY-MM-DD' dates.
 * A stay occupies nights from check_in_date up to but not including check_out_date.
 */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut || typeof checkIn !== 'string' || typeof checkOut !== 'string') {
    return 0;
  }
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  if ([y1, m1, d1, y2, m2, d2].some(isNaN)) return 0;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((utc2 - utc1) / msPerDay));
}

/**
 * Returns today's date in 'YYYY-MM-DD' for the hotel timezone (Asia/Colombo).
 */
export function todayISO(timeZone = 'Asia/Colombo') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}
