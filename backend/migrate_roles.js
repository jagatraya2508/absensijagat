const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'absensi',
    password: process.env.DB_PASSWORD || 'sa',
    port: process.env.DB_PORT || 5432,
});

async function migrateRoles() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Starting roles migration...');

        // 1. Create roles table
        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created roles table');

        // 2. Create role_permissions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
                permission_key VARCHAR(100) NOT NULL,
                UNIQUE(role_id, permission_key)
            );
        `);
        console.log('Created role_permissions table');

        // 3. Insert default roles
        await client.query(`
            INSERT INTO roles (name, label, is_system) 
            VALUES 
                ('super_admin', 'Super Admin', true),
                ('admin', 'Admin', true),
                ('employee', 'Karyawan', true),
                ('manager', 'Pimpinan / Manager', true),
                ('kiosk', 'Operator Kiosk', true)
            ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;
        `);
        console.log('Inserted default system roles');

        await client.query(`
            INSERT INTO role_permissions (role_id, permission_key)
            SELECT r.id, 'admin.kiosk'
            FROM roles r
            WHERE r.name = 'kiosk'
            ON CONFLICT (role_id, permission_key) DO NOTHING
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrateRoles();
