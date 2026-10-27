const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper to check if requester can manage/approve shift requests
async function canApproveShiftRequests(req) {
    if (req.user.role === 'admin' || req.user.role === 'manager') return true;
    
    // Check if user is a supervisor
    const supCheck = await pool.query(
        'SELECT 1 FROM employee_details WHERE supervisor_id = $1 LIMIT 1',
        [req.user.id]
    );
    if (supCheck.rows.length > 0) return true;

    // Check permission
    const permCheck = await pool.query(
        `SELECT 1 FROM role_permissions rp
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $1 AND rp.permission_key IN ('admin.work_schedule', 'manager.approvals')`,
        [req.user.role]
    );
    return permCheck.rows.length > 0;
}

// 1. GET /my: Get my shift change requests (as requester or target)
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const { month, year, status } = req.query;
        let query = `
            SELECT scr.*,
                   u_req.name as user_name, u_req.employee_id as user_employee_id,
                   u_tar.name as target_user_name, u_tar.employee_id as target_employee_id,
                   ws_cur.name as current_shift_name, ws_cur.start_time as current_shift_start, ws_cur.end_time as current_shift_end, ws_cur.color as current_shift_color,
                   ws_tar.name as target_shift_name, ws_tar.start_time as target_shift_start, ws_tar.end_time as target_shift_end, ws_tar.color as target_shift_color,
                   ws_tus.name as target_user_shift_name, ws_tus.start_time as target_user_shift_start, ws_tus.end_time as target_user_shift_end, ws_tus.color as target_user_shift_color,
                   u_app.name as approved_by_name
            FROM shift_change_requests scr
            JOIN users u_req ON u_req.id = scr.user_id
            LEFT JOIN users u_tar ON u_tar.id = scr.target_user_id
            LEFT JOIN work_shifts ws_cur ON ws_cur.id = scr.current_shift_id
            LEFT JOIN work_shifts ws_tar ON ws_tar.id = scr.target_shift_id
            LEFT JOIN work_shifts ws_tus ON ws_tus.id = scr.target_user_shift_id
            LEFT JOIN users u_app ON u_app.id = scr.approved_by
            WHERE (scr.user_id = $1 OR scr.target_user_id = $1)
        `;
        const values = [req.user.id];
        let p = 2;

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM scr.request_date) = $${p++} AND EXTRACT(YEAR FROM scr.request_date) = $${p++}`;
            values.push(month, year);
        } else if (year) {
            query += ` AND EXTRACT(YEAR FROM scr.request_date) = $${p++}`;
            values.push(year);
        }

        if (status) {
            query += ` AND scr.status = $${p++}`;
            values.push(status);
        }

        query += ` ORDER BY scr.created_at DESC`;
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get my shift change requests error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// 2. GET /list: For manager/admin to view incoming shift change requests
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const canApprove = await canApproveShiftRequests(req);
        if (!canApprove) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki wewenang persetujuan shift.' });
        }

        const { month, year, status, department } = req.query;
        let query = `
            SELECT scr.*,
                   u_req.name as user_name, u_req.employee_id as user_employee_id,
                   ed_req.department as user_department, ed_req.position as user_position,
                   u_tar.name as target_user_name, u_tar.employee_id as target_employee_id,
                   ed_tar.department as target_department,
                   ws_cur.name as current_shift_name, ws_cur.start_time as current_shift_start, ws_cur.end_time as current_shift_end, ws_cur.color as current_shift_color,
                   ws_tar.name as target_shift_name, ws_tar.start_time as target_shift_start, ws_tar.end_time as target_shift_end, ws_tar.color as target_shift_color,
                   ws_tus.name as target_user_shift_name, ws_tus.start_time as target_user_shift_start, ws_tus.end_time as target_user_shift_end, ws_tus.color as target_user_shift_color,
                   u_app.name as approved_by_name
            FROM shift_change_requests scr
            JOIN users u_req ON u_req.id = scr.user_id
            LEFT JOIN employee_details ed_req ON ed_req.user_id = scr.user_id
            LEFT JOIN users u_tar ON u_tar.id = scr.target_user_id
            LEFT JOIN employee_details ed_tar ON ed_tar.user_id = scr.target_user_id
            LEFT JOIN work_shifts ws_cur ON ws_cur.id = scr.current_shift_id
            LEFT JOIN work_shifts ws_tar ON ws_tar.id = scr.target_shift_id
            LEFT JOIN work_shifts ws_tus ON ws_tus.id = scr.target_user_shift_id
            LEFT JOIN users u_app ON u_app.id = scr.approved_by
            WHERE 1=1
        `;
        const values = [];
        let p = 1;

        // If user is supervisor only (not admin or manager), limit to their subordinates
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            query += ` AND (ed_req.supervisor_id = $${p++} OR ed_tar.supervisor_id = $${p++})`;
            values.push(req.user.id, req.user.id);
        }

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM scr.request_date) = $${p++} AND EXTRACT(YEAR FROM scr.request_date) = $${p++}`;
            values.push(month, year);
        } else if (year) {
            query += ` AND EXTRACT(YEAR FROM scr.request_date) = $${p++}`;
            values.push(year);
        }

        if (status) {
            query += ` AND scr.status = $${p++}`;
            values.push(status);
        }

        if (department) {
            query += ` AND (ed_req.department = $${p++} OR ed_tar.department = $${p++})`;
            values.push(department, department);
        }

        query += ` ORDER BY scr.created_at DESC`;
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get shift change list error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Helper: find assigned or default shift for a user on date
async function findUserShiftOnDate(userId, dateStr) {
    // 1. Check direct assignment
    const assignRes = await pool.query(`
        SELECT ws.* 
        FROM employee_shift_assignments esa
        JOIN work_shifts ws ON ws.id = esa.shift_id
        WHERE esa.user_id = $1 AND esa.assignment_date = $2
        LIMIT 1
    `, [userId, dateStr]);

    if (assignRes.rows.length > 0) {
        return { shift: assignRes.rows[0], is_assigned: true };
    }

    // 2. Check default work schedule for user's department/position
    const defaultRes = await pool.query(`
        SELECT ws.*
        FROM users u
        LEFT JOIN employee_details ed ON ed.user_id = u.id
        LEFT JOIN departments d ON d.name = ed.department
        LEFT JOIN positions pos ON pos.name = ed.position
        JOIN work_schedule_types wst ON wst.is_active = TRUE
          AND (
            wst.is_default = TRUE
            OR wst.department_id = d.id
            OR wst.position_id = pos.id
            OR EXISTS (SELECT 1 FROM work_schedule_departments wsd WHERE wsd.schedule_type_id = wst.id AND wsd.department_id = d.id)
            OR EXISTS (SELECT 1 FROM work_schedule_positions wsp WHERE wsp.schedule_type_id = wst.id AND wsp.position_id = pos.id)
          )
        JOIN work_shifts ws ON ws.schedule_type_id = wst.id
        WHERE u.id = $1
        ORDER BY ws.shift_order ASC
        LIMIT 1
    `, [userId]);

    if (defaultRes.rows.length > 0) {
        return { shift: defaultRes.rows[0], is_assigned: false };
    }

    return { shift: null, is_assigned: false };
}

