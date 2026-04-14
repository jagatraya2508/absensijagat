require('dotenv').config();
const { pool } = require('./db/index.js');

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_locations (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                location_id INTEGER REFERENCES attendance_locations(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, location_id)
            );
        `);
        console.log('Successfully created user_locations table.');

        await pool.end();
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
