const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

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

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // 1. Create schema_migrations table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Fetch applied migrations
  const [rows] = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename ASC');
  const appliedSet = new Set(rows.map((r) => r.filename));

  // 3. Read migration files
  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
    .sort();

  const unappliedFiles = allFiles.filter((f) => !appliedSet.has(f));

  if (unappliedFiles.length === 0) {
    console.log('nothing to apply');
    process.exit(0);
  }

  for (const filename of unappliedFiles) {
    const filePath = path.join(migrationsDir, filename);
    console.log(`Applying migration: ${filename}...`);

    try {
      if (filename.endsWith('.sql')) {
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        const statements = splitSqlStatements(sqlContent);
        for (const statement of statements) {
          if (statement) {
            await pool.query(statement);
          }
        }
      } else if (filename.endsWith('.js')) {
        const migration = require(filePath);
        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${filename} does not export an 'up(pool)' function.`);
        }
        await migration.up(pool);
      }

      // Record migration
      await pool.query('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
      console.log(`Applied: ${filename}`);
    } catch (err) {
      console.error(`❌ Migration failed at ${filename}:`, err.message || err);
      process.exit(1);
    }
  }

  console.log('✅ All migrations applied successfully.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Migration runner fatal error:', err);
  process.exit(1);
});
