-- Database Schema untuk Aplikasi Absensi Karyawan

-- Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee',
    face_descriptor TEXT,
    photo VARCHAR(255),
    off_day VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Attendance Locations (Lokasi Kantor)
CREATE TABLE IF NOT EXISTS attendance_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Departments (Master Departemen)
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Positions (Master Jabatan)
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Vehicle Types (Master Jenis Kendaraan)
CREATE TABLE IF NOT EXISTS vehicle_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Attendance Records (Rekam Absensi)
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES attendance_locations(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('check_in', 'check_out')),
    photo_path VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    distance_meters DECIMAL(10, 2),
    is_valid BOOLEAN DEFAULT TRUE,
    notes TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_at ON attendance_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance_records(type);

-- Tabel Leave Requests (Pengajuan Izin/Cuti)
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('late', 'sick', 'leave', 'change_off')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment_path VARCHAR(255),
    replacement_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_date ON leave_requests(start_date);

-- Insert default admin user (password: admin123)
INSERT INTO users (employee_id, name, email, password, role) 
VALUES ('ADMIN001', 'Administrator', 'admin@company.com', '$2b$10$rQZ5QH2V5Y1vX8W6x9Y8/.O7kJ6H5F4G3D2C1B0A9N8M7L6K5J4I3', 'admin')
ON CONFLICT (employee_id) DO NOTHING;

-- Tabel Announcements (Pengumuman)
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

-- Tabel User Off Days (Hari Libur Karyawan)
CREATE TABLE IF NOT EXISTS user_off_days (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    off_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, off_date)
);

-- Index untuk user_off_days
CREATE INDEX IF NOT EXISTS idx_off_days_user_id ON user_off_days(user_id);
CREATE INDEX IF NOT EXISTS idx_off_days_date ON user_off_days(off_date);

-- Tabel User Locations (Lokasi Absensi yang Diizinkan per Karyawan)
CREATE TABLE IF NOT EXISTS user_locations (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES attendance_locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, location_id)
);

-- ============================================
-- MODUL HR & PAYROLL
-- ============================================

