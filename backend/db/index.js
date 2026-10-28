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
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS receives_tuang BOOLEAN DEFAULT TRUE')
  .catch((err) => console.warn('DB patch receives_tuang:', err.message));
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS employment_status VARCHAR(150)')
  .catch((err) => console.warn('DB patch employment_status:', err.message));
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS division VARCHAR(150)')
  .catch((err) => console.warn('DB patch division:', err.message));
pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS appreciation_allowance DECIMAL(15,2) DEFAULT 0')
  .catch((err) => console.warn('DB patch appreciation_allowance:', err.message));
pool.query('ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS appreciation_allowance DECIMAL(15,2) DEFAULT 0')
  .catch((err) => console.warn('DB patch payroll appreciation_allowance:', err.message));
pool.query(`
  ALTER TABLE payroll_items 
    ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_deduction DECIMAL(15,2) DEFAULT 0;
  ALTER TABLE positions
    ADD COLUMN IF NOT EXISTS use_custom_late_deduction BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS late_deduction_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS late_deduction_mode VARCHAR(20) DEFAULT 'per_minute',
    ADD COLUMN IF NOT EXISTS late_deduction_rate_per_minute DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_deduction_rate_per_hour DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_deduction_hour_round VARCHAR(30) DEFAULT 'round_up',
    ADD COLUMN IF NOT EXISTS late_grace_period_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_deduct_grace_period BOOLEAN DEFAULT FALSE;
`).catch((err) => console.warn('DB patch payroll late deductions & position rules:', err.message));
pool.query(`ALTER TABLE employee_loans ADD COLUMN IF NOT EXISTS installment_period VARCHAR(10) NOT NULL DEFAULT 'monthly'`)
  .catch((err) => console.warn('DB patch installment_period:', err.message));
pool.query(`
  ALTER TABLE employee_details 
    ADD COLUMN IF NOT EXISTS contract_start_date DATE,
    ADD COLUMN IF NOT EXISTS contract_end_date DATE;
  ALTER TABLE vehicle_types
    ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(15,2) DEFAULT 0;
  ALTER TABLE driver_activities
    ADD COLUMN IF NOT EXISTS vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL;
`).catch((err) => console.warn('DB patch vehicle rate & contracts:', err.message));
pool.query(`
  ALTER TABLE leave_settings 
    ADD COLUMN IF NOT EXISTS leave_calculation_mode VARCHAR(20) DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS hours_per_leave_day NUMERIC(4,2) DEFAULT 8.0;
  ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS is_hourly BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_time TIME,
    ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS duration_days NUMERIC(5,2);
`).catch((err) => console.warn('DB patch hourly leave:', err.message));
pool.query(`
  ALTER TABLE attendance_locations
    ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'all';
  INSERT INTO settings (key, value) VALUES ('checkout_location_rule_mode', 'specific') ON CONFLICT (key) DO NOTHING;
  INSERT INTO settings (key, value) VALUES ('require_different_location_checkout', 'false') ON CONFLICT (key) DO NOTHING;
  INSERT INTO settings (key, value) VALUES ('min_checkout_distance_meters', '0') ON CONFLICT (key) DO NOTHING;
  ALTER TABLE employee_details
    ADD COLUMN IF NOT EXISTS require_different_checkout BOOLEAN DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS shift_change_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(20) NOT NULL DEFAULT 'change',
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    request_date DATE NOT NULL,
    current_shift_id INTEGER REFERENCES work_shifts(id) ON DELETE SET NULL,
    target_shift_id INTEGER REFERENCES work_shifts(id) ON DELETE SET NULL,
    target_user_date DATE,
    target_user_shift_id INTEGER REFERENCES work_shifts(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approval_notes TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_shift_change_user ON shift_change_requests(user_id, request_date);
  CREATE INDEX IF NOT EXISTS idx_shift_change_status ON shift_change_requests(status);
`).catch((err) => console.warn('DB patch location_type and checkout diff settings:', err.message));
pool.query(`
  ALTER TABLE employee_details 
    ADD COLUMN IF NOT EXISTS driver_subuh_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS driver_rit_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS driver_inap_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS driver_ritase_dekat_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS driver_ritase_jauh_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS driver_ritase_allowance DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bpjs_kes_enrolled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bpjs_jht_enrolled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bpjs_jp_enrolled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bpjs_jkk_enrolled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bpjs_jkm_enrolled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS pph21_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS bpjs_kes_employee_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_kes_company_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jht_employee_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jht_company_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jp_employee_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jp_company_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jkk_rate DECIMAL(6,4),
    ADD COLUMN IF NOT EXISTS bpjs_jkm_rate DECIMAL(6,4)
`).catch((err) => console.warn('DB patch employee_details driver/bpjs columns:', err.message));

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

async function ensurePayrollPeriodSchema() {
  await pool.query(`ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS period_type VARCHAR(10) NOT NULL DEFAULT 'monthly'`);
  await pool.query(`ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS week_start DATE`);
  await pool.query(`ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS week_end DATE`);
  await pool.query(`ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_period_month_period_year_key`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_monthly_period
    ON payroll_runs (period_month, period_year)
    WHERE period_type = 'monthly'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_weekly_start
    ON payroll_runs (week_start)
    WHERE period_type = 'weekly'
  `);
}

module.exports = { pool, ensurePrerequisiteUniques, ensureWorkScheduleSchema, ensurePayrollPeriodSchema };
