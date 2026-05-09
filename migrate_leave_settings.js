require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Create leave_settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_settings (
                id SERIAL PRIMARY KEY,
                annual_leave_quota INTEGER DEFAULT 12,
                late_deducts_leave BOOLEAN DEFAULT FALSE,
                sick_deducts_leave BOOLEAN DEFAULT FALSE,
                permission_deducts_leave BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insert default setting if empty
        const checkSettings = await client.query('SELECT COUNT(*) FROM leave_settings');
        if (parseInt(checkSettings.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO leave_settings (annual_leave_quota, late_deducts_leave, sick_deducts_leave, permission_deducts_leave)
                VALUES (12, FALSE, FALSE, FALSE)
            `);
        }

        // 2. Create big_leave_rules table
        await client.query(`
            CREATE TABLE IF NOT EXISTS big_leave_rules (
                id SERIAL PRIMARY KEY,
                min_years INTEGER NOT NULL,
                leave_days INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(min_years)
            );
        `);

        // In PostgreSQL 12+ consrc doesn't exist, we can use pg_get_constraintdef.
        // Or simply drop the standard constraint name 'leave_requests_type_check'
        await client.query(`
            ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;
        `);

        // Also just in case, drop any constraint by name if found
        const cQuery = await client.query(`
            SELECT oid, conname
            FROM pg_constraint
            WHERE conrelid = 'leave_requests'::regclass AND contype = 'c';
        `);
        for (const row of cQuery.rows) {
            const defQuery = await client.query(`SELECT pg_get_constraintdef($1) as def`, [row.oid]);
            if (defQuery.rows[0].def.includes('type')) {
                await client.query(`ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS ${row.conname}`);
            }
        }

        // Add the new constraint
        await client.query(`
            ALTER TABLE leave_requests 
            ADD CONSTRAINT leave_requests_type_check 
            CHECK (type IN ('late', 'sick', 'leave', 'change_off', 'permission'));
        `);

        await client.query('COMMIT');
        console.log('SUCCESS: leave_settings and big_leave_rules created, leave_requests constraint updated.');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
