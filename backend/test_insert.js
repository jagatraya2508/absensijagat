require('dotenv').config();
const { pool } = require('./db/index.js');
const bcrypt = require('bcryptjs');

async function test() {
    try {
        const r = await pool.query(`
            SELECT trigger_name, event_manipulation, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'users'
        `);
        console.log('Triggers:', r.rows);

        const hp = await bcrypt.hash('password123', 10);
        console.log('Inserting test user...');
        const result = await pool.query(
            `INSERT INTO users (employee_id, name, email, password, role, off_day) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            ['test03', 'test name', 'test@test.com', hp, 'employee', 'Minggu']
        );
        console.log('SUCCESS', result.rows);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.query("DELETE FROM users WHERE employee_id = 'test03'").catch(() => {});
        pool.end();
    }
}
test();
