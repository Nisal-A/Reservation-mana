// backend/scripts/check-indexes.js
// Runs EXPLAIN queries to verify indexes on reservations table.

process.env.NODE_ENV = 'test';
const pool = require('../src/config/db');

async function runExplain() {
  console.log('='.repeat(80));
  console.log('  EXPLAIN INDEX VERIFICATION FOR RESERVATIONS');
  console.log('='.repeat(80));

  const queries = [
    {
      label: '1. Reservations by Status',
      sql: "EXPLAIN SELECT * FROM reservations WHERE status = 'confirmed'",
    },
    {
      label: '2. Reservations by Dates',
      sql: "EXPLAIN SELECT * FROM reservations WHERE check_in_date < '2026-10-20' AND check_out_date > '2026-10-10'",
    },
    {
      label: '3. Reservations by Customer',
      sql: 'EXPLAIN SELECT * FROM reservations WHERE customer_id = 1',
    },
    {
      label: '4. Reservations by Room and Dates',
      sql: "EXPLAIN SELECT * FROM reservations WHERE room_id = 1 AND check_in_date < '2026-10-20' AND check_out_date > '2026-10-10'",
    },
  ];

  for (const q of queries) {
    console.log(`\n▶ ${q.label}`);
    console.log(`Query: ${q.sql}`);
    const [rows] = await pool.query(q.sql);
    for (const r of rows) {
      console.log(`  Table: ${r.table} | Type: ${r.type} | Possible Keys: ${r.possible_keys} | Key: ${r.key} | Ref: ${r.ref} | Rows: ${r.rows}`);
    }
  }

  console.log('\n▶ Indexes on reservations table:');
  const [indexes] = await pool.query('SHOW INDEX FROM reservations');
  const indexSummary = {};
  for (const idx of indexes) {
    if (!indexSummary[idx.Key_name]) indexSummary[idx.Key_name] = [];
    indexSummary[idx.Key_name].push(idx.Column_name);
  }
  for (const [name, cols] of Object.entries(indexSummary)) {
    console.log(`  - ${name}: (${cols.join(', ')})`);
  }

  console.log('\n' + '='.repeat(80));
  await pool.end();
}

runExplain().catch((err) => {
  console.error('Error running EXPLAIN:', err);
  process.exit(1);
});
