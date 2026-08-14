const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { wouldCreateCycle, ensureOrgApprovalSchema } = require('../utils/leaveApproval');
const { getActiveLicenseInfo } = require('../utils/licenseCheck');

// Configure multer for employee document uploads
const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/documents');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${req.params.id}-${Date.now()}-${safeName}`);
    }
});
const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf|doc|docx/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype) || file.mimetype === 'application/msword' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (ext || mime) return cb(null, true);
        cb(new Error('Hanya file gambar (jpg, png), PDF, atau DOC yang diizinkan'));
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
    employee_id: 'employee_id',
    'id karyawan': 'employee_id',
    'id pegawai': 'employee_id',
    nik_karyawan: 'employee_id',
    nama: 'name',
    'nama lengkap': 'name',
    name: 'name',
    email: 'email',
    password: 'password',
    'kata sandi': 'password',
    nik: 'nik',
    'no ktp': 'nik',
    ktp: 'nik',
    'no kk': 'no_kk',
    kk: 'no_kk',
    'nomor kk': 'no_kk',
    telepon: 'phone',
    telp: 'phone',
    hp: 'phone',
    phone: 'phone',
    'no telepon': 'phone',
    alamat: 'address',
    address: 'address',
    'tempat lahir': 'birth_place',
    'tanggal lahir': 'birth_date',
    'tgl lahir': 'birth_date',
    'jenis kelamin': 'gender',
    gender: 'gender',
    kelamin: 'gender',
    'status pernikahan': 'marital_status',
    'status kawin': 'marital_status',
    agama: 'religion',
    pendidikan: 'education',
    departemen: 'department',
    department: 'department',
    jabatan: 'position',
    position: 'position',
    'tanggal masuk': 'join_date',
    'tgl masuk': 'join_date',
    'gaji pokok': 'basic_salary',
    gaji: 'basic_salary',
    'tipe gaji': 'salary_type',
    npwp: 'npwp',
    'bpjs kesehatan': 'bpjs_kesehatan_no',
    'no bpjs kesehatan': 'bpjs_kesehatan_no',
    'bpjs ketenagakerjaan': 'bpjs_ketenagakerjaan_no',
    'no bpjs tk': 'bpjs_ketenagakerjaan_no',
    bank: 'bank_name',
    'nama bank': 'bank_name',
    'no rekening': 'bank_account',
    rekening: 'bank_account',
    'nama rekening': 'bank_holder',
    'nama pemilik rekening': 'bank_holder'
};

function normalizeExcelHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function cellToString(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date && !isNaN(value)) {
        return value.toISOString().slice(0, 10);
    }
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

function cellToDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !isNaN(value)) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && value > 20000 && value < 80000) {
        const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
        if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
    }
    const raw = cellToString(value);
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    return null;
}

function parseGender(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (['laki-laki', 'laki laki', 'pria', 'l', 'male', 'm'].includes(v)) return 'Laki-laki';
    if (['perempuan', 'wanita', 'p', 'female', 'f'].includes(v)) return 'Perempuan';
    return undefined;
}

function parseMarital(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (['belum menikah', 'lajang', 'single', 'tk'].includes(v)) return 'Belum Menikah';
    if (['menikah', 'kawin', 'married'].includes(v)) return 'Menikah';
    if (['cerai', 'divorced'].includes(v)) return 'Cerai';
    return undefined;
}

function parseSalaryType(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (['harian', 'daily', 'hari'].includes(v)) return 'daily';
    if (['mingguan', 'weekly', 'minggu'].includes(v)) return 'weekly';
    if (['bulanan', 'monthly', 'bulan'].includes(v)) return 'monthly';
    return undefined;
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

// Get all employees with details
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at,
                   ed.nik, ed.phone, ed.department, ed.position, ed.join_date,
                   ed.basic_salary, ed.salary_type, ed.gender, ed.bpjs_kesehatan_no, ed.npwp,
                   ed.is_driver, ed.is_collector, ed.use_tracking, ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_dekat_allowance, ed.driver_ritase_jauh_allowance,
                   ed.bpjs_kes_enrolled, ed.bpjs_jht_enrolled, ed.bpjs_jp_enrolled, ed.bpjs_jkk_enrolled, ed.bpjs_jkm_enrolled, ed.pph21_enabled,
                   ed.bpjs_kes_employee_rate, ed.bpjs_kes_company_rate, ed.bpjs_jht_employee_rate, ed.bpjs_jht_company_rate,
                   ed.bpjs_jp_employee_rate, ed.bpjs_jp_company_rate, ed.bpjs_jkk_rate, ed.bpjs_jkm_rate,
                   ed.vehicle_type_id, vt.name as vehicle_type_name,
                   ed.supervisor_id, supervisor.name as supervisor_name
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            LEFT JOIN vehicle_types vt ON ed.vehicle_type_id = vt.id
            LEFT JOIN users supervisor ON supervisor.id = ed.supervisor_id
            WHERE u.role = 'employee'
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get employees error:', error);
        require('fs').appendFileSync('error.log', '\\n[' + new Date().toISOString() + '] Get employees error: ' + error.message);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    }
});

