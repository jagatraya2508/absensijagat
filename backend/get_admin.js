const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dbabsen',
  password: 'sa',
  port: 5432,
});

pool.query("SELECT employee_id FROM employees WHERE role = 'admin' LIMIT 1", (err, res) => {
  if (err) {
    console.error(err);
  } else {
    console.log(res.rows[0]);
  }
  pool.end();
});
