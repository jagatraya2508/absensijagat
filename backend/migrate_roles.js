const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
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
                ('admin', 'Administrator', true),
                ('employee', 'Karyawan', true),
                ('manager', 'Pimpinan / Manager', true)
            ON CONFLICT (name) DO NOTHING;
        `);
        console.log('Inserted default system roles');

        // 4. Update existing users role values if needed
        // Assuming current users have 'admin', 'employee', 'manager'
        // If not, we might need to handle it. For now, the existing VARCHAR is compatible with the `name` column.

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateRoles();
