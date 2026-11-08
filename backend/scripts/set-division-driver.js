const { Pool } = require('pg');
require('dotenv').config();

const TARGET = 'DRIVER';
const SETTING_KEY = 'division_name_driver_exact';

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'absensi',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sa',
    });

function isDriverName(name) {
    const value = String(name || '').trim().toLowerCase();
    return value === 'driver' || value === 'divisi driver';
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const applied = await client.query(
            'SELECT 1 FROM settings WHERE key = $1 LIMIT 1',
            [SETTING_KEY]
        );
        if (applied.rowCount > 0) {
            await client.query('COMMIT');
            console.log(JSON.stringify({ skipped: true }));
            return;
        }

        const masters = await client.query(
            'SELECT id, name FROM divisions ORDER BY id'
        );
        const variants = masters.rows.filter((row) => isDriverName(row.name));
        let driverId = masters.rows.find((row) => row.name === TARGET)?.id || null;

        if (!driverId && variants.length > 0) {
            driverId = variants[0].id;
            await client.query(
                'UPDATE divisions SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [TARGET, driverId]
            );
        } else if (!driverId) {
            const inserted = await client.query(
                'INSERT INTO divisions (name) VALUES ($1) RETURNING id',
                [TARGET]
            );
            driverId = inserted.rows[0].id;
        }

        const ratesExist = await client.query(
            "SELECT to_regclass('public.driver_salary_rates') AS name"
        );
        for (const row of variants) {
            if (row.id === driverId) continue;
            if (ratesExist.rows[0].name) {
                await client.query(
                    `DELETE FROM driver_salary_rates extra
                     USING driver_salary_rates keep
                     WHERE extra.division_id = $1
                       AND keep.division_id = $2
                       AND keep.crew_role = extra.crew_role
                       AND keep.department_id = extra.department_id
                       AND keep.position_id = extra.position_id
                       AND keep.vehicle_type_id = extra.vehicle_type_id
                       AND keep.salary_type = extra.salary_type`,
                    [row.id, driverId]
                );
                await client.query(
                    'UPDATE driver_salary_rates SET division_id = $1, updated_at = CURRENT_TIMESTAMP WHERE division_id = $2',
                    [driverId, row.id]
                );
            }
            await client.query('DELETE FROM divisions WHERE id = $1', [row.id]);
        }

        const updated = await client.query(
            `UPDATE employee_details
             SET division = $1, updated_at = CURRENT_TIMESTAMP
             WHERE lower(btrim(division)) IN ('driver', 'divisi driver')
               AND division IS DISTINCT FROM $1`,
            [TARGET]
        );

        const picker = await client.query(
            "SELECT value FROM settings WHERE key = 'driver_picker_values'"
        );
        if (picker.rows[0]) {
            let values = null;
            try {
                values = JSON.parse(picker.rows[0].value);
            } catch {
                values = null;
            }
            if (values && Array.isArray(values.division)) {
                const next = [];
                const seen = new Set();
                for (const item of values.division) {
                    const name = isDriverName(item) ? TARGET : String(item || '').trim();
                    const key = name.toLowerCase();
                    if (!name || seen.has(key)) continue;
                    seen.add(key);
                    next.push(name);
                }
                values.division = next;
                await client.query(
                    'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
                    [JSON.stringify(values), 'driver_picker_values']
                );
            }
        }

        await client.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2)',
            [SETTING_KEY, 'done']
        );
        await client.query('COMMIT');

        const counts = await client.query(
            `SELECT division, COUNT(*)::int AS n
             FROM employee_details
             WHERE division = $1
             GROUP BY division`,
            [TARGET]
        );
        console.log(JSON.stringify({
            updated: updated.rowCount,
            masterId: driverId,
            counts: counts.rows,
        }));
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

main()
    .catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
