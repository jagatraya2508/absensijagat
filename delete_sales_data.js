// Load env from backend
require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

(async () => {
  try {
    // Find SLS users
    const slsUsers = await pool.query(
      `SELECT u.id, u.employee_id, u.name, u.role FROM users u WHERE u.employee_id LIKE 'SLS%' ORDER BY u.employee_id`
    );
    console.log('=== USERS SLS (Sales) ===');
    slsUsers.rows.forEach(r => console.log(`  ID:${r.id} EmpID:${r.employee_id} Name:${r.name} Role:${r.role}`));
    console.log('Total SLS users:', slsUsers.rows.length);

    const slsIds = slsUsers.rows.map(r => r.id);

    if (slsIds.length > 0) {
      const att = await pool.query('SELECT COUNT(*) as total FROM attendance_records WHERE user_id = ANY($1)', [slsIds]);
      const lr = await pool.query('SELECT COUNT(*) as total FROM leave_requests WHERE user_id = ANY($1)', [slsIds]);
      const od = await pool.query('SELECT COUNT(*) as total FROM user_off_days WHERE user_id = ANY($1)', [slsIds]);

      console.log('\n=== DATA YANG AKAN DIHAPUS ===');
      console.log('Attendance records:', att.rows[0].total);
      console.log('Leave requests:', lr.rows[0].total);
      console.log('Off days:', od.rows[0].total);

      // DELETE
      const delAtt = await pool.query('DELETE FROM attendance_records WHERE user_id = ANY($1)', [slsIds]);
      console.log('\n=== HASIL PENGHAPUSAN ===');
      console.log('Attendance records dihapus:', delAtt.rowCount);

      const delLr = await pool.query('DELETE FROM leave_requests WHERE user_id = ANY($1)', [slsIds]);
      console.log('Leave requests dihapus:', delLr.rowCount);

      const delOd = await pool.query('DELETE FROM user_off_days WHERE user_id = ANY($1)', [slsIds]);
      console.log('Off days dihapus:', delOd.rowCount);

      console.log('\nSelesai! Semua data absensi & pengajuan cuti/off karyawan Sales berhasil dihapus.');
    } else {
      console.log('\nTidak ada user SLS di database.');
    }

    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
