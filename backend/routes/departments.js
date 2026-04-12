const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all departments
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM departments ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new department
router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO departments (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
            [name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating department:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Department name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update department
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const result = await pool.query(
            'UPDATE departments SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [name, description, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating department:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Department name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete department
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.json({ message: 'Department deleted successfully' });
    } catch (err) {
        console.error('Error deleting department:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
