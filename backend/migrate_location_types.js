require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Migrating database for location types & different checkout settings...');
        await client.query('BEGIN');

        // Add location_type to attendance_locations
        await client.query(`
            ALTER TABLE attendance_locations 
            ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'all';
        `);

        // Ensure existing records have 'all' if NULL
        await client.query(`
            UPDATE attendance_locations 
            SET location_type = 'all' 
            WHERE location_type IS NULL;
        `);

        // Add settings default keys
        await client.query(`
            INSERT INTO settings (key, value) 
            VALUES ('require_different_location_checkout', 'false') 
            ON CONFLICT (key) DO NOTHING;
        `);

        await client.query(`
            INSERT INTO settings (key, value) 
            VALUES ('min_checkout_distance_meters', '0') 
            ON CONFLICT (key) DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
