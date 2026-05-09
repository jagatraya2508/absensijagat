const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

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

// Get leave types with labels
const leaveTypes = {
    late: 'Izin Terlambat',
    sick: 'Izin Sakit',
    leave: 'Cuti',
    change_off: 'Tukar Libur',
    permission: 'Izin Tidak Masuk'
};

// Helper function to calculate days between two dates
function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Helper function to get used leave days for a user in current year
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

// Helper function to get quota
async function getUserLeaveQuota(userId, year) {
    const setRes = await pool.query('SELECT * FROM leave_settings LIMIT 1');
    const settings = setRes.rows[0] || { annual_leave_quota: 12 };
    
    let quota = settings.annual_leave_quota;
    
    // Check big leave bonus
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
    try {
        const { type, start_date, end_date, reason, replacement_date } = req.body;
        const userId = req.user.id;

        // Validate type
        if (!['late', 'sick', 'leave', 'change_off', 'permission'].includes(type)) {
            return res.status(400).json({ error: 'Jenis izin tidak valid' });
        }

        // Validate dates
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Tanggal mulai dan selesai harus diisi' });
        }

        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih dari tanggal selesai' });
        }

        // Validate change_off specific requirements
        if (type === 'change_off' && !replacement_date) {
            return res.status(400).json({ error: 'Tanggal pengganti harus diisi untuk tukar libur' });
        }

        // Validate reason
        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ error: 'Alasan harus diisi minimal 10 karakter' });
        }

        // Check quota based on settings
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

        const result = await pool.query(
            `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, attachment_path, replacement_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [userId, type, start_date, end_date, reason.trim(), attachmentPath, replacement_date || null]
        );

        res.status(201).json({
            message: 'Pengajuan izin berhasil dibuat',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create leave request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
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
        res.json(result.rows);
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

// Get all leave requests (Admin only)
router.get('/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status, user_id } = req.query;

        let query = `
            SELECT lr.*, 
                   u.name as employee_name, 
                   u.employee_id,
                   approver.name as approver_name
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
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
        res.json(result.rows);
    } catch (error) {
        console.error('Get all leave requests error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get pending leave requests count (Admin only)
router.get('/pending-count', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Get pending count error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Approve/Reject leave request (Admin only)
router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        const adminId = req.user.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        // Check if request exists and is pending
        const checkResult = await pool.query(
            `SELECT * FROM leave_requests WHERE id = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        if (checkResult.rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Pengajuan sudah diproses sebelumnya' });
        }

        const result = await pool.query(
            `UPDATE leave_requests 
             SET status = $1, approved_by = $2, admin_notes = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [status, adminId, admin_notes || null, id]
        );

        res.json({
            message: status === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update leave status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete leave request (only pending and own request)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Check if request exists
        const checkResult = await pool.query(
            `SELECT * FROM leave_requests WHERE id = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const request = checkResult.rows[0];

        // Only owner can delete, or admin can delete any
        if (request.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        // Non-admin can only delete pending requests
        if (!isAdmin && request.status !== 'pending') {
            return res.status(400).json({ error: 'Hanya pengajuan pending yang bisa dihapus' });
        }

        // Delete attachment if exists
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
