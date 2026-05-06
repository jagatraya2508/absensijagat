const { pool } = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        // 1. Create customers table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_code VARCHAR(50) UNIQUE,
                name VARCHAR(200) NOT NULL,
                address TEXT,
                phone VARCHAR(30),
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name)
            )
        `);
        console.log('✅ customers table ready');

        // 2. Add customer_code column if table existed but column didn't
        const cols = await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'customers'`
        );
        const hasCode = cols.rows.some(r => r.column_name === 'customer_code');
        if (!hasCode) {
            await client.query(`ALTER TABLE customers ADD COLUMN customer_code VARCHAR(50) UNIQUE`);
            console.log('✅ Added customer_code column');
        }

        // 3. Create app_settings table for customer code config
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ app_settings table ready');

        // 4. Insert default customer code settings
        await client.query(`
            INSERT INTO app_settings (key, value) VALUES 
                ('customer_code_prefix', 'CUST'),
                ('customer_code_next', '1'),
                ('customer_code_digits', '4')
            ON CONFLICT (key) DO NOTHING
        `);
        console.log('✅ Default customer code settings inserted');

        // 5. Backfill existing customers without codes
        const existing = await client.query(
            `SELECT id FROM customers WHERE customer_code IS NULL ORDER BY id`
        );
        
        if (existing.rows.length > 0) {
            const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
            const digitsRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_digits'`);
            const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);
            
            const prefix = prefixRes.rows[0]?.value || 'CUST';
            const digits = parseInt(digitsRes.rows[0]?.value || '4');
            let next = parseInt(nextRes.rows[0]?.value || '1');

            for (const row of existing.rows) {
                const code = prefix + String(next).padStart(digits, '0');
                await client.query(`UPDATE customers SET customer_code = $1 WHERE id = $2`, [code, row.id]);
                console.log(`  Backfilled customer #${row.id} -> ${code}`);
                next++;
            }

            await client.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`, [String(next)]);
            console.log(`✅ Updated next counter to ${next}`);
        } else {
            console.log('✅ No customers to backfill');
        }

        // Create index
        await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('Migration error:', err.message);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
