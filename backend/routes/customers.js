const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

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
    'nama customer': 'name',
    'nama pelanggan': 'name',
    name: 'name',
    telepon: 'phone',
    telp: 'phone',
    phone: 'phone',
    'no telepon': 'phone',
    hp: 'phone',
    alamat: 'address',
    address: 'address',
    catatan: 'notes',
    notes: 'notes',
    keterangan: 'notes',
    kode: 'customer_code',
    'kode customer': 'customer_code',
    customer_code: 'customer_code',
    status: 'status'
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
        if (value.richText) return value.richText.map(t => t.text).join('').trim();
        if (value.hyperlink) return String(value.text || value.hyperlink).trim();
    }
    return String(value).trim();
}

function parseActiveStatus(value) {
    if (!value) return true;
    const v = String(value).trim().toLowerCase();
    if (['nonaktif', 'tidak aktif', 'inactive', 'false', '0', 'tidak', 'no'].includes(v)) return false;
    if (['aktif', 'active', 'true', '1', 'ya', 'yes'].includes(v)) return true;
    return null;
}

// Helper: generate next customer code
async function generateCustomerCode(client) {
    const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
    const digitsRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_digits'`);
    const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);

    const prefix = prefixRes.rows[0]?.value || 'CUST';
    const digits = parseInt(digitsRes.rows[0]?.value || '4');
    const next = parseInt(nextRes.rows[0]?.value || '1');

    const code = prefix + String(next).padStart(digits, '0');

    // Increment counter
    await client.query(
        `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`,
        [String(next + 1)]
    );

    return code;
}

async function advanceCounterIfNeeded(client, code) {
    if (!code) return;
    const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
    const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);
    const prefix = prefixRes.rows[0]?.value || 'CUST';
    if (!code.toUpperCase().startsWith(String(prefix).toUpperCase())) return;

    const numPart = code.slice(prefix.length);
    if (!/^\d+$/.test(numPart)) return;

    const n = parseInt(numPart, 10);
    const next = parseInt(nextRes.rows[0]?.value || '1', 10);
    if (n >= next) {
        await client.query(
            `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`,
            [String(n + 1)]
        );
    }
}

