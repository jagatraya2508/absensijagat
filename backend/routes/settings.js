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

module.exports = router;
