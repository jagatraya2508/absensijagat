const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin, hasPermission } = require('../middleware/auth');
const { generateCustomerCode } = require('../utils/customerCode');
const { classifyMotion } = require('../utils/motionMode');

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
// TRACKING ENDPOINTS (driver, collector, sales, dan tugas lain)
// ============================================

const VALID_TRACKING_TYPES = ['delivery', 'collection', 'sales', 'visit'];

function allowedTrackingTypes(user, role) {
    if (user.role === 'admin') return VALID_TRACKING_TYPES;
    const types = [];
    if (role?.is_driver) types.push('delivery');
    if (role?.is_collector) types.push('collection');
    if (role?.is_sales) types.push('sales');
    if (types.length === 0 && role?.use_tracking) types.push('visit');
    return types.length ? types : ['visit'];
}

function resolveTrackingType(requested, allowed) {
    const type = VALID_TRACKING_TYPES.includes(requested) ? requested : null;
    if (type && allowed.includes(type)) return type;
    return allowed[0] || 'visit';
}

// Middleware: check if user is allowed to use tracking
async function isTrackingUser(req, res, next) {
    try {
        // Admin always has access
        if (req.user.role === 'admin') {
            req.userRole = { is_driver: true, is_collector: true, is_sales: true, use_tracking: true };
            return next();
        }

        const result = await pool.query(
            'SELECT is_driver, is_collector, is_sales, use_tracking FROM employee_details WHERE user_id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0 || !result.rows[0].use_tracking) {
            return res.status(403).json({ error: 'Akses ditolak. Fitur tracking tidak aktif untuk akun Anda.' });
        }
        req.userRole = {
            is_driver: result.rows[0].is_driver,
            is_collector: result.rows[0].is_collector,
            is_sales: result.rows[0].is_sales,
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
        const { customer_name, address, latitude, longitude, notes, tracking_type = 'visit', amount_billed, invoice_number } = req.body;

        if (!customer_name) {
            return res.status(400).json({ error: 'Nama customer harus diisi' });
        }
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Koordinat GPS harus tersedia' });
        }

        const allowed = allowedTrackingTypes(req.user, req.userRole);
        const resolvedType = resolveTrackingType(tracking_type, allowed);

        const photoPath = req.file ? `/uploads/tracking/${req.file.filename}` : null;
        const customerName = String(customer_name).trim();

        // Auto-save customer to master table (with unique auto-code for new ones)
        try {
            const existingCust = await pool.query(
                `SELECT id FROM customers WHERE LOWER(name) = LOWER($1)`,
                [customerName]
            );
            if (existingCust.rows.length === 0) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const code = await generateCustomerCode(client);
                    await client.query(
                        `INSERT INTO customers (customer_code, name, address)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (name) DO UPDATE SET
                            address = COALESCE(EXCLUDED.address, customers.address),
                            updated_at = NOW()`,
                        [code, customerName, address || null]
                    );
                    await client.query('COMMIT');
                } catch (saveErr) {
                    await client.query('ROLLBACK');
                    throw saveErr;
                } finally {
                    client.release();
                }
            } else if (address) {
                await pool.query(
                    `UPDATE customers SET address = COALESCE($1, address), updated_at = NOW()
                     WHERE LOWER(name) = LOWER($2)`,
                    [address, customerName]
                );
            }
        } catch (custErr) {
            console.warn('Auto-save customer warning (non-fatal):', custErr.message);
        }

        const result = await pool.query(
            `INSERT INTO driver_tracking 
             (user_id, tracking_date, customer_name, address, checkin_time, checkin_latitude, checkin_longitude, checkin_photo_path, notes, status, tracking_type, amount_billed, invoice_number)
             VALUES ($1, CURRENT_DATE, $2, $3, NOW(), $4, $5, $6, $7, 'checked_in', $8, $9, $10)
             RETURNING *`,
            [req.user.id, customerName, address || null, latitude, longitude, photoPath, notes || null, resolvedType, amount_billed || null, invoice_number || null]
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
            SELECT u.id, u.name, u.employee_id, ed.is_driver, ed.is_collector, ed.is_sales, ed.use_tracking
            FROM users u
            JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee' AND ed.use_tracking = true
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ensureLiveTrackingSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS live_tracking_latest (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            accuracy DECIMAL(10, 2),
            speed DECIMAL(10, 2),
            heading DECIMAL(6, 2),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS live_tracking_points (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            speed DECIMAL(10, 2),
            heading DECIMAL(6, 2),
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_live_points_user_time
        ON live_tracking_points(user_id, recorded_at DESC)
    `);
}

// POST /live — karyawan mengirim posisi GPS saat ini
router.post('/live', authenticateToken, isTrackingUser, async (req, res) => {
    try {
        const latitude = parseFloat(req.body.latitude);
        const longitude = parseFloat(req.body.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ error: 'Koordinat GPS tidak valid' });
        }
        const accuracy = req.body.accuracy != null ? parseFloat(req.body.accuracy) : null;
        const speed = req.body.speed != null && req.body.speed !== '' ? parseFloat(req.body.speed) : null;
        const heading = req.body.heading != null && req.body.heading !== '' ? parseFloat(req.body.heading) : null;

        await ensureLiveTrackingSchema();

        await pool.query(`
            INSERT INTO live_tracking_latest (user_id, latitude, longitude, accuracy, speed, heading, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                accuracy = EXCLUDED.accuracy,
                speed = EXCLUDED.speed,
                heading = COALESCE(EXCLUDED.heading, live_tracking_latest.heading),
                updated_at = NOW()
        `, [
            req.user.id, latitude, longitude,
            Number.isFinite(accuracy) ? accuracy : null,
            Number.isFinite(speed) ? speed : null,
            Number.isFinite(heading) ? heading : null,
        ]);

        const last = await pool.query(
            `SELECT latitude, longitude, recorded_at
             FROM live_tracking_points
             WHERE user_id = $1
             ORDER BY recorded_at DESC
             LIMIT 1`,
            [req.user.id]
        );
        let insertPoint = true;
        if (last.rows[0]) {
            const dist = haversineMeters(
                parseFloat(last.rows[0].latitude),
                parseFloat(last.rows[0].longitude),
                latitude,
                longitude
            );
            const ageMs = Date.now() - new Date(last.rows[0].recorded_at).getTime();
            if (dist < 20 && ageMs < 15000) insertPoint = false;
        }
        if (insertPoint) {
            await pool.query(
                `INSERT INTO live_tracking_points (user_id, latitude, longitude, speed, heading)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    req.user.id, latitude, longitude,
                    Number.isFinite(speed) ? speed : null,
                    Number.isFinite(heading) ? heading : null,
                ]
            );
        }

        if (Math.random() < 0.08) {
            await pool.query(`DELETE FROM live_tracking_points WHERE recorded_at < NOW() - INTERVAL '12 hours'`);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Live ping error:', error);
        res.status(500).json({ error: 'Gagal menyimpan posisi live' });
    }
});

