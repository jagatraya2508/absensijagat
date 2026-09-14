require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: production tuang...');
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS production_tuang (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tuang_date DATE NOT NULL,
                amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, tuang_date)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_production_tuang_date ON production_tuang(tuang_date);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_production_tuang_user ON production_tuang(user_id);`);

        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS tuang_amount DECIMAL(15,2) DEFAULT 0
        `);
        await client.query(`
            ALTER TABLE payroll_items
            ADD COLUMN IF NOT EXISTS tuang_days INTEGER DEFAULT 0
        `);

        await client.query(`
            INSERT INTO role_permissions (role_id, permission_key)
            SELECT r.id, 'manager.tuang'
            FROM roles r
            WHERE r.name = 'manager'
            ON CONFLICT (role_id, permission_key) DO NOTHING
        `);

        await client.query('COMMIT');
        console.log('Migration successful: production tuang');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
