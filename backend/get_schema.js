const { pool } = require('./db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance_records'")
    .then(r => console.log(r.rows))
    .catch(console.error)
    .finally(() => process.exit());
