require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS driver_subuh_days INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_subuh_amount NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_rit_total INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_rit_amount NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_overnight_days INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_overnight_amount NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_total_allowance NUMERIC DEFAULT 0;
        `);
        await client.query('COMMIT');
        console.log('SUCCESS: Driver columns added to payroll_items');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
