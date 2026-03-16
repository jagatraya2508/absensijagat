require('dotenv').config();
const { pool } = require('./db');

async function main() {
    try {
        console.log('Adding replacement_date column to leave_requests...');
        
        // Add column
        await pool.query(
            `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS replacement_date DATE;`
        );
        
        // Update check constraint for type to include 'change_off' IF NOT EXISTS
        // PostgreSQL doesn't have a simple "ADD VALUE IF NOT EXISTS" for check constraints, 
        // so we drop and recreate it.
        try {
            // First try to find the constraint name
            const constraintQuery = await pool.query(`
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'leave_requests' AND constraint_type = 'CHECK'
            `);
            
            for (const row of constraintQuery.rows) {
                if (row.constraint_name.includes('type')) {
                    await pool.query(`ALTER TABLE leave_requests DROP CONSTRAINT "${row.constraint_name}";`);
                }
            }
            
            // Add new constraint
            await pool.query(`
                ALTER TABLE leave_requests 
                ADD CONSTRAINT leave_requests_type_check 
                CHECK (type IN ('late', 'sick', 'leave', 'change_off'));
            `);
        } catch (constraintErr) {
            console.log('Warning on constraint update:', constraintErr.message);
            // Ignore constraint errors, they might already be correct
        }

        console.log('Successfully updated leave_requests table schema');
        process.exit(0);
    } catch (err) {
        console.error('Error updating schema:', err.message);
        process.exit(1);
    }
}

main();
