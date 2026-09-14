require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: work_shift_breaks...');
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS work_shift_breaks (
                id SERIAL PRIMARY KEY,
                shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL DEFAULT 'Istirahat',
                break_order SMALLINT NOT NULL DEFAULT 1 CHECK (break_order BETWEEN 1 AND 3),
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (shift_id, break_order)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_work_shift_breaks_shift ON work_shift_breaks(shift_id);`);

        await client.query(`
            INSERT INTO work_shift_breaks (shift_id, name, break_order, start_time, end_time)
            SELECT ws.id, 'Istirahat', 1, ws.break_start, ws.break_end
            FROM work_shifts ws
            WHERE ws.break_start IS NOT NULL
              AND ws.break_end IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM work_shift_breaks wsb WHERE wsb.shift_id = ws.id
              );
        `);

        await client.query('COMMIT');
        console.log('Migration successful: work_shift_breaks');
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
