require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Master Tipe Jadwal Kerja
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_schedule_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'shift')),
        shift_count INTEGER DEFAULT 1 CHECK (shift_count BETWEEN 1 AND 4),
        department VARCHAR(100),
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table work_schedule_types created');

    // 2. Detail Shift
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_shifts (
        id SERIAL PRIMARY KEY,
        schedule_type_id INTEGER REFERENCES work_schedule_types(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        shift_order INTEGER DEFAULT 1 CHECK (shift_order BETWEEN 1 AND 4),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        break_start TIME,
        break_end TIME,
        is_overnight BOOLEAN DEFAULT FALSE,
        color VARCHAR(7) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table work_shifts created');

    // 3. Aturan Lembur per Jadwal
    await client.query(`
      CREATE TABLE IF NOT EXISTS overtime_rules (
        id SERIAL PRIMARY KEY,
        schedule_type_id INTEGER UNIQUE REFERENCES work_schedule_types(id) ON DELETE CASCADE,
        overtime_type VARCHAR(20) NOT NULL DEFAULT 'immediate' CHECK (overtime_type IN ('immediate', 'after_grace')),
        grace_period_minutes INTEGER DEFAULT 0,
        min_overtime_minutes INTEGER DEFAULT 30,
        max_overtime_hours DECIMAL(4,1) DEFAULT 4,
        rate_multiplier DECIMAL(3,1) DEFAULT 1.5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table overtime_rules created');

    // 4. Penugasan Shift per Karyawan per Tanggal
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_shift_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        shift_id INTEGER REFERENCES work_shifts(id) ON DELETE CASCADE,
        assignment_date DATE NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, assignment_date)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_esa_user ON employee_shift_assignments(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_esa_date ON employee_shift_assignments(assignment_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_esa_shift ON employee_shift_assignments(shift_id);`);
    console.log('✅ Table employee_shift_assignments created');

    // 5. Pengajuan Lembur / SPL (Surat Perintah Lembur)
    await client.query(`
      CREATE TABLE IF NOT EXISTS overtime_requests (
        id SERIAL PRIMARY KEY,
        spl_number VARCHAR(50) UNIQUE,
        date DATE NOT NULL,
        shift_id INTEGER REFERENCES work_shifts(id) ON DELETE SET NULL,
        department VARCHAR(100),
        overtime_start TIME NOT NULL,
        overtime_end TIME NOT NULL,
        estimated_hours DECIMAL(4,1) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otr_date ON overtime_requests(date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otr_status ON overtime_requests(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otr_dept ON overtime_requests(department);`);
    console.log('✅ Table overtime_requests created');

    // 6. Karyawan dalam SPL
    await client.query(`
      CREATE TABLE IF NOT EXISTS overtime_request_employees (
        id SERIAL PRIMARY KEY,
        overtime_request_id INTEGER REFERENCES overtime_requests(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        actual_hours DECIMAL(4,1),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(overtime_request_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ore_request ON overtime_request_employees(overtime_request_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ore_user ON overtime_request_employees(user_id);`);
    console.log('✅ Table overtime_request_employees created');

    await client.query('COMMIT');
    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
