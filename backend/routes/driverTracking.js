const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/tracking');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${req.user.id}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diizinkan'));
        }
    }
});

// ============================================
// DRIVER ENDPOINTS (Employee yang is_driver)
// ============================================

// Middleware: check if user is allowed to use tracking
async function isTrackingUser(req, res, next) {
    try {
        // Admin always has access
        if (req.user.role === 'admin') {
            req.userRole = { is_driver: true, is_collector: true, use_tracking: true };
            return next();
        }

        const result = await pool.query(
            'SELECT is_driver, is_collector, use_tracking FROM employee_details WHERE user_id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0 || !result.rows[0].use_tracking) {
            return res.status(403).json({ error: 'Akses ditolak. Fitur tracking tidak aktif untuk akun Anda.' });
        }
        req.userRole = {
            is_driver: result.rows[0].is_driver,
            is_collector: result.rows[0].is_collector,
            use_tracking: result.rows[0].use_tracking
        };
        next();
    } catch (error) {
        console.error('isTrackingUser check error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
}

// GET /my-today — Get driver's tracking records for today
router.get('/my-today', authenticateToken, isTrackingUser, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(
            `SELECT * FROM driver_tracking 
             WHERE user_id = $1 AND tracking_date = $2
             ORDER BY checkin_time DESC`,
            [req.user.id, today]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get my today tracking error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /my-history — Get driver's tracking history
router.get('/my-history', authenticateToken, isTrackingUser, async (req, res) => {
    try {
        const { start_date, end_date, limit = 50 } = req.query;
        let query = `SELECT * FROM driver_tracking WHERE user_id = $1`;
        const params = [req.user.id];
        let paramIdx = 2;

        if (start_date) {
            query += ` AND tracking_date >= $${paramIdx}`;
            params.push(start_date);
            paramIdx++;
        }
        if (end_date) {
            query += ` AND tracking_date <= $${paramIdx}`;
            params.push(end_date);
            paramIdx++;
        }

        query += ` ORDER BY tracking_date DESC, checkin_time DESC LIMIT $${paramIdx}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get my history tracking error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// POST /checkin — Driver check-in at customer location (with selfie photo)
router.post('/checkin', authenticateToken, isTrackingUser, upload.single('photo'), async (req, res) => {
    try {
        const { customer_name, address, latitude, longitude, notes, tracking_type = 'delivery', amount_billed, invoice_number } = req.body;

        if (!customer_name) {
            return res.status(400).json({ error: 'Nama customer harus diisi' });
        }
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Koordinat GPS harus tersedia' });
        }

        const photoPath = req.file ? `/uploads/tracking/${req.file.filename}` : null;

        // Auto-save customer to master table (with auto-code for new ones)
        try {
            const existingCust = await pool.query(`SELECT id FROM customers WHERE LOWER(name) = LOWER($1)`, [customer_name]);
            if (existingCust.rows.length === 0) {
                // Generate auto-code
                let code = null;
                try {
                    const prefixRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
                    const digitsRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'customer_code_digits'`);
                    const nextRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);
                    const prefix = prefixRes.rows[0]?.value || 'CUST';
                    const digits = parseInt(digitsRes.rows[0]?.value || '4');
                    const next = parseInt(nextRes.rows[0]?.value || '1');
                    code = prefix + String(next).padStart(digits, '0');
                    await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`, [String(next + 1)]);
                } catch (codeErr) {
                    console.warn('Could not generate customer code:', codeErr.message);
                }
                await pool.query(
                    `INSERT INTO customers (customer_code, name, address) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET address = COALESCE(EXCLUDED.address, customers.address), updated_at = NOW()`,
                    [code, customer_name, address || null]
                );
            } else {
                if (address) {
                    await pool.query(`UPDATE customers SET address = COALESCE($1, address), updated_at = NOW() WHERE LOWER(name) = LOWER($2)`, [address, customer_name]);
                }
            }
        } catch (custErr) {
            console.warn('Auto-save customer warning (non-fatal):', custErr.message);
        }

        const result = await pool.query(
            `INSERT INTO driver_tracking 
             (user_id, tracking_date, customer_name, address, checkin_time, checkin_latitude, checkin_longitude, checkin_photo_path, notes, status, tracking_type, amount_billed, invoice_number)
             VALUES ($1, CURRENT_DATE, $2, $3, NOW(), $4, $5, $6, $7, 'checked_in', $8, $9, $10)
             RETURNING *`,
            [req.user.id, customer_name, address || null, latitude, longitude, photoPath, notes || null, tracking_type, amount_billed || null, invoice_number || null]
        );

        res.status(201).json({
            ...result.rows[0],
            message: 'Check-in berhasil!'
        });
    } catch (error) {
        console.error('Driver checkin error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// PUT /:id/checkout — Driver check-out from customer location (with selfie photo)
router.put('/:id/checkout', authenticateToken, isTrackingUser, upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, notes, amount_collected, payment_method, collection_status } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Koordinat GPS harus tersedia' });
        }

        // Check if record exists and belongs to this driver
        const check = await pool.query(
            'SELECT * FROM driver_tracking WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Data tracking tidak ditemukan' });
        }

        if (check.rows[0].status === 'completed') {
            return res.status(400).json({ error: 'Sudah check-out sebelumnya' });
        }

        const updateNotes = notes 
            ? (check.rows[0].notes ? check.rows[0].notes + '\n' + notes : notes) 
            : check.rows[0].notes;

        const photoPath = req.file ? `/uploads/tracking/${req.file.filename}` : null;

        const result = await pool.query(
            `UPDATE driver_tracking SET 
                checkout_time = NOW(),
                checkout_latitude = $1,
                checkout_longitude = $2,
                checkout_photo_path = $3,
                notes = $4,
                amount_collected = $5,
                payment_method = $6,
                collection_status = $7,
                status = 'completed',
                updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [latitude, longitude, photoPath, updateNotes, amount_collected || null, payment_method || null, collection_status || null, id]
        );

        res.json({
            ...result.rows[0],
            message: 'Check-out berhasil!'
        });
    } catch (error) {
        console.error('Driver checkout error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET / — Get all tracking records (admin, with filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { user_id, start_date, end_date, status, tracking_type } = req.query;
        let query = `
            SELECT dt.*, u.name as driver_name, u.employee_id
            FROM driver_tracking dt
            JOIN users u ON dt.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (user_id) {
            query += ` AND dt.user_id = $${paramIdx}`;
            params.push(user_id);
            paramIdx++;
        }
        if (start_date) {
            query += ` AND dt.tracking_date >= $${paramIdx}`;
            params.push(start_date);
            paramIdx++;
        }
        if (end_date) {
            query += ` AND dt.tracking_date <= $${paramIdx}`;
            params.push(end_date);
            paramIdx++;
        }
        if (status) {
            query += ` AND dt.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }
        if (tracking_type) {
            query += ` AND dt.tracking_type = $${paramIdx}`;
            params.push(tracking_type);
            paramIdx++;
        }

        query += ' ORDER BY dt.tracking_date DESC, dt.checkin_time DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all tracking error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /drivers — Get all drivers (for dropdown)
router.get('/drivers', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.employee_id, ed.is_driver, ed.is_collector, ed.use_tracking
            FROM users u
            JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee' AND (ed.is_driver = true OR ed.is_collector = true OR ed.use_tracking = true)
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /:id — Get single tracking record detail (admin)
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT dt.*, u.name as driver_name, u.employee_id
             FROM driver_tracking dt
             JOIN users u ON dt.user_id = u.id
             WHERE dt.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get tracking detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// DELETE /:id — Delete tracking record (admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get photo paths before deleting
        const record = await pool.query('SELECT checkin_photo_path, checkout_photo_path FROM driver_tracking WHERE id = $1', [id]);
        
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }

        // Delete photos if exist
        const photos = [record.rows[0].checkin_photo_path, record.rows[0].checkout_photo_path];
        for (const photoPath of photos) {
            if (photoPath) {
                const fullPath = path.join(__dirname, '..', photoPath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }

        await pool.query('DELETE FROM driver_tracking WHERE id = $1', [id]);
        res.json({ message: 'Data tracking berhasil dihapus' });
    } catch (error) {
        console.error('Delete tracking error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
