require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    console.log('Starting migration for manual_attendances table...');
    
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS manual_attendances (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                time_in TIME,
                time_out TIME,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table "manual_attendances" created successfully.');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
