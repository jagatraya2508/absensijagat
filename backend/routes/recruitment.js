const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { sendInterviewEmail } = require('../utils/email');

// Configure multer for candidate uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/recruitment');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    }
});

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// Get all OPEN job positions (Public)
router.get('/public/positions', async (req, res) => {
    try {
        const query = `
            SELECT id, title, department, description, requirements, salary_range_min, salary_range_max, employment_type, created_at
            FROM job_positions
            WHERE status = 'open'
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Get public positions error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Submit application (Public)
router.post('/public/candidates', upload.fields([
    { name: 'resume', maxCount: 5 },
    { name: 'photo', maxCount: 1 }
]), async (req, res) => {
    try {
        const { full_name, email, phone, address, education, experience_years, applied_position_id, source } = req.body;

        if (!full_name) {
            return res.status(400).json({ error: 'Nama kandidat harus diisi' });
        }

        const resumePath = req.files?.resume 
            ? req.files.resume.map(f => `/uploads/recruitment/${f.filename}`).join(',') 
            : null;
        const photoPath = req.files?.photo ? `/uploads/recruitment/${req.files.photo[0].filename}` : null;

        const result = await pool.query(
            `INSERT INTO candidates (full_name, email, phone, address, education, experience_years, 
             applied_position_id, resume_path, photo_path, source, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'applied') RETURNING *`,
            [full_name, email || null, phone || null, address || null, education || null,
                experience_years || 0, applied_position_id || null, resumePath, photoPath,
                source || 'website', 'Pelamar via Public Page']
        );

        res.status(201).json({ success: true, message: 'Lamaran berhasil dikirim', data: result.rows[0] });
    } catch (error) {
        console.error('Public create candidate error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ==========================================
// JOB POSITIONS (ADMIN)
// ==========================================

// Get all job positions
router.get('/positions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT jp.*, u.name as creator_name,
                   (SELECT COUNT(*) FROM candidates c WHERE c.applied_position_id = jp.id) as total_applicants
            FROM job_positions jp
            LEFT JOIN users u ON jp.created_by = u.id
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` WHERE jp.status = $1`;
        }

        query += ` ORDER BY jp.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get positions error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create job position
router.post('/positions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, department, description, requirements, salary_range_min, salary_range_max, employment_type } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Judul posisi harus diisi' });
        }

        const result = await pool.query(
            `INSERT INTO job_positions (title, department, description, requirements, salary_range_min, salary_range_max, employment_type, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, department || null, description || null, requirements || null,
                salary_range_min || null, salary_range_max || null, employment_type || 'full-time', req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create position error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update job position
router.put('/positions/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, department, description, requirements, salary_range_min, salary_range_max, employment_type, status } = req.body;

        const result = await pool.query(
            `UPDATE job_positions 
             SET title = $1, department = $2, description = $3, requirements = $4,
                 salary_range_min = $5, salary_range_max = $6, employment_type = $7, status = $8,
                 closed_date = CASE WHEN $8 = 'closed' THEN CURRENT_DATE ELSE closed_date END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 RETURNING *`,
            [title, department, description, requirements, salary_range_min, salary_range_max, employment_type, status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Posisi tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update position error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete job position
router.delete('/positions/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM job_positions WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Posisi tidak ditemukan' });
        }

        res.json({ message: 'Posisi berhasil dihapus' });
    } catch (error) {
        console.error('Delete position error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ==========================================
// CANDIDATES
// ==========================================

// Get all candidates
router.get('/candidates', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { position_id, status } = req.query;
        let query = `
            SELECT c.*, jp.title as position_title, jp.department
            FROM candidates c
            LEFT JOIN job_positions jp ON c.applied_position_id = jp.id
        `;
        const params = [];
        const conditions = [];

        if (position_id) {
            params.push(parseInt(position_id));
            conditions.push(`c.applied_position_id = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`c.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY c.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create candidate
router.post('/candidates', authenticateToken, isAdmin, upload.fields([
    { name: 'resume', maxCount: 5 },
    { name: 'photo', maxCount: 1 }
]), async (req, res) => {
    try {
        const { full_name, email, phone, address, education, experience_years, applied_position_id, source, notes } = req.body;

        if (!full_name) {
            return res.status(400).json({ error: 'Nama kandidat harus diisi' });
        }

        const resumePath = req.files?.resume 
            ? req.files.resume.map(f => `/uploads/recruitment/${f.filename}`).join(',') 
            : null;
        const photoPath = req.files?.photo ? `/uploads/recruitment/${req.files.photo[0].filename}` : null;

        const result = await pool.query(
            `INSERT INTO candidates (full_name, email, phone, address, education, experience_years, 
             applied_position_id, resume_path, photo_path, source, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [full_name, email || null, phone || null, address || null, education || null,
                experience_years || 0, applied_position_id || null, resumePath, photoPath,
                source || 'website', notes || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create candidate error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update candidate
router.put('/candidates/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, address, education, experience_years, applied_position_id, status, source, notes } = req.body;

        const result = await pool.query(
            `UPDATE candidates 
             SET full_name = $1, email = $2, phone = $3, address = $4, education = $5,
                 experience_years = $6, applied_position_id = $7, status = $8, source = $9,
                 notes = $10, updated_at = CURRENT_TIMESTAMP
             WHERE id = $11 RETURNING *`,
            [full_name, email, phone, address, education, experience_years,
                applied_position_id, status, source, notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete candidate
router.delete('/candidates/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM candidates WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
        }

        res.json({ message: 'Kandidat berhasil dihapus' });
    } catch (error) {
        console.error('Delete candidate error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update candidate status (quick status change)
router.patch('/candidates/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['applied', 'screening', 'interview', 'test', 'offering', 'hired', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        const result = await pool.query(
            `UPDATE candidates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update candidate status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ==========================================
// RECRUITMENT STAGES
// ==========================================

// Get stages for a candidate
router.get('/candidates/:id/stages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT rs.*, u.name as interviewer_name
             FROM recruitment_stages rs
             LEFT JOIN users u ON rs.interviewer_id = u.id
             WHERE rs.candidate_id = $1
             ORDER BY rs.stage_order ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get stages error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create stage
router.post('/candidates/:id/stages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const candidateId = req.params.id;
        const { stage_name, stage_order, scheduled_date, interviewer_id, notes } = req.body;

        if (!stage_name) {
            return res.status(400).json({ error: 'Nama tahapan harus diisi' });
        }

        const result = await pool.query(
            `INSERT INTO recruitment_stages (candidate_id, stage_name, stage_order, scheduled_date, interviewer_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [candidateId, stage_name, stage_order || 1, scheduled_date || null, interviewer_id || null, notes || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create stage error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update stage
router.put('/stages/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, score, notes, completed_date } = req.body;

        const result = await pool.query(
            `UPDATE recruitment_stages 
             SET status = $1, score = $2, notes = $3, 
                 completed_date = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 RETURNING *`,
            [status, score || null, notes || null, completed_date || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tahapan tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ==========================================
// INTERVIEWS
// ==========================================

// Get all interviews
router.get('/interviews', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        let query = `
            SELECT i.*, c.full_name as candidate_name, c.email as candidate_email,
                   c.phone as candidate_phone, jp.title as position_title,
                   u.name as interviewer_name
            FROM interviews i
            JOIN candidates c ON i.candidate_id = c.id
            LEFT JOIN job_positions jp ON c.applied_position_id = jp.id
            LEFT JOIN users u ON i.interviewer_id = u.id
        `;
        const params = [];
        const conditions = [];

        if (start_date) {
            params.push(start_date);
            conditions.push(`i.interview_date >= $${params.length}`);
        }
        if (end_date) {
            params.push(end_date);
            conditions.push(`i.interview_date <= $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`i.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY i.interview_date ASC, i.interview_time ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get interviews error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create interview
router.post('/interviews', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { candidate_id, stage_id, interviewer_id, interview_date, interview_time, location, type, meeting_link, notes } = req.body;

        if (!candidate_id || !interview_date) {
            return res.status(400).json({ error: 'Kandidat dan tanggal interview harus diisi' });
        }

        const result = await pool.query(
            `INSERT INTO interviews (candidate_id, stage_id, interviewer_id, interview_date, interview_time, 
             location, type, meeting_link, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [candidate_id, stage_id || null, interviewer_id || null, interview_date,
                interview_time || null, location || null, type || 'onsite', meeting_link || null, notes || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create interview error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update interview
router.put('/interviews/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { interviewer_id, interview_date, interview_time, location, type, meeting_link, status, result: interviewResult, notes } = req.body;

        const dbResult = await pool.query(
            `UPDATE interviews 
             SET interviewer_id = $1, interview_date = $2, interview_time = $3, location = $4,
                 type = $5, meeting_link = $6, status = $7, result = $8, notes = $9,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $10 RETURNING *`,
            [interviewer_id, interview_date, interview_time, location, type, meeting_link, status, interviewResult || null, notes, id]
        );

        if (dbResult.rows.length === 0) {
            return res.status(404).json({ error: 'Interview tidak ditemukan' });
        }

        res.json(dbResult.rows[0]);
    } catch (error) {
        console.error('Update interview error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete interview
router.delete('/interviews/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM interviews WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Interview tidak ditemukan' });
        }

        res.json({ message: 'Interview berhasil dihapus' });
    } catch (error) {
        console.error('Delete interview error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Send interview email
router.post('/interviews/:id/send-email', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch interview details
        const interviewRes = await pool.query(`SELECT * FROM interviews WHERE id = $1`, [id]);
        if (interviewRes.rows.length === 0) return res.status(404).json({ error: 'Interview tidak ditemukan' });
        const interview = interviewRes.rows[0];

        // Fetch candidate
        const candidateRes = await pool.query(`SELECT * FROM candidates WHERE id = $1`, [interview.candidate_id]);
        if (candidateRes.rows.length === 0) return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
        const candidate = candidateRes.rows[0];

        if (!candidate.email) return res.status(400).json({ error: 'Kandidat tidak memiliki alamat email' });

        // Fetch position
        const positionRes = await pool.query(`SELECT * FROM job_positions WHERE id = $1`, [candidate.applied_position_id]);
        const position = positionRes.rows.length > 0 ? positionRes.rows[0] : { title: 'Posisi tidak diketahui' };

        // Send Email
        const emailResult = await sendInterviewEmail(candidate, interview, position);

        if (!emailResult.success) {
            return res.status(500).json({ error: emailResult.message || emailResult.error || 'Gagal mengirim email' });
        }

        res.json({ success: true, message: 'Email undangan berhasil dikirim' });

    } catch (error) {
        console.error('Send interview email error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ==========================================
// RECRUITMENT STATS
// ==========================================

router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const positionsResult = await pool.query(
            `SELECT status, COUNT(*) as count FROM job_positions GROUP BY status`
        );

        const candidatesResult = await pool.query(
            `SELECT status, COUNT(*) as count FROM candidates GROUP BY status`
        );

        const interviewsResult = await pool.query(
            `SELECT status, COUNT(*) as count FROM interviews 
             WHERE interview_date >= CURRENT_DATE GROUP BY status`
        );

        const recentCandidates = await pool.query(
            `SELECT c.*, jp.title as position_title
             FROM candidates c
             LEFT JOIN job_positions jp ON c.applied_position_id = jp.id
             ORDER BY c.created_at DESC LIMIT 5`
        );

        res.json({
            positions: positionsResult.rows,
            candidates: candidatesResult.rows,
            upcoming_interviews: interviewsResult.rows,
            recent_candidates: recentCandidates.rows
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
