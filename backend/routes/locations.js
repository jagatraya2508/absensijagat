const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');
const canManageLocations = hasPermission('admin.locations');

// Get all locations
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM attendance_locations ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get active locations only
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { type } = req.query; // 'check-in' or 'check-out'

        const userLocs = await pool.query('SELECT location_id FROM user_locations WHERE user_id = $1', [userId]);

        let query = 'SELECT * FROM attendance_locations WHERE is_active = true';
        let params = [];

        if (role !== 'admin' && userLocs.rows.length > 0) {
            const locIds = userLocs.rows.map(r => r.location_id);
            query += ' AND id = ANY($1)';
            params.push(locIds);
        }

        // Filter based on location_type ('all', 'check_in', 'check_out')
        if (type === 'check-in') {
            query += ` AND (location_type = 'all' OR location_type = 'check_in' OR location_type IS NULL)`;
        } else if (type === 'check-out') {
            query += ` AND (location_type = 'all' OR location_type = 'check_out' OR location_type IS NULL)`;
        }

        query += ' ORDER BY name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get active locations error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get single location
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM attendance_locations WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lokasi tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get location error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create location (Admin only)
router.post('/', authenticateToken, canManageLocations, async (req, res) => {
    try {
        const { name, latitude, longitude, radius_meters, is_active, location_type } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'Nama, latitude, dan longitude harus diisi' });
        }

        const validLocationType = ['all', 'check_in', 'check_out'].includes(location_type) ? location_type : 'all';

        const result = await pool.query(
            `INSERT INTO attendance_locations (name, latitude, longitude, radius_meters, is_active, location_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [name, latitude, longitude, radius_meters || 100, is_active !== false, validLocationType]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create location error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update location (Admin only)
router.put('/:id', authenticateToken, canManageLocations, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, latitude, longitude, radius_meters, is_active, location_type } = req.body;

        const validLocationType = location_type && ['all', 'check_in', 'check_out'].includes(location_type)
            ? location_type
            : undefined;

        const result = await pool.query(
            `UPDATE attendance_locations 
       SET name = COALESCE($1, name),
           latitude = COALESCE($2, latitude),
           longitude = COALESCE($3, longitude),
           radius_meters = COALESCE($4, radius_meters),
           is_active = COALESCE($5, is_active),
           location_type = COALESCE($6, location_type)
       WHERE id = $7
       RETURNING *`,
            [name, latitude, longitude, radius_meters, is_active, validLocationType, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lokasi tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete location (Admin only)
router.delete('/:id', authenticateToken, canManageLocations, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM attendance_locations WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lokasi tidak ditemukan' });
        }

        res.json({ message: 'Lokasi berhasil dihapus' });
    } catch (error) {
        console.error('Delete location error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
