const crypto = require('crypto');
const { pool } = require('../db');
const { getMachineId, normalizeMachineId, formatMachineId, machineIdsMatch } = require('./machineId');

const LICENSE_SECRET = 'ABSENSI_LICENSE_SECRET_KEY_2026_XYZ_SECURE!';

let schemaReady = false;

async function ensureLicenseSchema() {
    if (schemaReady) return;
    await pool.query('ALTER TABLE license_info ADD COLUMN IF NOT EXISTS machine_id VARCHAR(32)');
    schemaReady = true;
}

function verifyLicenseKey(licenseKey) {
    try {
        const parts = String(licenseKey || '').trim().split('.');
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
        if (payload.machine_id) {
            payload.machine_id = normalizeMachineId(payload.machine_id);
        }
        return payload;
    } catch (error) {
        throw new Error(`Validasi license gagal: ${error.message}`);
    }
}

async function getActiveLicenseInfo() {
    await ensureLicenseSchema();
    const currentMachineId = getMachineId();

    const result = await pool.query(
        'SELECT * FROM license_info ORDER BY activated_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
        return {
            active: false,
            machine_id: formatMachineId(currentMachineId),
            error: 'Tidak ada license yang terpasang'
        };
    }

    const license = result.rows[0];
    let boundId = normalizeMachineId(license.machine_id);

    if (!boundId) {
        await pool.query(
            'UPDATE license_info SET machine_id = $1 WHERE id = $2',
            [currentMachineId, license.id]
        );
        boundId = currentMachineId;
        license.machine_id = currentMachineId;
    }

    const expiresAt = new Date(license.expires_at);
    const expired = expiresAt < new Date();
    const boundOk = machineIdsMatch(boundId, currentMachineId);

    if (!boundOk) {
        return {
            active: false,
            expired,
            wrong_machine: true,
            company: license.company_name,
            max_users: license.max_users,
            expires_at: license.expires_at,
            machine_id: formatMachineId(currentMachineId),
            bound_machine_id: formatMachineId(boundId),
            error: 'License terikat ke mesin lain dan tidak bisa dipakai di server ini'
        };
    }

    if (expired) {
        return {
            active: false,
            expired: true,
            company: license.company_name,
            max_users: license.max_users,
            expires_at: license.expires_at,
            machine_id: formatMachineId(currentMachineId),
            bound_machine_id: formatMachineId(boundId),
            error: 'License sudah kadaluarsa'
        };
    }

    return {
        active: true,
        expired: false,
        wrong_machine: false,
        id: license.id,
        company: license.company_name,
        max_users: license.max_users,
        expires_at: license.expires_at,
        activated_at: license.activated_at,
        machine_id: formatMachineId(currentMachineId),
        bound_machine_id: formatMachineId(boundId)
    };
}

module.exports = {
    LICENSE_SECRET,
    ensureLicenseSchema,
    verifyLicenseKey,
    getActiveLicenseInfo,
    getMachineId,
    normalizeMachineId,
    formatMachineId,
    machineIdsMatch
};
