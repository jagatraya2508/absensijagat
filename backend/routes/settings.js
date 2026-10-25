const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin, hasPermission } = require('../middleware/auth');
const { PAYSLIP_FIELD_KEYS, resolvePayslipLayout } = require('../utils/payslipFields');
const canEditPayslipLayout = hasPermission('admin.payslip_layout');

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
        
        const logoType = req.body.type || 'app_logo'; // app_logo, login_logo, favicon_logo
        // Validate logoType
        const allowedTypes = ['app_logo', 'login_logo', 'favicon_logo'];
        if (!allowedTypes.includes(logoType)) {
             return res.status(400).json({ error: 'Tipe logo tidak valid' });
        }

        const logoPath = `/uploads/logo/${req.file.filename}`;
        
        // Use UPSERT so new settings like login_logo and favicon_logo can be created if they don't exist
        await pool.query(
            `INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            [logoType, logoPath]
        );
        
        res.json({
            message: 'Logo berhasil diperbarui',
            logoPath: logoPath,
            type: logoType
        });
    } catch (error) {
        console.error('Update logo error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update theme colors (Admin only)
router.put('/theme', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { primary_color, bg_color, card_bg_color, btn_bg_color } = req.body;

        if (!primary_color || !bg_color) {
            return res.status(400).json({ error: 'primary_color dan bg_color wajib diisi' });
        }

        // Validate hex color format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(primary_color) || !hexRegex.test(bg_color) || (card_bg_color && !hexRegex.test(card_bg_color)) || (btn_bg_color && !hexRegex.test(btn_bg_color))) {
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
        
        // Upsert theme_card_bg_color if provided
        if (card_bg_color) {
            await pool.query(
                `INSERT INTO settings (key, value) VALUES ('theme_card_bg_color', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [card_bg_color]
            );
        }

        // Upsert theme_btn_bg_color if provided
        if (btn_bg_color) {
            await pool.query(
                `INSERT INTO settings (key, value) VALUES ('theme_btn_bg_color', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [btn_bg_color]
            );
        }

        res.json({
            message: 'Tema berhasil diperbarui',
            theme_primary_color: primary_color,
            theme_bg_color: bg_color,
            theme_card_bg_color: card_bg_color,
            theme_btn_bg_color: btn_bg_color
        });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Show or hide the company logo on the payslip (Admin only)
router.put('/payslip-logo', authenticateToken, isAdmin, async (req, res) => {
    try {
        const showLogo = req.body.show_logo === true || req.body.show_logo === 'true';
        const value = showLogo ? 'true' : 'false';

        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('payslip_show_logo', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [value]
        );

        res.json({ message: 'Pengaturan logo slip gaji berhasil disimpan', payslip_show_logo: value });
    } catch (error) {
        console.error('Update payslip logo setting error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

function compactPayslipFields(incoming) {
    const fields = {};
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    PAYSLIP_FIELD_KEYS.forEach((key) => {
        if (source[key] === false) fields[key] = false;
    });
    return fields;
}

async function payslipScopeTarget(scope, userId) {
    if (scope === 'global') return { scopeType: 'global', scopeKey: '' };
    const user = await pool.query(
        `SELECT u.id, u.name, u.employee_id, ed.department
         FROM users u
         LEFT JOIN LATERAL (
            SELECT department FROM employee_details
            WHERE user_id = u.id AND COALESCE(department, '') <> ''
            ORDER BY id DESC LIMIT 1
         ) ed ON TRUE
         WHERE u.id = $1`,
        [userId]
    );
    if (user.rows.length === 0) {
        const error = new Error('Karyawan tidak ditemukan');
        error.status = 404;
        throw error;
    }
    if (scope === 'employee') {
        return { scopeType: 'employee', scopeKey: String(user.rows[0].id), user: user.rows[0] };
    }
    const department = (user.rows[0].department || '').trim();
    if (!department) {
        const error = new Error('Karyawan ini belum punya departemen');
        error.status = 400;
        throw error;
    }
    return { scopeType: 'department', scopeKey: department, user: user.rows[0] };
}

router.get('/payslip-fields', authenticateToken, canEditPayslipLayout, async (req, res) => {
    try {
        const userId = parseInt(req.query.user_id, 10);
        if (!userId) return res.status(400).json({ error: 'Karyawan wajib dipilih' });
        const user = await pool.query('SELECT id, name, employee_id FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        const layout = await resolvePayslipLayout(pool, userId);
        res.json({
            employee_name: user.rows[0].name,
            employee_id: user.rows[0].employee_id,
            department: layout.department,
            source: layout.source,
            global: layout.global,
            department_rule: layout.department_rule,
            employee_rule: layout.employee_rule,
        });
    } catch (error) {
        console.error('Get payslip fields error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/payslip-layouts', authenticateToken, canEditPayslipLayout, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pl.scope_type, pl.scope_key, pl.hide_zero, pl.fields,
                   u.name AS user_name, u.employee_id
            FROM payslip_layouts pl
            LEFT JOIN users u ON pl.scope_type = 'employee' AND u.id::text = pl.scope_key
            ORDER BY pl.scope_type, COALESCE(u.name, pl.scope_key)
        `);
        res.json(result.rows.map((row) => ({
            scope_type: row.scope_type,
            scope_key: row.scope_key,
            hide_zero: row.hide_zero,
            user_name: row.user_name,
            employee_id: row.employee_id,
        })));
    } catch (error) {
        console.error('List payslip layouts error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.put('/payslip-fields', authenticateToken, canEditPayslipLayout, async (req, res) => {
    try {
        const scope = ['department', 'employee'].includes(req.body.scope) ? req.body.scope : 'global';
        const fields = compactPayslipFields(req.body.fields);
        const hideZero = req.body.hide_zero === true;
        const value = JSON.stringify({ hide_zero: hideZero, fields });
        const target = await payslipScopeTarget(scope, req.body.user_id);

        if (target.scopeType === 'global') {
            await pool.query(
                `INSERT INTO settings (key, value) VALUES ('payslip_fields', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [value]
            );
        } else {
            await pool.query(
                `INSERT INTO payslip_layouts (scope_type, scope_key, hide_zero, fields)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (scope_type, scope_key)
                 DO UPDATE SET hide_zero = EXCLUDED.hide_zero, fields = EXCLUDED.fields, updated_at = CURRENT_TIMESTAMP`,
                [target.scopeType, target.scopeKey, hideZero, JSON.stringify(fields)]
            );
        }

        const layout = req.body.user_id
            ? await resolvePayslipLayout(pool, req.body.user_id)
            : null;
        const globalRow = await pool.query(`SELECT value FROM settings WHERE key = 'payslip_fields'`);
        res.json({
            message: 'Tampilan slip gaji berhasil disimpan',
            payslip_fields: globalRow.rows[0]?.value || value,
            layout: layout ? {
                hide_zero: layout.hide_zero,
                fields: layout.fields,
                source: layout.source,
                department: layout.department,
            } : null,
        });
    } catch (error) {
        console.error('Update payslip fields error:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Terjadi kesalahan server' });
    }
});

router.delete('/payslip-fields', authenticateToken, canEditPayslipLayout, async (req, res) => {
    try {
        const scope = req.query.scope === 'employee' ? 'employee' : 'department';
        if (req.query.scope_key) {
            await pool.query(
                'DELETE FROM payslip_layouts WHERE scope_type = $1 AND scope_key = $2',
                [scope, req.query.scope_key]
            );
            return res.json({ message: 'Aturan tampilan slip dihapus' });
        }
        const target = await payslipScopeTarget(scope, req.query.user_id);
        await pool.query(
            'DELETE FROM payslip_layouts WHERE scope_type = $1 AND scope_key = $2',
            [target.scopeType, target.scopeKey]
        );
        const layout = await resolvePayslipLayout(pool, req.query.user_id);
        res.json({
            message: 'Aturan tampilan slip dihapus',
            layout: {
                hide_zero: layout.hide_zero,
                fields: layout.fields,
                source: layout.source,
                department: layout.department,
            },
        });
    } catch (error) {
        console.error('Delete payslip layout error:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Terjadi kesalahan server' });
    }
});

// Update company name (Admin only)
router.put('/company-name', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { company_name } = req.body;

        if (!company_name || !company_name.trim()) {
            return res.status(400).json({ error: 'Nama perusahaan wajib diisi' });
        }

        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('company_name', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [company_name.trim()]
        );

        res.json({ message: 'Nama perusahaan berhasil diperbarui', company_name: company_name.trim() });
    } catch (error) {
        console.error('Update company name error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get leave settings
router.get('/leave', authenticateToken, isAdmin, async (req, res) => {
    try {
        const settingsResult = await pool.query('SELECT * FROM leave_settings LIMIT 1');
        const rulesResult = await pool.query('SELECT * FROM big_leave_rules ORDER BY min_years ASC');
        let approvalConfig = [];
        try {
            const { ensureOrgApprovalSchema } = require('../utils/leaveApproval');
            await ensureOrgApprovalSchema(pool);
            const cfgResult = await pool.query('SELECT * FROM leave_approval_config ORDER BY id ASC');
            approvalConfig = cfgResult.rows;
        } catch (e) {
            console.error('Load approval config error:', e.message);
        }

        res.json({
            settings: settingsResult.rows[0] || null,
            big_leave_rules: rulesResult.rows,
            approval_config: approvalConfig
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
        const { annual_leave_quota, late_deducts_leave, sick_deducts_leave, permission_deducts_leave, big_leave_rules, approval_config } = req.body;
        
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

        const savedApproval = [];
        if (Array.isArray(approval_config)) {
            const { ensureOrgApprovalSchema } = require('../utils/leaveApproval');
            await ensureOrgApprovalSchema(pool);
            for (const cfg of approval_config) {
                if (!cfg.leave_type) continue;
                const levels = Math.max(1, Math.min(5, parseInt(cfg.approval_levels, 10) || 1));
                const fallback = cfg.fallback_to_admin !== false;
                const r = await client.query(
                    `INSERT INTO leave_approval_config (leave_type, approval_levels, fallback_to_admin, updated_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (leave_type) DO UPDATE SET
                        approval_levels = EXCLUDED.approval_levels,
                        fallback_to_admin = EXCLUDED.fallback_to_admin,
                        updated_at = CURRENT_TIMESTAMP
                     RETURNING *`,
                    [cfg.leave_type, levels, fallback]
                );
                savedApproval.push(r.rows[0]);
            }
        }

        await client.query('COMMIT');
        
        res.json({
            message: 'Pengaturan cuti berhasil diperbarui',
            settings: settingsResult.rows[0],
            big_leave_rules: insertedRules,
            approval_config: savedApproval
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update leave settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Update SMTP settings
router.put('/smtp', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure } = req.body;
        
        await client.query('BEGIN');
        
        const settingsToUpdate = {
            'smtp_host': smtp_host || '',
            'smtp_port': smtp_port || '',
            'smtp_user': smtp_user || '',
            'smtp_pass': smtp_pass || '',
            'smtp_secure': smtp_secure !== undefined ? smtp_secure.toString() : 'false'
        };

        for (const [key, value] of Object.entries(settingsToUpdate)) {
            await client.query(
                `INSERT INTO settings (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
        }

        await client.query('COMMIT');
        
        res.json({ message: 'Pengaturan SMTP berhasil diperbarui' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update SMTP settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Minimum face-match percentage used by attendance and kiosk
router.put('/face-match', authenticateToken, hasPermission('admin.settings'), async (req, res) => {
    try {
        const percent = parseInt(req.body.percent, 10);
        if (!Number.isInteger(percent) || percent < 50 || percent > 95) {
            return res.status(400).json({ error: 'Kemiripan wajah harus bilangan bulat antara 50 dan 95' });
        }

        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('face_match_percent', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [String(percent)]
        );

        res.json({ message: 'Batas kemiripan wajah berhasil disimpan', face_match_percent: percent });
    } catch (error) {
        console.error('Update face match setting error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
