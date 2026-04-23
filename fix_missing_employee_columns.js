const { pool } = require('./backend/db');

async function fixMissingColumns() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query(`
            ALTER TABLE employee_details 
            ADD COLUMN IF NOT EXISTS is_collector BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS use_tracking BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS driver_ritase_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bpjs_kes_enrolled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS bpjs_jht_enrolled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS bpjs_jp_enrolled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS bpjs_jkk_enrolled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS bpjs_jkm_enrolled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS pph21_enabled BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS bpjs_kes_employee_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_kes_company_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jht_employee_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jht_company_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jp_employee_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jp_company_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jkk_rate DECIMAL(6,4),
            ADD COLUMN IF NOT EXISTS bpjs_jkm_rate DECIMAL(6,4);
        `);
        
        console.log('Successfully added missing columns to employee_details table');
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error altering table:', e);
    } finally {
        client.release();
        process.exit();
    }
}

fixMissingColumns();
