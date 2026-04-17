require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS driver_activities (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                activity_date DATE NOT NULL,
                is_subuh BOOLEAN DEFAULT FALSE,
                departure_time TIME,
                rit_count INTEGER DEFAULT 1,
                rit_notes TEXT,
                is_overnight BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, activity_date)
            );
        `);
        await client.query('COMMIT');
        console.log('SUCCESS: driver_activities table created');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