router.get('/template', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [depts, positions] = await Promise.all([
            pool.query('SELECT name FROM departments ORDER BY name ASC'),
            pool.query('SELECT name FROM positions ORDER BY name ASC')
        ]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Absensi Jagat';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data Karyawan', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        const columns = [
            { header: 'Employee ID *', key: 'employee_id', width: 16 },
            { header: 'Nama *', key: 'name', width: 26 },
            { header: 'Email', key: 'email', width: 26 },
            { header: 'Password', key: 'password', width: 16 },
            { header: 'NIK', key: 'nik', width: 18 },
            { header: 'No KK', key: 'no_kk', width: 18 },
            { header: 'Telepon', key: 'phone', width: 16 },
            { header: 'Alamat', key: 'address', width: 32 },
            { header: 'Tempat Lahir', key: 'birth_place', width: 16 },
            { header: 'Tanggal Lahir', key: 'birth_date', width: 16 },
            { header: 'Jenis Kelamin', key: 'gender', width: 16 },
            { header: 'Status Pernikahan', key: 'marital_status', width: 18 },
            { header: 'Agama', key: 'religion', width: 14 },
            { header: 'Pendidikan', key: 'education', width: 14 },
            { header: 'Departemen', key: 'department', width: 18 },
            { header: 'Jabatan', key: 'position', width: 18 },
            { header: 'Tanggal Masuk', key: 'join_date', width: 16 },
            { header: 'Gaji Pokok', key: 'basic_salary', width: 14 },
            { header: 'Tipe Gaji', key: 'salary_type', width: 14 },
            { header: 'NPWP', key: 'npwp', width: 18 },
            { header: 'BPJS Kesehatan', key: 'bpjs_kesehatan_no', width: 18 },
            { header: 'BPJS Ketenagakerjaan', key: 'bpjs_ketenagakerjaan_no', width: 20 },
            { header: 'Bank', key: 'bank_name', width: 14 },
            { header: 'No Rekening', key: 'bank_account', width: 18 },
            { header: 'Nama Rekening', key: 'bank_holder', width: 22 }
        ];
        sheet.columns = columns;
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25].forEach((col) => {
            sheet.getColumn(col).numFmt = '@';
        });
        applyHeaderStyle(sheet.getRow(1));
        sheet.getRow(1).height = 28;

        const sampleRows = [
            ['EMP001', 'Budi Santoso', 'budi@company.com', 'password123', '3174010101900001', '', '081234567890', 'Jl. Merdeka No. 1', 'Jakarta', '1990-01-15', 'Laki-laki', 'Menikah', 'Islam', 'S1', depts.rows[0]?.name || 'Operasional', positions.rows[0]?.name || 'Staff', '2024-01-02', '5000000', 'Bulanan', '', '', '', 'BCA', '1234567890', 'Budi Santoso'],
            ['EMP002', 'Siti Aminah', 'siti@company.com', 'password123', '3174010202920002', '', '081298765432', 'Jl. Sudirman No. 2', 'Bandung', '1992-02-20', 'Perempuan', 'Belum Menikah', 'Islam', 'SMA', depts.rows[0]?.name || 'Operasional', positions.rows[1]?.name || positions.rows[0]?.name || 'Staff', '2024-03-01', '4500000', 'Bulanan', '', '', '', 'Mandiri', '0987654321', 'Siti Aminah']
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

        const totalCols = columns.length;
        for (let i = 4; i <= 50; i++) {
            const row = sheet.getRow(i);
            for (let col = 1; col <= totalCols; col++) {
                applyCellBorder(row.getCell(col), 'FFE5E7EB');
            }
        }

        const refSheet = workbook.addWorksheet('Referensi');
        refSheet.columns = [
            { header: 'Departemen', width: 24 },
            { header: 'Jabatan', width: 24 },
            { header: 'Jenis Kelamin', width: 16 },
            { header: 'Status Pernikahan', width: 18 },
            { header: 'Tipe Gaji', width: 14 }
        ];
        applyHeaderStyle(refSheet.getRow(1));
        const maxRef = Math.max(depts.rows.length, positions.rows.length, 3);
        for (let i = 0; i < maxRef; i++) {
            const row = refSheet.getRow(i + 2);
            if (depts.rows[i]) row.getCell(1).value = depts.rows[i].name;
            if (positions.rows[i]) row.getCell(2).value = positions.rows[i].name;
        }
        refSheet.getCell('C2').value = 'Laki-laki';
        refSheet.getCell('C3').value = 'Perempuan';
        refSheet.getCell('D2').value = 'Belum Menikah';
        refSheet.getCell('D3').value = 'Menikah';
        refSheet.getCell('D4').value = 'Cerai';
        refSheet.getCell('E2').value = 'Harian';
        refSheet.getCell('E3').value = 'Mingguan';
        refSheet.getCell('E4').value = 'Bulanan';

        const deptCount = Math.max(depts.rows.length, 1);
        const posCount = Math.max(positions.rows.length, 1);
        if (depts.rows.length > 0) {
            sheet.dataValidations.add(`O2:O1000`, {
                type: 'list', allowBlank: true,
                formulae: [`Referensi!$A$2:$A$${deptCount + 1}`]
            });
        }
        if (positions.rows.length > 0) {
            sheet.dataValidations.add(`P2:P1000`, {
                type: 'list', allowBlank: true,
                formulae: [`Referensi!$B$2:$B$${posCount + 1}`]
            });
        }
        sheet.dataValidations.add('K2:K1000', {
            type: 'list', allowBlank: true, formulae: ['Referensi!$C$2:$C$3']
        });
        sheet.dataValidations.add('L2:L1000', {
            type: 'list', allowBlank: true, formulae: ['Referensi!$D$2:$D$4']
        });
        sheet.dataValidations.add('S2:S1000', {
            type: 'list', allowBlank: true, formulae: ['Referensi!$E$2:$E$4']
        });

        const guide = workbook.addWorksheet('Petunjuk');
        guide.columns = [{ width: 28 }, { width: 92 }];
        guide.mergeCells('A1:B1');
        guide.getCell('A1').value = 'PETUNJUK IMPORT DATA KARYAWAN DARI EXCEL';
        guide.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
        const instructions = [
            ['Sheet yang diisi', 'Isi data hanya pada sheet "Data Karyawan". Jangan ubah nama kolom header.'],
            ['Kolom wajib', 'Employee ID dan Nama wajib. Password wajib hanya untuk karyawan baru.'],
            ['Karyawan baru', 'Jika Employee ID belum ada, akun login akan dibuat (role employee). Password minimal 6 karakter.'],
            ['Karyawan existing', 'Jika Employee ID sudah ada, data karyawan akan diperbarui. Password dikosongkan = tidak diubah.'],
            ['Tanggal', 'Gunakan format YYYY-MM-DD (contoh 2024-01-15) atau pilih tanggal di Excel.'],
            ['Departemen & Jabatan', 'Pilih dari dropdown Referensi, atau ketik nama yang sama dengan master data.'],
            ['Baris contoh', 'Hapus atau ganti baris contoh sebelum diunggah.'],
            ['Batas lisensi', 'Pembuatan akun baru tidak boleh melebihi sisa kuota lisensi.'],
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
        res.setHeader('Content-Disposition', 'attachment; filename=template-import-karyawan.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download employee template error:', error);
        res.status(500).json({ error: 'Gagal membuat template Excel' });
    }
});

