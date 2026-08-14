const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../db');
const { JWT_SECRET, authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const ExcelJS = require('exceljs');

// Configure multer for profile photo uploads
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/profiles');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar (JPG/PNG) yang diperbolehkan!'));
    }
});

const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream'
        ];
        if (ext === '.xlsx' || allowedMimes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Hanya file Excel (.xlsx) yang diizinkan'));
    }
});

const EXCEL_HEADER_MAP = {
    'employee id': 'employee_id',
    'employee_id': 'employee_id',
    'id karyawan': 'employee_id',
    'id pegawai': 'employee_id',
    'nama': 'name',
    'nama lengkap': 'name',
    'name': 'name',
    'email': 'email',
    'password': 'password',
    'kata sandi': 'password',
    'role': 'role',
    'peran': 'role'
};

function normalizeExcelHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function cellToString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (value.text) return String(value.text).trim();
        if (value.result !== undefined && value.result !== null) return String(value.result).trim();
        if (value.richText) return value.richText.map(t => t.text).join('').trim();
        if (value.hyperlink) return String(value.text || value.hyperlink).trim();
    }
    return String(value).trim();
}

function normalizeRoleName(value, roles) {
    const raw = String(value || '').trim();
    if (!raw) return 'employee';
    const lower = raw.toLowerCase();
    const aliases = {
        karyawan: 'employee',
        pegawai: 'employee',
        employee: 'employee',
        admin: 'admin',
        administrator: 'admin',
        manager: 'manager',
        pimpinan: 'manager',
        'pimpinan / manager': 'manager',
        'pimpinan/manager': 'manager'
    };
    const mapped = aliases[lower] || lower;
    const byName = roles.find(r => r.name.toLowerCase() === mapped);
    if (byName) return byName.name;
    const byLabel = roles.find(r => (r.label || '').toLowerCase() === lower);
    if (byLabel) return byLabel.name;
    return null;
}

const DEFAULT_ROLES = [
    { name: 'admin', label: 'Admin' },
    { name: 'manager', label: 'Pimpinan / Manager' },
    { name: 'employee', label: 'Karyawan' }
];

async function getImportRoles() {
    try {
        const rolesResult = await pool.query('SELECT name, label FROM roles ORDER BY id ASC');
        if (rolesResult.rows.length) return rolesResult.rows;
    } catch (err) {
        console.error('Failed to load roles for user import:', err.message);
    }
    return DEFAULT_ROLES;
}

