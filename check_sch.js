require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'work_schedule_types'
        `);
        console.table(res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        client.release();
        process.exit(0);
    }
}
check();
