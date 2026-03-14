require('dotenv').config();
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        console.log('Running salary_type migration...');

        // First ensure the HR tables exist by running the full schema
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✓ Schema initialized');

        // Add salary_type if not exists (for databases that already had the table without this column)
        await pool.query(`ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS salary_type VARCHAR(10) DEFAULT 'monthly'`);
        console.log('✓ salary_type column ensured on employee_details');

        await pool.query(`ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS salary_type VARCHAR(10) DEFAULT 'monthly'`);
        console.log('✓ salary_type column ensured on payroll_items');

        await pool.query(`ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 0`);
        console.log('✓ working_days column ensured on payroll_items');

        console.log('Migration completed!');
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err.message);
        process.exit(1);
    }
}

migrate();
