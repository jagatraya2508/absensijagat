const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
    ensureLicenseSchema,
    verifyLicenseKey,
    getActiveLicenseInfo,
    getMachineId,
    normalizeMachineId,
    formatMachineId,
    machineIdsMatch
} = require('../utils/licenseCheck');

router.post('/activate', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureLicenseSchema();
        const { license_key } = req.body;
        if (!license_key) {
            return res.status(400).json({ error: 'License key harus diisi' });
        }

        let payload;
        try {
            payload = verifyLicenseKey(license_key);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }

        if (new Date(payload.expires_at) < new Date()) {
            return res.status(400).json({ error: 'License key sudah kadaluarsa' });
        }

        const boundId = normalizeMachineId(payload.machine_id);
        if (!boundId || boundId.length !== 16) {
            return res.status(400).json({
                error: 'License ini tidak terikat ke mesin. Minta license baru dengan ID Mesin dari halaman License.'
            });
        }

        const currentMachineId = getMachineId();
        if (!machineIdsMatch(boundId, currentMachineId)) {
            return res.status(400).json({
                error: `License ini hanya berlaku untuk mesin ${formatMachineId(boundId)}. ID mesin server ini: ${formatMachineId(currentMachineId)}`
            });
        }

        const existingKey = await pool.query(
            'SELECT id, machine_id FROM license_info WHERE license_key = $1 ORDER BY activated_at DESC LIMIT 1',
            [license_key]
        );
        if (existingKey.rows.length > 0) {
            const existingBound = normalizeMachineId(existingKey.rows[0].machine_id);
            if (existingBound && !machineIdsMatch(existingBound, currentMachineId)) {
                return res.status(400).json({
                    error: 'License key ini sudah diaktifkan di mesin lain'
                });
            }
            await pool.query(
                `UPDATE license_info
                 SET company_name = $1, max_users = $2, expires_at = $3, machine_id = $4, activated_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [payload.company, payload.max_users, payload.expires_at, currentMachineId, existingKey.rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO license_info (license_key, company_name, max_users, expires_at, machine_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [license_key, payload.company, payload.max_users, payload.expires_at, currentMachineId]
            );
        }

        res.json({
            message: 'License berhasil diaktifkan untuk mesin ini',
            info: {
                company: payload.company,
                max_users: payload.max_users,
                expires_at: payload.expires_at,
                machine_id: formatMachineId(currentMachineId)
            }
        });
    } catch (error) {
        console.error('License activation error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat aktivasi license' });
    }
});

router.get('/info', authenticateToken, isAdmin, async (req, res) => {
    try {
        const info = await getActiveLicenseInfo();
        const userCountQuery = await pool.query('SELECT COUNT(*) FROM users');
        const currentUsers = parseInt(userCountQuery.rows[0].count);

        res.json({
            ...info,
            current_users: currentUsers
        });
    } catch (error) {
        console.error('Get license info error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/status', async (req, res) => {
    try {
        const info = await getActiveLicenseInfo();
        res.json({
            active: info.active,
            expired: info.expired || false,
            wrong_machine: info.wrong_machine || false,
            company: info.company || null
        });
    } catch (error) {
        console.error('Get license status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.checkUserLimit = async () => {
    const info = await getActiveLicenseInfo();
    const maxUsers = info.active ? info.max_users : 5;

    const userCountQuery = await pool.query('SELECT COUNT(*) FROM users');
    const currentUsers = parseInt(userCountQuery.rows[0].count);

    if (currentUsers >= maxUsers) {
        return {
            allowed: false,
            current: currentUsers,
            max: maxUsers,
            error: info.active
                ? `Batas pengguna pada license tercapai (${maxUsers} pengguna).`
                : 'Tidak ada license aktif. Mode trial dibatasi 5 pengguna.'
        };
    }

    return { allowed: true, current: currentUsers, max: maxUsers };
};

module.exports = router;
