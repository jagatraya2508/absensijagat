const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth.verifyToken, auth.isAdmin);

const AVAILABLE_PERMISSIONS = [
    { key: 'admin.locations', label: 'Kelola Lokasi', category: 'Master' },
    { key: 'admin.departments', label: 'Master Departemen', category: 'Master' },
    { key: 'admin.positions', label: 'Master Jabatan', category: 'Master' },
    { key: 'admin.vehicle_types', label: 'Master Kendaraan', category: 'Master' },
    { key: 'admin.employees', label: 'Data Karyawan', category: 'Master' },
    { key: 'admin.face_registration', label: 'Registrasi Wajah', category: 'Master' },
    { key: 'admin.work_schedule', label: 'Jadwal Kerja', category: 'Master' },
    { key: 'admin.customers', label: 'Master Customer', category: 'Master' },
    { key: 'admin.organization', label: 'Struktur Organisasi', category: 'Master' },

    { key: 'admin.off_days', label: 'Atur Libur', category: 'Admin' },
    { key: 'admin.announcements', label: 'Kelola Pengumuman', category: 'Admin' },
    { key: 'admin.driver_activities', label: 'Aktivitas Driver', category: 'Admin' },
    { key: 'admin.driver_tracking', label: 'Tracking Kunjungan', category: 'Admin' },
    { key: 'admin.leaves', label: 'Kelola Izin', category: 'Admin' },
    { key: 'admin.manual_attendance', label: 'Persetujuan Absen', category: 'Admin' },
    { key: 'admin.daily_work_report', label: 'Review Laporan Harian', category: 'Admin' },

    { key: 'admin.loans', label: 'Pinjaman', category: 'HR & Keuangan' },
    { key: 'admin.payroll', label: 'Payroll', category: 'HR & Keuangan' },
    { key: 'admin.assessments', label: 'Penilaian', category: 'HR & Keuangan' },
    { key: 'admin.recruitment', label: 'Recruitment', category: 'HR & Keuangan' },
    { key: 'admin.assets', label: 'Manajemen Aset', category: 'Operasional' },
    { key: 'admin.reports', label: 'Laporan', category: 'Sistem' },
    { key: 'admin.users', label: 'Kelola User', category: 'Sistem' },
    { key: 'admin.roles', label: 'Kelola Role', category: 'Sistem' },
    { key: 'admin.settings', label: 'Pengaturan', category: 'Sistem' },
    { key: 'admin.license', label: 'License', category: 'Sistem' },
    { key: 'admin.kiosk', label: 'Mode Kiosk', category: 'Sistem' },

    { key: 'manager.leave_approvals', label: 'Persetujuan Izin (Atasan)', category: 'Managerial' },
    { key: 'manager.approvals', label: 'Persetujuan Lembur (Manager)', category: 'Managerial' }
];

const PERMISSION_KEY_SET = new Set(AVAILABLE_PERMISSIONS.map((p) => p.key));
const PERMISSION_BY_HEADER = (() => {
    const map = {};
    AVAILABLE_PERMISSIONS.forEach((p) => {
        map[p.key.toLowerCase()] = p.key;
        map[p.label.toLowerCase()] = p.key;
    });
    return map;
})();

const EXCEL_HEADER_MAP = {
    nama: 'name',
    'nama role': 'name',
    'nama peran': 'name',
    name: 'name',
    id: 'name',
    'role id': 'name',
    label: 'label',
    'label tampilan': 'label',
    tampilan: 'label',
    'hak akses': 'permissions',
    permissions: 'permissions',
    permission: 'permissions',
    akses: 'permissions'
};

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

function normalizeExcelHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function cellToString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : String(value);
    }
    if (typeof value === 'object') {
        if (value.text) return String(value.text).trim();
        if (value.result !== undefined && value.result !== null) return cellToString(value.result);
        if (value.richText) return value.richText.map((t) => t.text).join('').trim();
        if (value.hyperlink) return String(value.text || value.hyperlink).trim();
    }
    return String(value).trim();
}

