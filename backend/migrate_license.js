require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    try {
        console.log('Creating license_info table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS license_info (
                id SERIAL PRIMARY KEY,
                license_key TEXT NOT NULL,
                company_name VARCHAR(200),
                max_users INTEGER NOT NULL DEFAULT 10,
                expires_at DATE,
                activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('Table license_info created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
