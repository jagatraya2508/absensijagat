require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Rename existing column to make it clear it's for 'dekat'
        // Check if old column exists before renaming
        const colCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='employee_details' AND column_name='driver_ritase_allowance'
        `);
        
        if (colCheck.rows.length > 0) {
            await client.query(`
                ALTER TABLE employee_details 
                RENAME COLUMN driver_ritase_allowance TO driver_ritase_dekat_allowance;
            `);
        }

        // Add new column for 'jauh'
        await client.query(`
            ALTER TABLE employee_details
            ADD COLUMN IF NOT EXISTS driver_ritase_jauh_allowance NUMERIC DEFAULT 0;
        `);

        // Update payroll_items
        const colCheckExtra = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='payroll_items' AND column_name='driver_extra_rit'
        `);
        if (colCheckExtra.rows.length > 0) {
            await client.query(`
                ALTER TABLE payroll_items
                RENAME COLUMN driver_extra_rit TO driver_extra_rit_dekat;
            `);
        }
        
        const colCheckAmount = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='payroll_items' AND column_name='driver_ritase_amount'
        `);
        if (colCheckAmount.rows.length > 0) {
            await client.query(`
                ALTER TABLE payroll_items
                RENAME COLUMN driver_ritase_amount TO driver_ritase_dekat_amount;
            `);
        }

        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS driver_extra_rit_jauh INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_ritase_jauh_amount NUMERIC DEFAULT 0;
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: Separated Ritase Dekat and Ritase Jauh in database.');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
