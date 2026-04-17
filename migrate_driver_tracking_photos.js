require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE driver_tracking 
            ADD COLUMN IF NOT EXISTS checkin_photo_path VARCHAR(255),
            ADD COLUMN IF NOT EXISTS checkout_photo_path VARCHAR(255)
        `);
        console.log('SUCCESS: photo columns added to driver_tracking');
        process.exit();
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
migrate();
