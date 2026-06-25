const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ============================================
// EMPLOYEE ENDPOINTS
// ============================================

// GET / - List laporan harian user (filter by date range)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { start_date, end_date, status } = req.query;

        let query = `
            SELECT dwr.*, 
                   u.name as user_name,
                   (SELECT COUNT(*) FROM work_report_items WHERE report_id = dwr.id) as item_count,
                   (SELECT COUNT(*) FROM work_report_items WHERE report_id = dwr.id AND status IN ('pending', 'in_progress')) as pending_count
            FROM daily_work_reports dwr
            JOIN users u ON dwr.user_id = u.id
            WHERE dwr.user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2;

        if (start_date) {
            query += ` AND dwr.report_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        if (end_date) {
            query += ` AND dwr.report_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        if (status) {
            query += ` AND dwr.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY dwr.report_date DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching work reports:', error);
        res.status(500).json({ error: 'Gagal mengambil data laporan kerja' });
    }
});

// GET /pending/all - Semua pekerjaan pending user (across all reports)
router.get('/pending/all', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT wri.*, dwr.report_date, dwr.status as report_status
            FROM work_report_items wri
            JOIN daily_work_reports dwr ON wri.report_id = dwr.id
            WHERE dwr.user_id = $1 
              AND wri.status IN ('pending', 'in_progress', 'blocked')
            ORDER BY 
                CASE wri.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                wri.due_date ASC NULLS LAST,
                wri.created_at DESC
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending items:', error);
        res.status(500).json({ error: 'Gagal mengambil data pekerjaan pending' });
    }
});

// GET /schedule/upcoming - Jadwal penyelesaian pekerjaan
router.get('/schedule/upcoming', async (req, res) => {
    try {
        const userId = req.user.id;
        const { days } = req.query;
        const lookAhead = days || 30;

        const result = await pool.query(`
            SELECT wri.*, dwr.report_date, dwr.status as report_status
            FROM work_report_items wri
            JOIN daily_work_reports dwr ON wri.report_id = dwr.id
            WHERE dwr.user_id = $1 
              AND wri.status IN ('pending', 'in_progress', 'blocked')
              AND wri.due_date IS NOT NULL
              AND wri.due_date <= CURRENT_DATE + INTERVAL '1 day' * $2
            ORDER BY wri.due_date ASC, 
                CASE wri.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END
        `, [userId, lookAhead]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Gagal mengambil jadwal penyelesaian' });
    }
});

// GET /:id - Detail satu laporan + items
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        let reportQuery = `
            SELECT dwr.*, u.name as user_name, r.name as reviewer_name
            FROM daily_work_reports dwr
            JOIN users u ON dwr.user_id = u.id
            LEFT JOIN users r ON dwr.reviewed_by = r.id
            WHERE dwr.id = $1
        `;
        const params = [id];

        if (!isAdmin) {
            reportQuery += ` AND dwr.user_id = $2`;
            params.push(userId);
        }

        const reportResult = await pool.query(reportQuery, params);
        if (reportResult.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        const itemsResult = await pool.query(`
            SELECT * FROM work_report_items 
            WHERE report_id = $1 
            ORDER BY sort_order ASC, start_time ASC NULLS LAST, created_at ASC
        `, [id]);

        res.json({
            ...reportResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Error fetching report detail:', error);
        res.status(500).json({ error: 'Gagal mengambil detail laporan' });
    }
});

// POST / - Buat laporan harian baru
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { report_date, summary } = req.body;

        if (!report_date) {
            return res.status(400).json({ error: 'Tanggal laporan wajib diisi' });
        }

        // Check if report already exists for this date
        const existing = await pool.query(
            'SELECT id FROM daily_work_reports WHERE user_id = $1 AND report_date = $2',
            [userId, report_date]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ 
                error: 'Laporan untuk tanggal ini sudah ada',
                existing_id: existing.rows[0].id
            });
        }

        const result = await pool.query(`
            INSERT INTO daily_work_reports (user_id, report_date, summary)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [userId, report_date, summary || '']);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Gagal membuat laporan kerja' });
    }
});

// PUT /:id - Update laporan (summary, status)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { summary, status } = req.body;

        // Verify ownership
        const check = await pool.query(
            'SELECT * FROM daily_work_reports WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        // Only allow editing draft/submitted reports
        if (check.rows[0].status === 'reviewed' && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'Laporan yang sudah direview tidak dapat diedit' });
        }

        const result = await pool.query(`
            UPDATE daily_work_reports 
            SET summary = COALESCE($1, summary),
                status = COALESCE($2, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [summary, status, id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Gagal mengupdate laporan' });
    }
});

// DELETE /:id - Hapus laporan (draft only)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const check = await pool.query(
            'SELECT * FROM daily_work_reports WHERE id = $1',
            [id]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        if (!isAdmin && check.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        if (!isAdmin && check.rows[0].status !== 'draft') {
            return res.status(400).json({ error: 'Hanya laporan draft yang dapat dihapus' });
        }

        await pool.query('DELETE FROM daily_work_reports WHERE id = $1', [id]);
        res.json({ message: 'Laporan berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Gagal menghapus laporan' });
    }
});

// ============================================
// WORK REPORT ITEMS ENDPOINTS
// ============================================

