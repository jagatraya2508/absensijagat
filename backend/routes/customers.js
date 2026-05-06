const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Helper: generate next customer code
async function generateCustomerCode(client) {
    const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
    const digitsRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_digits'`);
    const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);

    const prefix = prefixRes.rows[0]?.value || 'CUST';
    const digits = parseInt(digitsRes.rows[0]?.value || '4');
    const next = parseInt(nextRes.rows[0]?.value || '1');

    const code = prefix + String(next).padStart(digits, '0');

    // Increment counter
    await client.query(
        `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`,
        [String(next + 1)]
    );

    return code;
}

// GET /search — Search customers (for driver autocomplete)
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q = '' } = req.query;
        const result = await pool.query(
            `SELECT id, customer_code, name, address, phone FROM customers 
             WHERE is_active = true AND (name ILIKE $1 OR customer_code ILIKE $1)
             ORDER BY name ASC LIMIT 20`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Search customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /code-settings — Get customer code settings (admin)
router.get('/code-settings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT key, value FROM app_settings WHERE key IN ('customer_code_prefix', 'customer_code_next', 'customer_code_digits')`
        );
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (error) {
        console.error('Get code settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// PUT /code-settings — Update customer code settings (admin)
router.put('/code-settings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { prefix, next_number, digits } = req.body;
        
        if (prefix !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_prefix'`, [prefix.toUpperCase()]);
        }
        if (next_number !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_next'`, [String(parseInt(next_number))]);
        }
        if (digits !== undefined) {
            await pool.query(`UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = 'customer_code_digits'`, [String(parseInt(digits))]);
        }

        res.json({ message: 'Pengaturan kode customer berhasil diperbarui' });
    } catch (error) {
        console.error('Update code settings error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET / — Get all customers (admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// POST / — Create customer (admin or auto-create from tracking)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, address, phone, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama customer harus diisi' });
        }

        await client.query('BEGIN');

        // Check if customer already exists by name
        const existing = await client.query(`SELECT id FROM customers WHERE LOWER(name) = LOWER($1)`, [name.trim()]);
        if (existing.rows.length > 0) {
            // Update existing
            const result = await client.query(
                `UPDATE customers SET 
                    address = COALESCE($1, address),
                    phone = COALESCE($2, phone),
                    notes = COALESCE($3, notes),
                    updated_at = NOW()
                 WHERE LOWER(name) = LOWER($4) RETURNING *`,
                [address || null, phone || null, notes || null, name.trim()]
            );
            await client.query('COMMIT');
            return res.status(200).json(result.rows[0]);
        }

        // Generate code for new customer
        const customerCode = await generateCustomerCode(client);

        const result = await client.query(
            `INSERT INTO customers (customer_code, name, address, phone, notes) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [customerCode, name.trim(), address || null, phone || null, notes || null]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create customer error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Nama customer sudah ada' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
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
