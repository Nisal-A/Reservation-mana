const request = require('supertest');
const app = require('../src/server');
const { cleanDb, closeDb } = require('./helpers/db');
const {
  createStaffUser,
  createCustomer,
  createRoom,
  createReservation,
} = require('./helpers/factories');
const {
  today,
  nightsBetween,
  eachNight,
  isValidDateString,
  addDays,
} = require('../src/utils/dates');

describe('8. Dates & Calendar Test Suite', () => {
  let receptionToken;

  beforeEach(async () => {
    await cleanDb();
    const reception = await createStaffUser('reception');
    receptionToken = reception.token;
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  describe('nightsBetween', () => {
    it('calculates nights accurately between dates', () => {
      expect(nightsBetween('2026-10-01', '2026-10-05')).toBe(4);
      expect(nightsBetween('2026-10-01', '2026-10-02')).toBe(1);
      expect(nightsBetween('2026-10-01', '2026-10-01')).toBe(0);
      expect(nightsBetween('2026-10-05', '2026-10-01')).toBe(-4);
    });

    it('handles leap years and month/year boundaries accurately', () => {
      // 2024 is a leap year (Feb 29 exists)
      expect(nightsBetween('2024-02-28', '2024-03-01')).toBe(2);
      // 2026 is non-leap year (Feb 28 days)
      expect(nightsBetween('2026-02-28', '2026-03-01')).toBe(1);
      // Year boundary
      expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
    });

    it('throws on invalid date strings', () => {
      expect(() => nightsBetween('invalid-date', '2026-10-05')).toThrow(/invalid date string/i);
      expect(() => nightsBetween('2026-10-01', '2026-02-31')).toThrow(/invalid date string/i);
    });
  });

  describe('eachNight', () => {
    it('returns an array of dates up to but NOT including check-out date', () => {
      const nights = eachNight('2026-10-10', '2026-10-14');
      expect(nights).toEqual([
        '2026-10-10',
        '2026-10-11',
        '2026-10-12',
        '2026-10-13',
      ]);
      expect(nights).not.toContain('2026-10-14');
      expect(nights.length).toBe(nightsBetween('2026-10-10', '2026-10-14'));
    });

    it('returns empty array when check_out <= check_in', () => {
      expect(eachNight('2026-10-10', '2026-10-10')).toEqual([]);
      expect(eachNight('2026-10-12', '2026-10-10')).toEqual([]);
    });

    it('spans month boundaries accurately', () => {
      const nights = eachNight('2026-01-30', '2026-02-02');
      expect(nights).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
    });
  });

  describe('today()', () => {
    it('returns a valid YYYY-MM-DD date string', () => {
      const t = today();
      expect(isValidDateString(t)).toBe(true);
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('respects different timezones across midnight', () => {
      // Create a fixed point in time: 2026-10-26 21:00:00 UTC
      // At this instant:
      // UTC is 2026-10-26
      // Asia/Colombo (+5:30) is 2026-10-27 02:30:00
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-26T21:00:00.000Z'));

      try {
        const utcDate = today('UTC');
        const colomboDate = today('Asia/Colombo');

        expect(utcDate).toBe('2026-10-26');
        expect(colomboDate).toBe('2026-10-27');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('calendar output with TZ=Asia/Colombo and TZ=UTC', () => {
    it('produces identical, timezone-safe calendar outputs regardless of process.env.TZ', async () => {
      const room = await createRoom({ room_number: '801', price: 15000.0 });
      const cust = await createCustomer({ name: 'Calendar Guest', email: 'cal_guest@luxestay.test' });

      // Stay from 2026-10-10 to 2026-10-13 (occupies nights 10, 11, 12; check out on 13)
      await createReservation({
        customer_id: cust.customer_id,
        room_id: room.room_id,
        check_in_date: '2026-10-10',
        check_out_date: '2026-10-13',
        status: 'confirmed',
      });

      const initialTZ = process.env.TZ;

      // 1. Run with TZ=Asia/Colombo
      process.env.TZ = 'Asia/Colombo';
      const colomboRes = await request(app)
        .get('/api/calendar?year=2026&month=10')
        .set('Authorization', `Bearer ${receptionToken}`);

      expect(colomboRes.status).toBe(200);
      expect(colomboRes.body.days_in_month).toBe(31);

      const colomboRoom = colomboRes.body.rooms.find((r) => r.room_number === '801');
      expect(colomboRoom).toBeDefined();

      // Check days status in Colombo
      const day10Colombo = colomboRoom.days.find((d) => d.date === '2026-10-10');
      const day11Colombo = colomboRoom.days.find((d) => d.date === '2026-10-11');
      const day12Colombo = colomboRoom.days.find((d) => d.date === '2026-10-12');
      const day13Colombo = colomboRoom.days.find((d) => d.date === '2026-10-13');

      expect(day10Colombo.status).toBe('reserved');
      expect(day11Colombo.status).toBe('reserved');
      expect(day12Colombo.status).toBe('reserved');
      expect(day13Colombo.status).toBe('available');

      // 2. Run with TZ=UTC
      process.env.TZ = 'UTC';
      const utcRes = await request(app)
        .get('/api/calendar?year=2026&month=10')
        .set('Authorization', `Bearer ${receptionToken}`);

      expect(utcRes.status).toBe(200);
      expect(utcRes.body.days_in_month).toBe(31);

      const utcRoom = utcRes.body.rooms.find((r) => r.room_number === '801');
      expect(utcRoom).toBeDefined();

      const day10UTC = utcRoom.days.find((d) => d.date === '2026-10-10');
      const day11UTC = utcRoom.days.find((d) => d.date === '2026-10-11');
      const day12UTC = utcRoom.days.find((d) => d.date === '2026-10-12');
      const day13UTC = utcRoom.days.find((d) => d.date === '2026-10-13');

      expect(day10UTC.status).toBe('reserved');
      expect(day11UTC.status).toBe('reserved');
      expect(day12UTC.status).toBe('reserved');
      expect(day13UTC.status).toBe('available');

      // 3. Compare full JSON structures between Colombo and UTC runs
      expect(utcRes.body).toEqual(colomboRes.body);

      // Restore initial TZ
      process.env.TZ = initialTZ;
    });
  });
});
