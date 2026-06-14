const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'absensi-secret-key-2024';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token tidak valid' });
        }
        req.user = user;
        next();
    });
}

const { pool } = require('../db'); // Need pool for DB query

function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
    }
    next();
}

function isManagerOrAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Akses ditolak. Memerlukan hak akses manajer atau admin.' });
    }
    next();
}

// Middleware to check specific permission
function hasPermission(permissionKey) {
    return async (req, res, next) => {
        try {
            // Admin always has all permissions
            if (req.user.role === 'admin') {
                return next();
            }

            // Query database for role permissions
            const result = await pool.query(
                `SELECT 1 FROM role_permissions rp 
                 JOIN roles r ON rp.role_id = r.id 
                 WHERE r.name = $1 AND rp.permission_key = $2`,
                [req.user.role, permissionKey]
            );

            if (result.rows.length > 0) {
                return next(); // Has permission
            }

            return res.status(403).json({ error: `Akses ditolak. Membutuhkan permission: ${permissionKey}` });
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hak akses' });
        }
    };
}

module.exports = { 
    authenticateToken, 
    verifyToken: authenticateToken, // Alias for backward compatibility
    isAdmin, 
    isManagerOrAdmin, 
    hasPermission,
    JWT_SECRET 
};
