const { pool } = require('./backend/db');
async function check() {
    const r = await pool.query("SELECT id, employee_id, name, role FROM users LIMIT 5");
    console.log(r.rows);
    process.exit();
}
check();
