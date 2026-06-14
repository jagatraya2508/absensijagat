require('dotenv').config();
const { pool } = require('./db');

async function fix() {
    try {
        console.log('Fixing leave_requests constraint...');
        
        // Find constraint name
        const constraintQuery = await pool.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'leave_requests' AND constraint_type = 'CHECK'
        `);
        
        for (const row of constraintQuery.rows) {
            if (row.constraint_name.includes('type')) {
                await pool.query(`ALTER TABLE leave_requests DROP CONSTRAINT "${row.constraint_name}";`);
                console.log('Dropped constraint:', row.constraint_name);
            }
        }
        
        // Add new constraint
        await pool.query(`
            ALTER TABLE leave_requests 
            ADD CONSTRAINT leave_requests_type_check 
            CHECK (type IN ('late', 'sick', 'leave', 'change_off', 'permission'));
        `);
        
        console.log('Successfully updated constraint');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