function logError(error) {
    const logPath = path.join(__dirname, '../error.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] AUTH ERROR: ${error.stack || error}\n`;
    fs.appendFileSync(logPath, logMessage);
}

// Helper to check user limit
async function checkUserLimit() {
    const result = await pool.query('SELECT * FROM license_info ORDER BY activated_at DESC LIMIT 1');
    const license = result.rows[0];
    const maxUsers = (license && new Date(license.expires_at) > new Date()) ? license.max_users : 5;
    
    const userCountQuery = await pool.query('SELECT COUNT(*) FROM users');
    const currentUsers = parseInt(userCountQuery.rows[0].count);
    
    return { allowed: currentUsers < maxUsers, current: currentUsers, max: maxUsers, active: !!license };
}

// Login
router.post('/login', async (req, res) => {
    try {
        const { employee_id, password } = req.body;

        if (!employee_id || !password) {
            return res.status(400).json({ error: 'Employee ID dan password harus diisi' });
        }

        const result = await pool.query(
            `SELECT u.*, COALESCE(ed.is_driver, false) as is_driver, COALESCE(ed.is_collector, false) as is_collector, COALESCE(ed.use_tracking, false) as use_tracking
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.employee_id = $1`,
            [employee_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Employee ID atau password salah' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Employee ID atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, employee_id: user.employee_id, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        let isSupervisor = false;
        try {
            const sup = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM employee_details WHERE supervisor_id = $1) as is_supervisor',
                [user.id]
            );
            isSupervisor = sup.rows[0].is_supervisor === true || sup.rows[0].is_supervisor === 't';
        } catch (_) { /* column may not exist yet */ }

        res.json({
            token,
            user: {
                id: user.id,
                employee_id: user.employee_id,
                name: user.name,
                email: user.email,
                role: user.role,
                off_day: user.off_day,
                photo: user.photo,
                is_driver: user.is_driver,
                is_collector: user.is_collector,
                use_tracking: user.use_tracking,
                is_supervisor: isSupervisor
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update Profile (Self)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { off_day } = req.body;

        const validDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        if (off_day && !validDays.includes(off_day)) {
            return res.status(400).json({ error: 'Hari libur tidak valid' });
        }

        const result = await pool.query(
            'UPDATE users SET off_day = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role, off_day',
            [off_day, userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update Profile Photo (Self)
router.put('/profile/photo', authenticateToken, uploadProfile.single('photo'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file foto yang diupload' });
        }

        const photoPath = '/uploads/profiles/' + req.file.filename;

        // Optionally, delete the old photo here if it exists (for brevity keeping it simple)
        const oldUser = await pool.query('SELECT photo FROM users WHERE id = $1', [userId]);
        if (oldUser.rows.length > 0 && oldUser.rows[0].photo) {
            try {
                const oldPath = path.join(__dirname, '..', oldUser.rows[0].photo);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            } catch (err) {
                console.error('Failed to delete old photo', err);
            }
        }

        const result = await pool.query(
            'UPDATE users SET photo = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role, off_day, photo',
            [photoPath, userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Upload profile photo error:', error);
        res.status(500).json({ error: error.message || 'Terjadi kesalahan server' });
    }
});

// Register (Admin only)
router.post('/register', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { employee_id, name, email, password, role, off_day } = req.body;

        if (!employee_id || !name || !password) {
            return res.status(400).json({ error: 'Employee ID, nama, dan password harus diisi' });
        }

        const limitCheck = await checkUserLimit();
        if (!limitCheck.allowed) {
            return res.status(403).json({ 
                error: limitCheck.active 
                    ? `Batas pengguna pada license tercapai (${limitCheck.max} pengguna). Silakan upgrade license.` 
                    : 'Tidak ada license aktif. Mode trial dibatasi 5 pengguna.' 
            });
        }


        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (employee_id, name, email, password, role, off_day) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, employee_id, name, email, role, off_day`,
            [employee_id, name, email || null, hashedPassword, role || 'employee', off_day || 'Minggu']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logError(error);
        console.error('Register error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Employee ID atau email sudah terdaftar' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at, u.off_day, u.photo,
                    COALESCE(ed.is_driver, false) as is_driver,
                    COALESCE(ed.is_collector, false) as is_collector,
                    COALESCE(ed.use_tracking, false) as use_tracking
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        const user = result.rows[0];

        // Fetch permissions for the user's role
        let permissions = [];
        if (user.role !== 'admin') {
            const permsResult = await pool.query(
                `SELECT rp.permission_key 
                 FROM role_permissions rp 
                 JOIN roles r ON rp.role_id = r.id 
                 WHERE r.name = $1`,
                [user.role]
            );
            permissions = permsResult.rows.map(p => p.permission_key);
        }

        user.permissions = permissions;
        user.is_supervisor = false;
        try {
            const sup = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM employee_details WHERE supervisor_id = $1) as is_supervisor',
                [user.id]
            );
            user.is_supervisor = sup.rows[0].is_supervisor === true || sup.rows[0].is_supervisor === 't';
        } catch (_) { /* column may not exist yet */ }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at, u.photo, r.label as role_label 
             FROM users u 
             LEFT JOIN roles r ON u.role = r.name 
             ORDER BY u.created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Download Excel template for bulk user import (Admin only)
router.get('/users/template', authenticateToken, isAdmin, async (req, res) => {
    try {
        const roles = await getImportRoles();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Absensi Jagat';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data User', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
            { header: 'Employee ID *', key: 'employee_id', width: 18 },
            { header: 'Nama *', key: 'name', width: 28 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Password *', key: 'password', width: 18 },
            { header: 'Role', key: 'role', width: 16 }
        ];
        sheet.getColumn(1).numFmt = '@';
        sheet.getColumn(3).numFmt = '@';
        sheet.getColumn(4).numFmt = '@';

        const headerRow = sheet.getRow(1);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
            };
        });

        const sampleRows = [
            ['EMP001', 'Budi Santoso', 'budi@company.com', 'password123', 'employee'],
            ['EMP002', 'Siti Aminah', 'siti@company.com', 'password123', 'employee']
        ];
        sampleRows.forEach((values, idx) => {
            const row = sheet.addRow(values);
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                };
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            });
        });

        for (let i = 4; i <= 50; i++) {
            const row = sheet.getRow(i);
            for (let col = 1; col <= 5; col++) {
                row.getCell(col).border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            }
        }

        const refSheet = workbook.addWorksheet('Referensi');
        refSheet.getCell('A1').value = 'Role (isi kolom Role dengan nilai name)';
        refSheet.getCell('A1').font = { bold: true };
        refSheet.getCell('B1').value = 'Label';
        refSheet.getCell('B1').font = { bold: true };
        roles.forEach((role, i) => {
            refSheet.getCell(i + 2, 1).value = role.name;
            refSheet.getCell(i + 2, 2).value = role.label;
        });
        refSheet.columns = [{ width: 38 }, { width: 24 }];

        const roleCount = Math.max(roles.length, 1);
        sheet.dataValidations.add('E2:E1000', {
            type: 'list',
            allowBlank: true,
            formulae: [`Referensi!$A$2:$A$${roleCount + 1}`],
            showErrorMessage: true,
            errorTitle: 'Role tidak valid',
            error: 'Pilih role dari daftar yang tersedia'
        });

        const guide = workbook.addWorksheet('Petunjuk');
        guide.columns = [{ width: 28 }, { width: 80 }];
        guide.mergeCells('A1:B1');
        guide.getCell('A1').value = 'PETUNJUK IMPORT USER DARI EXCEL';
        guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

        const instructions = [
            ['Sheet yang diisi', 'Isi data hanya pada sheet "Data User". Jangan ubah nama kolom header.'],
            ['Kolom wajib', 'Employee ID, Nama, dan Password wajib diisi. Email dan Role opsional.'],
            ['Employee ID', 'Harus unik. Tidak boleh sama dengan user yang sudah terdaftar.'],
            ['Email', 'Opsional. Jika diisi, harus format email yang valid dan belum terdaftar.'],
            ['Password', 'Minimal 6 karakter.'],
            ['Role', `Isi dengan: ${roles.map(r => r.name).join(', ')}. Kosong = employee.`],
            ['Baris contoh', 'Hapus atau ganti baris contoh (EMP001 / EMP002) sebelum diunggah.'],
            ['Batas lisensi', 'Jumlah user baru tidak boleh melebihi sisa kuota lisensi.'],
            ['Format file', 'Simpan sebagai .xlsx (Excel 2007 atau lebih baru).']
        ];
        instructions.forEach((item, i) => {
            const row = guide.getRow(i + 3);
            row.getCell(1).value = item[0];
            row.getCell(1).font = { bold: true };
            row.getCell(2).value = item[1];
            row.getCell(2).alignment = { wrapText: true };
            row.height = 22;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-import-user.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logError(error);
        console.error('Download user template error:', error);
        res.status(500).json({ error: 'Gagal membuat template Excel' });
    }
});

// Import users from Excel (Admin only)
router.post('/users/import', authenticateToken, isAdmin, (req, res, next) => {
    excelUpload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Gagal mengunggah file' });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File Excel wajib diunggah' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheet = workbook.getWorksheet('Data User') || workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ error: 'File Excel tidak memiliki sheet data' });
        }

        const headerRow = sheet.getRow(1);
        const columnMap = {};
        headerRow.eachCell((cell, colNumber) => {
            const key = EXCEL_HEADER_MAP[normalizeExcelHeader(cell.value)];
            if (key) columnMap[key] = colNumber;
        });

        if (!columnMap.employee_id || !columnMap.name || !columnMap.password) {
            return res.status(400).json({
                error: 'Header Excel tidak valid. Wajib ada kolom: Employee ID, Nama, dan Password. Unduh template resmi.'
            });
        }

        const roles = await getImportRoles();

        const existing = await pool.query('SELECT employee_id, LOWER(email) as email FROM users');
        const existingIds = new Set(existing.rows.map(r => String(r.employee_id).toLowerCase()));
        const existingEmails = new Set(existing.rows.filter(r => r.email).map(r => r.email));

        const limitCheck = await checkUserLimit();
        let remainingSlots = Math.max(0, limitCheck.max - limitCheck.current);

        const results = [];
        let imported = 0;
        let failed = 0;
        let skipped = 0;
        const seenIds = new Set();
        const seenEmails = new Set();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const employeeId = cellToString(row.getCell(columnMap.employee_id).value);
            const name = cellToString(row.getCell(columnMap.name).value);
            const email = columnMap.email ? cellToString(row.getCell(columnMap.email).value) : '';
            const password = cellToString(row.getCell(columnMap.password).value);
            const roleRaw = columnMap.role ? cellToString(row.getCell(columnMap.role).value) : '';

            if (!employeeId && !name && !email && !password) {
                continue;
            }

            const pushError = (message) => {
                failed++;
                results.push({ row: rowNumber, employee_id: employeeId || '-', status: 'error', message });
            };

            if (!employeeId || !name || !password) {
                pushError('Employee ID, Nama, dan Password wajib diisi');
                continue;
            }

            if (password.length < 6) {
                pushError('Password minimal 6 karakter');
                continue;
            }

            const idKey = employeeId.toLowerCase();
            if (existingIds.has(idKey) || seenIds.has(idKey)) {
                pushError(existingIds.has(idKey)
                    ? 'Employee ID sudah terdaftar'
                    : 'Employee ID duplikat di file Excel');
                continue;
            }

            if (email) {
                if (!emailRegex.test(email)) {
                    pushError('Format email tidak valid');
                    continue;
                }
                const emailKey = email.toLowerCase();
                if (existingEmails.has(emailKey) || seenEmails.has(emailKey)) {
                    pushError(existingEmails.has(emailKey)
                        ? 'Email sudah terdaftar'
                        : 'Email duplikat di file Excel');
                    continue;
                }
            }

            const role = normalizeRoleName(roleRaw, roles);
            if (!role) {
                pushError(`Role "${roleRaw}" tidak valid`);
                continue;
            }

            if (remainingSlots <= 0) {
                skipped++;
                results.push({
                    row: rowNumber,
                    employee_id: employeeId,
                    status: 'skipped',
                    message: limitCheck.active
                        ? `Batas lisensi tercapai (${limitCheck.max} pengguna)`
                        : 'Batas trial 5 pengguna tercapai'
                });
                continue;
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query(
                    `INSERT INTO users (employee_id, name, email, password, role)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [employeeId, name, email || null, hashedPassword, role]
                );
                imported++;
                remainingSlots--;
                seenIds.add(idKey);
                if (email) seenEmails.add(email.toLowerCase());
                results.push({
                    row: rowNumber,
                    employee_id: employeeId,
                    status: 'success',
                    message: 'Berhasil ditambahkan'
                });
            } catch (insertError) {
                if (insertError.code === '23505') {
                    pushError('Employee ID atau email sudah terdaftar');
                } else {
                    pushError(insertError.message || 'Gagal menyimpan user');
                }
            }
        }

        if (imported === 0 && failed === 0 && skipped === 0) {
            return res.status(400).json({ error: 'Tidak ada data user pada file Excel' });
        }

        res.json({
            imported,
            failed,
            skipped,
            remaining_slots: remainingSlots,
            results
        });
    } catch (error) {
        logError(error);
        console.error('Import users error:', error);
        res.status(500).json({ error: 'Gagal mengimpor user dari Excel' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update user (Admin only)
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { employee_id, name, email, password, role } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (employee_id) {
            updates.push(`employee_id = $${paramCount++}`);
            values.push(employee_id);
        }
        if (name) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email || null);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push(`password = $${paramCount++}`);
            values.push(hashedPassword);
        }
        if (role) {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, employee_id, name, email, role`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Employee ID atau email sudah digunakan' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Change password (Self)
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Password lama dan baru harus diisi' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Get current password
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(current_password, result.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Password lama tidak sesuai' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Reset password (Admin only)
router.put('/reset-password/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({ error: 'Password baru harus diisi' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Check user exists
        const userCheck = await pool.query('SELECT id, name FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);

        res.json({ message: `Password ${userCheck.rows[0].name} berhasil direset` });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { employee_id } = req.body;

        if (!employee_id) {
            return res.status(400).json({ error: 'Employee ID harus diisi' });
        }

        const result = await pool.query('SELECT id, name, email FROM users WHERE employee_id = $1', [employee_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        const user = result.rows[0];
        if (!user.email) {
            return res.status(400).json({ error: 'User ini tidak memiliki alamat email yang terdaftar. Hubungi Admin.' });
        }

        // Generate random password (8 chars)
        const newPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Setup Nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `"Sistem Absensi" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Reset Password Sistem Absensi',
            text: `Halo ${user.name},\n\nPassword Anda telah direset. Berikut adalah password baru Anda: ${newPassword}\n\nSilakan login menggunakan password ini dan segera ubah password Anda di menu Profil Saya.\n\nTerima kasih.`,
            html: `<p>Halo <b>${user.name}</b>,</p><p>Password Anda telah direset. Berikut adalah password baru Anda: <b>${newPassword}</b></p><p>Silakan login menggunakan password ini dan segera ubah password Anda di menu Profil Saya.</p><p>Terima kasih.</p>`
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (emailErr) {
            console.error('Email send error:', emailErr);
            return res.status(500).json({ 
                error: 'Gagal mengirim email. Pastikan konfigurasi SMTP di server sudah benar. ' + emailErr.message,
                // Fallback for development/testing if SMTP is missing
                fallback_password: newPassword
            });
        }

        // Update password in DB
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

        res.json({ message: 'Password baru telah dikirim ke email Anda' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
