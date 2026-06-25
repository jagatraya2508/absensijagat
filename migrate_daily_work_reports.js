require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabel master laporan harian per karyawan per tanggal
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_work_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        summary TEXT,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, report_date)
      );
    `);

    // Index untuk performa
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dwr_user ON daily_work_reports(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dwr_date ON daily_work_reports(report_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dwr_status ON daily_work_reports(status);`);

    // Tabel item pekerjaan dalam laporan
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_report_items (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES daily_work_reports(id) ON DELETE CASCADE,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        category VARCHAR(30) DEFAULT 'task' CHECK (category IN ('task', 'meeting', 'admin', 'other')),
        start_time TIME,
        end_time TIME,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress', 'pending', 'blocked')),
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        due_date DATE,
        completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_wri_report ON work_report_items(report_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wri_status ON work_report_items(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wri_due ON work_report_items(due_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wri_priority ON work_report_items(priority);`);

    await client.query('COMMIT');
    console.log('✅ Migration berhasil! Tabel daily_work_reports dan work_report_items sudah dibuat.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration gagal:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
