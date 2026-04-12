const { pool } = require('./backend/db');

async function migrate() {
    try {
        console.log('Creating departments table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating positions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Also let's update db/schema.sql to include these
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
