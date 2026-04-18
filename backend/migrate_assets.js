require('dotenv').config();
const { pool } = require('./db');

async function main() {
    try {
        console.log('Starting migration: Assets tables...');
        await pool.query('BEGIN');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS asset_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS assets (
                id SERIAL PRIMARY KEY,
                asset_code VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
                brand VARCHAR(100),
                purchase_date DATE,
                price DECIMAL(15,2),
                description TEXT,
                photo_path VARCHAR(255),
                status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
                current_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS asset_assignments (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
                returned_date DATE,
                returned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert initial categories
        await pool.query(`
            INSERT INTO asset_categories (name, description) VALUES
            ('Elektronik', 'Kategori untuk laptop, komputer, printer, dll'),
            ('Kendaraan', 'Kategori untuk mobil, motor operasional'),
            ('Mebel', 'Kategori untuk meja, kursi, lemari')
            ON CONFLICT (name) DO NOTHING
        `);

        await pool.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        process.exit(0);
    }
}
main();
