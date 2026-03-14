require('dotenv').config();
const { pool } = require('./db');

async function test() {
    try {
        const runResult = await pool.query('SELECT * FROM payroll_runs');
        console.log('All IDs:', runResult.rows.map(r => r.id));
        console.log('runResult:', runResult.rows.length);
        const id = 5;

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            WHERE pi.payroll_run_id = $1
            ORDER BY u.name ASC
        `, [id]);
        console.log('items format ok:', itemsResult.rows.length);
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
}
test();
