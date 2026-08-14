const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

// Apply admin auth for all role management routes
router.use(auth.verifyToken, auth.isAdmin);

// Get all roles with their permissions
router.get('/', async (req, res) => {
    try {
        const rolesResult = await pool.query('SELECT * FROM roles ORDER BY id ASC');
        const roles = rolesResult.rows;

        const permsResult = await pool.query('SELECT * FROM role_permissions');
        const permissions = permsResult.rows;

        // Group permissions by role_id
        const rolesWithPerms = roles.map(role => {
            return {
                ...role,
                permissions: permissions
                    .filter(p => p.role_id === role.id)
                    .map(p => p.permission_key)
            };
        });

        res.json(rolesWithPerms);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

// Get available permissions
router.get('/permissions', (req, res) => {
    // List of all available permission keys
    const availablePermissions = [
        { key: 'admin.locations', label: 'Kelola Lokasi', category: 'Master' },
        { key: 'admin.departments', label: 'Master Departemen', category: 'Master' },
        { key: 'admin.positions', label: 'Master Jabatan', category: 'Master' },
        { key: 'admin.vehicle_types', label: 'Master Kendaraan', category: 'Master' },
        { key: 'admin.employees', label: 'Data Karyawan', category: 'Master' },
        { key: 'admin.face_registration', label: 'Registrasi Wajah', category: 'Master' },
        { key: 'admin.work_schedule', label: 'Jadwal Kerja', category: 'Master' },
        { key: 'admin.customers', label: 'Master Customer', category: 'Master' },
        
        { key: 'admin.off_days', label: 'Atur Libur', category: 'Admin' },
        { key: 'admin.announcements', label: 'Kelola Pengumuman', category: 'Admin' },
        { key: 'admin.driver_activities', label: 'Aktivitas Driver', category: 'Admin' },
        { key: 'admin.driver_tracking', label: 'Tracking Kunjungan', category: 'Admin' },
        { key: 'admin.leaves', label: 'Kelola Izin', category: 'Admin' },
        { key: 'manager.leave_approvals', label: 'Persetujuan Izin (Atasan)', category: 'Managerial' },
        { key: 'admin.manual_attendance', label: 'Persetujuan Absen', category: 'Admin' },
        { key: 'admin.loans', label: 'Pinjaman', category: 'HR & Keuangan' },
        { key: 'admin.payroll', label: 'Payroll', category: 'HR & Keuangan' },
        { key: 'admin.assessments', label: 'Penilaian', category: 'HR & Keuangan' },
        { key: 'admin.recruitment', label: 'Recruitment', category: 'HR & Keuangan' },
        { key: 'admin.assets', label: 'Manajemen Aset', category: 'Operasional' },
        { key: 'admin.reports', label: 'Laporan', category: 'Sistem' },
        { key: 'admin.users', label: 'Kelola User', category: 'Sistem' },
        { key: 'admin.roles', label: 'Kelola Role', category: 'Sistem' },
        { key: 'admin.settings', label: 'Pengaturan', category: 'Sistem' },
        { key: 'admin.license', label: 'License', category: 'Sistem' },
        { key: 'admin.kiosk', label: 'Mode Kiosk', category: 'Sistem' },
        
        { key: 'manager.approvals', label: 'Persetujuan Lembur (Manager)', category: 'Managerial' },
        { key: 'admin.organization', label: 'Struktur Organisasi', category: 'Master' }
    ];

    res.json(availablePermissions);
});

// Create new role
router.post('/', async (req, res) => {
    const { name, label, permissions } = req.body;

    if (!name || !label) {
        return res.status(400).json({ error: 'Nama dan label role harus diisi' });
    }

    // Format name to be lowercase, no spaces (kebab-case or snake_case)
    const formattedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if role name exists
        const existingRole = await client.query('SELECT id FROM roles WHERE name = $1', [formattedName]);
        if (existingRole.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Nama role sudah digunakan' });
        }

        // Insert role
        const roleResult = await client.query(
            'INSERT INTO roles (name, label, is_system) VALUES ($1, $2, $3) RETURNING *',
            [formattedName, label, false]
        );
        const newRoleId = roleResult.rows[0].id;

        // Insert permissions
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            for (const perm of permissions) {
                await client.query(
                    'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                    [newRoleId, perm]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Role berhasil dibuat', role: roleResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

// Update role
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { label, permissions } = req.body;

    if (!label) {
        return res.status(400).json({ error: 'Label role harus diisi' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if role exists and get its status
        const roleResult = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Role tidak ditemukan' });
        }

        const role = roleResult.rows[0];

        // Update label
        await client.query('UPDATE roles SET label = $1 WHERE id = $2', [label, id]);

        // Don't update permissions for 'admin' (they always have all permissions implicitly)
        if (role.name !== 'admin') {
            // Delete old permissions
            await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

            // Insert new permissions
            if (permissions && Array.isArray(permissions) && permissions.length > 0) {
                for (const perm of permissions) {
                    await client.query(
                        'INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)',
                        [id, perm]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Role berhasil diperbarui' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

// Delete role
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if role exists
        const roleResult = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Role tidak ditemukan' });
        }

        const role = roleResult.rows[0];

        // Cannot delete system roles
        if (role.is_system) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Role sistem tidak dapat dihapus' });
        }

        // Check if any users are using this role
        const usersResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', [role.name]);
        if (usersResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Role masih digunakan oleh user, tidak dapat dihapus' });
        }

        // Delete role (cascades to role_permissions)
        await client.query('DELETE FROM roles WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ message: 'Role berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting role:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
});

module.exports = router;
