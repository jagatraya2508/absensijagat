const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const {
    ensureOrgApprovalSchema,
    createApprovalSteps,
    attachApprovalSteps,
    getApprovalAccess,
    userHasLeaveAdminAccess
} = require('../utils/leaveApproval');

router.use(async (req, res, next) => {
    try {
        await ensureOrgApprovalSchema(pool);
        next();
    } catch (error) {
        console.error('Ensure leave approval schema error:', error);
        next();
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/leave');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'leave-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar (jpg, png) atau PDF yang diizinkan'));
    }
});

function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

async function getUsedLeaveDays(userId, year, settings) {
    let types = ["'leave'"];
    if (settings && settings.late_deducts_leave) types.push("'late'");
    if (settings && settings.sick_deducts_leave) types.push("'sick'");
    if (settings && settings.permission_deducts_leave) types.push("'permission'");

    const result = await pool.query(
        `SELECT start_date, end_date 
         FROM leave_requests 
         WHERE user_id = $1 
           AND type IN (${types.join(',')}) 
           AND status IN ('approved', 'pending')
           AND EXTRACT(YEAR FROM start_date) = $2`,
        [userId, year]
    );

    let totalDays = 0;
    for (const row of result.rows) {
        totalDays += calculateDays(row.start_date, row.end_date);
    }
    return totalDays;
}

async function getUserLeaveQuota(userId, year) {
    const setRes = await pool.query('SELECT * FROM leave_settings LIMIT 1');
    const settings = setRes.rows[0] || { annual_leave_quota: 12 };

    let quota = settings.annual_leave_quota;

    const empRes = await pool.query('SELECT join_date FROM employee_details WHERE user_id = $1', [userId]);
    if (empRes.rows.length > 0 && empRes.rows[0].join_date) {
        const joinYear = new Date(empRes.rows[0].join_date).getFullYear();
        const yearsWorked = year - joinYear;

        if (yearsWorked > 0) {
            const rulesRes = await pool.query('SELECT leave_days FROM big_leave_rules WHERE min_years = $1 AND is_active = true', [yearsWorked]);
            if (rulesRes.rows.length > 0) {
                quota += rulesRes.rows[0].leave_days;
            }
        }
    }

    return { quota, settings };
}

