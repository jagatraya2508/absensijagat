const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);
        const [items, unread] = await Promise.all([
            pool.query(
                `SELECT id, category, title, message, link, reference_type, reference_id, is_read, created_at
                 FROM notifications
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [req.user.id, limit]
            ),
            pool.query(
                'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
                [req.user.id]
            ),
        ]);
        res.json({ unread: unread.rows[0].n, items: items.rows });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.post('/read-all', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [req.user.id]
        );
        res.json({ message: 'Semua notifikasi ditandai dibaca' });
    } catch (error) {
        console.error('Read all notifications error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1 AND user_id = $2
             RETURNING id, is_read`,
            [req.params.id, req.user.id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Read notification error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
