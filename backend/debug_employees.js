const { pool } = require('./db');

async function check() {
    try {
        // Check if employee_details table exists and has salary_type
        const cols = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'employee_details' ORDER BY ordinal_position"
        );
        console.log('employee_details columns:', cols.rows.map(x => x.column_name).join(', '));

        // Try the actual employees query
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at,
                   ed.nik, ed.phone, ed.department, ed.position, ed.join_date,
                   ed.basic_salary, ed.salary_type, ed.gender, ed.bpjs_kesehatan_no, ed.npwp
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee'
            ORDER BY u.name ASC
        `);
        console.log('Employees found:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('First employee:', JSON.stringify(result.rows[0], null, 2));
        }

        // Also check all users
        const users = await pool.query("SELECT id, employee_id, name, role FROM users");
        console.log('\nAll users:');
        users.rows.forEach(u => console.log(`  ${u.id}: ${u.employee_id} - ${u.name} (${u.role})`));
    } catch (err) {
        console.error('ERROR:', err.message);
    }
    process.exit(0);
}

check();
