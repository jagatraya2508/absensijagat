require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add use_tracking flag
        await client.query(`
            ALTER TABLE employee_details
            ADD COLUMN IF NOT EXISTS use_tracking BOOLEAN DEFAULT FALSE
        `);

        // Set use_tracking = TRUE for everyone who currently is a driver or collector
        await client.query(`
            UPDATE employee_details 
            SET use_tracking = TRUE 
            WHERE is_driver = TRUE OR is_collector = TRUE
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: use_tracking column added and initialized for drivers/collectors.');
        process.exit();
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
