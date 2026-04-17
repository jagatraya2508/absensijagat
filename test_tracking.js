require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function testQuery() {
    try {
        const id = 1;
        await pool.query(`
            UPDATE employee_details SET use_tracking = TRUE WHERE user_id = $1
        `, [id]);
        console.log("Syntax is fine in db check.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
testQuery();
