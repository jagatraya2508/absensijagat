const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// GET /search — Search customers (for driver autocomplete)
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q = '' } = req.query;
        const result = await pool.query(
            `SELECT id, name, address, phone FROM customers 
             WHERE is_active = true AND name ILIKE $1
             ORDER BY name ASC LIMIT 20`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Search customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET / — Get all customers (admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers ORDER BY name ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// POST / — Create customer (admin or auto-create from tracking)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, address, phone, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama customer harus diisi' });
        }

        const result = await pool.query(
            `INSERT INTO customers (name, address, phone, notes) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (name) DO UPDATE SET 
                address = COALESCE(EXCLUDED.address, customers.address),
                updated_at = NOW()
             RETURNING *`,
            [name.trim(), address || null, phone || null, notes || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
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
