const { pool } = require('./backend/db');

async function checkAndAlterTable() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Add is_driver column
        await client.query(`
            ALTER TABLE employee_details 
            ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS driver_subuh_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_rit_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_inap_allowance NUMERIC DEFAULT 0;
        `);
        
        console.log('Successfully added driver fields to employee_details table');
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error altering table:', e);
    } finally {
        client.release();
        process.exit();
    }
}

checkAndAlterTable();
