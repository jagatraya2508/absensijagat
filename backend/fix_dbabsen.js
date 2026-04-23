require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dbabsen',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sa',
});

async function fixMissingColumns() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log(`Connected to database: ${process.env.DB_NAME}`);

        // Create vehicle_types table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS vehicle_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add all missing columns
        await client.query(`
            ALTER TABLE employee_details 
            ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS driver_subuh_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_rit_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS driver_inap_allowance NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL,
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
        
        console.log('Successfully added missing columns to employee_details table in dbabsen');
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
