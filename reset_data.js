require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Memulai proses penghapusan data (reset)...');

    // 1. Absensi & Turunannya
    let res = await client.query('DELETE FROM attendance_records');
    console.log(`- Dihapus ${res.rowCount} baris dari attendance_records`);

    res = await client.query('DELETE FROM manual_attendances');
    console.log(`- Dihapus ${res.rowCount} baris dari manual_attendances`);

    res = await client.query('DELETE FROM user_off_days');
    console.log(`- Dihapus ${res.rowCount} baris dari user_off_days`);

    res = await client.query('DELETE FROM driver_tracking');
    console.log(`- Dihapus ${res.rowCount} baris dari driver_tracking`);

    res = await client.query('DELETE FROM driver_activities');
    console.log(`- Dihapus ${res.rowCount} baris dari driver_activities`);

    // 2. Izin
    res = await client.query('DELETE FROM leave_requests');
    console.log(`- Dihapus ${res.rowCount} baris dari leave_requests`);

    // 3. Gaji
    res = await client.query('DELETE FROM payroll_items');
    console.log(`- Dihapus ${res.rowCount} baris dari payroll_items`);

    res = await client.query('DELETE FROM payroll_runs');
    console.log(`- Dihapus ${res.rowCount} baris dari payroll_runs`);

    // 4. Data Terkait Pegawai
    res = await client.query('DELETE FROM employee_documents');
    console.log(`- Dihapus ${res.rowCount} baris dari employee_documents`);

    res = await client.query('DELETE FROM loan_payments');
    console.log(`- Dihapus ${res.rowCount} baris dari loan_payments`);

    res = await client.query('DELETE FROM employee_loans');
    console.log(`- Dihapus ${res.rowCount} baris dari employee_loans`);

    res = await client.query('DELETE FROM employee_shift_assignments');
    console.log(`- Dihapus ${res.rowCount} baris dari employee_shift_assignments`);

    res = await client.query('DELETE FROM user_locations');
    console.log(`- Dihapus ${res.rowCount} baris dari user_locations`);

    res = await client.query('DELETE FROM employee_details');
    console.log(`- Dihapus ${res.rowCount} baris dari employee_details`);

    // Clean up other possible user references just in case to prevent FK error
    res = await client.query('DELETE FROM asset_assignments');
    console.log(`- Dihapus ${res.rowCount} baris dari asset_assignments`);

    res = await client.query('DELETE FROM discipline_assessments');
    console.log(`- Dihapus ${res.rowCount} baris dari discipline_assessments`);

    res = await client.query('DELETE FROM overtime_request_employees');
    console.log(`- Dihapus ${res.rowCount} baris dari overtime_request_employees`);

    res = await client.query('DELETE FROM overtime_requests');
    console.log(`- Dihapus ${res.rowCount} baris dari overtime_requests`);

    res = await client.query('DELETE FROM overtime_records');
    console.log(`- Dihapus ${res.rowCount} baris dari overtime_records`);

    // 5. Data Users (Kecuali Admin Utama)
    res = await client.query(`
      DELETE FROM users 
      WHERE role != 'admin' AND employee_id != 'ADMIN001'
    `);
    console.log(`- Dihapus ${res.rowCount} akun pengguna (users)`);

    await client.query('COMMIT');
    console.log('\n✅ Proses reset data berhasil diselesaikan!');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('\n❌ Terjadi error, proses dibatalkan (rollback). Detail Error:');
    console.error(e.message);
  } finally {
    client.release();
    pool.end();
  }
})();