function formatRoleName(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseYesNo(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    const v = String(value).trim().toLowerCase();
    if (['ya', 'yes', 'y', 'true', '1', 'v', 'x', 'aktif'].includes(v)) return true;
    if (['tidak', 'no', 'n', 'false', '0', 'kosong', 'nonaktif'].includes(v)) return false;
    return null;
}

function parsePermissionList(value) {
    if (!value) return { keys: [], invalid: [] };
    const parts = String(value)
        .split(/[,;\n|]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    const keys = [];
    const invalid = [];
    const seen = new Set();
    parts.forEach((part) => {
        const mapped = PERMISSION_BY_HEADER[part.toLowerCase()] || (PERMISSION_KEY_SET.has(part) ? part : null);
        if (!mapped) {
            invalid.push(part);
            return;
        }
        if (!seen.has(mapped)) {
            seen.add(mapped);
            keys.push(mapped);
        }
    });
    return { keys, invalid };
}

function applyHeaderStyle(row) {
    row.height = 22;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
        };
    });
}

function applyCellBorder(cell, color = 'FFD1D5DB') {
    cell.border = {
        top: { style: 'thin', color: { argb: color } },
        left: { style: 'thin', color: { argb: color } },
        bottom: { style: 'thin', color: { argb: color } },
        right: { style: 'thin', color: { argb: color } }
    };
}

