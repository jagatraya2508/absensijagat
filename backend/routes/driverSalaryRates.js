const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

const canManage = [authenticateToken, hasPermission('admin.driver_salary_rates')];

function canRead(req, res, next) {
    if (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'superadmin') {
        return next();
    }
    pool.query(
        `SELECT 1 FROM role_permissions rp
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $1 AND rp.permission_key = ANY($2::text[])`,
        [req.user.role, ['admin.driver_salary_rates', 'admin.driver_activities', 'admin.payroll']]
    ).then((result) => {
        if (result.rows.length > 0) return next();
        return res.status(403).json({ error: 'Akses ditolak' });
    }).catch((error) => {
        console.error('Driver salary permission error:', error);
        return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hak akses' });
    });
}

function listSql(whereSql = '') {
    return `
        SELECT r.*,
               dv.name AS division_name,
               dp.name AS department_name,
               ps.name AS position_name,
               vt.name AS vehicle_type_name,
               COALESCE(vt.daily_rate, 0) AS vehicle_daily_rate
        FROM driver_salary_rates r
        JOIN divisions dv ON dv.id = r.division_id
        JOIN departments dp ON dp.id = r.department_id
        JOIN positions ps ON ps.id = r.position_id
        JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
        ${whereSql}
        ORDER BY r.crew_role ASC, r.salary_type ASC, dv.name ASC, dp.name ASC, ps.name ASC, vt.name ASC
    `;
}

function parsePayload(body) {
    const crewRole = String(body.crew_role || '').toLowerCase() === 'kenek' ? 'kenek' : (String(body.crew_role || '').toLowerCase() === 'supir' ? 'supir' : '');
    const divisionId = parseInt(body.division_id, 10);
    const departmentId = parseInt(body.department_id, 10);
    const positionId = parseInt(body.position_id, 10);
    const vehicleTypeId = parseInt(body.vehicle_type_id, 10);
    const salaryType = ['daily', 'weekly', 'monthly'].includes(body.salary_type) ? body.salary_type : '';
    const standardSalary = parseFloat(body.standard_salary);
    if (!crewRole) return { error: 'Pilih supir atau kenek' };
    if (!salaryType) return { error: 'Tipe gaji harus dipilih' };
    if (!divisionId) return { error: 'Divisi harus dipilih' };
    if (!departmentId) return { error: 'Departemen harus dipilih' };
    if (!positionId) return { error: 'Jabatan harus dipilih' };
    if (!vehicleTypeId) return { error: 'Jenis mobil harus dipilih' };
    if (!Number.isFinite(standardSalary) || standardSalary < 0) return { error: 'Standar gaji harus diisi' };
    return {
        crewRole,
        divisionId,
        departmentId,
        positionId,
        vehicleTypeId,
        salaryType,
        standardSalary
    };
}

router.get('/', authenticateToken, canRead, async (req, res) => {
    try {
        const result = await pool.query(listSql());
        res.json(result.rows);
    } catch (err) {
        console.error('Get driver salary rates error:', err);
        res.status(500).json({ error: 'Gagal memuat daftar gaji supir dan kenek' });
    }
});

router.post('/', ...canManage, async (req, res) => {
    const payload = parsePayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
        const result = await pool.query(`
            INSERT INTO driver_salary_rates (
                crew_role, division_id, department_id, position_id, vehicle_type_id, salary_type, standard_salary, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            payload.crewRole,
            payload.divisionId,
            payload.departmentId,
            payload.positionId,
            payload.vehicleTypeId,
            payload.salaryType,
            payload.standardSalary
        ]);
        const full = await pool.query(listSql('WHERE r.id = $1'), [result.rows[0].id]);
        res.status(201).json(full.rows[0]);
    } catch (err) {
        console.error('Create driver salary rate error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Kombinasi supir/kenek, tipe gaji, divisi, departemen, jabatan, dan mobil ini sudah ada' });
        }
        res.status(500).json({ error: 'Gagal menyimpan standar gaji' });
    }
});

router.put('/:id', ...canManage, async (req, res) => {
    const payload = parsePayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });
    try {
        const result = await pool.query(`
            UPDATE driver_salary_rates
            SET crew_role = $1,
                division_id = $2,
                department_id = $3,
                position_id = $4,
                vehicle_type_id = $5,
                salary_type = $6,
                standard_salary = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING id
        `, [
            payload.crewRole,
            payload.divisionId,
            payload.departmentId,
            payload.positionId,
            payload.vehicleTypeId,
            payload.salaryType,
            payload.standardSalary,
            req.params.id
        ]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Data gaji tidak ditemukan' });
        const full = await pool.query(listSql('WHERE r.id = $1'), [result.rows[0].id]);
        res.json(full.rows[0]);
    } catch (err) {
        console.error('Update driver salary rate error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Kombinasi supir/kenek, tipe gaji, divisi, departemen, jabatan, dan mobil ini sudah ada' });
        }
        res.status(500).json({ error: 'Gagal memperbarui standar gaji' });
    }
});

router.delete('/:id', ...canManage, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM driver_salary_rates WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Data gaji tidak ditemukan' });
        res.json({ message: 'Standar gaji dihapus' });
    } catch (err) {
        console.error('Delete driver salary rate error:', err);
        res.status(500).json({ error: 'Gagal menghapus standar gaji' });
    }
});

module.exports = router;
