require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                address TEXT,
                phone VARCHAR(30),
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name)
            );

            CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
            CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
        `);

        // Migrate existing customers from driver_tracking
        const existing = await pool.query(`
            SELECT DISTINCT customer_name, address 
            FROM driver_tracking 
            WHERE customer_name IS NOT NULL
            ORDER BY customer_name
        `);

        for (const row of existing.rows) {
            await pool.query(
                `INSERT INTO customers (name, address) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
                [row.customer_name, row.address]
            );
        }

        console.log(`SUCCESS: customers table created, ${existing.rows.length} existing customers migrated`);
        process.exit();
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
migrate();