-- Tabel Employee Details (Data Lengkap Karyawan)
CREATE TABLE IF NOT EXISTS employee_details (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nik VARCHAR(20),
    phone VARCHAR(20),
    address TEXT,
    birth_date DATE,
    birth_place VARCHAR(100),
    gender VARCHAR(10) CHECK (gender IN ('Laki-laki', 'Perempuan')),
    marital_status VARCHAR(20) DEFAULT 'Belum Menikah' CHECK (marital_status IN ('Belum Menikah', 'Menikah', 'Cerai')),
    religion VARCHAR(20),
    education VARCHAR(30),
    department VARCHAR(100),
    position VARCHAR(100),
    join_date DATE,
    bank_name VARCHAR(50),
    bank_account VARCHAR(30),
    bank_holder VARCHAR(100),
    npwp VARCHAR(30),
    bpjs_kesehatan_no VARCHAR(30),
    bpjs_ketenagakerjaan_no VARCHAR(30),
    basic_salary DECIMAL(15,2) DEFAULT 0,
    salary_type VARCHAR(10) DEFAULT 'monthly' CHECK (salary_type IN ('daily', 'weekly', 'monthly')),
    transport_allowance DECIMAL(15,2) DEFAULT 0,
    meal_allowance DECIMAL(15,2) DEFAULT 0,
    overtime_rate DECIMAL(15,2) DEFAULT 50000,
    tax_status VARCHAR(10) DEFAULT 'TK/0',
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL,
    no_kk VARCHAR(20),
    is_driver BOOLEAN DEFAULT FALSE,
    is_collector BOOLEAN DEFAULT FALSE,
    use_tracking BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_detail_user ON employee_details(user_id);

-- Tabel Overtime Records (Catatan Lembur)
CREATE TABLE IF NOT EXISTS overtime_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(4,1) NOT NULL,
    rate_per_hour DECIMAL(15,2) NOT NULL DEFAULT 50000,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_records(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_records(date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_records(status);

-- Tabel Employee Loans (Pinjaman Karyawan)
CREATE TABLE IF NOT EXISTS employee_loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    installment_amount DECIMAL(15,2) NOT NULL,
    total_installments INTEGER NOT NULL,
    paid_installments INTEGER DEFAULT 0,
    remaining_balance DECIMAL(15,2) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'cancelled')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_user ON employee_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_status ON employee_loans(status);

-- Tabel Loan Payments (Pembayaran Cicilan)
CREATE TABLE IF NOT EXISTS loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES employee_loans(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'manual' CHECK (payment_method IN ('payroll_deduction', 'manual')),
    payroll_item_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_payment_loan ON loan_payments(loan_id);

-- Tabel Payroll Runs (Master Penggajian)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id SERIAL PRIMARY KEY,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_month, period_year)
);

-- Tabel Payroll Items (Detail Gaji per Karyawan)
CREATE TABLE IF NOT EXISTS payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    basic_salary DECIMAL(15,2) DEFAULT 0,
    transport_allowance DECIMAL(15,2) DEFAULT 0,
    meal_allowance DECIMAL(15,2) DEFAULT 0,
    overtime_hours DECIMAL(6,1) DEFAULT 0,
    overtime_amount DECIMAL(15,2) DEFAULT 0,
    bpjs_kes_employee DECIMAL(15,2) DEFAULT 0,
    bpjs_kes_company DECIMAL(15,2) DEFAULT 0,
    bpjs_jht_employee DECIMAL(15,2) DEFAULT 0,
    bpjs_jht_company DECIMAL(15,2) DEFAULT 0,
    bpjs_jp_employee DECIMAL(15,2) DEFAULT 0,
    bpjs_jp_company DECIMAL(15,2) DEFAULT 0,
    bpjs_jkk DECIMAL(15,2) DEFAULT 0,
    bpjs_jkm DECIMAL(15,2) DEFAULT 0,
    gross_income DECIMAL(15,2) DEFAULT 0,
    pph21_amount DECIMAL(15,2) DEFAULT 0,
    loan_deduction DECIMAL(15,2) DEFAULT 0,
    total_deductions DECIMAL(15,2) DEFAULT 0,
    net_salary DECIMAL(15,2) DEFAULT 0,
    salary_type VARCHAR(10) DEFAULT 'monthly',
    working_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_item_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_item_user ON payroll_items(user_id);

-- Tabel BPJS Settings (Pengaturan Tarif BPJS)
CREATE TABLE IF NOT EXISTS bpjs_settings (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    employee_rate DECIMAL(6,4) NOT NULL DEFAULT 0,
    company_rate DECIMAL(6,4) NOT NULL DEFAULT 0,
    max_salary_base DECIMAL(15,2) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default BPJS rates sesuai peraturan Disnaker
INSERT INTO bpjs_settings (code, name, description, employee_rate, company_rate, max_salary_base) VALUES
('BPJS_KES', 'BPJS Kesehatan', 'Jaminan Kesehatan Nasional (JKN)', 0.0100, 0.0400, 12000000),
('BPJS_JHT', 'BPJS JHT', 'Jaminan Hari Tua', 0.0200, 0.0370, NULL),
('BPJS_JP', 'BPJS JP', 'Jaminan Pensiun', 0.0100, 0.0200, 10042300),
('BPJS_JKK', 'BPJS JKK', 'Jaminan Kecelakaan Kerja (Kelompok I - Risiko Sangat Rendah)', 0.0000, 0.0024, NULL),
('BPJS_JKM', 'BPJS JKM', 'Jaminan Kematian', 0.0000, 0.0030, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MODUL PENILAIAN KEDISIPLINAN
-- ============================================

CREATE TABLE IF NOT EXISTS discipline_assessments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    total_working_days INTEGER DEFAULT 0,
    present_days INTEGER DEFAULT 0,
    late_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    leave_days INTEGER DEFAULT 0,
    overtime_days INTEGER DEFAULT 0,
    attendance_score DECIMAL(5,2) DEFAULT 0,
    attitude_score DECIMAL(5,2) DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 0,
    final_score DECIMAL(5,2) DEFAULT 0,
    grade VARCHAR(2) DEFAULT 'E',
    notes TEXT,
    assessed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_assessment_user ON discipline_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_period ON discipline_assessments(period_year, period_month);

-- ============================================
-- MODUL RECRUITMENT
-- ============================================

CREATE TABLE IF NOT EXISTS job_positions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    department VARCHAR(100),
    description TEXT,
    requirements TEXT,
    salary_range_min DECIMAL(15,2),
    salary_range_max DECIMAL(15,2),
    employment_type VARCHAR(20) DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on-hold')),
    opened_date DATE DEFAULT CURRENT_DATE,
    closed_date DATE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_status ON job_positions(status);

CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    education VARCHAR(100),
    experience_years INTEGER DEFAULT 0,
    applied_position_id INTEGER REFERENCES job_positions(id) ON DELETE SET NULL,
    resume_path VARCHAR(255),
    photo_path VARCHAR(255),
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'screening', 'interview', 'test', 'offering', 'hired', 'rejected')),
    source VARCHAR(30) DEFAULT 'website' CHECK (source IN ('website', 'referral', 'jobfair', 'linkedin', 'other')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_position ON candidates(applied_position_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status ON candidates(status);

CREATE TABLE IF NOT EXISTS recruitment_stages (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('passed', 'failed', 'pending', 'in-progress')),
    scheduled_date DATE,
    completed_date DATE,
    interviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    score DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_candidate ON recruitment_stages(candidate_id);

CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    stage_id INTEGER REFERENCES recruitment_stages(id) ON DELETE SET NULL,
    interviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    interview_date DATE NOT NULL,
    interview_time TIME,
    location VARCHAR(200),
    type VARCHAR(20) DEFAULT 'onsite' CHECK (type IN ('online', 'onsite')),
    meeting_link VARCHAR(500),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
    result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'pending')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_date ON interviews(interview_date);
CREATE INDEX IF NOT EXISTS idx_interview_interviewer ON interviews(interviewer_id);

-- ============================================
-- MODUL JADWAL KERJA & LEMBUR (SPL)
-- ============================================

-- Master Tipe Jadwal Kerja
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

-- Detail Shift
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

-- Aturan Lembur per Jadwal
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

-- Penugasan Shift per Karyawan per Tanggal
CREATE TABLE IF NOT EXISTS employee_shift_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES work_shifts(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, assignment_date)
);

CREATE INDEX IF NOT EXISTS idx_esa_user ON employee_shift_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_esa_date ON employee_shift_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_esa_shift ON employee_shift_assignments(shift_id);

-- Pengajuan Lembur / SPL (Surat Perintah Lembur)
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

CREATE INDEX IF NOT EXISTS idx_otr_date ON overtime_requests(date);
CREATE INDEX IF NOT EXISTS idx_otr_status ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_otr_dept ON overtime_requests(department);

-- Karyawan dalam SPL
CREATE TABLE IF NOT EXISTS overtime_request_employees (
    id SERIAL PRIMARY KEY,
    overtime_request_id INTEGER REFERENCES overtime_requests(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    actual_hours DECIMAL(4,1),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(overtime_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ore_request ON overtime_request_employees(overtime_request_id);
CREATE INDEX IF NOT EXISTS idx_ore_user ON overtime_request_employees(user_id);

-- ============================================
-- MODUL LAPORAN KERJAAN HARIAN
-- ============================================

-- Master laporan harian per karyawan per tanggal
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

CREATE INDEX IF NOT EXISTS idx_dwr_user ON daily_work_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_dwr_date ON daily_work_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_dwr_status ON daily_work_reports(status);

-- Item pekerjaan dalam laporan (timeline & pending)
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

CREATE INDEX IF NOT EXISTS idx_wri_report ON work_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_wri_status ON work_report_items(status);
CREATE INDEX IF NOT EXISTS idx_wri_due ON work_report_items(due_date);
CREATE INDEX IF NOT EXISTS idx_wri_priority ON work_report_items(priority);

-- ============================================
-- MODUL SETTINGS, LICENSE, ROLES & EXTRA TABLES
-- ============================================

-- Tabel Settings (Pengaturan Aplikasi & Logo)
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO settings (key, value) VALUES ('app_logo', '/logo.png') ON CONFLICT DO NOTHING;

-- Tabel License Info
CREATE TABLE IF NOT EXISTS license_info (
    id SERIAL PRIMARY KEY,
    license_key TEXT NOT NULL,
    company_name VARCHAR(200),
    max_users INTEGER NOT NULL DEFAULT 10,
    expires_at DATE,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    UNIQUE(role_id, permission_key)
);

INSERT INTO roles (name, label, is_system) 
VALUES 
    ('admin', 'Administrator', true),
    ('employee', 'Karyawan', true),
    ('manager', 'Pimpinan / Manager', true)
ON CONFLICT (name) DO NOTHING;

-- Tabel Manual Attendances
CREATE TABLE IF NOT EXISTS manual_attendances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

-- Tabel Assets
CREATE TABLE IF NOT EXISTS asset_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    purchase_date DATE,
    price DECIMAL(15,2),
    description TEXT,
    photo_path VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
    current_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_assignments (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    returned_date DATE,
    returned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Employee Documents
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
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_user_id ON employee_documents(user_id);

-- ============================================
-- AUTO-PATCH MISSING COLUMNS (FOR EXISTING DBs)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS off_day VARCHAR(20);
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS no_kk VARCHAR(20);
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS is_collector BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS use_tracking BOOLEAN DEFAULT FALSE;

