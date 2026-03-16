require('dotenv').config();
const { pool } = require('./db');

async function main() {
    try {
        const res = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='leave_requests' ORDER BY ordinal_position"
        );
        console.log('=== leave_requests columns ===');
        res.rows.forEach(r => console.log(r.column_name));
        
        console.log('\n=== Testing INSERT query ===');
        try {
            await pool.query('BEGIN');
            await pool.query(
                "INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, attachment_path, replacement_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
                [1, 'sick', '2026-03-16', '2026-03-16', 'test sakit diagnosis', null, null]
            );
            await pool.query('ROLLBACK');
            console.log('INSERT query works fine!');
        } catch (insertErr) {
            await pool.query('ROLLBACK');
            console.log('INSERT ERROR:', insertErr.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('Connection Error:', err.message);
        process.exit(1);
    }
}
main();
