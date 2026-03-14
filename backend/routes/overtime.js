const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all overtime records (with optional filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year, user_id, status } = req.query;
        let query = `
            SELECT o.*, u.name as user_name, u.employee_id,
                   a.name as approved_by_name
            FROM overtime_records o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN users a ON o.approved_by = a.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM o.date) = $${paramCount++} AND EXTRACT(YEAR FROM o.date) = $${paramCount++}`;
            values.push(month, year);
        } else if (year) {
            query += ` AND EXTRACT(YEAR FROM o.date) = $${paramCount++}`;
            values.push(year);
        }

        if (user_id) {
            query += ` AND o.user_id = $${paramCount++}`;
            values.push(user_id);
        }

        if (status) {
            query += ` AND o.status = $${paramCount++}`;
            values.push(status);
        }

        query += ' ORDER BY o.date DESC';

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get overtime error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create overtime record
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { user_id, date, hours, description } = req.body;

        if (!user_id || !date || !hours) {
            return res.status(400).json({ error: 'User, tanggal, dan jam lembur harus diisi' });
        }

        // Get overtime rate from employee details
        const empDetail = await pool.query(
            'SELECT overtime_rate FROM employee_details WHERE user_id = $1',
            [user_id]
        );
        const rate = empDetail.rows.length > 0 ? parseFloat(empDetail.rows[0].overtime_rate) : 50000;
        const total = parseFloat(hours) * rate;

        const result = await pool.query(`
            INSERT INTO overtime_records (user_id, date, hours, rate_per_hour, total_amount, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [user_id, date, hours, rate, total, description || null]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create overtime error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update overtime record
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, date, hours, description } = req.body;

        // Get overtime rate
        const empDetail = await pool.query(
            'SELECT overtime_rate FROM employee_details WHERE user_id = $1',
            [user_id]
        );
        const rate = empDetail.rows.length > 0 ? parseFloat(empDetail.rows[0].overtime_rate) : 50000;
        const total = parseFloat(hours) * rate;

        const result = await pool.query(`
            UPDATE overtime_records SET
                user_id = $1, date = $2, hours = $3, rate_per_hour = $4,
                total_amount = $5, description = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 RETURNING *
        `, [user_id, date, hours, rate, total, description || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data lembur tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update overtime error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Approve/reject overtime
router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        const result = await pool.query(`
            UPDATE overtime_records SET status = $1, approved_by = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING *
        `, [status, req.user.id, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data lembur tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update overtime status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete overtime record
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM overtime_records WHERE id = $1', [id]);
        res.json({ message: 'Data lembur berhasil dihapus' });
    } catch (error) {
        console.error('Delete overtime error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
