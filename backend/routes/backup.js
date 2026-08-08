const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const BACKUP_MARKER = '-- ABSENSI_NODE_BACKUP v1';
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
        if (ext === '.sql' || ext === '.dump' || ext === '.backup') {
            return cb(null, true);
        }
        cb(new Error('Hanya file .sql, .dump, atau .backup yang diizinkan'));
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
        // Postgres array from node-pg
        return `ARRAY[${val.map(sqlLiteral).join(', ')}]`;
    }
    if (typeof val === 'object') {
        const json = JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
        return `'${json}'::jsonb`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function createNodeBackupFile(outPath) {
    const client = await pool.connect();
    const chunks = [];

    try {
        chunks.push(`${BACKUP_MARKER}`);
        chunks.push(`-- Created: ${new Date().toISOString()}`);
        chunks.push(`-- Format: data-only (schema diasumsikan sudah ada di aplikasi)`);
        chunks.push('BEGIN;');
        chunks.push('SET session_replication_role = replica;');
        chunks.push('');

        const tablesRes = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        const tables = tablesRes.rows.map((r) => r.tablename);

        if (tables.length > 0) {
            chunks.push(`TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE;`);
            chunks.push('');
        }

        for (const table of tables) {
            const colsRes = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            const columns = colsRes.rows.map((r) => r.column_name);
            if (columns.length === 0) continue;

            const colList = columns.map(quoteIdent).join(', ');
            const dataRes = await client.query(`SELECT * FROM ${quoteIdent(table)}`);

            chunks.push(`-- Table: ${table} (${dataRes.rows.length} rows)`);
            for (const row of dataRes.rows) {
                const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
                chunks.push(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${values});`);
            }
            chunks.push('');
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
        return { tables: tables.length };
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
            // line comment
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

async function restoreNodeBackupFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('ABSENSI_NODE_BACKUP')) {
        throw new Error(
            'File backup tidak dikenali. Gunakan file yang diunduh dari fitur Backup aplikasi ini.'
        );
    }

    const statements = splitSqlStatements(content);
    const client = await pool.connect();

    try {
        // Putuskan koneksi lain agar truncate/restore tidak terkunci
        try {
            await client.query(`
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND pid <> pg_backend_pid()
            `);
        } catch (termErr) {
            console.warn('Terminate backends warning:', termErr.message);
        }

        for (const statement of statements) {
            // Skip comment-only leftovers
            const cleaned = statement
                .split('\n')
                .filter((line) => !line.trim().startsWith('--'))
                .join('\n')
                .trim();
            if (!cleaned) continue;
            await client.query(cleaned);
        }
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) { /* ignore */ }
        throw error;
    } finally {
        client.release();
    }
}

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
            await restoreNodeBackupFile(filePath);
            res.json({
                message: 'Database berhasil di-restore. Data lama sudah diganti dengan backup.',
                filename: req.file.originalname,
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
