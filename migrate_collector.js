require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add is_collector to employee_details
        await client.query(`
            ALTER TABLE employee_details 
            ADD COLUMN IF NOT EXISTS is_collector BOOLEAN DEFAULT FALSE
        `);

        // Add tracking type and collection fields to driver_tracking  
        await client.query(`
            ALTER TABLE driver_tracking
            ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(20) DEFAULT 'delivery',
            ADD COLUMN IF NOT EXISTS amount_billed DECIMAL(15, 2),
            ADD COLUMN IF NOT EXISTS amount_collected DECIMAL(15, 2),
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
            ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS collection_status VARCHAR(20)
        `);

        // Create index 
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_driver_tracking_type ON driver_tracking(tracking_type)
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: Collector fields added');
        console.log('  - employee_details.is_collector');
        console.log('  - driver_tracking.tracking_type (delivery/collection)');
        console.log('  - driver_tracking.amount_billed');
        console.log('  - driver_tracking.amount_collected');
        console.log('  - driver_tracking.payment_method');
        console.log('  - driver_tracking.invoice_number');
        console.log('  - driver_tracking.collection_status');
        process.exit();
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
        process.exit(1);
    } finally {
        client.release();
    }
}
migrate();
