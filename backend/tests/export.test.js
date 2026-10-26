const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../src/server');
const { cleanDb, closeDb } = require('./helpers/db');
const {
  createStaffUser,
  createCustomer,
  createRoom,
  createReservation,
  createPayment,
} = require('./helpers/factories');

describe('7. Report Export Test Suite', () => {
  let adminToken;
  let receptionToken;

  beforeEach(async () => {
    await cleanDb();
    const admin = await createStaffUser('admin');
    const reception = await createStaffUser('reception');
    adminToken = admin.token;
    receptionToken = reception.token;
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it('reception gets 403', async () => {
    const res = await request(app)
      .get('/api/reports/export?report=overview&format=csv&from=2026-10-01&to=2026-10-26')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied|insufficient permissions/i);
  });

  it('a cell starting with "=" is neutralised against formula injection in CSV', async () => {
    const room = await createRoom({ room_number: '701', price: 15000.0 });
    // Customer with formula in name
    const maliciousName = '=HYPERLINK("http://attacker.test/steal", "Win Free Stay")';
    const cust = await createCustomer({
      name: maliciousName,
      email: 'formula_guest@luxestay.test',
    });

    await createReservation({
      customer_id: cust.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-10-10',
      check_out_date: '2026-10-12',
      status: 'confirmed',
    });

    const csvRes = await request(app)
      .get('/api/reports/export?report=reservations&format=csv&from=2026-10-01&to=2026-10-26')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(csvRes.status).toBe(200);
    const csvContent = csvRes.text;

    // Must find cell prefixed with a single quote "'" and quotes escaped for CSV
    expect(csvContent).toContain(`"'=HYPERLINK(\"\"http://attacker.test/steal\"\", \"\"Win Free Stay\"\")"`);
    // Must NOT contain unquoted unescaped formula cell starting with raw =
    expect(csvContent).not.toMatch(new RegExp(`,"${maliciousName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  });

  it('for the same filters the totals in CSV, XLSX (parsed back with xlsx) and the JSON report are equal', async () => {
    const room = await createRoom({ room_number: '702', price: 12000.0 });
    const cust = await createCustomer({ name: 'Export Test Guest', email: 'export_guest@luxestay.test' });

    // Res 1: 3 nights = 36,000, paid 36,000
    const res1 = await createReservation({
      customer_id: cust.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-10-05',
      check_out_date: '2026-10-08',
      nightly_rate: 12000.0,
      total_amount: 36000.0,
      status: 'checked_out',
    });
    await createPayment({ reservation_id: res1.reservation_id, amount: 36000.0, method: 'cash' });

    // Res 2: 2 nights = 24,000, paid 10,000
    const res2 = await createReservation({
      customer_id: cust.customer_id,
      room_id: room.room_id,
      check_in_date: '2026-10-15',
      check_out_date: '2026-10-17',
      nightly_rate: 12000.0,
      total_amount: 24000.0,
      status: 'confirmed',
    });
    await createPayment({ reservation_id: res2.reservation_id, amount: 10000.0, method: 'card' });

    const queryParams = 'report=reservations&from=2026-10-01&to=2026-10-26';

    // 1. JSON Report
    const jsonRes = await request(app)
      .get(`/api/reports/reservations?from=2026-10-01&to=2026-10-26`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(jsonRes.status).toBe(200);

    const jsonTotals = jsonRes.body.data.totals;
    const expectedCount = jsonTotals.total_count; // 2
    const expectedAmount = jsonTotals.total_amount; // 60,000
    const expectedPaid = jsonTotals.total_net_paid; // 46,000
    const expectedBalance = jsonTotals.total_balance; // 14,000

    expect(expectedCount).toBe(2);
    expect(expectedAmount).toBe(60000);
    expect(expectedPaid).toBe(46000);
    expect(expectedBalance).toBe(14000);

    // 2. CSV Export
    const csvRes = await request(app)
      .get(`/api/reports/export?${queryParams}&format=csv`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);

    const csvLines = csvRes.text.split('\n').map((l) => l.trim()).filter(Boolean);
    const totalsLine = csvLines.find((l) => l.startsWith('"TOTALS"') || l.includes('TOTALS'));
    expect(totalsLine).toBeDefined();

    // Check that totals in CSV match
    expect(totalsLine).toContain(`${expectedCount} bookings`);
    expect(totalsLine).toContain(String(expectedAmount));
    expect(totalsLine).toContain(String(expectedPaid));
    expect(totalsLine).toContain(String(expectedBalance));

    // 3. XLSX Export
    const xlsxRes = await request(app)
      .get(`/api/reports/export?${queryParams}&format=xlsx`)
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob');
    expect(xlsxRes.status).toBe(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxRes.body);
    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain('Summary');
    expect(sheetNames).toContain('Data');

    const dataSheet = workbook.getWorksheet('Data');
    const rows = [];
    dataSheet.eachRow((row) => {
      rows.push(row.values);
    });

    // Find TOTALS row at the bottom of the data sheet
    const xlsxTotalsRow = rows.find((r) => Array.isArray(r) && r.some((c) => String(c).includes('TOTALS')));
    expect(xlsxTotalsRow).toBeDefined();

    // Ensure totals values are present and identical in XLSX
    expect(xlsxTotalsRow).toContain(`${expectedCount} bookings`);
    expect(xlsxTotalsRow).toContain(expectedAmount);
    expect(xlsxTotalsRow).toContain(expectedPaid);
    expect(xlsxTotalsRow).toContain(expectedBalance);
  });
});
