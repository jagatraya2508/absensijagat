const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

const canManage = [authenticateToken, hasPermission('admin.employment_statuses')];

router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employment_statuses ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching employment statuses:', err);
        res.status(500).json({ error: 'Gagal memuat master status karyawan' });
    }
});

router.post('/', ...canManage, async (req, res) => {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nama status harus diisi' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO employment_statuses (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [String(name).trim(), description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating employment status:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Nama status sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal menambahkan status karyawan' });
    }
});

router.put('/:id', ...canManage, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nama status harus diisi' });
    }
    try {
        const existing = await pool.query('SELECT * FROM employment_statuses WHERE id = $1', [id]);
        if (existing.rowCount === 0) {
            return res.status(404).json({ error: 'Status karyawan tidak ditemukan' });
        }

        const nextName = String(name).trim();
        const result = await pool.query(
            'UPDATE employment_statuses SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [nextName, description || null, id]
        );

        const oldName = existing.rows[0].name;
        if (oldName !== nextName) {
            await pool.query(
                'UPDATE employee_details SET employment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE employment_status = $2',
                [nextName, oldName]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating employment status:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Nama status sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal memperbarui status karyawan' });
    }
});

router.delete('/:id', ...canManage, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM employment_statuses WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Status karyawan tidak ditemukan' });
        }
        res.json({ message: 'Status karyawan berhasil dihapus' });
    } catch (err) {
        console.error('Error deleting employment status:', err);
        res.status(500).json({ error: 'Gagal menghapus status karyawan' });
    }
});

module.exports = router;
