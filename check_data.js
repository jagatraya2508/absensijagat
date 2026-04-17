const { pool } = require('./backend/db');
const http = require('http');

async function check() {
    try {
        // Test direct query
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at,
                   ed.nik, ed.phone, ed.department, ed.position, ed.join_date,
                   ed.basic_salary, ed.salary_type, ed.gender, ed.bpjs_kesehatan_no, ed.npwp,
                   ed.is_driver, ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee'
            ORDER BY u.name ASC
        `);
        console.log('Direct query result:', result.rows.length, 'employees');
        result.rows.forEach(r => console.log(' -', r.name, r.employee_id));
    } catch(e) {
        console.error('Query error:', e.message);
    }
    
    // Test API endpoint
    try {
        const resp = await new Promise((resolve, reject) => {
            http.get('http://localhost:5000/api/employees', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            }).on('error', reject);
        });
        console.log('\nAPI response status:', resp.status);
        console.log('API response:', resp.body.substring(0, 200));
    } catch(e) {
        console.error('API error:', e.message);
    }
    
    process.exit();
}
check();