// GET /search — Search customers (for driver autocomplete)
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q = '' } = req.query;
        const result = await pool.query(
            `SELECT id, customer_code, name, address, phone FROM customers 
             WHERE is_active = true AND (name ILIKE $1 OR customer_code ILIKE $1)
             ORDER BY name ASC LIMIT 20`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Search customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /code-settings — Get customer code settings (admin)
router.get('/code-settings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT key, value FROM app_settings WHERE key IN ('customer_code_prefix', 'customer_code_next', 'customer_code_digits')`
        );
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (error) {
        console.error('Get code settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// PUT /code-settings — Update customer code settings (admin)
router.put('/code-settings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { prefix, next_number, digits } = req.body;
        
        if (prefix !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_prefix'`, [prefix.toUpperCase()]);
        }
        if (next_number !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`, [String(parseInt(next_number))]);
        }
        if (digits !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_digits'`, [String(parseInt(digits))]);
        }

        res.json({ message: 'Pengaturan kode customer berhasil diperbarui' });
    } catch (error) {
        console.error('Update code settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET / — Get all customers (admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /template — Download Excel template (admin)
router.get('/template', authenticateToken, isAdmin, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Absensi Jagat';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data Customer', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
            { header: 'Nama *', key: 'name', width: 32 },
            { header: 'Telepon', key: 'phone', width: 18 },
            { header: 'Alamat', key: 'address', width: 40 },
            { header: 'Catatan', key: 'notes', width: 28 },
            { header: 'Kode', key: 'customer_code', width: 16 },
            { header: 'Status', key: 'status', width: 14 }
        ];
        [1, 2, 3, 4, 5, 6].forEach((col) => {
            sheet.getColumn(col).numFmt = '@';
        });

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
            ['Toko Maju Jaya', '081234567890', 'Jl. Merdeka No. 10, Jakarta', 'Pelanggan rutin', '', 'Aktif'],
            ['CV Berkah Sentosa', '081298765432', 'Jl. Sudirman No. 25, Bandung', '', '', 'Aktif']
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
            for (let col = 1; col <= 6; col++) {
                row.getCell(col).border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            }
        }

        const refSheet = workbook.addWorksheet('Referensi');
        refSheet.getCell('A1').value = 'Status';
        refSheet.getCell('A1').font = { bold: true };
        refSheet.getCell('A2').value = 'Aktif';
        refSheet.getCell('A3').value = 'Nonaktif';
        refSheet.columns = [{ width: 16 }];

        sheet.dataValidations.add('F2:F1000', {
            type: 'list',
            allowBlank: true,
            formulae: ['Referensi!$A$2:$A$3'],
            showErrorMessage: true,
            errorTitle: 'Status tidak valid',
            error: 'Pilih Aktif atau Nonaktif'
        });

        const guide = workbook.addWorksheet('Petunjuk');
        guide.columns = [{ width: 28 }, { width: 85 }];
        guide.mergeCells('A1:B1');
        guide.getCell('A1').value = 'PETUNJUK IMPORT CUSTOMER DARI EXCEL';
        guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

        const instructions = [
            ['Sheet yang diisi', 'Isi data hanya pada sheet "Data Customer". Jangan ubah nama kolom header.'],
            ['Kolom wajib', 'Nama wajib diisi. Telepon, Alamat, Catatan, Kode, dan Status opsional.'],
            ['Nama', 'Harus unik. Tidak boleh sama dengan customer yang sudah terdaftar.'],
            ['Kode', 'Opsional. Jika dikosongkan, kode akan dibuat otomatis sesuai pengaturan (contoh CUST0001).'],
            ['Status', 'Isi Aktif atau Nonaktif. Kosong = Aktif.'],
            ['Baris contoh', 'Hapus atau ganti baris contoh sebelum diunggah.'],
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
        res.setHeader('Content-Disposition', 'attachment; filename=template-import-customer.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download customer template error:', error);
        res.status(500).json({ error: 'Gagal membuat template Excel' });
    }
});

// POST /import — Import customers from Excel (admin)
router.post('/import', authenticateToken, isAdmin, (req, res, next) => {
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
        const sheet = workbook.getWorksheet('Data Customer') || workbook.worksheets[0];
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

        const existing = await client.query('SELECT LOWER(name) as name, LOWER(customer_code) as customer_code FROM customers');
        const existingNames = new Set(existing.rows.map(r => r.name));
        const existingCodes = new Set(existing.rows.filter(r => r.customer_code).map(r => r.customer_code));

        const results = [];
        let imported = 0;
        let failed = 0;
        const seenNames = new Set();
        const seenCodes = new Set();

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const name = cellToString(row.getCell(columnMap.name).value);
            const phone = columnMap.phone ? cellToString(row.getCell(columnMap.phone).value) : '';
            const address = columnMap.address ? cellToString(row.getCell(columnMap.address).value) : '';
            const notes = columnMap.notes ? cellToString(row.getCell(columnMap.notes).value) : '';
            const customCode = columnMap.customer_code ? cellToString(row.getCell(columnMap.customer_code).value) : '';
            const statusRaw = columnMap.status ? cellToString(row.getCell(columnMap.status).value) : '';

            if (!name && !phone && !address && !notes && !customCode) {
                continue;
            }

            const pushError = (message) => {
                failed++;
                results.push({ row: rowNumber, name: name || '-', status: 'error', message });
            };

            if (!name) {
                pushError('Nama customer wajib diisi');
                continue;
            }

            const nameKey = name.toLowerCase();
            if (existingNames.has(nameKey) || seenNames.has(nameKey)) {
                pushError(existingNames.has(nameKey)
                    ? 'Nama customer sudah terdaftar'
                    : 'Nama customer duplikat di file Excel');
                continue;
            }

            let isActive = true;
            if (statusRaw) {
                const parsed = parseActiveStatus(statusRaw);
                if (parsed === null) {
                    pushError(`Status "${statusRaw}" tidak valid. Gunakan Aktif atau Nonaktif`);
                    continue;
                }
                isActive = parsed;
            }

            let customerCode = customCode;
            if (customerCode) {
                const codeKey = customerCode.toLowerCase();
                if (existingCodes.has(codeKey) || seenCodes.has(codeKey)) {
                    pushError(existingCodes.has(codeKey)
                        ? 'Kode customer sudah terdaftar'
                        : 'Kode customer duplikat di file Excel');
                    continue;
                }
            }

            try {
                if (!customerCode) {
                    customerCode = await generateCustomerCode(client);
                } else {
                    await advanceCounterIfNeeded(client, customerCode);
                }

                await client.query(
                    `INSERT INTO customers (customer_code, name, address, phone, notes, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [customerCode, name, address || null, phone || null, notes || null, isActive]
                );

                imported++;
                seenNames.add(nameKey);
                seenCodes.add(customerCode.toLowerCase());
                results.push({
                    row: rowNumber,
                    name,
                    status: 'success',
                    message: `Berhasil ditambahkan (${customerCode})`
                });
            } catch (insertError) {
                if (insertError.code === '23505') {
                    pushError('Nama atau kode customer sudah terdaftar');
                } else {
                    pushError(insertError.message || 'Gagal menyimpan customer');
                }
            }
        }

        if (imported === 0 && failed === 0) {
            return res.status(400).json({ error: 'Tidak ada data customer pada file Excel' });
        }

        res.json({ imported, failed, results });
    } catch (error) {
        console.error('Import customers error:', error);
        res.status(500).json({ error: 'Gagal mengimpor customer dari Excel' });
    } finally {
        client.release();
    }
});

// POST / — Create customer (admin or auto-create from tracking)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, address, phone, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama customer harus diisi' });
        }

        await client.query('BEGIN');

        // Check if customer already exists by name
        const existing = await client.query(`SELECT id FROM customers WHERE LOWER(name) = LOWER($1)`, [name.trim()]);
        if (existing.rows.length > 0) {
            // Update existing
            const result = await client.query(
                `UPDATE customers SET 
                    address = COALESCE($1, address),
                    phone = COALESCE($2, phone),
                    notes = COALESCE($3, notes),
                    updated_at = NOW()
                 WHERE LOWER(name) = LOWER($4) RETURNING *`,
                [address || null, phone || null, notes || null, name.trim()]
            );
            await client.query('COMMIT');
            return res.status(200).json(result.rows[0]);
        }

        // Generate code for new customer
        const customerCode = await generateCustomerCode(client);

        const result = await client.query(
            `INSERT INTO customers (customer_code, name, address, phone, notes) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [customerCode, name.trim(), address || null, phone || null, notes || null]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create customer error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Nama customer sudah ada' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// PUT /:id — Update customer (admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, phone, notes, is_active } = req.body;

        const result = await pool.query(
            `UPDATE customers SET 
                name = COALESCE($1, name),
                address = $2,
                phone = $3,
                notes = $4,
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [name, address || null, phone || null, notes || null, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update customer error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Nama customer sudah ada' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// DELETE /:id — Delete customer (admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM customers WHERE id = $1 RETURNING id', [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer tidak ditemukan' });
        }
        res.json({ message: 'Customer berhasil dihapus' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
