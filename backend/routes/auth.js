const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { JWT_SECRET, authenticateToken, isAdmin } = require('../middleware/auth');

function logError(error) {
    const logPath = path.join(__dirname, '../error.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] AUTH ERROR: ${error.stack || error}\n`;
    fs.appendFileSync(logPath, logMessage);
}


// Login
router.post('/login', async (req, res) => {
    try {
        const { employee_id, password } = req.body;

        if (!employee_id || !password) {
            return res.status(400).json({ error: 'Employee ID dan password harus diisi' });
        }

        const result = await pool.query(
            `SELECT u.*, COALESCE(ed.is_driver, false) as is_driver, COALESCE(ed.is_collector, false) as is_collector, COALESCE(ed.use_tracking, false) as use_tracking
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.employee_id = $1`,
            [employee_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Employee ID atau password salah' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Employee ID atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, employee_id: user.employee_id, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                employee_id: user.employee_id,
                name: user.name,
                email: user.email,
                role: user.role,
                off_day: user.off_day,
                is_driver: user.is_driver,
                is_collector: user.is_collector,
                use_tracking: user.use_tracking
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update Profile (Self)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { off_day } = req.body;

        const validDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        if (off_day && !validDays.includes(off_day)) {
            return res.status(400).json({ error: 'Hari libur tidak valid' });
        }

        const result = await pool.query(
            'UPDATE users SET off_day = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role, off_day',
            [off_day, userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Register (Admin only)
router.post('/register', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { employee_id, name, email, password, role, off_day } = req.body;

        if (!employee_id || !name || !password) {
            return res.status(400).json({ error: 'Employee ID, nama, dan password harus diisi' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (employee_id, name, email, password, role, off_day) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, employee_id, name, email, role, off_day`,
            [employee_id, name, email || null, hashedPassword, role || 'employee', off_day || 'Minggu']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Employee ID atau email sudah terdaftar' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.employee_id, u.name, u.email, u.role, u.created_at, u.off_day,
                    COALESCE(ed.is_driver, false) as is_driver,
                    COALESCE(ed.is_collector, false) as is_collector,
                    COALESCE(ed.use_tracking, false) as use_tracking
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, employee_id, name, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update user (Admin only)
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { employee_id, name, email, password, role } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (employee_id) {
            updates.push(`employee_id = $${paramCount++}`);
            values.push(employee_id);
        }
        if (name) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email || null);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push(`password = $${paramCount++}`);
            values.push(hashedPassword);
        }
        if (role) {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, employee_id, name, email, role`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Employee ID atau email sudah digunakan' });
        }
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Change password (Self)
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Password lama dan baru harus diisi' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Get current password
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(current_password, result.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Password lama tidak sesuai' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Reset password (Admin only)
router.put('/reset-password/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({ error: 'Password baru harus diisi' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Check user exists
        const userCheck = await pool.query('SELECT id, name FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);

        res.json({ message: `Password ${userCheck.rows[0].name} berhasil direset` });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
