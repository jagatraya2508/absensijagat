require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS driver_tracking (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
                customer_name VARCHAR(200) NOT NULL,
                address TEXT,
                checkin_time TIMESTAMP,
                checkin_latitude DECIMAL(10, 8),
                checkin_longitude DECIMAL(11, 8),
                checkout_time TIMESTAMP,
                checkout_latitude DECIMAL(10, 8),
                checkout_longitude DECIMAL(11, 8),
                notes TEXT,
                status VARCHAR(20) DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_driver_tracking_user ON driver_tracking(user_id);
            CREATE INDEX IF NOT EXISTS idx_driver_tracking_date ON driver_tracking(tracking_date);
            CREATE INDEX IF NOT EXISTS idx_driver_tracking_status ON driver_tracking(status);
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: driver_tracking table created');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