router.post('/import', authenticateToken, isAdmin, (req, res, next) => {
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
        const sheet = workbook.getWorksheet('Data Karyawan') || workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ error: 'File Excel tidak memiliki sheet data' });
        }

        const headerRow = sheet.getRow(1);
        const columnMap = {};
        headerRow.eachCell((cell, colNumber) => {
            const key = EXCEL_HEADER_MAP[normalizeExcelHeader(cell.value)];
            if (key) columnMap[key] = colNumber;
        });

        if (!columnMap.employee_id || !columnMap.name) {
            return res.status(400).json({
                error: 'Header Excel tidak valid. Wajib ada kolom Employee ID dan Nama. Unduh template resmi.'
            });
        }

        const usersResult = await pool.query('SELECT id, employee_id, email, role FROM users');
        const usersByEmpId = new Map(usersResult.rows.map((u) => [String(u.employee_id).toLowerCase(), u]));
        const emails = new Set(usersResult.rows.filter((u) => u.email).map((u) => u.email.toLowerCase()));

        const licenseInfo = await getActiveLicenseInfo();
        const maxUsers = licenseInfo.active ? licenseInfo.max_users : 5;
        let currentUsers = usersResult.rows.length;

        const results = [];
        let imported = 0;
        let updated = 0;
        let failed = 0;
        const seenIds = new Set();
        const seenEmails = new Set();

        const read = (row, key) => (columnMap[key] ? cellToString(row.getCell(columnMap[key]).value) : '');
        const readDate = (row, key) => (columnMap[key] ? cellToDate(row.getCell(columnMap[key]).value) : null);
        const readNum = (row, key) => {
            if (!columnMap[key]) return null;
            const raw = row.getCell(columnMap[key]).value;
            if (raw === null || raw === undefined || raw === '') return null;
            const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.-]/g, ''));
            return Number.isFinite(n) ? n : null;
        };

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            const employeeId = read(row, 'employee_id');
            const name = read(row, 'name');
            const email = read(row, 'email');
            const password = read(row, 'password');

            if (!employeeId && !name && !email) continue;

            const pushError = (message) => {
                failed++;
                results.push({ row: rowNumber, name: employeeId || name || '-', status: 'error', message });
            };

            if (!employeeId) {
                pushError('Employee ID wajib diisi');
                continue;
            }
            if (!name) {
                pushError('Nama wajib diisi');
                continue;
            }

            const empKey = employeeId.toLowerCase();
            if (seenIds.has(empKey)) {
                pushError('Employee ID duplikat di file Excel');
                continue;
            }

            if (email) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    pushError('Format email tidak valid');
                    continue;
                }
                const emailKey = email.toLowerCase();
                if (seenEmails.has(emailKey)) {
                    pushError('Email duplikat di file Excel');
                    continue;
                }
            }

            const genderRaw = read(row, 'gender');
            const gender = parseGender(genderRaw);
            if (genderRaw && gender === undefined) {
                pushError(`Jenis kelamin "${genderRaw}" tidak valid. Gunakan Laki-laki atau Perempuan`);
                continue;
            }

            const maritalRaw = read(row, 'marital_status');
            const marital = parseMarital(maritalRaw);
            if (maritalRaw && marital === undefined) {
                pushError(`Status pernikahan "${maritalRaw}" tidak valid`);
                continue;
            }

            const salaryRaw = read(row, 'salary_type');
            const salaryType = parseSalaryType(salaryRaw);
            if (salaryRaw && salaryType === undefined) {
                pushError(`Tipe gaji "${salaryRaw}" tidak valid. Gunakan Harian, Mingguan, atau Bulanan`);
                continue;
            }

            const details = {
                nik: read(row, 'nik') || null,
                no_kk: read(row, 'no_kk') || null,
                phone: read(row, 'phone') || null,
                address: read(row, 'address') || null,
                birth_place: read(row, 'birth_place') || null,
                birth_date: readDate(row, 'birth_date'),
                gender: gender || null,
                marital_status: marital || null,
                religion: read(row, 'religion') || null,
                education: read(row, 'education') || null,
                department: read(row, 'department') || null,
                position: read(row, 'position') || null,
                join_date: readDate(row, 'join_date'),
                basic_salary: readNum(row, 'basic_salary'),
                salary_type: salaryType,
                npwp: read(row, 'npwp') || null,
                bpjs_kesehatan_no: read(row, 'bpjs_kesehatan_no') || null,
                bpjs_ketenagakerjaan_no: read(row, 'bpjs_ketenagakerjaan_no') || null,
                bank_name: read(row, 'bank_name') || null,
                bank_account: read(row, 'bank_account') || null,
                bank_holder: read(row, 'bank_holder') || null
            };

            try {
                const existing = usersByEmpId.get(empKey);
                if (existing) {
                    if (existing.role === 'admin') {
                        pushError('Employee ID ini milik akun admin, tidak bisa diimpor sebagai karyawan');
                        continue;
                    }
                    if (email) {
                        const emailKey = email.toLowerCase();
                        if (emails.has(emailKey) && String(existing.email || '').toLowerCase() !== emailKey) {
                            pushError('Email sudah terdaftar pada user lain');
                            continue;
                        }
                    }

                    await pool.query(
                        `UPDATE users SET name = $1, email = COALESCE($2, email) WHERE id = $3`,
                        [name, email || null, existing.id]
                    );
                    if (password && password.length >= 6) {
                        const hash = await bcrypt.hash(password, 10);
                        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, existing.id]);
                    }

                    await pool.query(`
                        INSERT INTO employee_details (
                            user_id, nik, phone, address, birth_date, birth_place,
                            gender, marital_status, religion, education,
                            department, position, join_date,
                            bank_name, bank_account, bank_holder,
                            npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
                            basic_salary, salary_type, no_kk, updated_at
                        ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,CURRENT_TIMESTAMP
                        )
                        ON CONFLICT (user_id) DO UPDATE SET
                            nik = COALESCE(EXCLUDED.nik, employee_details.nik),
                            phone = COALESCE(EXCLUDED.phone, employee_details.phone),
                            address = COALESCE(EXCLUDED.address, employee_details.address),
                            birth_date = COALESCE(EXCLUDED.birth_date, employee_details.birth_date),
                            birth_place = COALESCE(EXCLUDED.birth_place, employee_details.birth_place),
                            gender = COALESCE(EXCLUDED.gender, employee_details.gender),
                            marital_status = COALESCE(EXCLUDED.marital_status, employee_details.marital_status),
                            religion = COALESCE(EXCLUDED.religion, employee_details.religion),
                            education = COALESCE(EXCLUDED.education, employee_details.education),
                            department = COALESCE(EXCLUDED.department, employee_details.department),
                            position = COALESCE(EXCLUDED.position, employee_details.position),
                            join_date = COALESCE(EXCLUDED.join_date, employee_details.join_date),
                            bank_name = COALESCE(EXCLUDED.bank_name, employee_details.bank_name),
                            bank_account = COALESCE(EXCLUDED.bank_account, employee_details.bank_account),
                            bank_holder = COALESCE(EXCLUDED.bank_holder, employee_details.bank_holder),
                            npwp = COALESCE(EXCLUDED.npwp, employee_details.npwp),
                            bpjs_kesehatan_no = COALESCE(EXCLUDED.bpjs_kesehatan_no, employee_details.bpjs_kesehatan_no),
                            bpjs_ketenagakerjaan_no = COALESCE(EXCLUDED.bpjs_ketenagakerjaan_no, employee_details.bpjs_ketenagakerjaan_no),
                            basic_salary = COALESCE(EXCLUDED.basic_salary, employee_details.basic_salary),
                            salary_type = COALESCE(EXCLUDED.salary_type, employee_details.salary_type),
                            no_kk = COALESCE(EXCLUDED.no_kk, employee_details.no_kk),
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        existing.id, details.nik, details.phone, details.address, details.birth_date, details.birth_place,
                        details.gender, details.marital_status, details.religion, details.education,
                        details.department, details.position, details.join_date,
                        details.bank_name, details.bank_account, details.bank_holder,
                        details.npwp, details.bpjs_kesehatan_no, details.bpjs_ketenagakerjaan_no,
                        details.basic_salary, details.salary_type, details.no_kk
                    ]);

                    updated++;
                    seenIds.add(empKey);
                    if (email) {
                        seenEmails.add(email.toLowerCase());
                        emails.add(email.toLowerCase());
                    }
                    results.push({ row: rowNumber, name: employeeId, status: 'success', message: 'Data karyawan diperbarui' });
                } else {
                    if (!password || password.length < 6) {
                        pushError('Password wajib diisi minimal 6 karakter untuk karyawan baru');
                        continue;
                    }
                    if (currentUsers >= maxUsers) {
                        pushError(`Kuota lisensi penuh (${maxUsers} pengguna). Karyawan baru tidak dapat ditambahkan`);
                        continue;
                    }
                    if (email && emails.has(email.toLowerCase())) {
                        pushError('Email sudah terdaftar');
                        continue;
                    }

                    const hash = await bcrypt.hash(password, 10);
                    const created = await pool.query(
                        `INSERT INTO users (employee_id, name, email, password, role)
                         VALUES ($1, $2, $3, $4, 'employee') RETURNING id, employee_id, email, role`,
                        [employeeId, name, email || null, hash]
                    );
                    const newUser = created.rows[0];

                    await pool.query(`
                        INSERT INTO employee_details (
                            user_id, nik, phone, address, birth_date, birth_place,
                            gender, marital_status, religion, education,
                            department, position, join_date,
                            bank_name, bank_account, bank_holder,
                            npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
                            basic_salary, salary_type, no_kk, updated_at
                        ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,CURRENT_TIMESTAMP
                        )
                    `, [
                        newUser.id, details.nik, details.phone, details.address, details.birth_date, details.birth_place,
                        details.gender, details.marital_status || 'Belum Menikah', details.religion, details.education,
                        details.department, details.position, details.join_date,
                        details.bank_name, details.bank_account, details.bank_holder,
                        details.npwp, details.bpjs_kesehatan_no, details.bpjs_ketenagakerjaan_no,
                        details.basic_salary, details.salary_type || 'monthly', details.no_kk
                    ]);

                    usersByEmpId.set(empKey, newUser);
                    currentUsers++;
                    imported++;
                    seenIds.add(empKey);
                    if (email) {
                        seenEmails.add(email.toLowerCase());
                        emails.add(email.toLowerCase());
                    }
                    results.push({ row: rowNumber, name: employeeId, status: 'success', message: 'Karyawan baru ditambahkan' });
                }
            } catch (saveError) {
                if (saveError.code === '23505') {
                    pushError('Employee ID atau email sudah terdaftar');
                } else if (saveError.code === '23514') {
                    pushError('Nilai tidak valid (cek jenis kelamin, status, atau tipe gaji)');
                } else {
                    pushError(saveError.message || 'Gagal menyimpan data karyawan');
                }
            }
        }

        if (imported === 0 && updated === 0 && failed === 0) {
            return res.status(400).json({ error: 'Tidak ada data karyawan pada file Excel' });
        }

        res.json({ imported, updated, failed, results });
    } catch (error) {
        console.error('Import employees error:', error);
        res.status(500).json({ error: 'Gagal mengimpor data karyawan dari Excel' });
    }
});

// Get single employee detail
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userResult = await pool.query(
            'SELECT id, employee_id, name, email, role, created_at FROM users WHERE id = $1',
            [id]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        const detailResult = await pool.query(
            'SELECT * FROM employee_details WHERE user_id = $1',
            [id]
        );

        const locationResult = await pool.query(
            'SELECT location_id FROM user_locations WHERE user_id = $1',
            [id]
        );

        const employee = {
            ...userResult.rows[0],
            details: detailResult.rows[0] || null,
            location_ids: locationResult.rows.map(r => r.location_id)
        };

        res.json(employee);
    } catch (error) {
        console.error('Get employee detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update employee details
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nik, phone, address, birth_date, birth_place,
            gender, marital_status, religion, education,
            department, position, join_date,
            bank_name, bank_account, bank_holder,
            npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
            basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate,
            tax_status, emergency_contact_name, emergency_contact_phone,
            is_driver, is_collector, use_tracking, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance, driver_ritase_dekat_allowance, driver_ritase_jauh_allowance,
            bpjs_kes_enrolled, bpjs_jht_enrolled, bpjs_jp_enrolled, bpjs_jkk_enrolled, bpjs_jkm_enrolled, pph21_enabled,
            bpjs_kes_employee_rate, bpjs_kes_company_rate, bpjs_jht_employee_rate, bpjs_jht_company_rate,
            bpjs_jp_employee_rate, bpjs_jp_company_rate, bpjs_jkk_rate, bpjs_jkm_rate,
            no_kk,
            location_ids, vehicle_type_id, supervisor_id
        } = req.body;


        // Check user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        if (supervisor_id) {
            const nextSupervisor = parseInt(supervisor_id, 10);
            if (nextSupervisor && await wouldCreateCycle(pool, id, nextSupervisor)) {
                return res.status(400).json({
                    error: 'Tidak bisa menetapkan atasan ini karena akan membuat siklus pelaporan'
                });
            }
        }

        // Upsert employee details
        const result = await pool.query(`
            INSERT INTO employee_details (
                user_id, nik, phone, address, birth_date, birth_place,
                gender, marital_status, religion, education,
                department, position, join_date,
                bank_name, bank_account, bank_holder,
                npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
                basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate,
                tax_status, emergency_contact_name, emergency_contact_phone,
                is_driver, is_collector, use_tracking, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance, driver_ritase_dekat_allowance, driver_ritase_jauh_allowance,
                bpjs_kes_enrolled, bpjs_jht_enrolled, bpjs_jp_enrolled, bpjs_jkk_enrolled, bpjs_jkm_enrolled, pph21_enabled,
                bpjs_kes_employee_rate, bpjs_kes_company_rate, bpjs_jht_employee_rate, bpjs_jht_company_rate,
                bpjs_jp_employee_rate, bpjs_jp_company_rate, bpjs_jkk_rate, bpjs_jkm_rate,
                no_kk, vehicle_type_id,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27,
                $28, $29, $30, $31, $32, $33, $34, $35,
                $36, $37, $38, $39, $40, $41,
                $42, $43, $44, $45, $46, $47, $48, $49,
                $50, $51,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO UPDATE SET
                nik = EXCLUDED.nik,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                birth_date = EXCLUDED.birth_date,
                birth_place = EXCLUDED.birth_place,
                gender = EXCLUDED.gender,
                marital_status = EXCLUDED.marital_status,
                religion = EXCLUDED.religion,
                education = EXCLUDED.education,
                department = EXCLUDED.department,
                position = EXCLUDED.position,
                join_date = EXCLUDED.join_date,
                bank_name = EXCLUDED.bank_name,
                bank_account = EXCLUDED.bank_account,
                bank_holder = EXCLUDED.bank_holder,
                npwp = EXCLUDED.npwp,
                bpjs_kesehatan_no = EXCLUDED.bpjs_kesehatan_no,
                bpjs_ketenagakerjaan_no = EXCLUDED.bpjs_ketenagakerjaan_no,
                basic_salary = EXCLUDED.basic_salary,
                salary_type = EXCLUDED.salary_type,
                transport_allowance = EXCLUDED.transport_allowance,
                meal_allowance = EXCLUDED.meal_allowance,
                overtime_rate = EXCLUDED.overtime_rate,
                tax_status = EXCLUDED.tax_status,
                emergency_contact_name = EXCLUDED.emergency_contact_name,
                emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                is_driver = EXCLUDED.is_driver,
                is_collector = EXCLUDED.is_collector,
                use_tracking = EXCLUDED.use_tracking,
                driver_subuh_allowance = EXCLUDED.driver_subuh_allowance,
                driver_rit_allowance = EXCLUDED.driver_rit_allowance,
                driver_inap_allowance = EXCLUDED.driver_inap_allowance,
                driver_ritase_dekat_allowance = EXCLUDED.driver_ritase_dekat_allowance,
                driver_ritase_jauh_allowance = EXCLUDED.driver_ritase_jauh_allowance,
                bpjs_kes_enrolled = EXCLUDED.bpjs_kes_enrolled,
                bpjs_jht_enrolled = EXCLUDED.bpjs_jht_enrolled,
                bpjs_jp_enrolled = EXCLUDED.bpjs_jp_enrolled,
                bpjs_jkk_enrolled = EXCLUDED.bpjs_jkk_enrolled,
                bpjs_jkm_enrolled = EXCLUDED.bpjs_jkm_enrolled,
                pph21_enabled = EXCLUDED.pph21_enabled,
                bpjs_kes_employee_rate = EXCLUDED.bpjs_kes_employee_rate,
                bpjs_kes_company_rate = EXCLUDED.bpjs_kes_company_rate,
                bpjs_jht_employee_rate = EXCLUDED.bpjs_jht_employee_rate,
                bpjs_jht_company_rate = EXCLUDED.bpjs_jht_company_rate,
                bpjs_jp_employee_rate = EXCLUDED.bpjs_jp_employee_rate,
                bpjs_jp_company_rate = EXCLUDED.bpjs_jp_company_rate,
                bpjs_jkk_rate = EXCLUDED.bpjs_jkk_rate,
                bpjs_jkm_rate = EXCLUDED.bpjs_jkm_rate,
                no_kk = EXCLUDED.no_kk,
                vehicle_type_id = EXCLUDED.vehicle_type_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            id, nik || null, phone || null, address || null, birth_date || null, birth_place || null,
            gender || null, marital_status || 'Belum Menikah', religion || null, education || null,
            department || null, position || null, join_date || null,
            bank_name || null, bank_account || null, bank_holder || null,
            npwp || null, bpjs_kesehatan_no || null, bpjs_ketenagakerjaan_no || null,
            basic_salary || 0, salary_type || 'monthly', transport_allowance || 0, meal_allowance || 0, overtime_rate || 50000,
            tax_status || 'TK/0', emergency_contact_name || null, emergency_contact_phone || null,
            is_driver || false, is_collector || false, use_tracking || false, driver_subuh_allowance || 0, driver_rit_allowance || 0, driver_inap_allowance || 0, driver_ritase_dekat_allowance || 0, driver_ritase_jauh_allowance || 0,
            bpjs_kes_enrolled !== false, bpjs_jht_enrolled !== false, bpjs_jp_enrolled !== false, bpjs_jkk_enrolled !== false, bpjs_jkm_enrolled !== false, pph21_enabled !== false,
            bpjs_kes_employee_rate || null, bpjs_kes_company_rate || null, bpjs_jht_employee_rate || null, bpjs_jht_company_rate || null,
            bpjs_jp_employee_rate || null, bpjs_jp_company_rate || null, bpjs_jkk_rate || null, bpjs_jkm_rate || null,
            no_kk || null, vehicle_type_id || null
        ]);

        // Manage locations
        if (Array.isArray(location_ids)) {
            await pool.query('DELETE FROM user_locations WHERE user_id = $1', [id]);
            if (location_ids.length > 0) {
                // Bulk insert
                const values = location_ids.map((locId, i) => `($1, $${i + 2})`).join(', ');
                const params = [id, ...location_ids];
                await pool.query(`INSERT INTO user_locations (user_id, location_id) VALUES ${values}`, params);
            }
        }

        if (supervisor_id !== undefined) {
            const nextSupervisor = supervisor_id ? parseInt(supervisor_id, 10) : null;
            try {
                await ensureOrgApprovalSchema(pool);
            } catch (e) { /* schema already applied */ }
            await pool.query(
                `UPDATE employee_details SET supervisor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
                [nextSupervisor, id]
            );
        }

        const latest = await pool.query('SELECT * FROM employee_details WHERE user_id = $1', [id]);
        res.json(latest.rows[0] || result.rows[0]);
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    }
});

// ========== DOCUMENT MANAGEMENT ==========

// Get documents for an employee
router.get('/:id/documents', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, doc_type, doc_name, file_path, file_size, mime_type, uploaded_at, notes FROM employee_documents WHERE user_id = $1 ORDER BY uploaded_at DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Upload document for an employee
router.post('/:id/documents', authenticateToken, isAdmin, docUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
        }
        const { doc_type, notes } = req.body;
        if (!doc_type) {
            return res.status(400).json({ error: 'Tipe dokumen harus diisi' });
        }

        const filePath = `/uploads/documents/${req.file.filename}`;
        const result = await pool.query(
            `INSERT INTO employee_documents (user_id, doc_type, doc_name, file_path, file_size, mime_type, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.params.id, doc_type, req.file.originalname, filePath, req.file.size, req.file.mimetype, notes || null]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete document
router.delete('/:id/documents/:docId', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Get file path first
        const docResult = await pool.query(
            'SELECT file_path FROM employee_documents WHERE id = $1 AND user_id = $2',
            [req.params.docId, req.params.id]
        );
        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
        }

        // Delete file from disk
        const fullPath = path.join(__dirname, '..', docResult.rows[0].file_path);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        // Delete from DB
        await pool.query('DELETE FROM employee_documents WHERE id = $1', [req.params.docId]);
        res.json({ message: 'Dokumen berhasil dihapus' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
