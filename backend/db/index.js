const { Pool } = require('pg');

// Railway provides DATABASE_URL, use it if available
const connectionConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'absensi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sa',
  };

const pool = new Pool(connectionConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS is_sales BOOLEAN DEFAULT FALSE')
  .catch((err) => console.warn('DB patch is_sales:', err.message));
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS employment_status VARCHAR(150)')
  .catch((err) => console.warn('DB patch employment_status:', err.message));
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS division VARCHAR(150)')
  .catch((err) => console.warn('DB patch division:', err.message));

async function ensurePrerequisiteUniques() {
  const stmts = [
    'CREATE UNIQUE INDEX IF NOT EXISTS employment_statuses_name_key ON employment_statuses (name)',
    'CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON departments (name)',
    'CREATE UNIQUE INDEX IF NOT EXISTS positions_name_key ON positions (name)',
    'CREATE UNIQUE INDEX IF NOT EXISTS bpjs_settings_code_key ON bpjs_settings (code)',
    'CREATE UNIQUE INDEX IF NOT EXISTS roles_name_key ON roles (name)',
    'CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_role_permission_key ON role_permissions (role_id, permission_key)',
    'CREATE UNIQUE INDEX IF NOT EXISTS leave_approval_config_leave_type_key ON leave_approval_config (leave_type)',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_key ON users (employee_id)',
  ];
  for (const sql of stmts) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Table may not exist yet; schema.sql will create it.
    }
  }
}

async function ensureWorkScheduleSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_schedule_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'shift')),
      shift_count INTEGER DEFAULT 1 CHECK (shift_count BETWEEN 1 AND 4),
      department VARCHAR(100),
      "position" VARCHAR(100),
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
      is_default BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
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
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_shift_breaks (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL DEFAULT 'Istirahat',
      break_order SMALLINT NOT NULL DEFAULT 1 CHECK (break_order BETWEEN 1 AND 3),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (shift_id, break_order)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_work_shift_breaks_shift ON work_shift_breaks(shift_id)');
  await pool.query(`
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
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_shift_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      shift_id INTEGER REFERENCES work_shifts(id) ON DELETE CASCADE,
      assignment_date DATE NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, assignment_date)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_esa_user ON employee_shift_assignments(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_esa_date ON employee_shift_assignments(assignment_date)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_esa_shift ON employee_shift_assignments(shift_id)');
  await pool.query(`
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
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS overtime_request_employees (
      id SERIAL PRIMARY KEY,
      overtime_request_id INTEGER REFERENCES overtime_requests(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      actual_hours DECIMAL(4,1),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(overtime_request_id, user_id)
    )
  `);
  await pool.query(`ALTER TABLE work_schedule_types ADD COLUMN IF NOT EXISTS "position" VARCHAR(100)`);
  await pool.query(`ALTER TABLE work_schedule_types ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE work_schedule_types ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wst_department_id ON work_schedule_types(department_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wst_position_id ON work_schedule_types(position_id)');
  await pool.query(`
    UPDATE work_schedule_types wst
    SET department_id = d.id
    FROM departments d
    WHERE wst.department_id IS NULL
      AND wst.department IS NOT NULL
      AND wst.department <> ''
      AND wst.department = d.name
  `);
  await pool.query(`
    UPDATE work_schedule_types wst
    SET position_id = p.id
    FROM positions p
    WHERE wst.position_id IS NULL
      AND wst."position" IS NOT NULL
      AND wst."position" <> ''
      AND wst."position" = p.name
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_schedule_departments (
      schedule_type_id INTEGER NOT NULL REFERENCES work_schedule_types(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      PRIMARY KEY (schedule_type_id, department_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_schedule_positions (
      schedule_type_id INTEGER NOT NULL REFERENCES work_schedule_types(id) ON DELETE CASCADE,
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      PRIMARY KEY (schedule_type_id, position_id)
    )
  `);
  await pool.query(`
    INSERT INTO work_schedule_departments (schedule_type_id, department_id)
    SELECT id, department_id FROM work_schedule_types
    WHERE department_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO work_schedule_positions (schedule_type_id, position_id)
    SELECT id, position_id FROM work_schedule_types
    WHERE position_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  try {
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS overtime_rules_schedule_type_id_key ON overtime_rules (schedule_type_id)');
  } catch (_) { /* already exists as table constraint */ }
}

module.exports = { pool, ensurePrerequisiteUniques, ensureWorkScheduleSchema };
