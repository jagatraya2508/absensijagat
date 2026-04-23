require('dotenv').config();
const { pool } = require('./backend/db');

async function migrate() {
    try {
        console.log('Creating vehicle_types table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicle_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('vehicle_types table created.');

        console.log('Adding vehicle_type_id to employee_details...');
        try {
            await pool.query(`
                ALTER TABLE employee_details 
                ADD COLUMN vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL;
            `);
            console.log('Column vehicle_type_id added.');
        } catch (err) {
            if (err.code === '42701') { // column already exists
                console.log('Column vehicle_type_id already exists.');
            } else {
                throw err;
            }
        }

        console.log('Migration successful.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
}

migrate();
