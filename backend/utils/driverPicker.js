const { pool } = require('../db');

const DRIVER_PICKER_MODES = ['flag', 'division', 'department', 'position'];

const DRIVER_PICKER_COLUMN = {
    division: 'division',
    department: 'department',
    position: 'position',
};

function normalizeNameList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const name = String(item || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}

function normalizeDriverPickerValues(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        division: normalizeNameList(source.division),
        department: normalizeNameList(source.department),
        position: normalizeNameList(source.position),
    };
}

async function getDriverPickerConfig() {
    const result = await pool.query(
        `SELECT key, value FROM settings WHERE key IN ('driver_picker_mode', 'driver_picker_values')`
    );
    let mode = 'flag';
    let values = normalizeDriverPickerValues(null);
    for (const row of result.rows) {
        if (row.key === 'driver_picker_mode' && DRIVER_PICKER_MODES.includes(row.value)) {
            mode = row.value;
        }
        if (row.key === 'driver_picker_values') {
            try {
                values = normalizeDriverPickerValues(JSON.parse(row.value));
            } catch {
                values = normalizeDriverPickerValues(null);
            }
        }
    }
    return { mode, values };
}

function driverPickerWhere(config, params) {
    if (!config || config.mode === 'flag') {
        return `u.role = 'employee' AND ed.is_driver = true`;
    }
    const column = DRIVER_PICKER_COLUMN[config.mode];
    const selected = (config.values?.[config.mode] || []).map((name) => name.toLowerCase());
    if (!column || selected.length === 0) {
        return 'FALSE';
    }
    params.push(selected);
    return `COALESCE(u.is_active, true) = true
        AND COALESCE(u.role, '') NOT IN ('admin', 'super_admin', 'superadmin', 'kiosk')
        AND LOWER(TRIM(ed.${column})) = ANY($${params.length}::text[])`;
}

async function findAllowedDriver(userId) {
    const config = await getDriverPickerConfig();
    const params = [userId];
    const where = driverPickerWhere(config, params);
    const result = await pool.query(
        `SELECT ed.vehicle_type_id
         FROM users u
         JOIN employee_details ed ON u.id = ed.user_id
         WHERE u.id = $1 AND ${where}`,
        params
    );
    return { config, row: result.rows[0] || null };
}

module.exports = {
    DRIVER_PICKER_MODES,
    normalizeDriverPickerValues,
    getDriverPickerConfig,
    driverPickerWhere,
    findAllowedDriver,
};
