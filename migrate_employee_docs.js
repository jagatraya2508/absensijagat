require('dotenv').config({ path: 'backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
    console.log('=== Migrasi: No. KK & Dokumen Karyawan ===\n');

    try {
        // 1. Add no_kk column to employee_details
        try {
            await pool.query(`ALTER TABLE employee_details ADD COLUMN no_kk VARCHAR(20)`);
            console.log('✅ Kolom no_kk berhasil ditambahkan');
        } catch (e) {
            if (e.code === '42701') console.log('ℹ️ Kolom no_kk sudah ada');
            else throw e;
        }

        // 2. Create employee_documents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS employee_documents (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                doc_type VARCHAR(50) NOT NULL,
                doc_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER DEFAULT 0,
                mime_type VARCHAR(100),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `);
        console.log('✅ Tabel employee_documents berhasil dibuat');

        // Create index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_employee_documents_user_id ON employee_documents(user_id)
        `);
        console.log('✅ Index employee_documents berhasil dibuat');

        console.log('\n✅ Migrasi selesai!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

migrate();
