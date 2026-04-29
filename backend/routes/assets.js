const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer for asset photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/assets');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'asset-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan!'));
    }
});

// ==========================================
// KATEGORI ASET
// ==========================================

router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM asset_categories ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching asset categories:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/categories', authenticateToken, isAdmin, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });

    try {
        const result = await pool.query(
            'INSERT INTO asset_categories (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating category:', err);
        if (err.code === '23505') return res.status(400).json({ error: 'Kategori sudah ada' });
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/categories/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });

        const result = await pool.query(
            'UPDATE asset_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
            [name, description, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating category:', err);
        if (err.code === '23505') return res.status(400).json({ error: 'Kategori sudah ada' });
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/categories/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if category is used by any asset
        const check = await pool.query('SELECT COUNT(*) FROM assets WHERE category_id = $1', [id]);
        if (parseInt(check.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Kategori tidak dapat dihapus karena masih digunakan oleh aset' });
        }

        const result = await pool.query('DELETE FROM asset_categories WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
        
        res.json({ message: 'Kategori berhasil dihapus' });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// ASET UTAMA
// ==========================================

router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, c.name as category_name, u.name as assignee_name, u.employee_id
            FROM assets a
            LEFT JOIN asset_categories c ON c.id = a.category_id
            LEFT JOIN users u ON u.id = a.current_assignee_id
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching assets:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create Asset
router.post('/', authenticateToken, isAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { asset_code, name, category_id, brand, purchase_date, price, description, status } = req.body;
        const photo_path = req.file ? `/uploads/assets/${req.file.filename}` : null;

        // Generate barcode if not provided
        let final_code = asset_code;
        if (!final_code) {
             const cntResult = await pool.query('SELECT COUNT(*) FROM assets');
             const count = parseInt(cntResult.rows[0].count) + 1;
             final_code = `AST-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
        }

        const result = await pool.query(`
            INSERT INTO assets (asset_code, name, category_id, brand, purchase_date, price, description, status, photo_path, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [
            final_code, name, category_id || null, brand, purchase_date || null, 
            price ? parseFloat(price) : null, description, status || 'available', photo_path, req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating asset:', err);
        if (err.code === '23505') return res.status(400).json({ error: 'Kode aset sudah digunakan' });
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Asset
router.put('/:id', authenticateToken, isAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const { asset_code, name, category_id, brand, purchase_date, price, description, status } = req.body;
        
        let query = `UPDATE assets SET 
            asset_code = $1, name = $2, category_id = $3, brand = $4, 
            purchase_date = $5, price = $6, description = $7, status = $8, updated_at = CURRENT_TIMESTAMP
        `;
        let values = [
            asset_code, name, category_id || null, brand, purchase_date || null, 
            price ? parseFloat(price) : null, description, status
        ];

        let valCount = 9;
        if (req.file) {
            query += `, photo_path = $${valCount++}`;
            values.push(`/uploads/assets/${req.file.filename}`);
        }

        query += ` WHERE id = $${valCount} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' });
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating asset:', err);
        if (err.code === '23505') return res.status(400).json({ error: 'Kode aset sudah digunakan' });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Asset
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch to delete photo
        const asset = await pool.query('SELECT photo_path FROM assets WHERE id = $1', [id]);
        if (asset.rows.length > 0 && asset.rows[0].photo_path) {
            const photoFile = path.join(__dirname, '..', asset.rows[0].photo_path);
            if (fs.existsSync(photoFile)) fs.unlinkSync(photoFile);
        }

        await pool.query('DELETE FROM assets WHERE id = $1', [id]);
        res.json({ message: 'Aset berhasil dihapus' });
    } catch (err) {
        console.error('Error deleting asset:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// ==========================================
// PEMINJAMAN / ASSIGNMENT ASET
// ==========================================

router.post('/:id/assign', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { user_id, assigned_date, notes } = req.body;

        await client.query('BEGIN');

        // Verify availability
        const asset = await client.query('SELECT status FROM assets WHERE id = $1 FOR UPDATE', [id]);
        if (asset.rows.length === 0) throw new Error('Aset tidak ditemukan');
        if (asset.rows[0].status !== 'available') throw new Error('Aset sedang tidak tersedia / dipinjam');

        // Record assignment
        await client.query(`
            INSERT INTO asset_assignments (asset_id, user_id, assigned_by, assigned_date, notes)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, user_id, req.user.id, assigned_date || new Date(), notes]);

        // Update asset status
        await client.query(`
            UPDATE assets SET status = 'assigned', current_assignee_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [user_id, id]);

        await client.query('COMMIT');
        res.json({ message: 'Aset berhasil dipinjamkan' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error assigning asset:', err);
        res.status(400).json({ error: err.message || 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/:id/return', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { returned_date, notes, condition } = req.body;

        await client.query('BEGIN');

        const activeAssignment = await client.query(`
            SELECT id FROM asset_assignments 
            WHERE asset_id = $1 AND returned_date IS NULL
            ORDER BY assigned_date DESC LIMIT 1
        `, [id]);

        if (activeAssignment.rows.length === 0) {
            throw new Error('Tidak ada data peminjaman aktif untuk aset ini');
        }

        // Close assignment
        await client.query(`
            UPDATE asset_assignments 
            SET returned_date = $1, returned_to = $2, notes = CONCAT(notes, ' | RETURN: ', $3::text)
            WHERE id = $4
        `, [returned_date || new Date(), req.user.id, notes || '', activeAssignment.rows[0].id]);

        // Update asset status
        await client.query(`
            UPDATE assets SET status = $1, current_assignee_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [condition || 'available', id]);

        await client.query('COMMIT');
        res.json({ message: 'Pengembalian aset berhasil dicatat' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error returning asset:', err);
        res.status(400).json({ error: err.message || 'Server error' });
    } finally {
        client.release();
    }
});

// Get Assignment History
router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT aa.*, u.name as user_name, u.employee_id, admin.name as admin_name
            FROM asset_assignments aa
            JOIN users u ON u.id = aa.user_id
            LEFT JOIN users admin ON admin.id = aa.assigned_by
            WHERE aa.asset_id = $1
            ORDER BY aa.assigned_date DESC, aa.created_at DESC
        `, [id]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching asset history:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
