const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// This must exactly match the secret in generate-license.js
const LICENSE_SECRET = 'ABSENSI_LICENSE_SECRET_KEY_2026_XYZ_SECURE!';

// Helper to verify and parse license key
function verifyLicenseKey(licenseKey) {
    try {
        const parts = licenseKey.split('.');
        if (parts.length !== 2) throw new Error('Format license tidak valid');
        
        const [payloadBase64, signature] = parts;
        
        const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
        hmac.update(payloadBase64);
        const expectedSignature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        if (signature !== expectedSignature) {
            throw new Error('Signature license tidak valid. License mungkin dipalsukan.');
        }
        
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        
        return payload;
    } catch (error) {
        throw new Error(`Validasi license gagal: ${error.message}`);
    }
}

// Helper to get active license from DB
async function getActiveLicenseInfo() {
    // Only fetch the most recently activated license
    const result = await pool.query(
        'SELECT * FROM license_info ORDER BY activated_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
        return { active: false, error: 'Tidak ada license yang terpasang' };
    }
    
    const license = result.rows[0];
    const expiresAt = new Date(license.expires_at);
    
    if (expiresAt < new Date()) {
        return { 
            active: false, 
            expired: true,
            company: license.company_name,
            max_users: license.max_users,
            expires_at: license.expires_at,
            error: 'License sudah kadaluarsa' 
        };
    }
    
    return {
        active: true,
        expired: false,
        id: license.id,
        company: license.company_name,
        max_users: license.max_users,
        expires_at: license.expires_at,
        activated_at: license.activated_at
    };
}

// 1. Activate License (Admin only)
router.post('/activate', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { license_key } = req.body;
        if (!license_key) {
            return res.status(400).json({ error: 'License key harus diisi' });
        }
        
        // Validate signature and parse payload
        let payload;
        try {
            payload = verifyLicenseKey(license_key);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }
        
        // Validate expiry
        if (new Date(payload.expires_at) < new Date()) {
            return res.status(400).json({ error: 'License key sudah kadaluarsa' });
        }
        
        // Save to database
        const result = await pool.query(
            `INSERT INTO license_info (license_key, company_name, max_users, expires_at) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [license_key, payload.company, payload.max_users, payload.expires_at]
        );
        
        res.json({
            message: 'License berhasil diaktifkan',
            info: {
                company: payload.company,
                max_users: payload.max_users,
                expires_at: payload.expires_at
            }
        });
    } catch (error) {
        console.error('License activation error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat aktivasi license' });
    }
});

// 2. Get License Info (Admin only)
router.get('/info', authenticateToken, isAdmin, async (req, res) => {
    try {
        const info = await getActiveLicenseInfo();
        
        // Get current user count
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

// 3. Get Public Status (For login page or app initialization)
router.get('/status', async (req, res) => {
    try {
        const info = await getActiveLicenseInfo();
        res.json({
            active: info.active,
            expired: info.expired || false,
            company: info.company || null
        });
    } catch (error) {
        console.error('Get license status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Helper that other routes can use to check user limits
router.checkUserLimit = async () => {
    const info = await getActiveLicenseInfo();
    
    // If no license is installed, we might enforce a strict default (e.g. max 5 users)
    // or just let it be. Let's enforce a default of 5 users.
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
                : 'Tidak ada licenseaktif. Mode trial dibatasi 5 pengguna.'
        };
    }
    
    return { allowed: true, current: currentUsers, max: maxUsers };
};

module.exports = router;
