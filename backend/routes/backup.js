const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const BACKUP_MARKER_V1 = '-- ABSENSI_NODE_BACKUP v1';
const BACKUP_MARKER_V2 = 'ABSENSI_NODE_BACKUP v2';
const BACKUP_DIR = path.join(__dirname, '../uploads/backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, BACKUP_DIR),
        filename: (_req, file, cb) => {
            const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, `restore-${Date.now()}-${safe}`);
        },
    }),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.sql', '.dump', '.backup', '.json'].includes(ext)) {
            return cb(null, true);
        }
        cb(new Error('Hanya file .sql, .dump, .backup, atau .json yang diizinkan'));
    },
});

function formatTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

function sqlLiteral(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') {
        return Number.isFinite(val) ? String(val) : 'NULL';
    }
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (Buffer.isBuffer(val)) return `'\\x${val.toString('hex')}'`;
    if (Array.isArray(val)) {
        return `ARRAY[${val.map(sqlLiteral).join(', ')}]`;
    }
    if (typeof val === 'object') {
        const json = JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
        return `'${json}'::jsonb`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
}

function deserializeCell(val) {
    if (val && typeof val === 'object' && !Array.isArray(val) && val.__t === 'date') {
        return val.v;
    }
    if (val && typeof val === 'object' && !Array.isArray(val) && val.__t === 'buf') {
        return Buffer.from(val.v, 'base64');
    }
    return val;
}

async function getPublicTables(client) {
    const res = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    `);
    return res.rows.map((r) => r.tablename);
}

async function getTableColumns(client, table) {
    const res = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
    `, [table]);
    return res.rows.map((r) => r.column_name);
}

async function ensureSchema() {
    try {
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
    } catch (error) {
        console.warn('ensureSchema warning:', error.message);
    }
}

async function trySetReplicaRole(client) {
    try {
        await client.query('SET session_replication_role = replica');
        return true;
    } catch (error) {
        console.warn('session_replication_role not available:', error.message);
        return false;
    }
}

async function dropCheckConstraints(client) {
    await client.query(`
        DO $$
        DECLARE r RECORD;
        BEGIN
            FOR r IN
                SELECT conname, conrelid::regclass AS tbl
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = 'public'::regnamespace
            LOOP
                EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
            END LOOP;
        END $$;
    `);
}

async function truncatePublicTables(client) {
    const tables = await getPublicTables(client);
    if (tables.length === 0) return tables;
    await client.query(
        `TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE`
    );
    return tables;
}

async function tableExists(client, table) {
    const res = await client.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        [table]
    );
    return res.rows.length > 0;
}

async function ensureTableAndColumns(client, table, columns) {
    const exists = await tableExists(client, table);
    if (!exists) {
        if (!columns.length) return false;
        const colDefs = columns.map((c) => `${quoteIdent(c)} TEXT`).join(', ');
        await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${colDefs})`);
    }

    const existing = new Set(await getTableColumns(client, table));
    for (const col of columns) {
        if (!existing.has(col)) {
            await client.query(
                `ALTER TABLE ${quoteIdent(table)} ADD COLUMN IF NOT EXISTS ${quoteIdent(col)} TEXT`
            );
            existing.add(col);
        }
    }

    // Kolom lokal NOT NULL yang tidak ada di backup bisa menggagalkan INSERT
    const notNullRes = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND is_nullable = 'NO'
          AND column_default IS NULL
          AND is_identity = 'NO'
    `, [table]);
    const backupCols = new Set(columns);
    for (const { column_name } of notNullRes.rows) {
        if (!backupCols.has(column_name)) {
            await client.query(
                `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(column_name)} DROP NOT NULL`
            );
        }
    }

    return true;
}

