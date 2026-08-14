const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureOrgApprovalSchema, wouldCreateCycle } = require('../utils/leaveApproval');

async function canManageOrg(req, res, next) {
    try {
        if (req.user.role === 'admin') return next();
        const result = await pool.query(
            `SELECT 1 FROM role_permissions rp
             JOIN roles r ON rp.role_id = r.id
             WHERE r.name = $1 AND rp.permission_key = ANY($2)`,
            [req.user.role, ['admin.employees', 'admin.organization']]
        );
        if (result.rows.length > 0) return next();
        return res.status(403).json({ error: 'Akses ditolak. Membutuhkan hak kelola struktur organisasi.' });
    } catch (error) {
        console.error('Org permission check error:', error);
        return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hak akses' });
    }
}

router.use(async (req, res, next) => {
    try {
        await ensureOrgApprovalSchema(pool);
        next();
    } catch (error) {
        console.error('Ensure org schema error:', error);
        res.status(500).json({ error: 'Gagal menyiapkan struktur organisasi' });
    }
});

// All users with reporting line (admin)
router.get('/', authenticateToken, canManageOrg, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.email, u.role, u.photo,
                   ed.department, ed.position, ed.supervisor_id,
                   supervisor.name as supervisor_name,
                   supervisor.employee_id as supervisor_employee_id
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            LEFT JOIN users supervisor ON supervisor.id = ed.supervisor_id
            ORDER BY u.name ASC
        `);

        const members = result.rows;
        const byId = new Map(members.map((m) => [m.id, { ...m, children: [] }]));
        const roots = [];
        const unassigned = [];

        for (const member of byId.values()) {
            if (member.supervisor_id && byId.has(member.supervisor_id) && member.supervisor_id !== member.id) {
                byId.get(member.supervisor_id).children.push(member);
            } else {
                roots.push(member);
                if (!member.supervisor_id) unassigned.push(member);
            }
        }

        const sortTree = (nodes) => {
            nodes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
            nodes.forEach((n) => sortTree(n.children));
        };
        sortTree(roots);

        res.json({
            members,
            tree: roots,
            unassigned,
            stats: {
                total: members.length,
                unassigned: unassigned.length,
                with_supervisor: members.filter((m) => !!m.supervisor_id).length
            }
        });
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Lightweight list for supervisor dropdowns
router.get('/members', authenticateToken, canManageOrg, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.role,
                   ed.department, ed.position, ed.supervisor_id
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get org members error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Assign / clear supervisor
router.put('/:userId/supervisor', authenticateToken, canManageOrg, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const supervisorId = req.body.supervisor_id ? parseInt(req.body.supervisor_id, 10) : null;

        if (!userId) {
            return res.status(400).json({ error: 'User tidak valid' });
        }

        const userCheck = await pool.query('SELECT id, name FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        if (supervisorId) {
            const supCheck = await pool.query('SELECT id, name FROM users WHERE id = $1', [supervisorId]);
            if (supCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Atasan tidak ditemukan' });
            }
            if (await wouldCreateCycle(pool, userId, supervisorId)) {
                return res.status(400).json({
                    error: 'Tidak bisa menetapkan atasan ini karena akan membuat siklus (A atasan B, B atasan A)'
                });
            }
        }

        await pool.query(
            `INSERT INTO employee_details (user_id, supervisor_id, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                supervisor_id = EXCLUDED.supervisor_id,
                updated_at = CURRENT_TIMESTAMP`,
            [userId, supervisorId]
        );

        const updated = await pool.query(`
            SELECT u.id, u.employee_id, u.name, u.role,
                   ed.department, ed.position, ed.supervisor_id,
                   supervisor.name as supervisor_name
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            LEFT JOIN users supervisor ON supervisor.id = ed.supervisor_id
            WHERE u.id = $1
        `, [userId]);

        res.json({
            message: supervisorId ? 'Atasan berhasil ditetapkan' : 'Atasan berhasil dihapus',
            data: updated.rows[0]
        });
    } catch (error) {
        console.error('Update supervisor error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
