require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function resetPassword() {
    try {
        const newPassword = process.argv[2] || 'admin123';
        const employeeId = process.argv[3] || 'ADMIN001';

        console.log(`Resetting password for ${employeeId} to '${newPassword}'...`);
        const hash = await bcrypt.hash(newPassword, 10);

        const result = await pool.query(
            'UPDATE users SET password = $1 WHERE employee_id = $2 RETURNING id, name, employee_id',
            [hash, employeeId]
        );

        if (result.rowCount === 0) {
            console.log(`User '${employeeId}' not found. Creating default admin user...`);
            await pool.query(
                `INSERT INTO users (employee_id, name, email, password, role) 
                 VALUES ($1, 'Administrator', 'admin@company.com', $2, 'admin')`,
                [employeeId, hash]
            );
            console.log(`✅ User '${employeeId}' created successfully with password '${newPassword}'!`);
        } else {
            console.log(`✅ Password for '${employeeId}' updated successfully to '${newPassword}'!`);
        }
        process.exit(0);
    } catch (e) {
        console.error('❌ Error resetting password:', e.message);
        process.exit(1);
    }
}

resetPassword();
