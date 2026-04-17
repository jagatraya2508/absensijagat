const { pool } = require('./backend/db');

async function check() {
    try {
        const r = await pool.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='employee_details' ORDER BY ordinal_position"
        );
        console.log('All columns in employee_details:');
        r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
        
        // Try a quick test update
        const test = await pool.query("SELECT id, is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance FROM employee_details LIMIT 3");
        console.log('\nSample data:', JSON.stringify(test.rows, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}
check();
