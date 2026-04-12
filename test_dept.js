const { pool } = require('./backend/db');

async function test() {
    try {
        const result = await pool.query(
            'INSERT INTO departments (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            ['Marketing', '']
        );
        console.log(result.rows);
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        pool.end();
    }
}
test();
