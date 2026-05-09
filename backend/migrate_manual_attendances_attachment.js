require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    console.log('Adding attachment_path column to manual_attendances table...');
    
    try {
        await pool.query(`
            ALTER TABLE manual_attendances
            ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(255) DEFAULT NULL;
        `);
        console.log('Successfully added attachment_path column!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
