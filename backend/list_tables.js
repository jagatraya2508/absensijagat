require('dotenv').config();
const { pool } = require('./db');
async function main() {
  const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log(result.rows.map(r => r.table_name).join('\n'));
  process.exit(0);
}
main();
