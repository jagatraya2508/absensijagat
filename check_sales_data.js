const { pool } = require('./backend/db');

(async () => {
  try {
    // Get ALL users
    const allUsers = await pool.query(
      `SELECT u.id, u.employee_id, u.name, u.role, ed.department 
       FROM users u 
       LEFT JOIN employee_details ed ON u.id = ed.user_id
       ORDER BY u.employee_id`
    );
    
    console.log('=== SEMUA USERS ===');
    allUsers.rows.forEach(r => console.log(`  ID:${r.id} EmpID:${r.employee_id} Name:${r.name} Role:${r.role} Dept:${r.department || '(kosong)'}`));
    console.log('Total users:', allUsers.rows.length);

    // Find SLS users specifically
    const slsUsers = await pool.query(
      `SELECT id, employee_id, name, role FROM users WHERE employee_id LIKE 'SLS%' ORDER BY employee_id`
    );
    console.log('\n=== USERS SLS (Sales) ===');
    slsUsers.rows.forEach(r => console.log(`  ID:${r.id} EmpID:${r.employee_id} Name:${r.name} Role:${r.role}`));
    console.log('Total SLS users:', slsUsers.rows.length);

    const slsIds = slsUsers.rows.map(r => r.id);

    if (slsIds.length > 0) {
      const att = await pool.query('SELECT COUNT(*) as total FROM attendance_records WHERE user_id = ANY($1)', [slsIds]);
      const lr = await pool.query('SELECT COUNT(*) as total FROM leave_requests WHERE user_id = ANY($1)', [slsIds]);
      const od = await pool.query('SELECT COUNT(*) as total FROM user_off_days WHERE user_id = ANY($1)', [slsIds]);

      console.log('\n=== DATA SLS USERS ===');
      console.log('Attendance records:', att.rows[0].total);
      console.log('Leave requests:', lr.rows[0].total);
      console.log('Off days:', od.rows[0].total);
    }

    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
