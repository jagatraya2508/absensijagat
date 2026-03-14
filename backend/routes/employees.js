const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all employees with details
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at,
                   ed.nik, ed.phone, ed.department, ed.position, ed.join_date,
                   ed.basic_salary, ed.salary_type, ed.gender, ed.bpjs_kesehatan_no, ed.npwp
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee'
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get single employee detail
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userResult = await pool.query(
            'SELECT id, employee_id, name, email, role, created_at FROM users WHERE id = $1',
            [id]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        const detailResult = await pool.query(
            'SELECT * FROM employee_details WHERE user_id = $1',
            [id]
        );

        const employee = {
            ...userResult.rows[0],
            details: detailResult.rows[0] || null
        };

        res.json(employee);
    } catch (error) {
        console.error('Get employee detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update employee details
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nik, phone, address, birth_date, birth_place,
            gender, marital_status, religion, education,
            department, position, join_date,
            bank_name, bank_account, bank_holder,
            npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
            basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate,
            tax_status, emergency_contact_name, emergency_contact_phone
        } = req.body;

        // Check user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        // Upsert employee details
        const result = await pool.query(`
            INSERT INTO employee_details (
                user_id, nik, phone, address, birth_date, birth_place,
                gender, marital_status, religion, education,
                department, position, join_date,
                bank_name, bank_account, bank_holder,
                npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
                basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate,
                tax_status, emergency_contact_name, emergency_contact_phone,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27, CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO UPDATE SET
                nik = EXCLUDED.nik,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                birth_date = EXCLUDED.birth_date,
                birth_place = EXCLUDED.birth_place,
                gender = EXCLUDED.gender,
                marital_status = EXCLUDED.marital_status,
                religion = EXCLUDED.religion,
                education = EXCLUDED.education,
                department = EXCLUDED.department,
                position = EXCLUDED.position,
                join_date = EXCLUDED.join_date,
                bank_name = EXCLUDED.bank_name,
                bank_account = EXCLUDED.bank_account,
                bank_holder = EXCLUDED.bank_holder,
                npwp = EXCLUDED.npwp,
                bpjs_kesehatan_no = EXCLUDED.bpjs_kesehatan_no,
                bpjs_ketenagakerjaan_no = EXCLUDED.bpjs_ketenagakerjaan_no,
                basic_salary = EXCLUDED.basic_salary,
                salary_type = EXCLUDED.salary_type,
                transport_allowance = EXCLUDED.transport_allowance,
                meal_allowance = EXCLUDED.meal_allowance,
                overtime_rate = EXCLUDED.overtime_rate,
                tax_status = EXCLUDED.tax_status,
                emergency_contact_name = EXCLUDED.emergency_contact_name,
                emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            id, nik || null, phone || null, address || null, birth_date || null, birth_place || null,
            gender || null, marital_status || 'Belum Menikah', religion || null, education || null,
            department || null, position || null, join_date || null,
            bank_name || null, bank_account || null, bank_holder || null,
            npwp || null, bpjs_kesehatan_no || null, bpjs_ketenagakerjaan_no || null,
            basic_salary || 0, salary_type || 'monthly', transport_allowance || 0, meal_allowance || 0, overtime_rate || 50000,
            tax_status || 'TK/0', emergency_contact_name || null, emergency_contact_phone || null
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