// 3. GET /user-shift: Get current shift of a user on a specific date
router.get('/user-shift', authenticateToken, async (req, res) => {
    try {
        const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : req.user.id;
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);

        const data = await findUserShiftOnDate(userId, dateStr);
        res.json(data);
    } catch (error) {
        console.error('Get user shift on date error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// 4. GET /colleagues: List potential colleagues to swap shifts with
router.get('/colleagues', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.employee_id, ed.department, ed.position
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            WHERE u.id != $1 AND u.role != 'kiosk'
            ORDER BY u.name ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get colleagues error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// 5. POST /: Submit a shift change / swap request
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            request_type = 'change',
            request_date,
            target_shift_id,
            target_user_id,
            target_user_date,
            reason
        } = req.body;

        if (!request_date || !reason || !reason.trim()) {
            return res.status(400).json({ error: 'Tanggal shift dan alasan permohonan wajib diisi' });
        }

        if (request_type === 'change' && !target_shift_id) {
            return res.status(400).json({ error: 'Shift tujuan yang diinginkan wajib dipilih' });
        }

        if (request_type === 'swap') {
            if (!target_user_id) {
                return res.status(400).json({ error: 'Rekan kerja untuk tukar shift wajib dipilih' });
            }
            if (parseInt(target_user_id, 10) === req.user.id) {
                return res.status(400).json({ error: 'Tidak dapat bertukar shift dengan diri sendiri' });
            }
        }

        // 1. Get current shift of requester on request_date
        const requesterShiftData = await findUserShiftOnDate(req.user.id, request_date);
        const currentShiftId = requesterShiftData.shift?.id || null;

        // Check if pending request already exists for the same date
        const existingPending = await pool.query(
            `SELECT id FROM shift_change_requests 
             WHERE user_id = $1 AND request_date = $2 AND status = 'pending'`,
            [req.user.id, request_date]
        );
        if (existingPending.rows.length > 0) {
            return res.status(400).json({ error: 'Anda sudah memiliki pengajuan perubahan shift yang sedang menunggu persetujuan pada tanggal tersebut' });
        }

        let targetUserShiftId = null;
        let actualTargetShiftId = target_shift_id || null;
        const targetDate = target_user_date || request_date;

        if (request_type === 'swap') {
            // Find target user's shift on targetDate
            const targetUserShiftData = await findUserShiftOnDate(target_user_id, targetDate);
            targetUserShiftId = targetUserShiftData.shift?.id || null;

            if (!targetUserShiftId) {
                return res.status(400).json({
                    error: 'Rekan kerja yang dipilih belum memiliki jadwal shift pada tanggal tersebut'
                });
            }

            if (currentShiftId && currentShiftId === targetUserShiftId && request_date === targetDate) {
                return res.status(400).json({
                    error: 'Anda dan rekan kerja sudah berada di shift yang sama pada tanggal tersebut'
                });
            }

            // For swap, requester's target shift becomes the target user's shift
            actualTargetShiftId = targetUserShiftId;
        } else {
            // For 'change': ensure target_shift_id is different from currentShiftId
            if (currentShiftId && currentShiftId === parseInt(target_shift_id, 10)) {
                return res.status(400).json({ error: 'Shift tujuan tidak boleh sama dengan shift Anda saat ini' });
            }
        }

        const insertResult = await pool.query(`
            INSERT INTO shift_change_requests (
                request_type, user_id, target_user_id, request_date,
                current_shift_id, target_shift_id, target_user_date, target_user_shift_id,
                reason, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
            RETURNING *
        `, [
            request_type,
            req.user.id,
            request_type === 'swap' ? target_user_id : null,
            request_date,
            currentShiftId,
            actualTargetShiftId,
            request_type === 'swap' ? targetDate : null,
            targetUserShiftId,
            reason.trim()
        ]);

        const newRequest = insertResult.rows[0];

        // Send notifications to supervisors/admins
        try {
            const { createNotifications, findUsersByAccess } = require('../utils/notifications');
            const admins = await findUsersByAccess(pool, {
                permissionKey: 'admin.work_schedule',
                includeManagers: true,
                excludeUserId: req.user.id
            });

            // Also find direct supervisor
            const supRes = await pool.query(
                `SELECT u.id, u.name, u.email FROM employee_details ed 
                 JOIN users u ON u.id = ed.supervisor_id 
                 WHERE ed.user_id = $1`,
                [req.user.id]
            );
            const supervisor = supRes.rows[0];
            const recipients = [...admins];
            if (supervisor && !recipients.some(r => r.id === supervisor.id)) {
                recipients.push(supervisor);
            }

            const title = request_type === 'swap' ? 'Pengajuan Tukar Shift' : 'Pengajuan Pindah Shift';
            const msg = `${req.user.name || 'Karyawan'} mengajukan ${title.toLowerCase()} untuk tanggal ${request_date}.`;

            await createNotifications(pool, recipients.map(r => ({
                userId: r.id,
                name: r.name,
                email: r.email,
                category: 'shift_change',
                title,
                message: msg,
                link: '/admin/work-schedule',
                referenceType: 'shift_change_request',
                referenceId: newRequest.id
            })));
        } catch (notifErr) {
            console.warn('Failed to send shift change notification:', notifErr.message);
        }

        res.status(201).json({
            message: 'Pengajuan perubahan shift berhasil dikirim',
            data: newRequest
        });
    } catch (error) {
        console.error('Create shift change request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// 6. PUT /:id/status: Approve or Reject a shift change request
router.put('/:id/status', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const canApprove = await canApproveShiftRequests(req);
        if (!canApprove) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki wewenang persetujuan shift.' });
        }

        const { id } = req.params;
        const { status, approval_notes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid (hanya approved atau rejected)' });
        }

        await client.query('BEGIN');

        const reqCheck = await client.query(
            'SELECT * FROM shift_change_requests WHERE id = $1 FOR UPDATE',
            [id]
        );
        if (reqCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pengajuan shift tidak ditemukan' });
        }

        const shiftReq = reqCheck.rows[0];
        if (shiftReq.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Pengajuan ini sudah ${shiftReq.status}` });
        }

        // If approved: update the assignments!
        if (status === 'approved') {
            if (shiftReq.request_type === 'change') {
                // Upsert employee_shift_assignments for user_id on request_date
                await client.query(`
                    INSERT INTO employee_shift_assignments (user_id, shift_id, assignment_date, created_by)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id, assignment_date) DO UPDATE SET
                        shift_id = $2, created_by = $4
                `, [shiftReq.user_id, shiftReq.target_shift_id, shiftReq.request_date, req.user.id]);
            } else if (shiftReq.request_type === 'swap') {
                const targetDate = shiftReq.target_user_date || shiftReq.request_date;

                // 1. Assign target user's shift to requester
                await client.query(`
                    INSERT INTO employee_shift_assignments (user_id, shift_id, assignment_date, created_by)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id, assignment_date) DO UPDATE SET
                        shift_id = $2, created_by = $4
                `, [shiftReq.user_id, shiftReq.target_shift_id, shiftReq.request_date, req.user.id]);

                // 2. Assign requester's shift to target user
                await client.query(`
                    INSERT INTO employee_shift_assignments (user_id, shift_id, assignment_date, created_by)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id, assignment_date) DO UPDATE SET
                        shift_id = $2, created_by = $4
                `, [shiftReq.target_user_id, shiftReq.current_shift_id, targetDate, req.user.id]);
            }
        }

        // Update the shift_change_requests record
        const updateResult = await client.query(`
            UPDATE shift_change_requests
            SET status = $1, approved_by = $2, approval_notes = $3,
                approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [status, req.user.id, approval_notes || null, id]);

        await client.query('COMMIT');

        // Send notification to employee(s)
        try {
            const { createNotifications } = require('../utils/notifications');
            const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [shiftReq.user_id]);
            const targetUserRes = shiftReq.target_user_id ? await pool.query('SELECT id, name, email FROM users WHERE id = $1', [shiftReq.target_user_id]) : { rows: [] };

            const statusText = status === 'approved' ? 'DISETUJUI' : 'DITOLAK';
            const notifTitle = `Pengajuan Perubahan Shift ${statusText}`;
            const notifMsg = `Pengajuan perubahan shift Anda untuk tanggal ${shiftReq.request_date} telah ${statusText.toLowerCase()}.${approval_notes ? ` Catatan: ${approval_notes}` : ''}`;

            const notifyUsers = [];
            if (userRes.rows[0]) notifyUsers.push(userRes.rows[0]);
            if (status === 'approved' && targetUserRes.rows[0]) notifyUsers.push(targetUserRes.rows[0]);

            await createNotifications(pool, notifyUsers.map(u => ({
                userId: u.id,
                name: u.name,
                email: u.email,
                category: 'shift_change',
                title: notifTitle,
                message: notifMsg,
                link: '/schedule',
                referenceType: 'shift_change_request',
                referenceId: shiftReq.id
            })));
        } catch (notifErr) {
            console.warn('Failed to send status update notification:', notifErr.message);
        }

        res.json({
            message: `Pengajuan shift berhasil di-${status === 'approved' ? 'setujui dan jadwal telah diperbarui' : 'tolak'}`,
            data: updateResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update shift change request status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// 7. DELETE /:id: Cancel pending request by requester or admin
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT * FROM shift_change_requests WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const r = check.rows[0];
        if (req.user.role !== 'admin' && r.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Anda hanya dapat membatalkan pengajuan milik Anda sendiri' });
        }

        if (r.status !== 'pending' && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'Hanya pengajuan yang masih pending yang dapat dibatalkan' });
        }

        await pool.query('DELETE FROM shift_change_requests WHERE id = $1', [id]);
        res.json({ message: 'Pengajuan perubahan shift berhasil dibatalkan' });
    } catch (error) {
        console.error('Delete shift change request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
