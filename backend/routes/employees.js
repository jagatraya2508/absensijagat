const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

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
                   ed.vehicle_type_id, vt.name as vehicle_type_name
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            LEFT JOIN vehicle_types vt ON ed.vehicle_type_id = vt.id
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
            location_ids, vehicle_type_id
        } = req.body;


        // Check user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
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