// GET /live — posisi kendaraan real-time + jejak
router.get('/live', authenticateToken, hasPermission('admin.driver_tracking'), async (req, res) => {
    try {
        await ensureLiveTrackingSchema();
        const latest = await pool.query(`
            SELECT l.user_id, l.latitude, l.longitude, l.accuracy, l.speed, l.heading, l.updated_at,
                   u.name, u.employee_id, u.photo,
                   COALESCE(ed.is_driver, false) as is_driver,
                   COALESCE(ed.is_collector, false) as is_collector,
                   COALESCE(ed.is_sales, false) as is_sales,
                   vt.name as vehicle_type_name,
                   dt.customer_name, dt.status as visit_status, dt.tracking_type
            FROM live_tracking_latest l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            LEFT JOIN vehicle_types vt ON vt.id = ed.vehicle_type_id
            LEFT JOIN LATERAL (
                SELECT customer_name, status, tracking_type
                FROM driver_tracking
                WHERE user_id = l.user_id AND status = 'checked_in'
                ORDER BY checkin_time DESC
                LIMIT 1
            ) dt ON true
            WHERE l.updated_at > NOW() - INTERVAL '30 minutes'
            ORDER BY l.updated_at DESC
        `);

        const userIds = latest.rows.map((r) => r.user_id);
        let trailsByUser = {};
        if (userIds.length > 0) {
            const trails = await pool.query(`
                SELECT user_id, latitude, longitude, recorded_at
                FROM live_tracking_points
                WHERE user_id = ANY($1::int[])
                  AND recorded_at > NOW() - INTERVAL '45 minutes'
                ORDER BY user_id, recorded_at ASC
            `, [userIds]);
            for (const row of trails.rows) {
                if (!trailsByUser[row.user_id]) trailsByUser[row.user_id] = [];
                trailsByUser[row.user_id].push({
                    lat: parseFloat(row.latitude),
                    lng: parseFloat(row.longitude),
                    at: row.recorded_at,
                });
            }
        }

        const now = Date.now();
        const vehicles = latest.rows.map((row) => {
            const updated = new Date(row.updated_at).getTime();
            const ageSec = Math.max(0, Math.round((now - updated) / 1000));
            const trail = trailsByUser[row.user_id] || [];
            const speed = row.speed != null ? parseFloat(row.speed) : null;
            const motion = classifyMotion({
                speedMs: speed,
                trail,
                vehicleTypeName: row.vehicle_type_name,
            });
            return {
                user_id: row.user_id,
                name: row.name,
                employee_id: row.employee_id,
                photo: row.photo,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
                accuracy: row.accuracy != null ? parseFloat(row.accuracy) : null,
                speed,
                heading: row.heading != null ? parseFloat(row.heading) : null,
                updated_at: row.updated_at,
                age_sec: ageSec,
                online: ageSec <= 45,
                customer_name: row.customer_name || null,
                visit_status: row.visit_status || null,
                tracking_type: row.tracking_type || null,
                is_driver: row.is_driver,
                is_collector: row.is_collector,
                is_sales: row.is_sales,
                vehicle_type_name: row.vehicle_type_name || null,
                motion,
                trail,
            };
        });

        res.json({ vehicles, server_time: new Date().toISOString() });
    } catch (error) {
        console.error('Get live tracking error:', error);
        res.status(500).json({ error: 'Gagal memuat peta live' });
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