// POST /:id/items - Tambah item pekerjaan
router.post('/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { title, description, category, start_time, end_time, status, priority, due_date, completion_percentage, notes } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Judul pekerjaan wajib diisi' });
        }

        // Verify report ownership
        const check = await pool.query(
            'SELECT * FROM daily_work_reports WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        // Get max sort_order
        const maxOrder = await pool.query(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM work_report_items WHERE report_id = $1',
            [id]
        );

        const result = await pool.query(`
            INSERT INTO work_report_items 
            (report_id, title, description, category, start_time, end_time, status, priority, due_date, completion_percentage, notes, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            id,
            title,
            description || '',
            category || 'task',
            start_time || null,
            end_time || null,
            status || 'completed',
            priority || 'medium',
            due_date || null,
            completion_percentage || (status === 'completed' ? 100 : 0),
            notes || '',
            maxOrder.rows[0].next_order
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding report item:', error);
        res.status(500).json({ error: 'Gagal menambah item pekerjaan' });
    }
});

// PUT /items/:itemId - Update item pekerjaan
router.put('/items/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user.id;
        const { title, description, category, start_time, end_time, status, priority, due_date, completion_percentage, notes, sort_order } = req.body;

        // Verify ownership through report
        const check = await pool.query(`
            SELECT wri.* FROM work_report_items wri
            JOIN daily_work_reports dwr ON wri.report_id = dwr.id
            WHERE wri.id = $1 AND dwr.user_id = $2
        `, [itemId, userId]);

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Item pekerjaan tidak ditemukan' });
        }

        const result = await pool.query(`
            UPDATE work_report_items SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                start_time = COALESCE($4, start_time),
                end_time = COALESCE($5, end_time),
                status = COALESCE($6, status),
                priority = COALESCE($7, priority),
                due_date = COALESCE($8, due_date),
                completion_percentage = COALESCE($9, completion_percentage),
                notes = COALESCE($10, notes),
                sort_order = COALESCE($11, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
        `, [title, description, category, start_time, end_time, status, priority, due_date, completion_percentage, notes, sort_order, itemId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating report item:', error);
        res.status(500).json({ error: 'Gagal mengupdate item pekerjaan' });
    }
});

// DELETE /items/:itemId - Hapus item pekerjaan
router.delete('/items/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user.id;

        // Verify ownership through report
        const check = await pool.query(`
            SELECT wri.* FROM work_report_items wri
            JOIN daily_work_reports dwr ON wri.report_id = dwr.id
            WHERE wri.id = $1 AND dwr.user_id = $2
        `, [itemId, userId]);

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Item pekerjaan tidak ditemukan' });
        }

        await pool.query('DELETE FROM work_report_items WHERE id = $1', [itemId]);
        res.json({ message: 'Item pekerjaan berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting report item:', error);
        res.status(500).json({ error: 'Gagal menghapus item pekerjaan' });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET /admin/all - Admin: List semua laporan karyawan
router.get('/admin/all', hasPermission('admin.daily_work_report'), async (req, res) => {
    try {
        const { start_date, end_date, status, user_id, search } = req.query;

        let query = `
            SELECT dwr.*, 
                   u.name as user_name, u.employee_id,
                   ed.department, ed.position,
                   r.name as reviewer_name,
                   (SELECT COUNT(*) FROM work_report_items WHERE report_id = dwr.id) as item_count,
                   (SELECT COUNT(*) FROM work_report_items WHERE report_id = dwr.id AND status IN ('pending', 'in_progress')) as pending_count
            FROM daily_work_reports dwr
            JOIN users u ON dwr.user_id = u.id
            LEFT JOIN employee_details ed ON dwr.user_id = ed.user_id
            LEFT JOIN users r ON dwr.reviewed_by = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND dwr.report_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        if (end_date) {
            query += ` AND dwr.report_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        if (status) {
            query += ` AND dwr.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (user_id) {
            query += ` AND dwr.user_id = $${paramIndex}`;
            params.push(user_id);
            paramIndex++;
        }
        if (search) {
            query += ` AND (u.name ILIKE $${paramIndex} OR u.employee_id ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY dwr.report_date DESC, u.name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching admin reports:', error);
        res.status(500).json({ error: 'Gagal mengambil data laporan' });
    }
});

// GET /admin/stats - Admin: Statistik laporan
router.get('/admin/stats', hasPermission('admin.daily_work_report'), async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(DISTINCT user_id) FROM daily_work_reports WHERE report_date = $1) as total_submitted,
                (SELECT COUNT(*) FROM daily_work_reports WHERE report_date = $1 AND status = 'draft') as draft_count,
                (SELECT COUNT(*) FROM daily_work_reports WHERE report_date = $1 AND status = 'submitted') as submitted_count,
                (SELECT COUNT(*) FROM daily_work_reports WHERE report_date = $1 AND status = 'reviewed') as reviewed_count,
                (SELECT COUNT(*) FROM users WHERE role != 'admin') as total_employees
        `, [targetDate]);

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Gagal mengambil statistik' });
    }
});

// PUT /admin/:id/review - Admin: Review laporan
router.put('/admin/:id/review', hasPermission('admin.daily_work_report'), async (req, res) => {
    try {
        const { id } = req.params;
        const { review_notes, status } = req.body;
        const reviewerId = req.user.id;

        const check = await pool.query('SELECT * FROM daily_work_reports WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        const result = await pool.query(`
            UPDATE daily_work_reports 
            SET status = $1,
                reviewed_by = $2,
                review_notes = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [status || 'reviewed', reviewerId, review_notes || '', id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error reviewing report:', error);
        res.status(500).json({ error: 'Gagal mereview laporan' });
    }
});

module.exports = router;
