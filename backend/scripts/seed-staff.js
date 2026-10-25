const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');
const env = require('../src/config/env');

async function seedStaff() {
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  const adminPassword = env.ADMIN_PASSWORD || 'admin';
  const receptionUsername = env.RECEPTION_USERNAME || 'reception';
  const receptionPassword = env.RECEPTION_PASSWORD || 'password';

  console.log('Seeding staff users...');

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
  const hashedReceptionPassword = await bcrypt.hash(receptionPassword, 12);

  // Admin user
  const [adminRows] = await pool.query('SELECT user_id FROM users WHERE username = ?', [adminUsername]);
  if (adminRows.length > 0) {
    await pool.query('UPDATE users SET password = ?, role = ? WHERE username = ?', [
      hashedAdminPassword,
      'admin',
      adminUsername,
    ]);
    console.log(`Updated admin user '${adminUsername}'.`);
  } else {
    await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
      adminUsername,
      hashedAdminPassword,
      'admin',
    ]);
    console.log(`Created admin user '${adminUsername}'.`);
  }

  // Reception user
  const [receptionRows] = await pool.query('SELECT user_id FROM users WHERE username = ?', [receptionUsername]);
  if (receptionRows.length > 0) {
    await pool.query('UPDATE users SET password = ?, role = ? WHERE username = ?', [
      hashedReceptionPassword,
      'reception',
      receptionUsername,
    ]);
    console.log(`Updated reception user '${receptionUsername}'.`);
  } else {
    await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
      receptionUsername,
      hashedReceptionPassword,
      'reception',
    ]);
    console.log(`Created reception user '${receptionUsername}'.`);
  }

  console.log('✅ Staff users seeded successfully.');
  process.exit(0);
}

seedStaff().catch((err) => {
  console.error('❌ Error seeding staff users:', err);
  process.exit(1);
});
