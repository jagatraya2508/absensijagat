require('dotenv').config();
const { Pool } = require('pg');

const SETTINGS_KEY = 'gudang_department_by_name_v1';

const MAPPING = [
    ['APUD', 'DRIVER CD'],
    ['DONI CAHYADI', 'DRIVER CD'],
    ['HASRUL', 'DRIVER CD'],
    ['MUHAMAD FIRLI', 'DRIVER CD'],
    ['MUHAMAD RIZAL', 'DRIVER CD'],
    ['MUHAMMAD HIDAYAT', 'DRIVER CD'],
    ['NURSIMAN', 'DRIVER CD'],
    ['RAHMAD FADILAH', 'DRIVER CD'],
    ['BAMBANG PAISAL', 'DRIVER CD'],
    ['TUBAGUS', 'DRIVER FUSO'],
    ['FENDI', 'DRIVER FUSO'],
    ['EDI SETIAWAN', 'DRIVER G-MAX'],
    ['ADE ASIAN FAUZI', 'KENEK CD'],
    ['ENDANG SAHRONI', 'KENEK CD'],
    ['ERIK', 'KENEK CD'],
    ['FIRMANTO', 'KENEK CD'],
    ['IDUP SANJAYA', 'KENEK CD'],
    ['JUNAEDI', 'KENEK CD'],
    ['MAMAN', 'KENEK CD'],
    ['RONI', 'KENEK CD'],
    ['JUHENI', 'KENEK FUSO'],
    ['NURHAM', 'KENEK TRONTON'],
    ['AHMAD JAENUDIN', 'LOGISTIK'],
    ['RUDI', 'LOGISTIK'],
    ['SUCHANDRA', 'LOGISTIK'],
    ['MUHAJERIN', 'LOGISTIK'],
    ['APRI SETIAWAN', 'PROD FF & TEMPEL'],
    ['IKA', 'PROD FF & TEMPEL'],
    ['NOVAL EGIANSYAH', 'PROD FF & TEMPEL'],
    ['ODAH', 'PROD FF & TEMPEL'],
    ['OGI', 'PROD FF & TEMPEL'],
    ['AHMAD FAUZI', 'PROD RESIN & POTONG'],
    ['ALWIYAH', 'PROD RESIN & POTONG'],
    ['KOMARUDIN', 'PROD RESIN & POTONG'],
    ['WARDI', 'PROD RESIN & POTONG'],
    ['NENGSIH DARSIAH', 'PROD SORTIR'],
    ['NUR SAPITRO', 'PROD SORTIR'],
    ['M. AGGA RAMADHAN', 'PROD SORTIR'],
    ['WAWAN SETIAWAN', 'CHECKER'],
    ['JEKI', 'CLEANING SERVICE'],
    ['CHOCKY ANDREAN', 'ADMIN'],
    ['GLEDY PRATAMA', 'MEKANIK'],
    ['M. MAULANA SIDIK', 'ADMIN'],
    ['PANJI TERTA WIJAYA', 'MEKANIK'],
    ['AGUS', 'MEKANIK'],
];

const DEPARTMENTS = [
    'DRIVER CD', 'DRIVER FUSO', 'DRIVER G-MAX', 'KENEK CD', 'KENEK FUSO', 'KENEK TRONTON',
    'LOGISTIK', 'PROD FF & TEMPEL', 'PROD RESIN & POTONG', 'PROD SORTIR', 'CHECKER',
    'CLEANING SERVICE', 'ADMIN', 'MEKANIK',
];

function tokensOf(name) {
    return String(name || '')
        .toUpperCase()
        .replace(/MUHAMMAD/g, 'MUHAMAD')
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
}

function compact(name) {
    return tokensOf(name).join('');
}

function levenshtein(a, b) {
    const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
        }
    }
    return rows[a.length][b.length];
}

function scoreMatch(sheetTokens, userTokens) {
    if (sheetTokens.length === userTokens.length && sheetTokens.every((token, index) => token === userTokens[index])) return 0;
    const sheetText = sheetTokens.join(' ');
    const prefixOk = (sheetTokens.length >= 2 || sheetText.length >= 6)
        && sheetTokens.length <= userTokens.length
        && sheetTokens.every((token, index) => token === userTokens[index]);
    if (prefixOk) return 1;
    const needed = sheetTokens.filter((token) => token.length >= 4);
    if (needed.length > 0 && needed.every((token) => userTokens.includes(token)) && (needed.length >= 2 || userTokens.filter((token) => token.length >= 4).length === 1)) {
        return 2;
    }
    const left = sheetTokens.join('');
    const right = userTokens.join('');
    if (left.length >= 8 && right.length >= 8 && levenshtein(left, right) === 1) return 3;
    return null;
}

