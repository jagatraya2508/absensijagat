const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all positions
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM positions ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching positions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new position
router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO positions (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating position:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Position name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update position
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'UPDATE positions SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [name, description, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Position not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating position:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Position name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete position
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM positions WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Position not found' });
        }
        res.json({ message: 'Position deleted successfully' });
    } catch (err) {
        console.error('Error deleting position:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
