const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/logo');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar (jpg, png, svg) yang diizinkan'));
    }
});

// Get all settings
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT key, value FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get BPJS settings
router.get('/bpjs', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bpjs_settings WHERE is_active = true ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Get BPJS settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update logo (Admin only)
router.post('/logo', authenticateToken, isAdmin, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
        }
        const logoPath = `/uploads/logo/${req.file.filename}`;
        await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [logoPath, 'app_logo']);
        res.json({
            message: 'Logo berhasil diperbarui',
            logoPath: logoPath
        });
    } catch (error) {
        console.error('Update logo error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update theme colors (Admin only)
router.put('/theme', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { primary_color, bg_color } = req.body;

        if (!primary_color || !bg_color) {
            return res.status(400).json({ error: 'primary_color dan bg_color wajib diisi' });
        }

        // Validate hex color format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(primary_color) || !hexRegex.test(bg_color)) {
            return res.status(400).json({ error: 'Format warna harus hex (contoh: #6D0000)' });
        }

        // Upsert theme_primary_color
        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('theme_primary_color', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [primary_color]
        );

        // Upsert theme_bg_color
        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('theme_bg_color', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [bg_color]
        );

        res.json({
            message: 'Tema berhasil diperbarui',
            theme_primary_color: primary_color,
            theme_bg_color: bg_color
        });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get leave settings
router.get('/leave', authenticateToken, isAdmin, async (req, res) => {
    try {
        const settingsResult = await pool.query('SELECT * FROM leave_settings LIMIT 1');
        const rulesResult = await pool.query('SELECT * FROM big_leave_rules ORDER BY min_years ASC');
        
        res.json({
            settings: settingsResult.rows[0] || null,
            big_leave_rules: rulesResult.rows
        });
    } catch (error) {
        console.error('Get leave settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update leave settings
router.put('/leave', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { annual_leave_quota, late_deducts_leave, sick_deducts_leave, permission_deducts_leave, big_leave_rules } = req.body;
        
        await client.query('BEGIN');
        
        // Update general settings
        const settingsResult = await client.query(
            `UPDATE leave_settings 
             SET annual_leave_quota = $1, 
                 late_deducts_leave = $2, 
                 sick_deducts_leave = $3, 
                 permission_deducts_leave = $4,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                annual_leave_quota || 12, 
                !!late_deducts_leave, 
                !!sick_deducts_leave, 
                !!permission_deducts_leave
            ]
        );

        // Update big leave rules
        // For simplicity, we can delete all existing and re-insert
        await client.query('DELETE FROM big_leave_rules');
        
        const insertedRules = [];
        if (Array.isArray(big_leave_rules) && big_leave_rules.length > 0) {
            for (const rule of big_leave_rules) {
                if (rule.min_years && rule.leave_days) {
                    const r = await client.query(
                        `INSERT INTO big_leave_rules (min_years, leave_days, is_active) 
                         VALUES ($1, $2, $3) RETURNING *`,
                        [rule.min_years, rule.leave_days, rule.is_active !== false]
                    );
                    insertedRules.push(r.rows[0]);
                }
            }
        }

        await client.query('COMMIT');
        
        res.json({
            message: 'Pengaturan cuti berhasil diperbarui',
            settings: settingsResult.rows[0],
            big_leave_rules: insertedRules
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update leave settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

module.exports = router;
