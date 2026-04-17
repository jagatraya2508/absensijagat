require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function fix() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE employee_details 
            ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS driver_subuh_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_rit_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_inap_allowance NUMERIC DEFAULT 0;
        `);
        await client.query('COMMIT');
        console.log('SUCCESS: Driver columns added to dbabsen database');
        
        // Verify
        const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='employee_details' AND column_name LIKE '%driver%' OR column_name = 'is_driver'");
        console.log('Verified columns:', r.rows.map(x => x.column_name));
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
fix();
