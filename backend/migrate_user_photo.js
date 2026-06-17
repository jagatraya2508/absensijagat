require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    try {
        console.log('Starting migration to add photo column to users...');
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo VARCHAR(255);`);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
