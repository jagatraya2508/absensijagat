require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

(async () => {
  try {
    // Delete off days for ADMIN001
    const del = await pool.query(
      `DELETE FROM user_off_days WHERE user_id = (SELECT id FROM users WHERE employee_id = 'ADMIN001')`
    );
    console.log('Off days dihapus:', del.rowCount);

    // Delete attendance for ADMIN001
    const att = await pool.query(
      `DELETE FROM attendance_records WHERE user_id = (SELECT id FROM users WHERE employee_id = 'ADMIN001')`
    );
    console.log('Attendance dihapus:', att.rowCount);

    // Delete leave requests for ADMIN001
    const lr = await pool.query(
      `DELETE FROM leave_requests WHERE user_id = (SELECT id FROM users WHERE employee_id = 'ADMIN001')`
    );
    console.log('Leave requests dihapus:', lr.rowCount);

    console.log('\nSelesai! Data Admin berhasil dihapus.');
    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
