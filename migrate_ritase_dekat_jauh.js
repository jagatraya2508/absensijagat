require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add ritase_dekat and ritase_jauh columns to driver_activities
        await client.query(`
            ALTER TABLE driver_activities
            ADD COLUMN IF NOT EXISTS ritase_dekat INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ritase_jauh INTEGER DEFAULT 0;
        `);

        // Migrate existing data: set old extra_rit as ritase_dekat by default
        await client.query(`
            UPDATE driver_activities
            SET ritase_dekat = GREATEST(rit_count - 1, 0),
                ritase_jauh = 0
            WHERE rit_count > 1 AND ritase_dekat = 0 AND ritase_jauh = 0;
        `);

        // Ensure payroll_items has the split columns (from previous migration)
        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS driver_extra_rit_dekat INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_extra_rit_jauh INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_ritase_dekat_amount NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_ritase_jauh_amount NUMERIC DEFAULT 0;
        `);

        // Ensure employee_details has the split allowance columns
        await client.query(`
            ALTER TABLE employee_details
            ADD COLUMN IF NOT EXISTS driver_ritase_dekat_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_ritase_jauh_allowance NUMERIC DEFAULT 0;
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: Added ritase_dekat and ritase_jauh columns to driver_activities.');
        console.log('SUCCESS: Ensured payroll_items and employee_details have split ritase columns.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
