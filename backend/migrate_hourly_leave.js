require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Migrating database for Hourly Leave...');
        await client.query('BEGIN');

        // Add columns to leave_settings
        await client.query(`
            ALTER TABLE leave_settings 
            ADD COLUMN IF NOT EXISTS leave_calculation_mode VARCHAR(20) DEFAULT 'both',
            ADD COLUMN IF NOT EXISTS hours_per_leave_day NUMERIC(4,2) DEFAULT 8.0;
        `);

        // Ensure default row in leave_settings has the defaults if null
        await client.query(`
            UPDATE leave_settings 
            SET leave_calculation_mode = COALESCE(leave_calculation_mode, 'both'),
                hours_per_leave_day = COALESCE(hours_per_leave_day, 8.0);
        `);

        // Add columns to leave_requests
        await client.query(`
            ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS is_hourly BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS start_time TIME,
            ADD COLUMN IF NOT EXISTS end_time TIME,
            ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,2),
            ADD COLUMN IF NOT EXISTS duration_days NUMERIC(5,2);
        `);

        // Backfill duration_days for existing leave_requests
        await client.query(`
            UPDATE leave_requests
            SET is_hourly = COALESCE(is_hourly, false),
                duration_days = COALESCE(duration_days, (end_date - start_date + 1)::numeric),
                duration_hours = COALESCE(duration_hours, ((end_date - start_date + 1) * 8.0)::numeric)
            WHERE duration_days IS NULL;
        `);

        await client.query('COMMIT');
        console.log('Migration for Hourly Leave completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
