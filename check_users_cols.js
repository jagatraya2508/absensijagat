require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

(async () => {
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    console.log('Kolom tabel users:');
    res.rows.forEach(r => console.log('  -', r.column_name));
    await pool.end();
  } catch(e) {
    console.error(e.message);
  }
})();
