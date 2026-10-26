const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const TEST_DB_NAME = 'hotel_reservation_test';

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      current += char;
      if (char === '\\') {
        current += next || '';
        i++;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

async function setupTestDb(options = { reset: true }) {
  console.log(`Setting up test database: ${TEST_DB_NAME}...`);
  const rootConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  if (options.reset) {
    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  }
  await rootConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await rootConn.end();

  const testPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
    dateStrings: ['DATE'],
    timezone: '+05:30',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Ensure schema_migrations table
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
    .sort();

  for (const filename of allFiles) {
    const filePath = path.join(migrationsDir, filename);
    if (filename.endsWith('.sql')) {
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const statements = splitSqlStatements(sqlContent);
      for (const statement of statements) {
        if (statement.trim()) {
          await testPool.query(statement);
        }
      }
    } else if (filename.endsWith('.js')) {
      const migration = require(filePath);
      if (typeof migration.up === 'function') {
        await migration.up(testPool);
      }
    }
    await testPool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [filename]);
  }

  console.log(`✅ Test database ${TEST_DB_NAME} initialized and migrated successfully.`);
  await testPool.end();
}

if (require.main === module) {
  setupTestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Failed to setup test database:', err);
      process.exit(1);
    });
}

module.exports = { setupTestDb, TEST_DB_NAME };
