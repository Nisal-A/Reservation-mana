const env = require('../config/env');

function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  const [year, month, day] = s.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function today(timeZone = env.HOTEL_TIMEZONE) {
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

function addDays(s, n) {
  if (!isValidDateString(s)) {
    throw new Error(`Invalid date string: ${s}`);
  }
  const [year, month, day] = s.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

function nightsBetween(checkIn, checkOut) {
  if (!isValidDateString(checkIn) || !isValidDateString(checkOut)) {
    throw new Error(`Invalid date strings: checkIn=${checkIn}, checkOut=${checkOut}`);
  }
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

function eachNight(checkIn, checkOut) {
  const count = nightsBetween(checkIn, checkOut);
  if (count <= 0) return [];
  const nights = [];
  for (let i = 0; i < count; i++) {
    nights.push(addDays(checkIn, i));
  }
  return nights;
}

module.exports = {
  today,
  isValidDateString,
  addDays,
  nightsBetween,
  eachNight,
};