function antonDepartment(user) {
    const id = String(user.employee_id || '').toUpperCase();
    const hint = `${user.position || ''} ${user.division || ''} ${user.department || ''}`.toUpperCase();
    if (id === 'SKB2-02602' || hint.includes('KENEK')) return 'KENEK CD';
    if (id === 'SKB4-02608' || hint.includes('RESIN') || hint.includes('POTONG') || hint.includes('PRODUKSI')) return 'PROD RESIN & POTONG';
    if (tokensOf(user.name).includes('I') && tokensOf(user.name).includes('ANTON')) return 'KENEK CD';
    return null;
}

function poolFromEnv() {
    if (process.env.DATABASE_URL) return new Pool({ connectionString: process.env.DATABASE_URL });
    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'absensi',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sa',
    });
}

async function main() {
    if (process.env.ALLOW_GUDANG_DEPT_REMAP !== '1') {
        console.error('perubahan departemen hanya dijalankan di server gudang');
        process.exitCode = 1;
        return;
    }

    const pool = poolFromEnv();
    const client = await pool.connect();
    try {
        const applied = await client.query('SELECT 1 FROM settings WHERE key = $1 LIMIT 1', [SETTINGS_KEY]);
        if (applied.rowCount > 0) {
            console.log(JSON.stringify({ skipped: 'sudah pernah dijalankan' }));
            return;
        }

        const usersResult = await client.query(`
            SELECT u.id, u.employee_id, u.name, u.role,
                   ed.department, ed.division, ed.position
            FROM users u
            LEFT JOIN employee_details ed ON ed.user_id = u.id
            WHERE u.role NOT IN ('admin', 'super_admin', 'superadmin', 'kiosk')
            ORDER BY u.id
        `);
        const users = usersResult.rows.map((row) => ({ ...row, tokens: tokensOf(row.name) }));
        const updated = [];
        const unchanged = [];
        const ambiguous = [];
        const notFound = [];
        const chosen = [];

        for (const [sheetName, department] of MAPPING) {
            const sheetTokens = tokensOf(sheetName);
            const ranked = users
                .map((user) => ({ user, score: scoreMatch(sheetTokens, user.tokens) }))
                .filter((item) => item.score !== null)
                .sort((a, b) => a.score - b.score || a.user.id - b.user.id);
            if (ranked.length === 0) {
                notFound.push({ name: sheetName, department });
                continue;
            }
            const best = ranked[0].score;
            const ties = ranked.filter((item) => item.score === best);
            if (ties.length > 1) {
                ambiguous.push({
                    name: sheetName,
                    department,
                    matches: ties.map((item) => ({ id: item.user.id, name: item.user.name, employee_id: item.user.employee_id })),
                });
                continue;
            }
            const user = ties[0].user;
            if (chosen.some((item) => item.user.id === user.id)) {
                ambiguous.push({ name: sheetName, department, reason: 'karyawan yang sama cocok dengan lebih dari satu baris' });
                continue;
            }
            chosen.push({ user, sheetName, department });
        }

        const antonUsers = users.filter((user) => user.tokens.includes('ANTON') && !chosen.some((item) => item.user.id === user.id));
        for (const user of antonUsers) {
            const department = antonDepartment(user);
            if (!department) {
                ambiguous.push({ name: user.name, employee_id: user.employee_id, reason: 'Anton tidak bisa dibedakan' });
                continue;
            }
            chosen.push({ user, sheetName: user.name, department });
        }

        await client.query('BEGIN');
        for (const name of DEPARTMENTS) {
            await client.query(
                'INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                [name]
            );
        }
        for (const item of chosen) {
            const current = item.user.department || '';
            if (current === item.department) {
                unchanged.push({ name: item.user.name, employee_id: item.user.employee_id, department: current });
                continue;
            }
            const existing = await client.query('SELECT 1 FROM employee_details WHERE user_id = $1', [item.user.id]);
            if (existing.rowCount === 0) {
                await client.query(
                    'INSERT INTO employee_details (user_id, department, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
                    [item.user.id, item.department]
                );
            } else {
                await client.query(
                    'UPDATE employee_details SET department = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
                    [item.department, item.user.id]
                );
            }
            updated.push({
                name: item.user.name,
                employee_id: item.user.employee_id,
                from: current || null,
                to: item.department,
            });
        }
        await client.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2)',
            [SETTINGS_KEY, JSON.stringify({ updated: updated.length, unchanged: unchanged.length, not_found: notFound.length, ambiguous: ambiguous.length })]
        );
        await client.query('COMMIT');
        console.log(JSON.stringify({
            updated: updated.length,
            unchanged: unchanged.length,
            not_found: notFound.length,
            ambiguous: ambiguous.length,
            changes: updated,
            not_found_rows: notFound,
            ambiguous_rows: ambiguous,
        }));
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { /* transaksi belum mulai */ }
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
});
