const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all vehicle types
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vehicle_types ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching vehicle types:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new vehicle type
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO vehicle_types (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating vehicle type:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Jenis kendaraan sudah ada' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update vehicle type
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'UPDATE vehicle_types SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [name, description, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vehicle type not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating vehicle type:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Jenis kendaraan sudah ada' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete vehicle type
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Cek apakah jenis kendaraan ini digunakan oleh karyawan
        const checkResult = await pool.query('SELECT COUNT(*) FROM employee_details WHERE vehicle_type_id = $1', [id]);
        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Jenis kendaraan ini sedang digunakan oleh karyawan dan tidak dapat dihapus' });
        }

        const result = await pool.query('DELETE FROM vehicle_types WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vehicle type not found' });
        }
        res.json({ message: 'Vehicle type deleted successfully' });
    } catch (err) {
        console.error('Error deleting vehicle type:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
