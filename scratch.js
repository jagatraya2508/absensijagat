const { pool } = require('./backend/db');
pool.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'attendance_records'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
