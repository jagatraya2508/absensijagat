const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');

const canManage = [authenticateToken, hasPermission('admin.divisions')];

router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM divisions ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching divisions:', err);
        res.status(500).json({ error: 'Gagal memuat master divisi' });
    }
});

router.post('/', ...canManage, async (req, res) => {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nama divisi harus diisi' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO divisions (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [String(name).trim(), description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating division:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Nama divisi sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal menambahkan divisi' });
    }
});

router.put('/:id', ...canManage, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nama divisi harus diisi' });
    }
    try {
        const existing = await pool.query('SELECT * FROM divisions WHERE id = $1', [id]);
        if (existing.rowCount === 0) {
            return res.status(404).json({ error: 'Divisi tidak ditemukan' });
        }

        const nextName = String(name).trim();
        const result = await pool.query(
            'UPDATE divisions SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [nextName, description || null, id]
        );

        const oldName = existing.rows[0].name;
        if (oldName !== nextName) {
            await pool.query(
                'UPDATE employee_details SET division = $1, updated_at = CURRENT_TIMESTAMP WHERE division = $2',
                [nextName, oldName]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating division:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Nama divisi sudah terdaftar' });
        }
        res.status(500).json({ error: 'Gagal memperbarui divisi' });
    }
});

router.delete('/:id', ...canManage, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM divisions WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Divisi tidak ditemukan' });
        }
        res.json({ message: 'Divisi berhasil dihapus' });
    } catch (err) {
        console.error('Error deleting division:', err);
        res.status(500).json({ error: 'Gagal menghapus divisi' });
    }
});

module.exports = router;
