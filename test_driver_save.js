const { pool } = require('./backend/db');

async function test() {
    try {
        // Get a user to test with
        const users = await pool.query("SELECT id, name FROM users WHERE role='employee' LIMIT 1");
        if (users.rows.length === 0) {
            console.log('No employees found');
            process.exit();
        }
        const userId = users.rows[0].id;
        console.log('Testing with user:', users.rows[0].name, '(id:', userId, ')');

        // Try to update with driver fields
        const result = await pool.query(`
            UPDATE employee_details 
            SET is_driver = true, 
                driver_subuh_allowance = 25000, 
                driver_rit_allowance = 15000, 
                driver_inap_allowance = 50000,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance
        `, [userId]);
        
        if (result.rows.length === 0) {
            console.log('No employee_details row found for this user. Trying INSERT...');
            // Maybe they don't have a details row yet
            const insert = await pool.query(`
                INSERT INTO employee_details (user_id, is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance)
                VALUES ($1, true, 25000, 15000, 50000)
                ON CONFLICT (user_id) DO UPDATE SET 
                    is_driver = true, 
                    driver_subuh_allowance = 25000, 
                    driver_rit_allowance = 15000, 
                    driver_inap_allowance = 50000
                RETURNING *
            `, [userId]);
            console.log('Insert result:', JSON.stringify(insert.rows[0], null, 2));
        } else {
            console.log('Update result:', JSON.stringify(result.rows[0], null, 2));
        }

        // Read back
        const check = await pool.query("SELECT is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance FROM employee_details WHERE user_id = $1", [userId]);
        console.log('Read back:', JSON.stringify(check.rows[0], null, 2));

    } catch (e) {
        console.error('Error:', e.message);
        console.error('Full error:', e);
    } finally {
        process.exit();
    }
}
test();