async function createNodeBackupFile(outPath) {
    const client = await pool.connect();
    const chunks = [];
    const counts = [];

    try {
        const tables = await getPublicTables(client);

        chunks.push(BACKUP_MARKER_V1);
        chunks.push(`-- Created: ${new Date().toISOString()}`);
        chunks.push('-- Format: data-only (schema diasumsikan sudah ada di aplikasi)');
        chunks.push('BEGIN;');
        chunks.push('SET session_replication_role = replica;');
        chunks.push('');

        if (tables.length > 0) {
            chunks.push(`TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE;`);
            chunks.push('');
        }

        for (const table of tables) {
            const columns = await getTableColumns(client, table);
            if (columns.length === 0) continue;

            const colList = columns.map(quoteIdent).join(', ');
            const dataRes = await client.query(`SELECT * FROM ${quoteIdent(table)}`);
            counts.push(`${table}=${dataRes.rows.length}`);

            chunks.push(`-- Table: ${table} (${dataRes.rows.length} rows)`);
            for (const row of dataRes.rows) {
                const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
                chunks.push(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${values});`);
            }
            chunks.push('');
        }

        if (counts.length > 0) {
            chunks.splice(3, 0, `-- Counts: ${counts.join('; ')}`);
        }

        const seqRes = await client.query(`
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
            ORDER BY sequencename
        `);

        for (const { sequencename } of seqRes.rows) {
            const seqVal = await client.query(
                `SELECT last_value, is_called FROM ${quoteIdent(sequencename)}`
            );
            if (seqVal.rows[0]) {
                const { last_value, is_called } = seqVal.rows[0];
                chunks.push(
                    `SELECT setval('public.${sequencename.replace(/'/g, "''")}', ${last_value}, ${is_called});`
                );
            }
        }

        chunks.push('');
        chunks.push('SET session_replication_role = DEFAULT;');
        chunks.push('COMMIT;');

        fs.writeFileSync(outPath, chunks.join('\n'), 'utf8');
        return { tables: tables.length, counts };
    } finally {
        client.release();
    }
}

function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let inSingle = false;

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];

        if (inSingle) {
            current += ch;
            if (ch === "'" && next === "'") {
                current += next;
                i++;
            } else if (ch === "'") {
                inSingle = false;
            }
            continue;
        }

        if (ch === '-' && next === '-') {
            while (i < sql.length && sql[i] !== '\n') {
                current += sql[i];
                i++;
            }
            if (i < sql.length) current += '\n';
            continue;
        }

        if (ch === "'") {
            inSingle = true;
            current += ch;
            continue;
        }

        if (ch === ';') {
            const trimmed = current.trim();
            if (trimmed) statements.push(trimmed);
            current = '';
            continue;
        }

        current += ch;
    }

    const tail = current.trim();
    if (tail) statements.push(tail);
    return statements;
}

function stripCommentLines(statement) {
    return statement
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
}

function parseInsertHeader(sql) {
    const m = sql.match(/^INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?\s*\(([\s\S]*?)\)\s*VALUES/i);
    if (!m) return null;
    const table = m[1];
    const columns = m[2]
        .split(',')
        .map((c) => c.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    return { table, columns };
}

async function executeWithSavepoint(client, sql) {
    await client.query('SAVEPOINT restore_sp');
    try {
        await client.query(sql);
        await client.query('RELEASE SAVEPOINT restore_sp');
        return { ok: true };
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT restore_sp');
        return { ok: false, error };
    }
}

function isFkError(error) {
    return error && (error.code === '23503' || /foreign key/i.test(error.message || ''));
}

async function insertRow(client, item) {
    if (item.params) {
        await client.query(item.sql, item.params);
    } else {
        await client.query(item.sql);
    }
}

async function restorePreparedData({ tableInserts, setvals }) {
    await ensureSchema();
    const client = await pool.connect();
    const warnings = [];
    const restoredCounts = {};
    let inserted = 0;

    try {
        await client.query('BEGIN');
        await client.query('SET statement_timeout = 0');
        const replicaOk = await trySetReplicaRole(client);
        await dropCheckConstraints(client);

        const ensured = new Set();
        for (const item of tableInserts) {
            const key = `${item.table}:${item.columns.join(',')}`;
            if (ensured.has(key)) continue;
            await ensureTableAndColumns(client, item.table, item.columns);
            ensured.add(key);
        }

        const truncated = await truncatePublicTables(client);

        const recordSuccess = (table) => {
            inserted += 1;
            restoredCounts[table] = (restoredCounts[table] || 0) + 1;
        };

        if (replicaOk) {
            for (const item of tableInserts) {
                await insertRow(client, item);
                recordSuccess(item.table);
            }
        } else {
            let pending = [...tableInserts];
            while (pending.length > 0) {
                const next = [];
                let progress = false;

                for (const item of pending) {
                    const result = item.params
                        ? await executeWithSavepointParams(client, item.sql, item.params)
                        : await executeWithSavepoint(client, item.sql);

                    if (result.ok) {
                        progress = true;
                        recordSuccess(item.table);
                    } else if (isFkError(result.error)) {
                        item.lastError = result.error.message;
                        next.push(item);
                    } else {
                        throw new Error(
                            `Gagal restore tabel "${item.table}": ${result.error.message}`
                        );
                    }
                }

                if (next.length === pending.length && !progress) {
                    throw new Error(
                        `Gagal restore karena foreign key pada "${next[0].table}": ${next[0].lastError || 'constraint'}`
                    );
                }
                pending = next;
            }
        }

        for (const sql of setvals) {
            const result = await executeWithSavepoint(client, sql);
            if (!result.ok) {
                warnings.push(`Sequence dilewati: ${result.error.message}`);
            }
        }

        try {
            await client.query('SET session_replication_role = DEFAULT');
        } catch (_) { /* ignore */ }

        await client.query('COMMIT');
        return {
            truncated: truncated.length,
            inserted,
            tables: Object.keys(restoredCounts).length,
            counts: restoredCounts,
            warnings,
        };
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) { /* ignore */ }
        throw error;
    } finally {
        client.release();
    }
}

