require('dotenv').config();
const { Pool } = require('pg');

const SETTINGS_KEY = 'gudang_employee_ids_20261104';

const MAPPING = [
    ['APUD', 'SKB1-02601'],
    ['DONI CAHYADI', 'SKB1-02602'],
    ['HASRUL', 'SKB1-02603'],
    ['MUHAMAD FIRLI', 'SKB1-02604'],
    ['MUHAMAD RIZAL', 'SKB1-02605'],
    ['MUHAMMAD HIDAYAT', 'SKB1-02606'],
    ['NURSIMAN', 'SKB1-02607'],
    ['RAHMAD FADILAH', 'SKB1-02608'],
    ['BAMBANG PAISAL', 'SKB1-02609'],
    ['TUBAGUS', 'ANK1-02601'],
    ['FENDI', 'SKB1-02610'],
    ['EDI SETIAWAN', 'SKB1-02611'],
    ['ADE ASIAN FAUZI', 'SKB2-02601'],
    ['ANTON', 'SKB2-02602'],
    ['ENDANG SAHRONI', 'SKB2-02603'],
    ['ERIK', 'SKB2-02604'],
    ['FIRMANTO', 'SKB2-02605'],
    ['IDUP SANJAYA', 'SKB2-02606'],
    ['JUNAEDI', 'SKB2-02607'],
    ['MAMAN', 'SKB2-02609'],
    ['RONI', 'SKB2-02610'],
    ['JUHENI', 'SKB2-02611'],
    ['NURHAM', 'SKB2-02612'],
    ['AHMAD JAENUDIN', 'SKB3-02601'],
    ['RUDI', 'SKB3-02602'],
    ['SUCHANDRA', 'SKB3-02603'],
    ['MUHAJERIN', 'ANK3-02601'],
    ['APRI SETIAWAN', 'SKB4-02601'],
    ['IKA', 'SKB4-02602'],
    ['NOVAL EGIANSYAH', 'SKB4-02603'],
    ['ODAH', 'SKB4-02604'],
    ['OGI', 'SKB4-02605'],
    ['AHMAD FAUZI', 'SKB4-02606'],
    ['ALWIYAH', 'SKB4-02607'],
    ['ANTON', 'SKB4-02608'],
    ['KOMARUDIN', 'SKB4-02609'],
    ['WARDI', 'SKB4-02610'],
    ['NENGSIH DARSIAH', 'SKB4-02611'],
    ['NUR SAPITRO', 'SKB4-02612'],
    ['M. AGGA RAMADHAN', 'ANK4-02601'],
    ['WAWAN SETIAWAN', 'SKB5-02601'],
    ['JEKI', 'SKB6-02601'],
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

function sameTokens(a, b) {
    return a.length === b.length && a.every((token, index) => token === b[index]);
}

function startsWithTokens(longer, prefix) {
    return prefix.length <= longer.length && prefix.every((token, index) => token === longer[index]);
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
    if (sameTokens(sheetTokens, userTokens)) return 0;
    const sheetText = sheetTokens.join(' ');
    const prefixOk = sheetTokens.length >= 2 || sheetText.length >= 6;
    if (prefixOk && startsWithTokens(userTokens, sheetTokens)) return 1;
    const left = sheetTokens.join('');
    const right = userTokens.join('');
    if (left.length >= 10 && right.length >= 10) {
        const distance = levenshtein(left, right);
        if (distance === 1) return 2;
        if (distance === 2 && left.length >= 12 && right.length >= 12) return 3;
    }
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
    if (process.env.ALLOW_GUDANG_ID_REMAP !== '1') {
        console.error('remap hanya dijalankan di server gudang');
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
            SELECT id, employee_id, name, role
            FROM users
            ORDER BY id
        `);
        const allUsers = usersResult.rows.map((row) => ({
            ...row,
            tokens: tokensOf(row.name),
        }));
        const users = allUsers.filter((row) => !['admin', 'super_admin', 'superadmin', 'kiosk'].includes(row.role));

        const nameCounts = new Map();
        for (const [name] of MAPPING) {
            const key = compact(name);
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        }

        const updated = [];
        const unchanged = [];
        const ambiguous = [];
        const notFound = [];
        const chosen = [];

        for (const [sheetName, newId] of MAPPING) {
            if (nameCounts.get(compact(sheetName)) > 1) {
                ambiguous.push({ name: sheetName, new_id: newId, reason: 'nama di tabel lebih dari satu' });
                continue;
            }
            const sheetTokens = tokensOf(sheetName);
            const ranked = users
                .map((user) => ({ user, score: scoreMatch(sheetTokens, user.tokens) }))
                .filter((item) => item.score !== null)
                .sort((a, b) => a.score - b.score || a.user.id - b.user.id);
            if (ranked.length === 0) {
                notFound.push({ name: sheetName, new_id: newId });
                continue;
            }
            const best = ranked[0].score;
            const ties = ranked.filter((item) => item.score === best);
            if (ties.length > 1) {
                ambiguous.push({
                    name: sheetName,
                    new_id: newId,
                    reason: 'lebih dari satu karyawan cocok',
                    matches: ties.map((item) => ({ id: item.user.id, name: item.user.name, employee_id: item.user.employee_id })),
                });
                continue;
            }
            const user = ties[0].user;
            if (chosen.some((item) => item.user.id === user.id)) {
                ambiguous.push({ name: sheetName, new_id: newId, reason: 'karyawan yang sama cocok dengan lebih dari satu baris' });
                continue;
            }
            chosen.push({ user, sheetName, newId, score: best });
        }

        const byEmployeeId = new Map(allUsers.map((user) => [String(user.employee_id).toUpperCase(), user]));
        const blocked = (planned) => {
            const moving = new Set(
                planned
                    .filter((item) => String(item.user.employee_id).toUpperCase() !== item.newId.toUpperCase())
                    .map((item) => item.user.id)
            );
            return planned.filter((item) => {
                const holder = byEmployeeId.get(item.newId.toUpperCase());
                return holder && holder.id !== item.user.id && !moving.has(holder.id);
            });
        };
        let ready = chosen.slice();
        const collisions = [];
        for (let guard = 0; guard < chosen.length + 1; guard += 1) {
            const bad = blocked(ready);
            if (bad.length === 0) break;
            const badIds = new Set(bad.map((item) => item.user.id));
            for (const item of bad) {
                const holder = byEmployeeId.get(item.newId.toUpperCase());
                collisions.push({
                    name: item.sheetName,
                    new_id: item.newId,
                    current_name: item.user.name,
                    current_id: item.user.employee_id,
                    held_by: holder ? holder.name : '',
                });
            }
            ready = ready.filter((item) => !badIds.has(item.user.id));
        }

        await client.query('BEGIN');
        const changing = ready.filter((item) => String(item.user.employee_id).toUpperCase() !== item.newId.toUpperCase());
        if (changing.length > 0) {
            await client.query(
                `UPDATE users SET employee_id = '__idremap_' || id::text WHERE id = ANY($1::int[])`,
                [changing.map((item) => item.user.id)]
            );
            for (const item of changing) {
                await client.query('UPDATE users SET employee_id = $1 WHERE id = $2', [item.newId, item.user.id]);
                updated.push({
                    name: item.user.name,
                    from: item.user.employee_id,
                    to: item.newId,
                });
            }
        }
        for (const item of ready) {
            if (String(item.user.employee_id).toUpperCase() === item.newId.toUpperCase()) {
                unchanged.push({ name: item.user.name, employee_id: item.user.employee_id });
            }
        }
        const report = {
            updated: updated.length,
            unchanged: unchanged.length,
            not_found: notFound.length,
            ambiguous: ambiguous.length,
            collision: collisions.length,
            changes: updated,
            unchanged_rows: unchanged,
            not_found_rows: notFound,
            ambiguous_rows: ambiguous,
            collision_rows: collisions,
        };
        await client.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2)',
            [SETTINGS_KEY, JSON.stringify({ updated: report.updated, unchanged: report.unchanged, not_found: report.not_found, ambiguous: report.ambiguous, collision: report.collision })]
        );
        await client.query('COMMIT');
        console.log(JSON.stringify(report));
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
