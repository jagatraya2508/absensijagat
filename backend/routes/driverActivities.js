const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get driver activities (with filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year, user_id } = req.query;
        let query = `
            SELECT da.*, u.name as user_name, u.employee_id,
                   ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM da.activity_date) = $${paramIdx} AND EXTRACT(YEAR FROM da.activity_date) = $${paramIdx + 1}`;
            params.push(month, year);
            paramIdx += 2;
        }
        if (user_id) {
            query += ` AND da.user_id = $${paramIdx}`;
            params.push(user_id);
            paramIdx++;
        }

        query += ' ORDER BY da.activity_date DESC, u.name ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get driver activities error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get summary for payroll (per driver per month)
router.get('/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const result = await pool.query(`
            SELECT da.user_id, u.name as user_name, u.employee_id,
                   COUNT(*) as total_days,
                   SUM(CASE WHEN da.is_subuh THEN 1 ELSE 0 END) as total_subuh,
                   SUM(da.rit_count) as total_rit,
                   SUM(CASE WHEN da.is_overnight THEN 1 ELSE 0 END) as total_overnight,
                   SUM(GREATEST(da.rit_count - 1, 0)) as extra_rit,
                   COALESCE(ed.driver_subuh_allowance, 0) as tarif_subuh,
                   COALESCE(ed.driver_rit_allowance, 0) as tarif_rit,
                   COALESCE(ed.driver_inap_allowance, 0) as tarif_inap,
                   COALESCE(ed.driver_ritase_allowance, 0) as tarif_ritase
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE EXTRACT(MONTH FROM da.activity_date) = $1
              AND EXTRACT(YEAR FROM da.activity_date) = $2
            GROUP BY da.user_id, u.name, u.employee_id, 
                     ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_allowance
            ORDER BY u.name ASC
        `, [month, year]);

        // Calculate totals
        const summary = result.rows.map(row => {
            const subuhAmt = parseInt(row.total_subuh) * parseFloat(row.tarif_subuh);
            const ritAmt = parseInt(row.total_rit) * parseFloat(row.tarif_rit);
            const overnightAmt = parseInt(row.total_overnight) * parseFloat(row.tarif_inap);
            const ritaseAmt = parseInt(row.extra_rit) * parseFloat(row.tarif_ritase);
            return {
                ...row,
                total_subuh_amount: subuhAmt,
                total_rit_amount: ritAmt,
                total_overnight_amount: overnightAmt,
                total_ritase_amount: ritaseAmt,
                grand_total: subuhAmt + ritAmt + overnightAmt + ritaseAmt
            };
        });

        res.json(summary);
    } catch (error) {
        console.error('Get driver summary error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all drivers (for dropdown)
router.get('/drivers', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.employee_id
            FROM users u
            JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee' AND ed.is_driver = true
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create driver activity
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes } = req.body;

        if (!user_id || !activity_date) {
            return res.status(400).json({ error: 'Driver dan tanggal harus diisi' });
        }

        // Verify user is a driver
        const driverCheck = await pool.query(
            'SELECT ed.is_driver FROM employee_details ed WHERE ed.user_id = $1',
            [user_id]
        );
        if (driverCheck.rows.length === 0 || !driverCheck.rows[0].is_driver) {
            return res.status(400).json({ error: 'Karyawan ini bukan driver' });
        }

        const result = await pool.query(`
            INSERT INTO driver_activities (user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, activity_date) DO UPDATE SET
                is_subuh = EXCLUDED.is_subuh,
                departure_time = EXCLUDED.departure_time,
                rit_count = EXCLUDED.rit_count,
                rit_notes = EXCLUDED.rit_notes,
                is_overnight = EXCLUDED.is_overnight,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user_id, activity_date,
            is_subuh || false,
            departure_time || null,
            rit_count || 1,
            rit_notes || null,
            is_overnight || false,
            notes || null,
            req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update driver activity
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes } = req.body;

        const result = await pool.query(`
            UPDATE driver_activities SET
                is_subuh = $1, departure_time = $2, rit_count = $3, rit_notes = $4,
                is_overnight = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [
            is_subuh || false, departure_time || null, rit_count || 1,
            rit_notes || null, is_overnight || false, notes || null, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete driver activity
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM driver_activities WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }
        res.json({ message: 'Data berhasil dihapus' });
    } catch (error) {
        console.error('Delete driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Bulk create/update (for quick entry of multiple days)
router.post('/bulk', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { activities } = req.body; // Array of { user_id, activity_date, is_subuh, rit_count, is_overnight, ... }
        if (!Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({ error: 'Data aktivitas tidak valid' });
        }

        await client.query('BEGIN');

        const results = [];
        for (const act of activities) {
            const result = await client.query(`
                INSERT INTO driver_activities (user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (user_id, activity_date) DO UPDATE SET
                    is_subuh = EXCLUDED.is_subuh,
                    departure_time = EXCLUDED.departure_time,
                    rit_count = EXCLUDED.rit_count,
                    rit_notes = EXCLUDED.rit_notes,
                    is_overnight = EXCLUDED.is_overnight,
                    notes = EXCLUDED.notes,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                act.user_id, act.activity_date,
                act.is_subuh || false, act.departure_time || null,
                act.rit_count || 1, act.rit_notes || null,
                act.is_overnight || false, act.notes || null,
                req.user.id
            ]);
            results.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `${results.length} data berhasil disimpan`, data: results });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk create driver activities error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

module.exports = router;
