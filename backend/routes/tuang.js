const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

router.use(authenticateToken, hasPermission('manager.tuang'));

router.get('/employees', async (req, res) => {
    try {
        const { department } = req.query;
        const values = [];
        let query = `
            SELECT u.id, u.name, u.employee_id, ed.department, ed.position
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            WHERE u.role = 'employee'
              AND COALESCE(ed.receives_tuang, true) = true
        `;
        if (department) {
            values.push(department);
            query += ` AND ed.department = $1`;
        }
        query += ' ORDER BY ed.department NULLS LAST, u.name';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get tuang employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ed.department
            FROM employee_details ed
            JOIN users u ON u.id = ed.user_id
            WHERE u.role = 'employee'
              AND COALESCE(ed.receives_tuang, true) = true
              AND ed.department IS NOT NULL AND ed.department != ''
            ORDER BY ed.department
        `);
        res.json(result.rows.map(r => r.department));
    } catch (error) {
        console.error('Get tuang departments error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/summary', async (req, res) => {
    try {
        const month = parseInt(req.query.month, 10);
        const year = parseInt(req.query.year, 10);
        if (!month || !year) {
            return res.status(400).json({ error: 'Bulan dan tahun harus diisi' });
        }

        const result = await pool.query(`
            SELECT u.id as user_id, u.name, u.employee_id, ed.department,
                   COUNT(*) FILTER (WHERE pt.amount > 0) as tuang_days,
                   COALESCE(SUM(pt.amount), 0) as tuang_amount
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            JOIN production_tuang pt ON pt.user_id = u.id
            WHERE EXTRACT(MONTH FROM pt.tuang_date) = $1
              AND EXTRACT(YEAR FROM pt.tuang_date) = $2
            GROUP BY u.id, u.name, u.employee_id, ed.department
            HAVING COALESCE(SUM(pt.amount), 0) > 0
            ORDER BY ed.department NULLS LAST, u.name
        `, [month, year]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get tuang summary error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { date, month, year, user_id } = req.query;
        const values = [];
        let p = 1;
        let query = `
            SELECT pt.*, u.name as user_name, u.employee_id, ed.department
            FROM production_tuang pt
            JOIN users u ON u.id = pt.user_id
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            WHERE 1=1
        `;
        if (date) {
            query += ` AND pt.tuang_date = $${p++}`;
            values.push(date);
        }
        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM pt.tuang_date) = $${p++} AND EXTRACT(YEAR FROM pt.tuang_date) = $${p++}`;
            values.push(month, year);
        }
        if (user_id) {
            query += ` AND pt.user_id = $${p++}`;
            values.push(user_id);
        }
        query += ' ORDER BY ed.department NULLS LAST, u.name';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get tuang error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.post('/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        const { date, entries } = req.body;
        if (!date || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'Tanggal dan data tuang harus diisi' });
        }

        await client.query('BEGIN');
        let saved = 0;
        let removed = 0;

        for (const entry of entries) {
            const userId = parseInt(entry.user_id, 10);
            const amount = parseFloat(entry.amount) || 0;
            if (!userId) continue;

            const eligible = await client.query(
                'SELECT COALESCE(receives_tuang, true) as receives_tuang FROM employee_details WHERE user_id = $1',
                [userId]
            );
            if (eligible.rows.length > 0 && eligible.rows[0].receives_tuang === false) {
                continue;
            }

            if (amount <= 0) {
                const del = await client.query(
                    'DELETE FROM production_tuang WHERE user_id = $1 AND tuang_date = $2',
                    [userId, date]
                );
                removed += del.rowCount;
                continue;
            }

            await client.query(`
                INSERT INTO production_tuang (user_id, tuang_date, amount, notes, created_by, updated_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, tuang_date) DO UPDATE SET
                    amount = EXCLUDED.amount,
                    notes = EXCLUDED.notes,
                    created_by = EXCLUDED.created_by,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, date, amount, entry.notes || null, req.user.id]);
            saved++;
        }

        await client.query('COMMIT');
        res.json({ message: 'Tuang berhasil disimpan', saved, removed });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Save tuang bulk error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

module.exports = router;
