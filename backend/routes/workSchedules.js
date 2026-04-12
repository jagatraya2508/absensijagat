const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth');

// ============================================
// WORK SCHEDULE TYPES (Master Jadwal Kerja)
// ============================================

// Get all schedule types with shifts & overtime rules
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { department } = req.query;
        let query = `
            SELECT wst.*, 
                   COALESCE(json_agg(
                       json_build_object(
                           'id', ws.id,
                           'name', ws.name,
                           'shift_order', ws.shift_order,
                           'start_time', ws.start_time,
                           'end_time', ws.end_time,
                           'break_start', ws.break_start,
                           'break_end', ws.break_end,
                           'is_overnight', ws.is_overnight,
                           'color', ws.color
                       ) ORDER BY ws.shift_order
                   ) FILTER (WHERE ws.id IS NOT NULL), '[]') as shifts,
                   json_build_object(
                       'id', otr.id,
                       'overtime_type', otr.overtime_type,
                       'grace_period_minutes', otr.grace_period_minutes,
                       'min_overtime_minutes', otr.min_overtime_minutes,
                       'max_overtime_hours', otr.max_overtime_hours,
                       'rate_multiplier', otr.rate_multiplier
                   ) as overtime_rule
            FROM work_schedule_types wst
            LEFT JOIN work_shifts ws ON ws.schedule_type_id = wst.id
            LEFT JOIN overtime_rules otr ON otr.schedule_type_id = wst.id
        `;
        const values = [];
        if (department) {
            query += ` WHERE wst.department = $1`;
            values.push(department);
        }
        query += ` GROUP BY wst.id, otr.id ORDER BY wst.created_at DESC`;

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get work schedules error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create schedule type with shifts & overtime rule
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, type, shift_count, department, is_default, shifts, overtime_rule } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Nama dan tipe jadwal harus diisi' });
        }

        await client.query('BEGIN');

        // If setting as default, unset other defaults for same department
        if (is_default) {
            await client.query(
                `UPDATE work_schedule_types SET is_default = FALSE WHERE department = $1`,
                [department || null]
            );
        }

        // Create schedule type
        const schedResult = await client.query(`
            INSERT INTO work_schedule_types (name, type, shift_count, department, is_default)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [name, type, shift_count || 1, department || null, is_default || false]);
        const scheduleType = schedResult.rows[0];

        // Create shifts
        if (shifts && shifts.length > 0) {
            for (const shift of shifts) {
                await client.query(`
                    INSERT INTO work_shifts (schedule_type_id, name, shift_order, start_time, end_time, break_start, break_end, is_overnight, color)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    scheduleType.id,
                    shift.name,
                    shift.shift_order,
                    shift.start_time,
                    shift.end_time,
                    shift.break_start || null,
                    shift.break_end || null,
                    shift.is_overnight || false,
                    shift.color || '#3b82f6'
                ]);
            }
        }

        // Create overtime rule
        if (overtime_rule) {
            await client.query(`
                INSERT INTO overtime_rules (schedule_type_id, overtime_type, grace_period_minutes, min_overtime_minutes, max_overtime_hours, rate_multiplier)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                scheduleType.id,
                overtime_rule.overtime_type || 'immediate',
                overtime_rule.grace_period_minutes || 0,
                overtime_rule.min_overtime_minutes || 30,
                overtime_rule.max_overtime_hours || 4,
                overtime_rule.rate_multiplier || 1.5
            ]);
        }

        await client.query('COMMIT');

        // Fetch full record
        const fullResult = await pool.query(`
            SELECT wst.*, 
                   COALESCE(json_agg(
                       json_build_object('id', ws.id, 'name', ws.name, 'shift_order', ws.shift_order,
                           'start_time', ws.start_time, 'end_time', ws.end_time,
                           'break_start', ws.break_start, 'break_end', ws.break_end,
                           'is_overnight', ws.is_overnight, 'color', ws.color
                       ) ORDER BY ws.shift_order
                   ) FILTER (WHERE ws.id IS NOT NULL), '[]') as shifts,
                   json_build_object('id', otr.id, 'overtime_type', otr.overtime_type,
                       'grace_period_minutes', otr.grace_period_minutes,
                       'min_overtime_minutes', otr.min_overtime_minutes,
                       'max_overtime_hours', otr.max_overtime_hours,
                       'rate_multiplier', otr.rate_multiplier
                   ) as overtime_rule
            FROM work_schedule_types wst
            LEFT JOIN work_shifts ws ON ws.schedule_type_id = wst.id
            LEFT JOIN overtime_rules otr ON otr.schedule_type_id = wst.id
            WHERE wst.id = $1
            GROUP BY wst.id, otr.id
        `, [scheduleType.id]);

        res.status(201).json(fullResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create work schedule error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Update schedule type with shifts & overtime rule
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, type, shift_count, department, is_default, is_active, shifts, overtime_rule } = req.body;

        await client.query('BEGIN');

        // If setting as default, unset other defaults for same department
        if (is_default) {
            await client.query(
                `UPDATE work_schedule_types SET is_default = FALSE WHERE department = $1 AND id != $2`,
                [department || null, id]
            );
        }

        // Update schedule type
        await client.query(`
            UPDATE work_schedule_types 
            SET name = $1, type = $2, shift_count = $3, department = $4, 
                is_default = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [name, type, shift_count || 1, department || null, is_default || false, is_active !== false, id]);

        // Replace shifts: delete old, insert new
        await client.query('DELETE FROM work_shifts WHERE schedule_type_id = $1', [id]);
        if (shifts && shifts.length > 0) {
            for (const shift of shifts) {
                await client.query(`
                    INSERT INTO work_shifts (schedule_type_id, name, shift_order, start_time, end_time, break_start, break_end, is_overnight, color)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    id,
                    shift.name,
                    shift.shift_order,
                    shift.start_time,
                    shift.end_time,
                    shift.break_start || null,
                    shift.break_end || null,
                    shift.is_overnight || false,
                    shift.color || '#3b82f6'
                ]);
            }
        }

        // Upsert overtime rule
        if (overtime_rule) {
            await client.query(`
                INSERT INTO overtime_rules (schedule_type_id, overtime_type, grace_period_minutes, min_overtime_minutes, max_overtime_hours, rate_multiplier)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (schedule_type_id) DO UPDATE SET
                    overtime_type = $2, grace_period_minutes = $3, min_overtime_minutes = $4,
                    max_overtime_hours = $5, rate_multiplier = $6, updated_at = CURRENT_TIMESTAMP
            `, [
                id,
                overtime_rule.overtime_type || 'immediate',
                overtime_rule.grace_period_minutes || 0,
                overtime_rule.min_overtime_minutes || 30,
                overtime_rule.max_overtime_hours || 4,
                overtime_rule.rate_multiplier || 1.5
            ]);
        }

        await client.query('COMMIT');

        // Fetch full record
        const fullResult = await pool.query(`
            SELECT wst.*, 
                   COALESCE(json_agg(
                       json_build_object('id', ws.id, 'name', ws.name, 'shift_order', ws.shift_order,
                           'start_time', ws.start_time, 'end_time', ws.end_time,
                           'break_start', ws.break_start, 'break_end', ws.break_end,
                           'is_overnight', ws.is_overnight, 'color', ws.color
                       ) ORDER BY ws.shift_order
                   ) FILTER (WHERE ws.id IS NOT NULL), '[]') as shifts,
                   json_build_object('id', otr.id, 'overtime_type', otr.overtime_type,
                       'grace_period_minutes', otr.grace_period_minutes,
                       'min_overtime_minutes', otr.min_overtime_minutes,
                       'max_overtime_hours', otr.max_overtime_hours,
                       'rate_multiplier', otr.rate_multiplier
                   ) as overtime_rule
            FROM work_schedule_types wst
            LEFT JOIN work_shifts ws ON ws.schedule_type_id = wst.id
            LEFT JOIN overtime_rules otr ON otr.schedule_type_id = wst.id
            WHERE wst.id = $1
            GROUP BY wst.id, otr.id
        `, [id]);

        res.json(fullResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update work schedule error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Delete schedule type
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM work_schedule_types WHERE id = $1', [id]);
        res.json({ message: 'Jadwal kerja berhasil dihapus' });
    } catch (error) {
        console.error('Delete work schedule error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get single schedule type
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT wst.*, 
                   COALESCE(json_agg(
                       json_build_object(
                           'id', ws.id,
                           'name', ws.name,
                           'shift_order', ws.shift_order,
                           'start_time', ws.start_time,
                           'end_time', ws.end_time,
                           'break_start', ws.break_start,
                           'break_end', ws.break_end,
                           'is_overnight', ws.is_overnight,
                           'color', ws.color
                       ) ORDER BY ws.shift_order
                   ) FILTER (WHERE ws.id IS NOT NULL), '[]') as shifts,
                   json_build_object(
                       'id', otr.id,
                       'overtime_type', otr.overtime_type,
                       'grace_period_minutes', otr.grace_period_minutes,
                       'min_overtime_minutes', otr.min_overtime_minutes,
                       'max_overtime_hours', otr.max_overtime_hours,
                       'rate_multiplier', otr.rate_multiplier
                   ) as overtime_rule
            FROM work_schedule_types wst
            LEFT JOIN work_shifts ws ON ws.schedule_type_id = wst.id
            LEFT JOIN overtime_rules otr ON otr.schedule_type_id = wst.id
            WHERE wst.id = $1
            GROUP BY wst.id, otr.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Jadwal kerja tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get work schedule error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});


// ============================================
// EMPLOYEE SHIFT ASSIGNMENTS
// ============================================

// Get all shifts (for dropdown)
router.get('/shifts/all', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ws.*, wst.name as schedule_name, wst.department
            FROM work_shifts ws
            JOIN work_schedule_types wst ON wst.id = ws.schedule_type_id
            WHERE wst.is_active = TRUE
            ORDER BY wst.department, wst.name, ws.shift_order
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all shifts error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get assignments with filters
router.get('/assignments/list', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { start_date, end_date, department, user_id } = req.query;
        let query = `
            SELECT esa.*, u.name as user_name, u.employee_id,
                   ws.name as shift_name, ws.start_time, ws.end_time, ws.color,
                   ed.department,
                   wst.name as schedule_name
            FROM employee_shift_assignments esa
            JOIN users u ON u.id = esa.user_id
            JOIN work_shifts ws ON ws.id = esa.shift_id
            JOIN work_schedule_types wst ON wst.id = ws.schedule_type_id
            LEFT JOIN employee_details ed ON ed.user_id = esa.user_id
            WHERE 1=1
        `;
        const values = [];
        let p = 1;

        if (start_date) {
            query += ` AND esa.assignment_date >= $${p++}`;
            values.push(start_date);
        }
        if (end_date) {
            query += ` AND esa.assignment_date <= $${p++}`;
            values.push(end_date);
        }
        if (department) {
            query += ` AND ed.department = $${p++}`;
            values.push(department);
        }
        if (user_id) {
            query += ` AND esa.user_id = $${p++}`;
            values.push(user_id);
        }

        query += ' ORDER BY esa.assignment_date, u.name';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Bulk assign shifts (bisa harian, mingguan, bulanan)
router.post('/assignments/bulk', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_ids, shift_id, dates } = req.body;
        // dates is array of 'YYYY-MM-DD'

        if (!user_ids || !user_ids.length || !shift_id || !dates || !dates.length) {
            return res.status(400).json({ error: 'Data karyawan, shift, dan tanggal harus diisi' });
        }

        await client.query('BEGIN');

        let insertedCount = 0;
        for (const userId of user_ids) {
            for (const date of dates) {
                await client.query(`
                    INSERT INTO employee_shift_assignments (user_id, shift_id, assignment_date, created_by)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id, assignment_date) DO UPDATE SET
                        shift_id = $2, created_by = $4
                `, [userId, shift_id, date, req.user.id]);
                insertedCount++;
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `${insertedCount} penugasan shift berhasil disimpan` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk assign error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Update single assignment
router.put('/assignments/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { shift_id, assignment_date, user_id } = req.body;
        
        if (!shift_id || !assignment_date || !user_id) {
            return res.status(400).json({ error: 'Shift, tanggal, dan karyawan harus diisi' });
        }

        // Check if user already has another shift on that date
        const check = await pool.query('SELECT id FROM employee_shift_assignments WHERE user_id = $1 AND assignment_date = $2 AND id != $3', [user_id, assignment_date, id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Karyawan sudah memiliki shift di tanggal tersebut' });
        }

        const result = await pool.query(`
            UPDATE employee_shift_assignments
            SET shift_id = $1, assignment_date = $2, user_id = $3, created_by = $4
            WHERE id = $5 RETURNING *
        `, [shift_id, assignment_date, user_id, req.user.id, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penugasan tidak ditemukan' });
        }
        res.json({ message: 'Penugasan berhasil diperbarui', data: result.rows[0] });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete assignment
router.delete('/assignments/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM employee_shift_assignments WHERE id = $1', [id]);
        res.json({ message: 'Penugasan shift berhasil dihapus' });
    } catch (error) {
        console.error('Delete assignment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});


// ============================================
// OVERTIME REQUESTS / SPL (Surat Perintah Lembur)
// ============================================

// Generate SPL number
async function generateSplNumber(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const prefix = `SPL/${year}/${month}`;

    const result = await pool.query(
        `SELECT COUNT(*) as count FROM overtime_requests WHERE spl_number LIKE $1`,
        [`${prefix}/%`]
    );
    const seq = parseInt(result.rows[0].count) + 1;
    return `${prefix}/${String(seq).padStart(4, '0')}`;
}

// Get overtime requests
router.get('/overtime-requests/list', authenticateToken, async (req, res) => {
    try {
        const { month, year, department, status } = req.query;
        let query = `
            SELECT otr.*,
                   u_req.name as requested_by_name,
                   u_app.name as approved_by_name,
                   ws.name as shift_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'id', ore.id,
                           'user_id', ore.user_id,
                           'user_name', u_emp.name,
                           'employee_id', u_emp.employee_id,
                           'actual_hours', ore.actual_hours,
                           'notes', ore.notes
                       ) ORDER BY u_emp.name
                   ) FILTER (WHERE ore.id IS NOT NULL), '[]') as employees
            FROM overtime_requests otr
            LEFT JOIN users u_req ON u_req.id = otr.requested_by
            LEFT JOIN users u_app ON u_app.id = otr.approved_by
            LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
            LEFT JOIN overtime_request_employees ore ON ore.overtime_request_id = otr.id
            LEFT JOIN users u_emp ON u_emp.id = ore.user_id
            WHERE 1=1
        `;
        const values = [];
        let p = 1;

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM otr.date) = $${p++} AND EXTRACT(YEAR FROM otr.date) = $${p++}`;
            values.push(month, year);
        } else if (year) {
            query += ` AND EXTRACT(YEAR FROM otr.date) = $${p++}`;
            values.push(year);
        }
        if (department) {
            query += ` AND otr.department = $${p++}`;
            values.push(department);
        }
        if (status) {
            query += ` AND otr.status = $${p++}`;
            values.push(status);
        }

        // Non-admin and non-manager employees only see their own.
        // If query has ?self=true, then force user filter even if they are admin/manager.
        if (req.user.role !== 'admin' && req.user.role !== 'manager' || req.query.self === 'true') {
            query += ` AND (otr.requested_by = $${p} OR ore.user_id = $${p})`;
            values.push(req.user.id);
            p++;
        }

        query += ' GROUP BY otr.id, u_req.name, u_app.name, ws.name ORDER BY otr.date DESC, otr.created_at DESC';

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get overtime requests error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create overtime request (SPL)
router.post('/overtime-requests', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { date, shift_id, department, overtime_start, overtime_end, estimated_hours, reason, employee_ids } = req.body;

        if (!date || !overtime_start || !overtime_end || !reason || !employee_ids || !employee_ids.length) {
            return res.status(400).json({ error: 'Tanggal, jam mulai, jam selesai, alasan, dan karyawan harus diisi' });
        }

        await client.query('BEGIN');

        const splNumber = await generateSplNumber(date);

        const result = await client.query(`
            INSERT INTO overtime_requests (spl_number, date, shift_id, department, overtime_start, overtime_end, estimated_hours, reason, requested_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [splNumber, date, shift_id || null, department || null, overtime_start, overtime_end, estimated_hours, reason, req.user.id]);

        const otRequest = result.rows[0];

        // Add employees
        for (const empId of employee_ids) {
            await client.query(`
                INSERT INTO overtime_request_employees (overtime_request_id, user_id)
                VALUES ($1, $2)
            `, [otRequest.id, empId]);
        }

        await client.query('COMMIT');

        // Fetch full record with employees
        const fullResult = await pool.query(`
            SELECT otr.*,
                   u_req.name as requested_by_name,
                   COALESCE(json_agg(
                       json_build_object('id', ore.id, 'user_id', ore.user_id,
                           'user_name', u_emp.name, 'employee_id', u_emp.employee_id,
                           'actual_hours', ore.actual_hours, 'notes', ore.notes
                       ) ORDER BY u_emp.name
                   ) FILTER (WHERE ore.id IS NOT NULL), '[]') as employees
            FROM overtime_requests otr
            LEFT JOIN users u_req ON u_req.id = otr.requested_by
            LEFT JOIN overtime_request_employees ore ON ore.overtime_request_id = otr.id
            LEFT JOIN users u_emp ON u_emp.id = ore.user_id
            WHERE otr.id = $1
            GROUP BY otr.id, u_req.name
        `, [otRequest.id]);

        res.status(201).json(fullResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create overtime request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Approve/reject overtime request - Managers and Admins can do this
router.put('/overtime-requests/:id/status', authenticateToken, isManagerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        if (!['approved', 'rejected', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        const result = await pool.query(`
            UPDATE overtime_requests 
            SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, 
                admin_notes = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 RETURNING *
        `, [status, req.user.id, admin_notes || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan lembur tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update overtime request status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update actual hours for employee in SPL
router.put('/overtime-requests/:reqId/employees/:empId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { reqId, empId } = req.params;
        const { actual_hours, notes } = req.body;

        const result = await pool.query(`
            UPDATE overtime_request_employees 
            SET actual_hours = $1, notes = $2
            WHERE overtime_request_id = $3 AND id = $4 RETURNING *
        `, [actual_hours, notes || null, reqId, empId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data karyawan tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update overtime employee error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete overtime request
router.delete('/overtime-requests/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM overtime_requests WHERE id = $1', [id]);
        res.json({ message: 'Pengajuan lembur berhasil dihapus' });
    } catch (error) {
        console.error('Delete overtime request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get departments list (helper)
router.get('/helpers/departments', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT department FROM employee_details 
            WHERE department IS NOT NULL AND department != ''
            ORDER BY department
        `);
        res.json(result.rows.map(r => r.department));
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get employees list (helper, with department filter)
router.get('/helpers/employees', authenticateToken, async (req, res) => {
    try {
        const { department } = req.query;
        let query = `
            SELECT u.id, u.name, u.employee_id, ed.department, ed.position
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            WHERE u.role != 'admin'
        `;
        const values = [];
        if (department) {
            query += ` AND ed.department = $1`;
            values.push(department);
        }
        query += ' ORDER BY u.name';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
