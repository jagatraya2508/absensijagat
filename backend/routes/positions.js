const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

const canManagePositions = [authenticateToken, hasPermission('admin.positions')];

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
    nama: 'name',
    'nama jabatan': 'name',
    jabatan: 'name',
    name: 'name',
    posisi: 'name',
    position: 'name',
    keterangan: 'description',
    deskripsi: 'description',
    description: 'description',
    catatan: 'description'
};

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

function applyHeaderStyle(row) {
    row.height = 22;
    row.eachCell((cell) => {
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
        const result = await pool.query('SELECT * FROM positions ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching positions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/template', ...canManagePositions, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Absensi Jagat';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data Jabatan', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
            { header: 'Nama *', key: 'name', width: 32 },
            { header: 'Keterangan', key: 'description', width: 48 }
        ];
        sheet.getColumn(1).numFmt = '@';
        sheet.getColumn(2).numFmt = '@';
        applyHeaderStyle(sheet.getRow(1));

        const sampleRows = [
            ['Manager', 'Memimpin divisi / unit kerja'],
            ['Supervisor', 'Mengawasi operasional harian'],
            ['Staff', 'Pelaksana tugas operasional']
        ];
        sampleRows.forEach((values, idx) => {
            const row = sheet.addRow(values);
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle' };
                applyCellBorder(cell);
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            });
        });

        for (let i = 5; i <= 50; i++) {
            const row = sheet.getRow(i);
            for (let col = 1; col <= 2; col++) {
                applyCellBorder(row.getCell(col), 'FFE5E7EB');
            }
        }

        const guide = workbook.addWorksheet('Petunjuk');
        guide.columns = [{ width: 28 }, { width: 88 }];
        guide.mergeCells('A1:B1');
        guide.getCell('A1').value = 'PETUNJUK IMPORT JABATAN DARI EXCEL';
        guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

        const instructions = [
            ['Sheet yang diisi', 'Isi data hanya pada sheet "Data Jabatan". Jangan ubah nama kolom header.'],
            ['Kolom wajib', 'Nama wajib diisi. Keterangan opsional.'],
            ['Nama', 'Harus unik. Jika nama sudah ada, keterangan akan diperbarui.'],
            ['Baris contoh', 'Hapus atau ganti baris contoh sebelum diunggah.'],
            ['Format file', 'Simpan sebagai .xlsx (Excel 2007 atau lebih baru).']
        ];
        instructions.forEach((item, i) => {
            const row = guide.getRow(i + 3);
            row.getCell(1).value = item[0];
            row.getCell(1).font = { bold: true };
            row.getCell(2).value = item[1];
            row.getCell(2).alignment = { wrapText: true };
            row.height = 24;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-import-jabatan.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download position template error:', error);
        res.status(500).json({ error: 'Gagal membuat template Excel' });
    }
});

router.post('/import', ...canManagePositions, (req, res, next) => {
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
        const sheet = workbook.getWorksheet('Data Jabatan') || workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ error: 'File Excel tidak memiliki sheet data' });
        }

        const headerRow = sheet.getRow(1);
        const columnMap = {};
        headerRow.eachCell((cell, colNumber) => {
            const key = EXCEL_HEADER_MAP[normalizeExcelHeader(cell.value)];
            if (key) columnMap[key] = colNumber;
        });

        if (!columnMap.name) {
            return res.status(400).json({
                error: 'Header Excel tidak valid. Wajib ada kolom Nama. Unduh template resmi.'
            });
        }

        const existing = await pool.query('SELECT id, LOWER(name) as name FROM positions');
        const existingByName = new Map(existing.rows.map((row) => [row.name, row.id]));

        const results = [];
        let imported = 0;
        let updated = 0;
        let failed = 0;
        const seenNames = new Set();

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const name = cellToString(row.getCell(columnMap.name).value);
            const description = columnMap.description
                ? cellToString(row.getCell(columnMap.description).value)
                : '';

            if (!name && !description) continue;

            const pushError = (message) => {
                failed++;
                results.push({ row: rowNumber, name: name || '-', status: 'error', message });
            };

            if (!name) {
                pushError('Nama jabatan wajib diisi');
                continue;
            }

            const nameKey = name.toLowerCase();
            if (seenNames.has(nameKey)) {
                pushError('Nama jabatan duplikat di file Excel');
                continue;
            }

            try {
                const existingId = existingByName.get(nameKey);
                if (existingId) {
                    await pool.query(
                        'UPDATE positions SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [description || null, existingId]
                    );
                    updated++;
                    seenNames.add(nameKey);
                    results.push({
                        row: rowNumber,
                        name,
                        status: 'success',
                        message: 'Berhasil diperbarui'
                    });
                } else {
                    const inserted = await pool.query(
                        'INSERT INTO positions (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id',
                        [name, description || null]
                    );
                    existingByName.set(nameKey, inserted.rows[0].id);
                    imported++;
                    seenNames.add(nameKey);
                    results.push({
                        row: rowNumber,
                        name,
                        status: 'success',
                        message: 'Berhasil ditambahkan'
                    });
                }
            } catch (saveError) {
                if (saveError.code === '23505') {
                    pushError('Nama jabatan sudah terdaftar');
                } else {
                    pushError(saveError.message || 'Gagal menyimpan jabatan');
                }
            }
        }

        if (imported === 0 && updated === 0 && failed === 0) {
            return res.status(400).json({ error: 'Tidak ada data jabatan pada file Excel' });
        }

        res.json({ imported, updated, failed, results });
    } catch (error) {
        console.error('Import positions error:', error);
        res.status(500).json({ error: 'Gagal mengimpor jabatan dari Excel' });
    }
});

router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO positions (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating position:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Position name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'UPDATE positions SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [name, description, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Position not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating position:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Position name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM positions WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Position not found' });
        }
        res.json({ message: 'Position deleted successfully' });
    } catch (err) {
        console.error('Error deleting position:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