async function executeWithSavepointParams(client, sql, params) {
    await client.query('SAVEPOINT restore_sp');
    try {
        await client.query(sql, params);
        await client.query('RELEASE SAVEPOINT restore_sp');
        return { ok: true };
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT restore_sp');
        return { ok: false, error };
    }
}

async function restoreSqlBackup(content) {
    const statements = splitSqlStatements(content);
    const tableInserts = [];
    const setvals = [];

    for (const statement of statements) {
        const cleaned = stripCommentLines(statement);
        if (!cleaned) continue;

        const compact = cleaned.replace(/\s+/g, ' ').trim();
        if (/^BEGIN\b/i.test(compact)) continue;
        if (/^COMMIT\b/i.test(compact)) continue;
        if (/^SET\s+session_replication_role\b/i.test(compact)) continue;
        if (/^TRUNCATE\b/i.test(compact)) continue;

        if (/^INSERT\s+INTO\b/i.test(compact)) {
            const parsed = parseInsertHeader(cleaned);
            tableInserts.push({
                table: parsed ? parsed.table : 'unknown',
                columns: parsed ? parsed.columns : [],
                sql: cleaned,
            });
            continue;
        }

        if (/^SELECT\s+setval\b/i.test(compact)) {
            setvals.push(cleaned);
        }
    }

    if (tableInserts.length === 0) {
        throw new Error('File backup tidak berisi data INSERT. Pastikan file diunduh dari fitur Backup aplikasi.');
    }

    return restorePreparedData({ tableInserts, setvals });
}