router.get('/', async (req, res) => {
    try {
        const rolesResult = await pool.query('SELECT * FROM roles ORDER BY id ASC');
        const roles = rolesResult.rows;

        const permsResult = await pool.query('SELECT * FROM role_permissions');
        const permissions = permsResult.rows;

        const rolesWithPerms = roles.map((role) => {
            return {
                ...role,
                permissions: permissions
                    .filter((p) => p.role_id === role.id)
                    .map((p) => p.permission_key)
            };
        });

        res.json(rolesWithPerms);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

router.get('/permissions', (req, res) => {
    res.json(AVAILABLE_PERMISSIONS);
});

router.get('/template', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Absensi Jagat';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data Role', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        const columns = [
            { header: 'Nama *', key: 'name', width: 24 },
            { header: 'Label *', key: 'label', width: 32 }
        ];
        sheet.columns = columns;
        columns.forEach((_, idx) => {
            sheet.getColumn(idx + 1).numFmt = '@';
        });

        applyHeaderStyle(sheet.getRow(1));
        sheet.getRow(1).height = 22;

        const sampleRows = [
            ['supervisor', 'Supervisor Gudang'],
            ['hrd', 'Staff HRD']
        ];

        sampleRows.forEach((values, idx) => {
            const row = sheet.addRow(values);
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                applyCellBorder(cell);
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            });
        });

        for (let i = 4; i <= 50; i++) {
            const row = sheet.getRow(i);
            for (let col = 1; col <= 2; col++) {
                applyCellBorder(row.getCell(col), 'FFE5E7EB');
            }
        }

        const refSheet = workbook.addWorksheet('Referensi');
        refSheet.columns = [
            { header: 'Key Hak Akses', key: 'key', width: 32 },
            { header: 'Label', key: 'label', width: 36 },
            { header: 'Kategori', key: 'category', width: 18 }
        ];
        applyHeaderStyle(refSheet.getRow(1));
        AVAILABLE_PERMISSIONS.forEach((perm) => {
            refSheet.addRow([perm.key, perm.label, perm.category]);
        });

        const guide = workbook.addWorksheet('Petunjuk');
        guide.columns = [{ width: 28 }, { width: 92 }];
        guide.mergeCells('A1:B1');
        guide.getCell('A1').value = 'PETUNJUK IMPORT ROLE DARI EXCEL';
        guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

        const instructions = [
            ['Sheet yang diisi', 'Isi data hanya pada sheet "Data Role". Jangan ubah nama kolom header.'],
            ['Kolom wajib', 'Nama dan Label wajib diisi.'],
            ['Nama', 'ID unik role (huruf kecil, tanpa spasi). Contoh: hrd, supervisor. Karakter selain huruf/angka otomatis jadi underscore.'],
            ['Label', 'Nama tampilan di aplikasi. Contoh: Staff HRD, Supervisor Gudang.'],
            ['Hak akses', 'Tidak perlu diisi di Excel. Semua hak akses default Tidak. Atur kemudian lewat menu Edit Role.'],
            ['Role baru', 'Jika Nama belum ada di sistem, role custom baru akan dibuat tanpa hak akses.'],
            ['Role existing', 'Jika Nama sudah ada (kecuali admin), hanya label yang diperbarui. Hak akses tidak diubah.'],
            ['Role admin', 'Tidak dapat diubah melalui import.'],
            ['Baris contoh', 'Hapus atau ganti baris contoh sebelum diunggah.'],
            ['Format file', 'Simpan sebagai .xlsx (Excel 2007 atau lebih baru).']
        ];
        instructions.forEach((item, i) => {
            const row = guide.getRow(i + 3);
            row.getCell(1).value = item[0];
            row.getCell(1).font = { bold: true };
            row.getCell(2).value = item[1];
            row.getCell(2).alignment = { wrapText: true };
            row.height = 28;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-import-role.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download role template error:', error);
        res.status(500).json({ error: 'Gagal membuat template Excel' });
    }
});

router.post('/import', (req, res, next) => {
    excelUpload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Gagal mengunggah file' });
        }
        next();
    });
}, async (req, res) => {
    const client = await pool.connect();
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File Excel wajib diunggah' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheet = workbook.getWorksheet('Data Role') || workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ error: 'File Excel tidak memiliki sheet data' });
        }

        const headerRow = sheet.getRow(1);
        const columnMap = {};
        const permissionColumns = [];
        headerRow.eachCell((cell, colNumber) => {
            const normalized = normalizeExcelHeader(cell.value);
            const metaKey = EXCEL_HEADER_MAP[normalized];
            if (metaKey) {
                columnMap[metaKey] = colNumber;
                return;
            }
            const permKey = PERMISSION_BY_HEADER[normalized];
            if (permKey) {
                permissionColumns.push({ colNumber, key: permKey });
            }
        });

        if (!columnMap.name || !columnMap.label) {
            return res.status(400).json({
                error: 'Header Excel tidak valid. Wajib ada kolom Nama dan Label. Unduh template resmi.'
            });
        }

        const existingResult = await client.query('SELECT id, name, is_system FROM roles');
        const existingByName = new Map(existingResult.rows.map((row) => [row.name, row]));

        const results = [];
        let imported = 0;
        let updated = 0;
        let failed = 0;
        const seenNames = new Set();

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const rawName = cellToString(row.getCell(columnMap.name).value);
            const label = cellToString(row.getCell(columnMap.label).value);
            const permissionText = columnMap.permissions
                ? cellToString(row.getCell(columnMap.permissions).value)
                : '';

            const hasPermissionMarks = permissionColumns.some((col) => cellToString(row.getCell(col.colNumber).value));
            if (!rawName && !label && !permissionText && !hasPermissionMarks) {
                continue;
            }

            const pushError = (message) => {
                failed++;
                results.push({ row: rowNumber, name: rawName || '-', status: 'error', message });
            };

            if (!rawName) {
                pushError('Nama role wajib diisi');
                continue;
            }
            if (!label) {
                pushError('Label role wajib diisi');
                continue;
            }

            const formattedName = formatRoleName(rawName);
            if (!formattedName) {
                pushError('Nama role tidak valid. Gunakan huruf dan angka.');
                continue;
            }
            if (formattedName === 'admin') {
                pushError('Role admin tidak dapat diubah melalui import');
                continue;
            }
            if (seenNames.has(formattedName)) {
                pushError('Nama role duplikat di file Excel');
                continue;
            }

            const selectedKeys = new Set();
            let invalidYesNo = null;
            permissionColumns.forEach((col) => {
                const raw = cellToString(row.getCell(col.colNumber).value);
                if (!raw) return;
                const parsed = parseYesNo(raw);
                if (parsed === null) {
                    invalidYesNo = raw;
                    return;
                }
                if (parsed) selectedKeys.add(col.key);
            });
            if (invalidYesNo) {
                pushError(`Nilai hak akses "${invalidYesNo}" tidak valid. Gunakan Ya atau Tidak`);
                continue;
            }

            const listed = parsePermissionList(permissionText);
            if (listed.invalid.length > 0) {
                pushError(`Hak akses tidak dikenali: ${listed.invalid.join(', ')}`);
                continue;
            }
            listed.keys.forEach((key) => selectedKeys.add(key));
            const hasPermissionInput = permissionColumns.length > 0 || Boolean(columnMap.permissions);
            const permissions = Array.from(selectedKeys);

            try {
                await client.query('BEGIN');
                const existing = existingByName.get(formattedName);
                if (existing) {
                    await client.query('UPDATE roles SET label = $1 WHERE id = $2', [label, existing.id]);
                    if (hasPermissionInput) {
                        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [existing.id]);
                        for (const perm of permissions) {
                            await client.query(
                                'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                                [existing.id, perm]
                            );
                        }
                    }
                    await client.query('COMMIT');
                    updated++;
                    seenNames.add(formattedName);
                    results.push({
                        row: rowNumber,
                        name: formattedName,
                        status: 'success',
                        message: hasPermissionInput
                            ? `Berhasil diperbarui (${permissions.length} hak akses)`
                            : 'Label diperbarui (hak akses tidak diubah)'
                    });
                } else {
                    const roleResult = await client.query(
                        'INSERT INTO roles (name, label, is_system) VALUES ($1, $2, $3) RETURNING *',
                        [formattedName, label, false]
                    );
                    const newRoleId = roleResult.rows[0].id;
                    if (hasPermissionInput) {
                        for (const perm of permissions) {
                            await client.query(
                                'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                                [newRoleId, perm]
                            );
                        }
                    }
                    await client.query('COMMIT');
                    existingByName.set(formattedName, { id: newRoleId, name: formattedName, is_system: false });
                    imported++;
                    seenNames.add(formattedName);
                    results.push({
                        row: rowNumber,
                        name: formattedName,
                        status: 'success',
                        message: hasPermissionInput
                            ? `Berhasil ditambahkan (${permissions.length} hak akses)`
                            : 'Berhasil ditambahkan (hak akses default tidak)'
                    });
                }
            } catch (saveError) {
                try {
                    await client.query('ROLLBACK');
                } catch (_) { /* ignore */ }
                if (saveError.code === '23505') {
                    pushError('Nama role sudah terdaftar');
                } else {
                    pushError(saveError.message || 'Gagal menyimpan role');
                }
            }
        }

        if (imported === 0 && updated === 0 && failed === 0) {
            return res.status(400).json({ error: 'Tidak ada data role pada file Excel' });
        }

        res.json({ imported, updated, failed, results });
    } catch (error) {
        console.error('Import roles error:', error);
        res.status(500).json({ error: 'Gagal mengimpor role dari Excel' });
    } finally {
        client.release();
    }
});

