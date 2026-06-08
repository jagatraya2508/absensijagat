const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Register face for a user (Admin only)
router.post('/register/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { face_descriptor } = req.body;

        console.log(`Registering face for user ${userId}, descriptor length: ${face_descriptor?.length}`);

        if (!face_descriptor || !Array.isArray(face_descriptor)) {
            return res.status(400).json({ error: 'Face descriptor tidak valid' });
        }

        if (face_descriptor.length !== 128) {
            return res.status(400).json({ error: 'Face descriptor harus memiliki 128 elemen' });
        }

        // Check if user exists
        const userCheck = await pool.query('SELECT id, name FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Store face descriptor as JSON string
        await pool.query(
            'UPDATE users SET face_descriptor = $1 WHERE id = $2',
            [JSON.stringify(face_descriptor), userId]
        );

        res.json({
            message: `Wajah ${userCheck.rows[0].name} berhasil didaftarkan`,
            user_id: userId
        });
    } catch (error) {
        console.error('Face register error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Self-register face (Employee)
router.post('/register-self', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { face_descriptor } = req.body;

        console.log(`Self-registering face for user ${userId}, descriptor length: ${face_descriptor?.length}`);

        if (!face_descriptor || !Array.isArray(face_descriptor)) {
            return res.status(400).json({ error: 'Face descriptor tidak valid' });
        }

        if (face_descriptor.length !== 128) {
            return res.status(400).json({ error: 'Face descriptor harus memiliki 128 elemen' });
        }

        // Check if user already has face registered
        const userCheck = await pool.query(
            'SELECT face_descriptor FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows[0].face_descriptor) {
            return res.status(400).json({ error: 'Wajah sudah terdaftar. Hubungi admin untuk mengubah.' });
        }

        // Store face descriptor
        await pool.query(
            'UPDATE users SET face_descriptor = $1 WHERE id = $2',
            [JSON.stringify(face_descriptor), userId]
        );

        res.json({ message: 'Wajah berhasil didaftarkan' });
    } catch (error) {
        console.error('Self face register error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Check if current user has face registered
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT face_descriptor FROM users WHERE id = $1',
            [userId]
        );

        res.json({
            has_face: !!result.rows[0]?.face_descriptor,
            user_id: userId
        });
    } catch (error) {
        console.error('Face status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get face descriptor for current user (for verification)
router.get('/my-descriptor', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT face_descriptor FROM users WHERE id = $1',
            [userId]
        );

        if (!result.rows[0]?.face_descriptor) {
            return res.status(404).json({ error: 'Wajah belum terdaftar' });
        }

        res.json({
            face_descriptor: JSON.parse(result.rows[0].face_descriptor)
        });
    } catch (error) {
        console.error('Get descriptor error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all users with face registration status (Admin)
router.get('/users-status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, employee_id, name, 
                   CASE WHEN face_descriptor IS NOT NULL THEN true ELSE false END as has_face
            FROM users 
            WHERE role = 'employee'
            ORDER BY name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Get users face status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all face descriptors for Kiosk matching (Admin)
router.get('/all-descriptors', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, employee_id, name, face_descriptor 
            FROM users 
            WHERE face_descriptor IS NOT NULL
        `);

        // Parse descriptors from string
        const descriptors = result.rows.map(row => ({
            id: row.id,
            employee_id: row.employee_id,
            name: row.name,
            descriptor: JSON.parse(row.face_descriptor)
        }));

        res.json(descriptors);
    } catch (error) {
        console.error('Get all descriptors error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete face registration (Admin only)
router.delete('/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            'UPDATE users SET face_descriptor = NULL WHERE id = $1 RETURNING name',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json({ message: `Registrasi wajah ${result.rows[0].name} berhasil dihapus` });
    } catch (error) {
        console.error('Delete face error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