// Create new leave request (Employee)
router.post('/', authenticateToken, upload.single('attachment'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { type, start_date, end_date, reason, replacement_date } = req.body;
        const userId = req.user.id;

        if (!['late', 'sick', 'leave', 'change_off', 'permission'].includes(type)) {
            return res.status(400).json({ error: 'Jenis izin tidak valid' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Tanggal mulai dan selesai harus diisi' });
        }

        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih dari tanggal selesai' });
        }

        if (type === 'change_off' && !replacement_date) {
            return res.status(400).json({ error: 'Tanggal pengganti harus diisi untuk tukar libur' });
        }

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ error: 'Alasan harus diisi minimal 10 karakter' });
        }

        const year = new Date(start_date).getFullYear();
        const { quota, settings } = await getUserLeaveQuota(userId, year);

        let deductsLeave = false;
        if (type === 'leave') deductsLeave = true;
        if (type === 'late' && settings.late_deducts_leave) deductsLeave = true;
        if (type === 'sick' && settings.sick_deducts_leave) deductsLeave = true;
        if (type === 'permission' && settings.permission_deducts_leave) deductsLeave = true;

        if (deductsLeave) {
            const requestedDays = calculateDays(start_date, end_date);
            const usedDays = await getUsedLeaveDays(userId, year, settings);
            const remainingDays = quota - usedDays;

            if (requestedDays > remainingDays) {
                return res.status(400).json({
                    error: `Sisa cuti Anda tahun ${year} adalah ${remainingDays} hari. Anda mengajukan ${requestedDays} hari. (Dipotong oleh pengajuan ini)`,
                    remaining_days: remainingDays,
                    requested_days: requestedDays
                });
            }
        }

        const attachmentPath = req.file ? `/uploads/leave/${req.file.filename}` : null;

        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, attachment_path, replacement_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [userId, type, start_date, end_date, reason.trim(), attachmentPath, replacement_date || null]
        );

        const request = result.rows[0];
        await createApprovalSteps(client, request.id, userId, type);

        const withSteps = await client.query(
            `SELECT lr.*, u.name as approver_name
             FROM leave_requests lr
             LEFT JOIN users u ON lr.approved_by = u.id
             WHERE lr.id = $1`,
            [request.id]
        );

        await client.query('COMMIT');

        const [payload] = await attachApprovalSteps(pool, withSteps.rows);

        res.status(201).json({
            message: 'Pengajuan izin berhasil dibuat',
            data: payload
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create leave request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Get my leave requests (Employee)
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        let query = `
            SELECT lr.*, u.name as approver_name
            FROM leave_requests lr
            LEFT JOIN users u ON lr.approved_by = u.id
            WHERE lr.user_id = $1
        `;
        const params = [userId];

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query += ` AND lr.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY lr.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(await attachApprovalSteps(pool, result.rows));
    } catch (error) {
        console.error('Get my leave requests error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get my leave quota info (Employee)
router.get('/my-quota', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const year = new Date().getFullYear();
        const { quota, settings } = await getUserLeaveQuota(userId, year);
        const usedDays = await getUsedLeaveDays(userId, year, settings);

        res.json({
            year,
            quota: quota,
            used: usedDays,
            remaining: quota - usedDays,
            settings
        });
    } catch (error) {
        console.error('Get quota error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Inbox: requests waiting for current user (supervisor or HR)
router.get('/pending-for-me', authenticateToken, async (req, res) => {
    try {
        const isHr = await userHasLeaveAdminAccess(pool, req.user);
        const result = await pool.query(
            `SELECT lr.*,
                    u.name as employee_name,
                    u.employee_id,
                    ed.department,
                    ed.position,
                    s.step_order as current_step_order,
                    s.approver_label as current_approver_label,
                    s.id as current_step_id
             FROM leave_approval_steps s
             JOIN leave_requests lr ON lr.id = s.leave_request_id
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN employee_details ed ON ed.user_id = u.id
             WHERE lr.status = 'pending'
               AND s.status = 'pending'
               AND (
                    s.approver_id = $1
                    OR ($2 = true AND s.approver_id IS NULL)
               )
             ORDER BY lr.created_at ASC`,
            [req.user.id, isHr]
        );

        // HR sees all pending; supervisors only their assigned step.
        // The OR ($2 = true) already includes all for HR. Deduplicate by request id.
        const unique = [];
        const seen = new Set();
        for (const row of result.rows) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            unique.push(row);
        }

        res.json(await attachApprovalSteps(pool, unique));
    } catch (error) {
        console.error('Get pending-for-me error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all leave requests (HR / admin)
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const isHr = await userHasLeaveAdminAccess(pool, req.user);
        if (!isHr) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const { status, user_id } = req.query;

        let query = `
            SELECT lr.*, 
                   u.name as employee_name, 
                   u.employee_id,
                   ed.department,
                   ed.position,
                   approver.name as approver_name
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            LEFT JOIN users approver ON lr.approved_by = approver.id
            WHERE 1=1
        `;
        const params = [];

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            params.push(status);
            query += ` AND lr.status = $${params.length}`;
        }

        if (user_id) {
            params.push(user_id);
            query += ` AND lr.user_id = $${params.length}`;
        }

        query += ` ORDER BY lr.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(await attachApprovalSteps(pool, result.rows));
    } catch (error) {
        console.error('Get all leave requests error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Pending count for badge (assigned to me, or all if HR)
router.get('/pending-count', authenticateToken, async (req, res) => {
    try {
        const isHr = await userHasLeaveAdminAccess(pool, req.user);
        const result = await pool.query(
            `SELECT COUNT(DISTINCT lr.id) as count
             FROM leave_requests lr
             LEFT JOIN leave_approval_steps s
               ON s.leave_request_id = lr.id AND s.status = 'pending'
             WHERE lr.status = 'pending'
               AND (
                    $2 = true
                    OR s.approver_id = $1
                    OR (s.approver_id IS NULL AND $2 = true)
               )`,
            [req.user.id, isHr]
        );
        res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (error) {
        console.error('Get pending count error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Approve / reject (current step, or final override for HR)
router.put('/:id/status', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status, admin_notes, final } = req.body;
        const actorId = req.user.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        const checkResult = await pool.query(`SELECT * FROM leave_requests WHERE id = $1`, [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const request = checkResult.rows[0];
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Pengajuan sudah diproses sebelumnya' });
        }

        if (request.user_id === actorId) {
            return res.status(403).json({ error: 'Tidak dapat menyetujui pengajuan sendiri' });
        }

        const access = await getApprovalAccess(pool, req.user, id);
        if (!access.allowed) {
            return res.status(403).json({ error: 'Anda tidak berwenang memproses pengajuan ini' });
        }

        await client.query('BEGIN');

        const stepsRes = await client.query(
            `SELECT * FROM leave_approval_steps WHERE leave_request_id = $1 ORDER BY step_order ASC`,
            [id]
        );

        // Legacy requests without steps: keep old single-approve behavior
        if (stepsRes.rows.length === 0) {
            if (!access.isHr) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Pengajuan lama hanya dapat diproses Admin / HR' });
            }
            const result = await client.query(
                `UPDATE leave_requests 
                 SET status = $1, approved_by = $2, admin_notes = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING *`,
                [status, actorId, admin_notes || null, id]
            );
            await client.query('COMMIT');
            return res.json({
                message: status === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak',
                data: result.rows[0]
            });
        }

        const currentStep = access.currentStep || stepsRes.rows.find((s) => s.status === 'pending');
        if (!currentStep) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Tidak ada langkah approval yang menunggu' });
        }

        const notes = admin_notes || null;
        const forceFinal = !!final && access.isHr && status === 'approved';

        if (status === 'rejected') {
            await client.query(
                `UPDATE leave_approval_steps
                 SET status = 'rejected', notes = $1, acted_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [notes, currentStep.id]
            );
            await client.query(
                `UPDATE leave_approval_steps
                 SET status = 'skipped'
                 WHERE leave_request_id = $1 AND status = 'waiting'`,
                [id]
            );
            const result = await client.query(
                `UPDATE leave_requests
                 SET status = 'rejected', approved_by = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3
                 RETURNING *`,
                [actorId, notes, id]
            );
            await client.query('COMMIT');
            const [payload] = await attachApprovalSteps(pool, result.rows);
            return res.json({
                message: 'Pengajuan ditolak',
                data: payload
            });
        }

        // Approved current step
        await client.query(
            `UPDATE leave_approval_steps
             SET status = 'approved', notes = $1, acted_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [notes, currentStep.id]
        );

        if (forceFinal) {
            await client.query(
                `UPDATE leave_approval_steps
                 SET status = 'skipped', notes = COALESCE(notes, 'Dilewati (disetujui final oleh Admin/HR)'), acted_at = CURRENT_TIMESTAMP
                 WHERE leave_request_id = $1 AND status IN ('waiting', 'pending') AND id <> $2`,
                [id, currentStep.id]
            );
        }

        const remaining = await client.query(
            `SELECT * FROM leave_approval_steps
             WHERE leave_request_id = $1 AND status = 'waiting'
             ORDER BY step_order ASC
             LIMIT 1`,
            [id]
        );

        let result;
        let message;

        if (!forceFinal && remaining.rows.length > 0) {
            const nextStep = remaining.rows[0];
            await client.query(
                `UPDATE leave_approval_steps SET status = 'pending' WHERE id = $1`,
                [nextStep.id]
            );
            result = await client.query(
                `UPDATE leave_requests
                 SET current_step = $1, approved_by = $2, admin_notes = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING *`,
                [nextStep.step_order, actorId, notes, id]
            );
            message = `Disetujui di tingkat ${currentStep.step_order}. Menunggu ${nextStep.approver_label}.`;
        } else {
            result = await client.query(
                `UPDATE leave_requests
                 SET status = 'approved', current_step = total_steps, approved_by = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3
                 RETURNING *`,
                [actorId, notes, id]
            );
            message = 'Pengajuan disetujui';
        }

        await client.query('COMMIT');
        const [payload] = await attachApprovalSteps(pool, result.rows);
        res.json({ message, data: payload });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update leave status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Delete leave request (only pending and own request)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdminUser = req.user.role === 'admin';

        const checkResult = await pool.query(
            `SELECT * FROM leave_requests WHERE id = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const request = checkResult.rows[0];

        if (request.user_id !== userId && !isAdminUser) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        if (request.attachment_path) {
            const filePath = path.join(__dirname, '..', request.attachment_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.query(`DELETE FROM leave_requests WHERE id = $1`, [id]);

        res.json({ message: 'Pengajuan berhasil dihapus' });
    } catch (error) {
        console.error('Delete leave request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
