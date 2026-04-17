require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Add ritase allowance to employee_details
        await client.query(`
            ALTER TABLE employee_details
            ADD COLUMN IF NOT EXISTS driver_ritase_allowance NUMERIC DEFAULT 0;
        `);
        // Add ritase columns to payroll_items
        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS driver_extra_rit INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_ritase_amount NUMERIC DEFAULT 0;
        `);
        await client.query('COMMIT');
        console.log('SUCCESS: driver_ritase_allowance added to employee_details & payroll_items');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