async function restoreJsonBackup(payload) {
    if (!payload || !Array.isArray(payload.tables)) {
        throw new Error('Format backup JSON tidak valid.');
    }

    const tableInserts = [];
    for (const table of payload.tables) {
        if (!table.name || !Array.isArray(table.columns) || !Array.isArray(table.rows)) continue;
        const colList = table.columns.map(quoteIdent).join(', ');
        const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${quoteIdent(table.name)} (${colList}) VALUES (${placeholders})`;
        for (const row of table.rows) {
            tableInserts.push({
                table: table.name,
                columns: table.columns,
                sql,
                params: (row || []).map(deserializeCell),
            });
        }
    }

    const setvals = (payload.sequences || []).map((seq) => {
        const name = String(seq.name).replace(/'/g, "''");
        return `SELECT setval('public.${name}', ${Number(seq.last_value) || 1}, ${seq.is_called ? 'true' : 'false'})`;
    });

    return restorePreparedData({ tableInserts, setvals });
}

async function restoreBackupFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const trimmed = content.trim();

    if (trimmed.startsWith('{')) {
        let payload;
        try {
            payload = JSON.parse(content);
        } catch (error) {
            throw new Error('File JSON backup rusak atau tidak valid.');
        }
        if (payload.marker !== BACKUP_MARKER_V2 && !String(payload.marker || '').includes('ABSENSI_NODE_BACKUP')) {
            throw new Error('File backup tidak dikenali. Gunakan file yang diunduh dari fitur Backup aplikasi ini.');
        }
        return restoreJsonBackup(payload);
    }

    if (!content.includes('ABSENSI_NODE_BACKUP')) {
        throw new Error(
            'File backup tidak dikenali. Gunakan file yang diunduh dari fitur Backup aplikasi ini.'
        );
    }

    return restoreSqlBackup(content);
}

function normalizeRemoteApiBase(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new Error('URL server wajib diisi');
    }
    let url = raw.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_) {
        throw new Error('URL server tidak valid');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('URL server harus http atau https');
    }
    let base = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
    if (!/\/api$/i.test(base)) {
        base = `${base}/api`;
    }
    return base;
}

async function readRemoteError(res, fallback) {
    const text = await res.text();
    try {
        const data = JSON.parse(text);
        return data.error || fallback;
    } catch (_) {
        if ((text || '').trim().startsWith('<')) {
            return `${fallback}. Cek URL server (harus mengarah ke aplikasi absensi).`;
        }
        return fallback;
    }
}

async function loginRemoteAdmin(apiBase, employeeId, password) {
    let res;
    try {
        res = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: employeeId, password }),
        });
    } catch (error) {
        throw new Error(`Tidak dapat terhubung ke ${apiBase}: ${error.message}`);
    }
    if (!res.ok) {
        throw new Error(await readRemoteError(res, 'Gagal login ke server tujuan'));
    }
    const data = await res.json();
    if (!data.token) {
        throw new Error('Server tujuan tidak mengembalikan token login');
    }
    if (data.user && data.user.role !== 'admin') {
        throw new Error('Akun di server tujuan harus role admin');
    }
    return data.token;
}

async function downloadRemoteBackup(apiBase, token, outPath) {
    let res;
    try {
        res = await fetch(`${apiBase}/backup/download`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        throw new Error(`Gagal mengunduh backup dari ${apiBase}: ${error.message}`);
    }
    if (!res.ok) {
        throw new Error(await readRemoteError(res, `Gagal mengunduh backup dari server (${res.status})`));
    }
    if (res.body && typeof Readable.fromWeb === 'function') {
        await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(outPath));
    } else {
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    }
    const stat = fs.statSync(outPath);
    if (!stat.size) {
        throw new Error('File backup dari server kosong');
    }
    const fd = fs.openSync(outPath, 'r');
    try {
        const buf = Buffer.alloc(Math.min(400, stat.size));
        fs.readSync(fd, buf, 0, buf.length, 0);
        const peek = buf.toString('utf8');
        if (!peek.includes('ABSENSI_NODE_BACKUP') && !peek.trim().startsWith('{')) {
            throw new Error('File dari server bukan backup aplikasi ini. Deploy fitur Backup ke server dulu.');
        }
    } finally {
        fs.closeSync(fd);
    }
}

function buildRestoreMultipart(filePath, filename) {
    const boundary = `----AbsensiBackup${Date.now()}${Math.random().toString(16).slice(2)}`;
    const fileBuffer = fs.readFileSync(filePath);
    const header = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="backup"; filename="${filename}"\r\n` +
        `Content-Type: application/sql\r\n\r\n`
    );
    const footer = Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="confirm"\r\n\r\n` +
        `TIMPA\r\n` +
        `--${boundary}--\r\n`
    );
    return {
        body: Buffer.concat([header, fileBuffer, footer]),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

async function restoreRemoteBackup(apiBase, token, filePath, filename) {
    const multipart = buildRestoreMultipart(filePath, filename);
    let res;
    try {
        res = await fetch(`${apiBase}/backup/restore`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': multipart.contentType,
            },
            body: multipart.body,
        });
    } catch (error) {
        throw new Error(`Gagal mengirim backup ke ${apiBase}: ${error.message}`);
    }
    if (!res.ok) {
        throw new Error(await readRemoteError(res, `Gagal restore ke server tujuan (${res.status})`));
    }
    return res.json();
}

function currentDbInfo() {
    if (process.env.DATABASE_URL) {
        try {
            const u = new URL(process.env.DATABASE_URL);
            return {
                host: u.hostname,
                database: (u.pathname || '').replace(/^\//, '') || 'absensi',
                isLocal: u.hostname === 'localhost' || u.hostname === '127.0.0.1',
            };
        } catch (_) {
            return { host: 'remote', database: 'absensi', isLocal: false };
        }
    }
    const host = process.env.DB_HOST || 'localhost';
    return {
        host,
        database: process.env.DB_NAME || 'absensi',
        isLocal: host === 'localhost' || host === '127.0.0.1',
    };
}

function requireTimpa(confirm) {
    if ((confirm || '').trim().toUpperCase() !== 'TIMPA') {
        throw Object.assign(new Error('Konfirmasi tidak valid. Ketik TIMPA untuk menimpa database.'), { status: 400 });
    }
}

// GET /api/backup/info
router.get('/info', authenticateToken, isAdmin, async (_req, res) => {
    res.json(currentDbInfo());
});

// POST /api/backup/pull-from-remote  (server → database saat ini)
router.post('/pull-from-remote', authenticateToken, isAdmin, async (req, res) => {
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);
    const tmpPath = path.join(BACKUP_DIR, `pull-${Date.now()}.sql`);
    try {
        requireTimpa(req.body.confirm);
        const apiBase = normalizeRemoteApiBase(req.body.remote_url);
        const employeeId = (req.body.employee_id || '').trim();
        const password = req.body.password || '';
        if (!employeeId || !password) {
            return res.status(400).json({ error: 'NIK dan password admin server wajib diisi' });
        }

        const token = await loginRemoteAdmin(apiBase, employeeId, password);
        await downloadRemoteBackup(apiBase, token, tmpPath);
        const result = await restoreBackupFile(tmpPath);
        const countSummary = Object.entries(result.counts || {})
            .map(([table, n]) => `${table}: ${n}`)
            .join(', ');

        res.json({
            message: 'Database server berhasil diunduh dan menimpa database saat ini. Silakan login ulang.',
            inserted: result.inserted,
            tables: result.tables,
            counts: result.counts,
            warnings: result.warnings,
            summary: countSummary,
            source: apiBase,
        });
    } catch (error) {
        console.error('Pull-from-remote error:', error);
        res.status(error.status || 500).json({
            error: error.message || 'Gagal menarik database dari server',
        });
    } finally {
        if (fs.existsSync(tmpPath)) fs.unlink(tmpPath, () => {});
    }
});

// POST /api/backup/push-to-remote  (database saat ini → server)
router.post('/push-to-remote', authenticateToken, isAdmin, async (req, res) => {
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);
    const tmpPath = path.join(BACKUP_DIR, `push-${formatTimestamp()}.sql`);
    try {
        requireTimpa(req.body.confirm);
        const apiBase = normalizeRemoteApiBase(req.body.remote_url);
        const employeeId = (req.body.employee_id || '').trim();
        const password = req.body.password || '';
        if (!employeeId || !password) {
            return res.status(400).json({ error: 'NIK dan password admin server wajib diisi' });
        }

        const token = await loginRemoteAdmin(apiBase, employeeId, password);
        await createNodeBackupFile(tmpPath);
        const remoteResult = await restoreRemoteBackup(
            apiBase,
            token,
            tmpPath,
            path.basename(tmpPath)
        );

        res.json({
            message: 'Database lokal berhasil dikirim dan menimpa database di server.',
            remote: remoteResult,
            target: apiBase,
        });
    } catch (error) {
        console.error('Push-to-remote error:', error);
        res.status(error.status || 500).json({
            error: error.message || 'Gagal mengirim database ke server',
        });
    } finally {
        if (fs.existsSync(tmpPath)) fs.unlink(tmpPath, () => {});
    }
});

// GET /api/backup/download
router.get('/download', authenticateToken, isAdmin, async (req, res) => {
    const filename = `absensi-backup-${formatTimestamp()}.sql`;
    const outPath = path.join(BACKUP_DIR, filename);

    try {
        await createNodeBackupFile(outPath);
        res.download(outPath, filename, (err) => {
            fs.unlink(outPath, () => {});
            if (err && !res.headersSent) {
                res.status(500).json({ error: 'Gagal mengirim file backup' });
            }
        });
    } catch (error) {
        console.error('Backup download error:', error);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        res.status(500).json({ error: error.message || 'Gagal membuat backup database' });
    }
});

// POST /api/backup/restore
router.post('/restore', authenticateToken, isAdmin, (req, res) => {
    upload.single('backup')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Upload gagal' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'File backup wajib diupload' });
        }

        const confirm = (req.body.confirm || '').trim().toUpperCase();
        if (confirm !== 'TIMPA') {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({
                error: 'Konfirmasi tidak valid. Ketik TIMPA untuk menimpa database.',
            });
        }

        const filePath = req.file.path;

        try {
            const result = await restoreBackupFile(filePath);
            const countSummary = Object.entries(result.counts || {})
                .map(([table, n]) => `${table}: ${n}`)
                .join(', ');
            res.json({
                message: 'Database berhasil di-restore. Data lama sudah diganti dengan backup. Silakan login ulang.',
                filename: req.file.originalname,
                inserted: result.inserted,
                tables: result.tables,
                counts: result.counts,
                warnings: result.warnings,
                summary: countSummary,
            });
        } catch (error) {
            console.error('Restore error:', error);
            res.status(500).json({ error: error.message || 'Gagal restore database' });
        } finally {
            fs.unlink(filePath, () => {});
        }
    });
});

module.exports = router;
