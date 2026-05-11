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
        const dir = path.join(__dirname, '../uploads/manual_attendance');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ma-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar (JPG/PNG) dan PDF yang diperbolehkan!'));
    }
});

// Create new manual attendance request (Employee)
router.post('/', authenticateToken, upload.single('attachment'), async (req, res) => {
    try {
        const { date, time_in, time_out, reason } = req.body;
        const userId = req.user.id;

        if (!date) {
            return res.status(400).json({ error: 'Tanggal harus diisi' });
        }

        if (!time_in && !time_out) {
            return res.status(400).json({ error: 'Minimal harus mengisi jam masuk atau jam pulang' });
        }

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: 'Alasan harus diisi dengan jelas' });
        }

        const attachmentPath = req.file ? `/uploads/manual_attendance/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO manual_attendances (user_id, date, time_in, time_out, reason, attachment_path) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [userId, date, time_in || null, time_out || null, reason.trim(), attachmentPath]
        );

        res.status(201).json({
            message: 'Pengajuan absen manual berhasil dibuat',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create manual attendance request error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get my manual attendance requests (Employee)
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        let query = `
            SELECT ma.*, u.name as approver_name
            FROM manual_attendances ma
            LEFT JOIN users u ON ma.approved_by = u.id
            WHERE ma.user_id = $1
        `;
        const params = [userId];

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query += ` AND ma.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY ma.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get my manual attendances error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all manual attendance requests (Admin only)
router.get('/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status, user_id } = req.query;

        let query = `
            SELECT ma.*, 
                   u.name as employee_name, 
                   u.employee_id,
                   approver.name as approver_name
            FROM manual_attendances ma
            JOIN users u ON ma.user_id = u.id
            LEFT JOIN users approver ON ma.approved_by = approver.id
            WHERE 1=1
        `;
        const params = [];

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            params.push(status);
            query += ` AND ma.status = $${params.length}`;
        }

        if (user_id) {
            params.push(user_id);
            query += ` AND ma.user_id = $${params.length}`;
        }

        query += ` ORDER BY ma.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all manual attendances error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Approve/Reject/Cancel manual attendance request (Admin only)
router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        const adminId = req.user.id;

        if (!['approved', 'rejected', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        await client.query('BEGIN');

        // Check if request exists
        const checkResult = await client.query(
            `SELECT * FROM manual_attendances WHERE id = $1 FOR UPDATE`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const request = checkResult.rows[0];

        // If cancelling an approved request, delete the attendance_records that were created
        if (status === 'cancelled' && request.status === 'approved') {
            const userId = request.user_id;
            const targetDateStr = new Date(request.date).toISOString().split('T')[0];

            // Delete attendance records created by this manual attendance approval
            await client.query(
                `DELETE FROM attendance_records 
                 WHERE user_id = $1 
                   AND notes = 'Absen Manual (Disetujui Admin)' 
                   AND photo_path = 'manual'
                   AND recorded_at::date = $2::date`,
                [userId, targetDateStr]
            );
        }

        const updateResult = await client.query(
            `UPDATE manual_attendances 
             SET status = $1, approved_by = $2, admin_notes = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [status, adminId, admin_notes || null, id]
        );

        // If approved, insert into attendance_records
        if (status === 'approved') {
            const userId = request.user_id;
            const targetDateStr = new Date(request.date).toISOString().split('T')[0]; // YYYY-MM-DD

            // Insert Time In
            if (request.time_in) {
                const recordedAtIn = `${targetDateStr} ${request.time_in}`;
                await client.query(
                    `INSERT INTO attendance_records 
                     (user_id, type, photo_path, latitude, longitude, is_valid, notes, recorded_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [userId, 'check_in', 'manual', 0, 0, true, 'Absen Manual (Disetujui Admin)', recordedAtIn]
                );
            }

            // Insert Time Out
            if (request.time_out) {
                const recordedAtOut = `${targetDateStr} ${request.time_out}`;
                await client.query(
                    `INSERT INTO attendance_records 
                     (user_id, type, photo_path, latitude, longitude, is_valid, notes, recorded_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [userId, 'check_out', 'manual', 0, 0, true, 'Absen Manual (Disetujui Admin)', recordedAtOut]
                );
            }
        }

        await client.query('COMMIT');

        const messages = {
            approved: 'Pengajuan disetujui dan absen tercatat',
            rejected: 'Pengajuan ditolak',
            cancelled: 'Persetujuan dibatalkan dan record absen dihapus'
        };

        res.json({
            message: messages[status],
            data: updateResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update manual attendance status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Delete manual attendance request (only pending and own request)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdminUser = req.user.role === 'admin';

        const checkResult = await pool.query(
            `SELECT * FROM manual_attendances WHERE id = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
        }

        const request = checkResult.rows[0];

        if (request.user_id !== userId && !isAdminUser) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        if (!isAdminUser && request.status !== 'pending') {
            return res.status(400).json({ error: 'Hanya pengajuan pending yang bisa dihapus' });
        }

        await pool.query(`DELETE FROM manual_attendances WHERE id = $1`, [id]);

        res.json({ message: 'Pengajuan berhasil dihapus' });
    } catch (error) {
        console.error('Delete manual attendance error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