router.post('/', async (req, res) => {
    const { name, label, permissions } = req.body;

    if (!name || !label) {
        return res.status(400).json({ error: 'Nama dan label role harus diisi' });
    }

    const formattedName = formatRoleName(name);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingRole = await client.query('SELECT id FROM roles WHERE name = $1', [formattedName]);
        if (existingRole.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Nama role sudah digunakan' });
        }

        const roleResult = await client.query(
            'INSERT INTO roles (name, label, is_system) VALUES ($1, $2, $3) RETURNING *',
            [formattedName, label, false]
        );
        const newRoleId = roleResult.rows[0].id;

        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            for (const perm of permissions) {
                await client.query(
                    'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                    [newRoleId, perm]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Role berhasil dibuat', role: roleResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { label, permissions } = req.body;

    if (!label) {
        return res.status(400).json({ error: 'Label role harus diisi' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roleResult = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Role tidak ditemukan' });
        }

        const role = roleResult.rows[0];

        await client.query('UPDATE roles SET label = $1 WHERE id = $2', [label, id]);

        if (role.name !== 'admin') {
            await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

            if (permissions && Array.isArray(permissions) && permissions.length > 0) {
                for (const perm of permissions) {
                    await client.query(
                        'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                        [id, perm]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Role berhasil diperbarui' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roleResult = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Role tidak ditemukan' });
        }

        const role = roleResult.rows[0];

        if (role.is_system) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Role sistem tidak dapat dihapus' });
        }

        const usersResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', [role.name]);
        if (usersResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Role masih digunakan oleh user, tidak dapat dihapus' });
        }

        await client.query('DELETE FROM roles WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ message: 'Role berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

module.exports = router;
