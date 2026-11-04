const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'absensi',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sa',
    });

async function main() {
    await pool.query(`ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS appreciation_allowance_period VARCHAR(10) DEFAULT 'monthly'`);
    const applied = await pool.query(`SELECT 1 FROM settings WHERE key = 'appreciation_daily_applied' LIMIT 1`);
    let updated = 0;
    if (applied.rowCount === 0) {
        const result = await pool.query(`
            UPDATE employee_details
            SET appreciation_allowance_period = 'daily'
            WHERE appreciation_allowance_period IS DISTINCT FROM 'daily'
        `);
        updated = result.rowCount;
        await pool.query(`INSERT INTO settings (key, value) VALUES ('appreciation_daily_applied', 'done')`);
    }
    const counts = await pool.query(`
        SELECT COALESCE(appreciation_allowance_period, '(null)') AS period, COUNT(*)::int AS n
        FROM employee_details
        GROUP BY 1
        ORDER BY 1
    `);
    console.log(JSON.stringify({ updated, counts: counts.rows }));
}

main()
    .catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
