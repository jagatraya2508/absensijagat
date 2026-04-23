const { pool } = require('./backend/db');
const fs = require('fs');

async function testQuery() {
    try {
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at,
                   ed.nik, ed.phone, ed.department, ed.position, ed.join_date,
                   ed.basic_salary, ed.salary_type, ed.gender, ed.bpjs_kesehatan_no, ed.npwp,
                   ed.is_driver, ed.is_collector, ed.use_tracking, ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_allowance,
                   ed.bpjs_kes_enrolled, ed.bpjs_jht_enrolled, ed.bpjs_jp_enrolled, ed.bpjs_jkk_enrolled, ed.bpjs_jkm_enrolled, ed.pph21_enabled,
                   ed.bpjs_kes_employee_rate, ed.bpjs_kes_company_rate, ed.bpjs_jht_employee_rate, ed.bpjs_jht_company_rate,
                   ed.bpjs_jp_employee_rate, ed.bpjs_jp_company_rate, ed.bpjs_jkk_rate, ed.bpjs_jkm_rate,
                   ed.vehicle_type_id, vt.name as vehicle_type_name
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            LEFT JOIN vehicle_types vt ON ed.vehicle_type_id = vt.id
            WHERE u.role = 'employee'
            ORDER BY u.name ASC
        `);
        console.log('Query successful, found rows:', result.rows.length);
        fs.writeFileSync('employees_dump.json', JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error('Query failed:', e.message);
    } finally {
        process.exit();
    }
}

testQuery();
