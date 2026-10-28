const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');
const { buildSlipSections, resolvePayslipLayout } = require('../utils/payslipFields');
const canManagePayroll = hasPermission('admin.payroll');

async function weeksWorkedInMonth(client, userId, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    const weeksResult = await client.query(`
        SELECT COUNT(DISTINCT EXTRACT(WEEK FROM recorded_at)) as weeks_worked
        FROM attendance_records
        WHERE user_id = $1
          AND type = 'check_in'
          AND EXTRACT(MONTH FROM recorded_at) = $2
          AND EXTRACT(YEAR FROM recorded_at) = $3
    `, [userId, month, year]);
    return parseInt(weeksResult.rows[0].weeks_worked, 10) || weeksInMonth;
}

function weekBounds(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const next = new Date(end);
    next.setDate(end.getDate() + 1);
    const fmt = (value) => {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    return {
        start: fmt(start),
        end: fmt(end),
        endExclusive: fmt(next),
        month: start.getMonth() + 1,
        year: start.getFullYear(),
    };
}

function monthBounds(year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return {
        start,
        endExclusive: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    };
}

function formatIsoDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPayrollPeriod(run) {
    if (run.period_type === 'weekly' && run.week_start) {
        return `${formatIsoDate(run.week_start)} – ${formatIsoDate(run.week_end)}`;
    }
    return `${monthNamesID[run.period_month]} ${run.period_year}`;
}

function loanChargeForPeriod(loan, weeklyPeriods) {
    const installment = parseFloat(loan.installment_amount) || 0;
    const periods = loan.installment_period === 'weekly' ? Math.max(1, weeklyPeriods || 1) : 1;
    const remaining = parseFloat(loan.remaining_balance) || 0;
    return {
        periods,
        amount: Math.min(remaining, installment * periods),
    };
}

async function getPayslipLogoFile() {
    const result = await pool.query(
        `SELECT key, value FROM settings WHERE key IN ('payslip_show_logo', 'app_logo')`
    );
    const map = {};
    result.rows.forEach(row => { map[row.key] = row.value; });
    if (map.payslip_show_logo === 'false' || !map.app_logo) return null;

    const ext = path.extname(map.app_logo).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;

    let filePath = null;
    if (map.app_logo.startsWith('/uploads/')) {
        filePath = path.join(__dirname, '..', map.app_logo);
    } else if (map.app_logo.startsWith('/')) {
        const relative = map.app_logo.replace(/^\//, '');
        filePath = [
            path.join(__dirname, '../../frontend/public', relative),
            path.join(__dirname, '../../frontend/dist', relative),
        ].find(candidate => fs.existsSync(candidate)) || null;
    }

    if (!filePath || !fs.existsSync(filePath)) return null;
    return filePath;
}

async function payslipSectionsFor(slip) {
    const layout = await resolvePayslipLayout(pool, slip.user_id, slip.department);
    return buildSlipSections(slip, layout.vis);
}

// PPh 21 progressive tax calculation (annual)
function calculatePPh21(annualTaxableIncome) {
    if (annualTaxableIncome <= 0) return 0;
    let tax = 0;
    const brackets = [
        { limit: 60000000, rate: 0.05 },
        { limit: 250000000, rate: 0.15 },
        { limit: 500000000, rate: 0.25 },
        { limit: 5000000000, rate: 0.30 },
        { limit: Infinity, rate: 0.35 }
    ];
    let remaining = annualTaxableIncome;
    let prevLimit = 0;
    for (const bracket of brackets) {
        const taxable = Math.min(remaining, bracket.limit - prevLimit);
        if (taxable <= 0) break;
        tax += taxable * bracket.rate;
        remaining -= taxable;
        prevLimit = bracket.limit;
    }
    return tax;
}

// PTKP (Penghasilan Tidak Kena Pajak) per year
function getPTKP(taxStatus) {
    const ptkpMap = {
        'TK/0': 54000000,
        'TK/1': 58500000,
        'TK/2': 63000000,
        'TK/3': 67500000,
        'K/0': 58500000,
        'K/1': 63000000,
        'K/2': 67500000,
        'K/3': 72000000,
    };
    return ptkpMap[taxStatus] || 54000000;
}

// Approved manual records plus approved pengajuan lembur (SPL).
// SPL hours use actual hours when filled, otherwise the requested estimate.
// Amount = hours × tarif lembur karyawan × pengali rate shift (default 1,5).
async function sumEmployeeOvertime(client, userId, rangeStart, rangeEnd, hourlyRate) {
    const records = await client.query(`
        SELECT COALESCE(SUM(hours), 0) AS hours,
               COALESCE(SUM(total_amount), 0) AS amount
        FROM overtime_records
        WHERE user_id = $1
          AND status = 'approved'
          AND date >= $2::date
          AND date < $3::date
    `, [userId, rangeStart, rangeEnd]);

    const requests = await client.query(`
        SELECT COALESCE(SUM(COALESCE(ore.actual_hours, otr.estimated_hours)), 0) AS hours,
               COALESCE(SUM(
                   COALESCE(ore.actual_hours, otr.estimated_hours)
                   * $4::numeric
                   * COALESCE(rl.rate_multiplier, 1.5)
               ), 0) AS amount
        FROM overtime_requests otr
        JOIN overtime_request_employees ore ON ore.overtime_request_id = otr.id
        LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
        LEFT JOIN overtime_rules rl ON rl.schedule_type_id = ws.schedule_type_id
        WHERE ore.user_id = $1
          AND otr.status IN ('approved', 'completed')
          AND otr.date >= $2::date
          AND otr.date < $3::date
    `, [userId, rangeStart, rangeEnd, hourlyRate]);

    return {
        hours: parseFloat(records.rows[0].hours) + parseFloat(requests.rows[0].hours),
        amount: parseFloat(records.rows[0].amount) + parseFloat(requests.rows[0].amount)
    };
}

// Get all payroll runs
router.get('/', authenticateToken, canManagePayroll, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pr.*,
                   to_char(pr.week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(pr.week_end, 'YYYY-MM-DD') AS week_end,
                   u.name as created_by_name,
                   (SELECT COUNT(*) FROM payroll_items WHERE payroll_run_id = pr.id) as employee_count,
                   (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_items WHERE payroll_run_id = pr.id) as total_net_salary
            FROM payroll_runs pr
            LEFT JOIN users u ON pr.created_by = u.id
            ORDER BY pr.period_year DESC, pr.period_month DESC, pr.week_start DESC NULLS LAST
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get payroll runs error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get payroll run detail with items
router.get('/:id', authenticateToken, canManagePayroll, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query(`
            SELECT *, to_char(week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(week_end, 'YYYY-MM-DD') AS week_end
            FROM payroll_runs WHERE id = $1
        `, [id]);
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        }

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   ed.bank_name, ed.bank_account
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1
            ORDER BY u.name ASC
        `, [id]);

        res.json({
            ...runResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Get payroll detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Generate payroll for a month
router.post('/generate', authenticateToken, canManagePayroll, async (req, res) => {
    const client = await pool.connect();
    try {
        const periodType = req.body.period_type === 'weekly' ? 'weekly' : 'monthly';
        const notes = req.body.notes;
        let month = parseInt(req.body.month, 10);
        let year = parseInt(req.body.year, 10);
        let weekStart = null;
        let weekEnd = null;
        let rangeStart;
        let rangeEnd;
        if (periodType === 'weekly') {
            const bounds = weekBounds(req.body.week_date);
            if (!bounds) {
                return res.status(400).json({ error: 'Tanggal minggu payroll harus diisi' });
            }
            weekStart = bounds.start;
            weekEnd = bounds.end;
            rangeStart = bounds.start;
            rangeEnd = bounds.endExclusive;
            month = bounds.month;
            year = bounds.year;
        } else if (!month || !year) {
            return res.status(400).json({ error: 'Bulan dan tahun harus diisi' });
        } else {
            const bounds = monthBounds(year, month);
            rangeStart = bounds.start;
            rangeEnd = bounds.endExclusive;
        }

        await client.query('BEGIN');

        const existing = periodType === 'weekly'
            ? await client.query('SELECT id FROM payroll_runs WHERE period_type = $1 AND week_start = $2::date', ['weekly', weekStart])
            : await client.query(
                `SELECT id FROM payroll_runs WHERE period_month = $1 AND period_year = $2 AND period_type = 'monthly'`,
                [month, year]
            );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: periodType === 'weekly'
                    ? 'Payroll untuk minggu ini sudah ada. Hapus dulu jika ingin generate ulang.'
                    : 'Payroll untuk bulan ini sudah ada. Hapus dulu jika ingin generate ulang.'
            });
        }

        const runResult = await client.query(`
            INSERT INTO payroll_runs (period_month, period_year, period_type, week_start, week_end, created_by, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [month, year, periodType, weekStart, weekEnd, req.user.id, notes || null]);
        const payrollRunId = runResult.rows[0].id;

        // Get default BPJS rates from bpjs_settings table
        const bpjsSettingsResult = await client.query(
            "SELECT code, employee_rate, company_rate, max_salary_base FROM bpjs_settings WHERE is_active = true"
        );
        const defaultRates = {};
        bpjsSettingsResult.rows.forEach(r => { defaultRates[r.code] = r; });

        // Get all employees with details (including driver info + BPJS enrollment)
        const employees = await client.query(`
            SELECT u.id, u.employee_id, u.name,
                   COALESCE(ed.basic_salary, 0) as basic_salary,
                   COALESCE(ed.salary_type, 'monthly') as salary_type,
                   COALESCE(ed.transport_allowance, 0) as transport_allowance,
                   COALESCE(ed.meal_allowance, 0) as meal_allowance,
                   COALESCE(ed.appreciation_allowance, 0) as appreciation_allowance,
                   COALESCE(ed.overtime_rate, 50000) as overtime_rate,
                   COALESCE(ed.tax_status, 'TK/0') as tax_status,
                   COALESCE(ed.is_driver, false) as is_driver,
                   COALESCE(ed.driver_subuh_allowance, 0) as driver_subuh_allowance,
                   COALESCE(ed.driver_rit_allowance, 0) as driver_rit_allowance,
                   COALESCE(ed.driver_inap_allowance, 0) as driver_inap_allowance,
                   COALESCE(ed.driver_ritase_dekat_allowance, 0) as driver_ritase_dekat_allowance,
                   COALESCE(ed.driver_ritase_jauh_allowance, 0) as driver_ritase_jauh_allowance,
                   COALESCE(ed.bpjs_kes_enrolled, true) as bpjs_kes_enrolled,
                   COALESCE(ed.bpjs_jht_enrolled, true) as bpjs_jht_enrolled,
                   COALESCE(ed.bpjs_jp_enrolled, true) as bpjs_jp_enrolled,
                   COALESCE(ed.bpjs_jkk_enrolled, true) as bpjs_jkk_enrolled,
                   COALESCE(ed.bpjs_jkm_enrolled, true) as bpjs_jkm_enrolled,
                   COALESCE(ed.pph21_enabled, true) as pph21_enabled,
                   ed.bpjs_kes_employee_rate, ed.bpjs_kes_company_rate,
                   ed.bpjs_jht_employee_rate, ed.bpjs_jht_company_rate,
                   ed.bpjs_jp_employee_rate, ed.bpjs_jp_company_rate,
                   ed.bpjs_jkk_rate, ed.bpjs_jkm_rate,
                   ed.position,
                   pos.use_custom_late_deduction,
                   pos.late_deduction_enabled as pos_late_enabled,
                   pos.late_deduction_mode as pos_late_mode,
                   pos.late_deduction_rate_per_minute as pos_late_rate_per_minute,
                   pos.late_deduction_rate_per_hour as pos_late_rate_per_hour,
                   pos.late_deduction_hour_round as pos_late_hour_round,
                   pos.late_grace_period_minutes as pos_late_grace_minutes,
                   pos.late_deduct_grace_period as pos_late_deduct_grace
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            LEFT JOIN positions pos ON LOWER(TRIM(COALESCE(ed.position, ''))) = LOWER(TRIM(pos.name))
            WHERE u.role = 'employee'
        `);
        const payrollEmployees = employees.rows.filter((emp) => (
            periodType === 'weekly' 
                ? (emp.salary_type === 'weekly' || emp.salary_type === 'daily') 
                : (emp.salary_type !== 'weekly' && emp.salary_type !== 'daily')
        ));
        if (payrollEmployees.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: periodType === 'weekly'
                    ? 'Tidak ada karyawan dengan gaji mingguan atau harian.'
                    : 'Tidak ada karyawan untuk payroll bulanan.'
            });
        }

        // Calculate working days in the month (Mon-Fri)
        const daysInMonth = new Date(year, month, 0).getDate();
        let totalWorkingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay();
            if (dow !== 0 && dow !== 6) totalWorkingDays++;
        }
        const allowanceFactor = periodType === 'weekly' ? 0.25 : 1;

        // Load late deduction settings
        const lateSettingsRes = await client.query(
            `SELECT key, value FROM settings WHERE key IN (
                'late_deduction_enabled',
                'late_deduction_mode',
                'late_deduction_rate_per_minute',
                'late_deduction_rate_per_hour',
                'late_deduction_hour_round',
                'late_grace_period_minutes',
                'late_deduct_grace_period',
                'late_exempt_approved_leave',
                'late_fallback_start_time'
            )`
        );
        const lateConfig = {
            enabled: false,
            mode: 'per_minute',
            ratePerMinute: 1000,
            ratePerHour: 25000,
            hourRound: 'round_up',
            graceMinutes: 0,
            deductGrace: false,
            exemptApprovedLeave: true,
            fallbackStart: '08:00'
        };
        lateSettingsRes.rows.forEach(r => {
            if (r.key === 'late_deduction_enabled') lateConfig.enabled = r.value === 'true';
            else if (r.key === 'late_deduction_mode') lateConfig.mode = r.value || 'per_minute';
            else if (r.key === 'late_deduction_rate_per_minute') lateConfig.ratePerMinute = parseFloat(r.value) || 0;
            else if (r.key === 'late_deduction_rate_per_hour') lateConfig.ratePerHour = parseFloat(r.value) || 0;
            else if (r.key === 'late_deduction_hour_round') lateConfig.hourRound = r.value || 'round_up';
            else if (r.key === 'late_grace_period_minutes') lateConfig.graceMinutes = parseInt(r.value, 10) || 0;
            else if (r.key === 'late_deduct_grace_period') lateConfig.deductGrace = r.value === 'true';
            else if (r.key === 'late_exempt_approved_leave') lateConfig.exemptApprovedLeave = r.value !== 'false';
            else if (r.key === 'late_fallback_start_time') lateConfig.fallbackStart = r.value || '08:00';
        });
        for (const emp of payrollEmployees) {
            const salaryType = emp.salary_type || 'monthly';
            const baseSalaryRate = parseFloat(emp.basic_salary);
            const transportAllowance = parseFloat(emp.transport_allowance) * allowanceFactor;
            const mealAllowance = parseFloat(emp.meal_allowance) * allowanceFactor;
            const appreciationAllowance = (parseFloat(emp.appreciation_allowance) || 0) * allowanceFactor;

            const attendanceResult = await client.query(`
                SELECT COUNT(DISTINCT DATE(recorded_at)) as days_worked
                FROM attendance_records
                WHERE user_id = $1
                  AND type = 'check_in'
                  AND recorded_at >= $2::date
                  AND recorded_at < $3::date
            `, [emp.id, rangeStart, rangeEnd]);
            const attendedDays = parseInt(attendanceResult.rows[0].days_worked, 10) || 0;
            const daysWorked = periodType === 'weekly' ? attendedDays : (attendedDays || totalWorkingDays);

            let workingDays = 0;
            let basicSalary = 0;
            if (salaryType === 'daily') {
                if (emp.is_driver) {
                    // Ambil seluruh tanggal kerja (baik dari absensi check-in maupun aktivitas driver)
                    const driverDays = await client.query(`
                        SELECT 
                            d.work_date,
                            COALESCE(vt.daily_rate, 0) as vehicle_daily_rate,
                            vt.name as vehicle_name
                        FROM (
                            SELECT DISTINCT DATE(recorded_at) as work_date
                            FROM attendance_records
                            WHERE user_id = $1
                              AND type = 'check_in'
                              AND recorded_at >= $2::date
                              AND recorded_at < $3::date
                            UNION
                            SELECT DISTINCT activity_date as work_date
                            FROM driver_activities
                            WHERE user_id = $1
                              AND activity_date >= $2::date
                              AND activity_date < $3::date
                        ) d
                        LEFT JOIN driver_activities da ON da.user_id = $1 AND da.activity_date = d.work_date
                        LEFT JOIN vehicle_types vt ON da.vehicle_type_id = vt.id
                        ORDER BY d.work_date ASC
                    `, [emp.id, rangeStart, rangeEnd]);

                    const actualDays = driverDays.rows.length;
                    workingDays = actualDays > 0 ? actualDays : daysWorked;
                    if (actualDays > 0) {
                        let totalDaily = 0;
                        for (const row of driverDays.rows) {
                            const vehicleRate = parseFloat(row.vehicle_daily_rate) || 0;
                            // Asas tidak merugikan driver: ambil tarif tertinggi antara base supir vs tarif mobil yang dibawa
                            const effectiveDayRate = Math.max(baseSalaryRate, vehicleRate);
                            totalDaily += effectiveDayRate;
                        }
                        basicSalary = totalDaily;
                    } else {
                        basicSalary = baseSalaryRate * workingDays;
                    }
                } else {
                    workingDays = daysWorked;
                    basicSalary = baseSalaryRate * daysWorked;
                }
            } else if (salaryType === 'weekly') {
                const weeksWorked = periodType === 'weekly'
                    ? (attendedDays > 0 ? 1 : 0)
                    : await weeksWorkedInMonth(client, emp.id, year, month);
                workingDays = daysWorked;
                basicSalary = baseSalaryRate * weeksWorked;
                emp._weeksWorked = weeksWorked;
            } else {
                workingDays = totalWorkingDays;
                basicSalary = baseSalaryRate;
            }

            const overtime = await sumEmployeeOvertime(client, emp.id, rangeStart, rangeEnd, parseFloat(emp.overtime_rate) || 50000);
            const overtimeHours = overtime.hours;
            const overtimeAmount = overtime.amount;

            // Calculate driver allowances
            let driverSubuhDays = 0, driverSubuhAmount = 0;
            let driverRitTotal = 0, driverRitAmount = 0;
            let driverOvernightDays = 0, driverOvernightAmount = 0;
            let driverExtraRitDekat = 0, driverRitaseDekatAmount = 0;
            let driverExtraRitJauh = 0, driverRitaseJauhAmount = 0;
            let driverRitaseAmount = 0; // Total
            let driverTotalAllowance = 0;
            let tuangAmount = 0;
            let tuangDays = 0;

            if (emp.is_driver) {
                const driverResult = await client.query(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN is_subuh THEN 1 ELSE 0 END), 0) as total_subuh,
                        COALESCE(SUM(rit_count), 0) as total_rit,
                        COALESCE(SUM(CASE WHEN is_overnight THEN 1 ELSE 0 END), 0) as total_overnight,
                        COALESCE(SUM(ritase_dekat), 0) as extra_rit_dekat,
                        COALESCE(SUM(ritase_jauh), 0) as extra_rit_jauh
                    FROM driver_activities
                    WHERE user_id = $1
                      AND activity_date >= $2::date
                      AND activity_date < $3::date
                `, [emp.id, rangeStart, rangeEnd]);

                driverSubuhDays = parseInt(driverResult.rows[0].total_subuh);
                driverRitTotal = parseInt(driverResult.rows[0].total_rit);
                driverOvernightDays = parseInt(driverResult.rows[0].total_overnight);
                driverExtraRitDekat = parseInt(driverResult.rows[0].extra_rit_dekat);
                driverExtraRitJauh = parseInt(driverResult.rows[0].extra_rit_jauh);

                driverSubuhAmount = driverSubuhDays * parseFloat(emp.driver_subuh_allowance);
                driverRitAmount = driverRitTotal * parseFloat(emp.driver_rit_allowance);
                driverOvernightAmount = driverOvernightDays * parseFloat(emp.driver_inap_allowance);
                driverRitaseDekatAmount = driverExtraRitDekat * parseFloat(emp.driver_ritase_dekat_allowance);
                driverRitaseJauhAmount = driverExtraRitJauh * parseFloat(emp.driver_ritase_jauh_allowance);
                driverRitaseAmount = driverRitaseDekatAmount + driverRitaseJauhAmount;
                driverTotalAllowance = driverSubuhAmount + driverRitAmount + driverOvernightAmount + driverRitaseAmount;
            }

            const tuangResult = await client.query(`
                SELECT COALESCE(SUM(amount), 0) as total_amount,
                       COUNT(*) FILTER (WHERE amount > 0) as total_days
                FROM production_tuang
                WHERE user_id = $1
                  AND tuang_date >= $2::date
                  AND tuang_date < $3::date
            `, [emp.id, rangeStart, rangeEnd]);
            tuangAmount = parseFloat(tuangResult.rows[0].total_amount) || 0;
            tuangDays = parseInt(tuangResult.rows[0].total_days, 10) || 0;

            // Calculate BPJS (using rates from bpjs_settings + per-employee overrides)
            const bpjsBase = basicSalary; // effective monthly amount

            // Helper: get rate (employee override > default from bpjs_settings > fallback)
            function getRate(overrideRate, settingsCode, rateType, fallback) {
                if (overrideRate != null) return parseFloat(overrideRate);
                if (defaultRates[settingsCode]) return parseFloat(defaultRates[settingsCode][rateType]);
                return fallback;
            }

            // Apply max salary base cap if configured
            function getBpjsBase(settingsCode) {
                const maxBase = defaultRates[settingsCode]?.max_salary_base;
                if (maxBase && parseFloat(maxBase) > 0) {
                    return Math.min(bpjsBase, parseFloat(maxBase));
                }
                return bpjsBase;
            }

            const bpjsKesBase = getBpjsBase('BPJS_KES');
            const bpjsKesEmployee = emp.bpjs_kes_enrolled ? bpjsKesBase * getRate(emp.bpjs_kes_employee_rate, 'BPJS_KES', 'employee_rate', 0.01) : 0;
            const bpjsKesCompany = emp.bpjs_kes_enrolled ? bpjsKesBase * getRate(emp.bpjs_kes_company_rate, 'BPJS_KES', 'company_rate', 0.04) : 0;

            const bpjsJhtBase = getBpjsBase('BPJS_JHT');
            const bpjsJhtEmployee = emp.bpjs_jht_enrolled ? bpjsJhtBase * getRate(emp.bpjs_jht_employee_rate, 'BPJS_JHT', 'employee_rate', 0.02) : 0;
            const bpjsJhtCompany = emp.bpjs_jht_enrolled ? bpjsJhtBase * getRate(emp.bpjs_jht_company_rate, 'BPJS_JHT', 'company_rate', 0.037) : 0;

            const bpjsJpBase = getBpjsBase('BPJS_JP');
            const bpjsJpEmployee = emp.bpjs_jp_enrolled ? bpjsJpBase * getRate(emp.bpjs_jp_employee_rate, 'BPJS_JP', 'employee_rate', 0.01) : 0;
            const bpjsJpCompany = emp.bpjs_jp_enrolled ? bpjsJpBase * getRate(emp.bpjs_jp_company_rate, 'BPJS_JP', 'company_rate', 0.02) : 0;

            const bpjsJkk = emp.bpjs_jkk_enrolled ? bpjsBase * getRate(emp.bpjs_jkk_rate, 'BPJS_JKK', 'company_rate', 0.0024) : 0;
            const bpjsJkm = emp.bpjs_jkm_enrolled ? bpjsBase * getRate(emp.bpjs_jkm_rate, 'BPJS_JKM', 'company_rate', 0.003) : 0;

            // Gross income (including driver allowances)
            const grossIncome = basicSalary + transportAllowance + mealAllowance + appreciationAllowance + overtimeAmount + driverTotalAllowance + tuangAmount;

            // Calculate PPh 21 (monthly) - only if enabled for this employee
            let monthlyPPh = 0;
            if (emp.pph21_enabled) {
                const periodsInYear = periodType === 'weekly' ? 52 : 12;
                const annualGross = grossIncome * periodsInYear;
                const annualBpjsDeduction = (bpjsJhtEmployee + bpjsJpEmployee) * periodsInYear;
                const ptkp = getPTKP(emp.tax_status);
                const annualTaxableIncome = annualGross - annualBpjsDeduction - ptkp;
                const annualPPh = calculatePPh21(annualTaxableIncome);
                monthlyPPh = Math.round(annualPPh / periodsInYear);
            }

            // Weekly loans are charged once per week worked in this payroll month.
            const activeLoans = await client.query(`
                SELECT installment_amount, installment_period, remaining_balance
                FROM employee_loans
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at ASC
            `, [emp.id]);
            const hasWeeklyLoan = activeLoans.rows.some((loan) => loan.installment_period === 'weekly');
            const weeklyPeriods = periodType === 'weekly'
                ? 1
                : (hasWeeklyLoan ? (emp._weeksWorked || await weeksWorkedInMonth(client, emp.id, year, month)) : 1);
            const loanDeduction = activeLoans.rows.reduce((sum, loan) => {
                return sum + loanChargeForPeriod(loan, weeklyPeriods).amount;
            }, 0);

            // Total deductions
            // Calculate late deduction
            // Hierarchy: Custom rule per position -> Global lateConfig fallback
            const effectiveLate = { ...lateConfig };
            if (emp.use_custom_late_deduction) {
                effectiveLate.enabled = emp.pos_late_enabled !== false;
                if (emp.pos_late_mode) effectiveLate.mode = emp.pos_late_mode;
                effectiveLate.ratePerMinute = parseFloat(emp.pos_late_rate_per_minute) || 0;
                effectiveLate.ratePerHour = parseFloat(emp.pos_late_rate_per_hour) || 0;
                if (emp.pos_late_hour_round) effectiveLate.hourRound = emp.pos_late_hour_round;
                if (emp.pos_late_grace_minutes !== null && emp.pos_late_grace_minutes !== undefined) {
                    effectiveLate.graceMinutes = parseInt(emp.pos_late_grace_minutes, 10) || 0;
                }
                if (emp.pos_late_deduct_grace !== null && emp.pos_late_deduct_grace !== undefined) {
                    effectiveLate.deductGrace = emp.pos_late_deduct_grace === true;
                }
            }

            let totalEmpLateMinutes = 0;
            let totalEmpLateDeduction = 0;

            // Calculate if enabled either globally or via position custom rule
            if (effectiveLate.enabled) {
                const lateRecords = await client.query(`
                    SELECT DISTINCT ON (DATE(ar.recorded_at))
                        DATE(ar.recorded_at) as work_date,
                        TO_CHAR(ar.recorded_at, 'HH24:MI:SS') as check_in_time,
                        COALESCE(esa_ws.start_time::text, dept_ws.start_time::text, def_ws.start_time::text, $4::text) as scheduled_start_time,
                        COALESCE(esa_ws.is_overnight, dept_ws.is_overnight, def_ws.is_overnight, false) as is_overnight,
                        CASE WHEN lr.id IS NOT NULL THEN true ELSE false END as has_approved_late_leave
                    FROM attendance_records ar
                    LEFT JOIN LATERAL (
                        SELECT ws.start_time, ws.is_overnight
                        FROM employee_shift_assignments esa
                        JOIN work_shifts ws ON ws.id = esa.shift_id
                        WHERE esa.user_id = ar.user_id AND esa.assignment_date = DATE(ar.recorded_at)
                        LIMIT 1
                    ) esa_ws ON true
                    LEFT JOIN LATERAL (
                        SELECT ws.start_time, ws.is_overnight
                        FROM employee_details ed
                        LEFT JOIN departments d ON d.name = ed.department
                        LEFT JOIN positions pos ON pos.name = ed.position
                        JOIN work_schedule_types wst ON wst.is_active = TRUE
                          AND (
                            wst.department_id = d.id
                            OR wst.position_id = pos.id
                            OR EXISTS (SELECT 1 FROM work_schedule_departments wsd WHERE wsd.schedule_type_id = wst.id AND wsd.department_id = d.id)
                            OR EXISTS (SELECT 1 FROM work_schedule_positions wsp WHERE wsp.schedule_type_id = wst.id AND wsp.position_id = pos.id)
                          )
                        JOIN work_shifts ws ON ws.schedule_type_id = wst.id
                        WHERE ed.user_id = ar.user_id
                        ORDER BY ws.shift_order ASC
                        LIMIT 1
                    ) dept_ws ON true
                    LEFT JOIN LATERAL (
                        SELECT ws.start_time, ws.is_overnight
                        FROM work_schedule_types wst
                        JOIN work_shifts ws ON ws.schedule_type_id = wst.id
                        WHERE wst.is_active = TRUE AND wst.is_default = TRUE
                        ORDER BY ws.shift_order ASC
                        LIMIT 1
                    ) def_ws ON true
                    LEFT JOIN LATERAL (
                        SELECT id
                        FROM leave_requests
                        WHERE user_id = ar.user_id
                          AND type = 'late'
                          AND status = 'approved'
                          AND DATE(ar.recorded_at) BETWEEN start_date AND end_date
                        LIMIT 1
                    ) lr ON true
                    WHERE ar.user_id = $1
                      AND ar.type = 'check_in'
                      AND ar.recorded_at >= $2::date
                      AND ar.recorded_at < $3::date
                    ORDER BY DATE(ar.recorded_at), ar.recorded_at ASC
                `, [emp.id, rangeStart, rangeEnd, lateConfig.fallbackStart]);

                for (const att of lateRecords.rows) {
                    if (att.has_approved_late_leave && effectiveLate.exemptApprovedLeave) {
                        continue;
                    }
                    const ciTime = att.check_in_time || '00:00:00';
                    const schedTime = att.scheduled_start_time || effectiveLate.fallbackStart;

                    const [ciH, ciM, ciS] = ciTime.split(':').map(Number);
                    const [shH, shM, shS] = schedTime.split(':').map(Number);

                    let ciMins = (ciH || 0) * 60 + (ciM || 0) + ((ciS || 0) / 60);
                    let shMins = (shH || 0) * 60 + (shM || 0) + ((shS || 0) / 60);

                    if (att.is_overnight && ciMins < shMins && ciMins < 720) {
                        ciMins += 1440;
                    }

                    const rawLateMins = Math.floor(ciMins - shMins);
                    if (rawLateMins > effectiveLate.graceMinutes) {
                        const chargedMins = effectiveLate.deductGrace ? (rawLateMins - effectiveLate.graceMinutes) : rawLateMins;
                        totalEmpLateMinutes += chargedMins;

                        if (effectiveLate.mode === 'per_hour' && effectiveLate.hourRound === 'round_up_daily') {
                            const dayHours = Math.ceil(chargedMins / 60);
                            totalEmpLateDeduction += dayHours * effectiveLate.ratePerHour;
                        }
                    }
                }

                if (effectiveLate.mode === 'per_minute') {
                    totalEmpLateDeduction = Math.round(totalEmpLateMinutes * effectiveLate.ratePerMinute);
                } else if (effectiveLate.mode === 'per_hour' && effectiveLate.hourRound !== 'round_up_daily') {
                    if (effectiveLate.hourRound === 'round_up') {
                        const totalHours = Math.ceil(totalEmpLateMinutes / 60);
                        totalEmpLateDeduction = Math.round(totalHours * effectiveLate.ratePerHour);
                    } else if (effectiveLate.hourRound === 'prorated') {
                        const totalHours = totalEmpLateMinutes / 60;
                        totalEmpLateDeduction = Math.round(totalHours * effectiveLate.ratePerHour);
                    } else if (effectiveLate.hourRound === 'exact_hour') {
                        const totalHours = Math.floor(totalEmpLateMinutes / 60);
                        totalEmpLateDeduction = Math.round(totalHours * effectiveLate.ratePerHour);
                    }
                }
            }

            // Total deductions
            const totalDeductions = bpjsKesEmployee + bpjsJhtEmployee + bpjsJpEmployee + monthlyPPh + loanDeduction + totalEmpLateDeduction;

            // Net salary
            const netSalary = grossIncome - totalDeductions;

            // Insert payroll item
            await client.query(`
                INSERT INTO payroll_items (
                    payroll_run_id, user_id, basic_salary, transport_allowance, meal_allowance,
                    overtime_hours, overtime_amount,
                    bpjs_kes_employee, bpjs_kes_company, bpjs_jht_employee, bpjs_jht_company,
                    bpjs_jp_employee, bpjs_jp_company, bpjs_jkk, bpjs_jkm,
                    gross_income, pph21_amount, loan_deduction, total_deductions, net_salary,
                    salary_type, working_days,
                    driver_subuh_days, driver_subuh_amount, driver_rit_total, driver_rit_amount,
                    driver_overnight_days, driver_overnight_amount, driver_total_allowance,
                    driver_extra_rit_dekat, driver_extra_rit_jauh, driver_ritase_dekat_amount, driver_ritase_jauh_amount,
                    tuang_amount, tuang_days, appreciation_allowance,
                    late_minutes, late_deduction
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
            `, [
                payrollRunId, emp.id, basicSalary, transportAllowance, mealAllowance,
                overtimeHours, overtimeAmount,
                bpjsKesEmployee, bpjsKesCompany, bpjsJhtEmployee, bpjsJhtCompany,
                bpjsJpEmployee, bpjsJpCompany, bpjsJkk, bpjsJkm,
                grossIncome, monthlyPPh, loanDeduction, totalDeductions, netSalary,
                salaryType, workingDays,
                driverSubuhDays, driverSubuhAmount, driverRitTotal, driverRitAmount,
                driverOvernightDays, driverOvernightAmount, driverTotalAllowance,
                driverExtraRitDekat, driverExtraRitJauh, driverRitaseDekatAmount, driverRitaseJauhAmount,
                tuangAmount, tuangDays, appreciationAllowance,
                totalEmpLateMinutes, totalEmpLateDeduction
            ]);
        }

        await client.query('COMMIT');

        // Return the created payroll
        const result = await pool.query(`
            SELECT pr.*,
                   to_char(pr.week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(pr.week_end, 'YYYY-MM-DD') AS week_end,
                   (SELECT COUNT(*) FROM payroll_items WHERE payroll_run_id = pr.id) as employee_count,
                   (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_items WHERE payroll_run_id = pr.id) as total_net_salary
            FROM payroll_runs pr WHERE pr.id = $1
        `, [payrollRunId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Generate payroll error:', error);
        res.status(500).json({ error: error.message || 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Finalize payroll (also process loan deductions)
router.put('/:id/finalize', authenticateToken, canManagePayroll, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        const runResult = await client.query('SELECT * FROM payroll_runs WHERE id = $1 FOR UPDATE', [id]);
        if (runResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        }
        if (runResult.rows[0].status === 'finalized') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Payroll sudah difinalisasi' });
        }

        // Process loan deductions for each employee
        const items = await client.query(
            'SELECT user_id, id as item_id, loan_deduction FROM payroll_items WHERE payroll_run_id = $1 AND loan_deduction > 0',
            [id]
        );

        const run = runResult.rows[0];
        for (const item of items.rows) {
            // Get active loans for this employee
            const loans = await client.query(
                "SELECT * FROM employee_loans WHERE user_id = $1 AND status = 'active' ORDER BY created_at ASC",
                [item.user_id]
            );
            const weeklyPeriods = run.period_type === 'weekly'
                ? 1
                : await weeksWorkedInMonth(client, item.user_id, run.period_year, run.period_month);

            let remainingDeduction = parseFloat(item.loan_deduction);
            for (const loan of loans.rows) {
                if (remainingDeduction <= 0) break;
                const due = loanChargeForPeriod(loan, weeklyPeriods);
                const payAmount = Math.min(remainingDeduction, due.amount);
                if (payAmount <= 0) continue;
                const installment = parseFloat(loan.installment_amount) || 0;
                const periodsCovered = installment > 0
                    ? Math.min(due.periods, Math.max(1, Math.round(payAmount / installment)))
                    : 1;

                // Record payment
                await client.query(`
                    INSERT INTO loan_payments (loan_id, payment_date, amount, payment_method, payroll_item_id) 
                    VALUES ($1, CURRENT_DATE, $2, 'payroll_deduction', $3)
                `, [loan.id, payAmount, item.item_id]);

                // Update loan balance
                const newBalance = parseFloat(loan.remaining_balance) - payAmount;
                const newPaid = newBalance <= 0
                    ? parseInt(loan.total_installments, 10)
                    : Math.min(parseInt(loan.total_installments, 10), parseInt(loan.paid_installments, 10) + periodsCovered);
                const newStatus = newBalance <= 0 ? 'paid_off' : 'active';
                await client.query(
                    'UPDATE employee_loans SET remaining_balance=$1, paid_installments=$2, status=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4',
                    [Math.max(0, newBalance), newPaid, newStatus, loan.id]
                );

                remainingDeduction -= payAmount;
            }
        }

        // Finalize
        await client.query(
            "UPDATE payroll_runs SET status = 'finalized', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Payroll berhasil difinalisasi' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Finalize payroll error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Get slip gaji
router.get('/:id/slip/:userId', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;

        // Allow admin or the employee themselves
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        const result = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   pr.period_month, pr.period_year, pr.period_type,
                   to_char(pr.week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(pr.week_end, 'YYYY-MM-DD') AS week_end,
                   ed.department, ed.position, ed.bank_name, ed.bank_account
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1 AND pi.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Slip gaji tidak ditemukan' });
        }

        const slip = result.rows[0];
        const layout = await resolvePayslipLayout(pool, slip.user_id, slip.department);
        res.json({
            ...slip,
            payslip_layout: {
                hide_zero: layout.hide_zero,
                fields: layout.fields,
                source: layout.source,
                department: layout.department,
            },
        });
    } catch (error) {
        console.error('Get slip error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete payroll run (draft or finalized). Reverse loan deductions tied to this run.
router.delete('/:id', authenticateToken, canManagePayroll, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        const check = await client.query(
            'SELECT id, status FROM payroll_runs WHERE id = $1 FOR UPDATE',
            [id]
        );
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        }

        const payments = await client.query(`
            SELECT lp.id, lp.loan_id, lp.amount
            FROM loan_payments lp
            JOIN payroll_items pi ON lp.payroll_item_id = pi.id
            WHERE pi.payroll_run_id = $1
            ORDER BY lp.id DESC
        `, [id]);

        for (const payment of payments.rows) {
            const loanResult = await client.query(
                'SELECT * FROM employee_loans WHERE id = $1 FOR UPDATE',
                [payment.loan_id]
            );
            if (loanResult.rows.length > 0) {
                const loan = loanResult.rows[0];
                const newBalance = parseFloat(loan.remaining_balance) + parseFloat(payment.amount);
                const newPaid = Math.max(0, parseInt(loan.paid_installments, 10) - 1);
                let newStatus = loan.status;
                if (loan.status !== 'cancelled') {
                    newStatus = newBalance > 0 ? 'active' : 'paid_off';
                }
                await client.query(
                    'UPDATE employee_loans SET remaining_balance=$1, paid_installments=$2, status=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4',
                    [newBalance, newPaid, newStatus, loan.id]
                );
            }
            await client.query('DELETE FROM loan_payments WHERE id = $1', [payment.id]);
        }

        await client.query('DELETE FROM payroll_runs WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.json({ message: 'Payroll berhasil dihapus' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete payroll error:', error);
        res.status(500).json({ error: error.message || 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// ============================================
// EXPORT ENDPOINTS - PDF & Excel
// ============================================

const monthNamesID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function fmtCurrency(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
}

// Export Payroll Report as PDF
router.get('/:id/export/pdf', authenticateToken, canManagePayroll, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
        if (runResult.rows.length === 0) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        const run = runResult.rows[0];

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   ed.department, ed.position, ed.bank_name, ed.bank_account
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1
            ORDER BY u.name ASC
        `, [id]);

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payroll-${run.period_year}-${run.period_month}.pdf`);
        doc.pipe(res);

        // Title
        doc.fontSize(16).font('Helvetica-Bold').text('LAPORAN PAYROLL', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text(`Periode: ${formatPayrollPeriod(run)}`, { align: 'center' });
        doc.fontSize(9).text(`Status: ${run.status === 'finalized' ? 'Final' : 'Draft'}`, { align: 'center' });
        doc.moveDown(1);

        // Table columns
        const cols = [
            { x: 30, w: 25, label: 'No' },
            { x: 55, w: 90, label: 'Nama Karyawan' },
            { x: 145, w: 65, label: 'Bank' },
            { x: 210, w: 75, label: 'No. Rekening' },
            { x: 285, w: 65, label: 'Gaji Pokok' },
            { x: 350, w: 55, label: 'Tunjangan' },
            { x: 405, w: 45, label: 'Jam Lembur' },
            { x: 450, w: 55, label: 'Nilai Lembur' },
            { x: 505, w: 60, label: 'Gross' },
            { x: 565, w: 55, label: 'BPJS' },
            { x: 620, w: 55, label: 'PPh 21' },
            { x: 670, w: 48, label: 'Pot.Telat' },
            { x: 720, w: 50, label: 'Pot.Pinjam' },
            { x: 772, w: 55, label: 'Gaji Bersih' },
        ];

        // Header
        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(7);
        cols.forEach(c => doc.text(c.label, c.x, y, { width: c.w, align: c.x > 250 ? 'right' : 'left' }));
        y += 14;
        doc.moveTo(30, y).lineTo(795, y).stroke();
        y += 5;

        // Rows
        doc.font('Helvetica').fontSize(7);
        let totalBasic = 0, totalTunj = 0, totalOT = 0, totalGross = 0, totalBPJS = 0, totalPPh = 0, totalLate = 0, totalLoan = 0, totalNet = 0;

        itemsResult.rows.forEach((item, idx) => {
            if (y > 530) { doc.addPage(); y = 30; }
            const bpjs = parseFloat(item.bpjs_kes_employee) + parseFloat(item.bpjs_jht_employee) + parseFloat(item.bpjs_jp_employee);
            const tunj = parseFloat(item.transport_allowance) + parseFloat(item.meal_allowance) + parseFloat(item.appreciation_allowance || 0);

            doc.text(String(idx + 1), cols[0].x, y, { width: cols[0].w });
            doc.text(item.user_name, cols[1].x, y, { width: cols[1].w });
            doc.text(item.bank_name || '-', cols[2].x, y, { width: cols[2].w });
            doc.text(item.bank_account || '-', cols[3].x, y, { width: cols[3].w });
            doc.text(fmtCurrency(item.basic_salary), cols[4].x, y, { width: cols[4].w, align: 'right' });
            doc.text(fmtCurrency(tunj), cols[5].x, y, { width: cols[5].w, align: 'right' });
            doc.text(item.overtime_hours + ' jam', cols[6].x, y, { width: cols[6].w, align: 'right' });
            doc.text(fmtCurrency(item.overtime_amount), cols[7].x, y, { width: cols[7].w, align: 'right' });
            doc.text(fmtCurrency(item.gross_income), cols[8].x, y, { width: cols[8].w, align: 'right' });
            doc.text(fmtCurrency(bpjs), cols[9].x, y, { width: cols[9].w, align: 'right' });
            doc.text(fmtCurrency(item.pph21_amount), cols[10].x, y, { width: cols[10].w, align: 'right' });
            doc.text(fmtCurrency(item.late_deduction), cols[11].x, y, { width: cols[11].w, align: 'right' });
            doc.text(fmtCurrency(item.loan_deduction), cols[12].x, y, { width: cols[12].w, align: 'right' });
            doc.text(fmtCurrency(item.net_salary), cols[13].x, y, { width: cols[13].w, align: 'right' });

            totalBasic += parseFloat(item.basic_salary);
            totalTunj += tunj;
            totalOT += parseFloat(item.overtime_amount);
            totalGross += parseFloat(item.gross_income);
            totalBPJS += bpjs;
            totalPPh += parseFloat(item.pph21_amount);
            totalLate += parseFloat(item.late_deduction || 0);
            totalLoan += parseFloat(item.loan_deduction);
            totalNet += parseFloat(item.net_salary);
            y += 16;
        });

        // Total row
        y += 5;
        doc.moveTo(30, y).lineTo(795, y).stroke();
        y += 5;
        doc.font('Helvetica-Bold').fontSize(7);
        doc.text('TOTAL', cols[1].x, y, { width: cols[1].w });
        doc.text(fmtCurrency(totalBasic), cols[4].x, y, { width: cols[4].w, align: 'right' });
        doc.text(fmtCurrency(totalTunj), cols[5].x, y, { width: cols[5].w, align: 'right' });
        doc.text('', cols[6].x, y, { width: cols[6].w, align: 'right' });
        doc.text(fmtCurrency(totalOT), cols[7].x, y, { width: cols[7].w, align: 'right' });
        doc.text(fmtCurrency(totalGross), cols[8].x, y, { width: cols[8].w, align: 'right' });
        doc.text(fmtCurrency(totalBPJS), cols[9].x, y, { width: cols[9].w, align: 'right' });
        doc.text(fmtCurrency(totalPPh), cols[10].x, y, { width: cols[10].w, align: 'right' });
        doc.text(fmtCurrency(totalLate), cols[11].x, y, { width: cols[11].w, align: 'right' });
        doc.text(fmtCurrency(totalLoan), cols[12].x, y, { width: cols[12].w, align: 'right' });
        doc.text(fmtCurrency(totalNet), cols[13].x, y, { width: cols[13].w, align: 'right' });

        doc.fontSize(7).font('Helvetica').text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 30, 560);
        doc.end();
    } catch (error) {
        console.error('Export payroll PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Payroll Report as Excel
router.get('/:id/export/excel', authenticateToken, canManagePayroll, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
        if (runResult.rows.length === 0) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        const run = runResult.rows[0];

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   ed.department, ed.position, ed.bank_name, ed.bank_account
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1
            ORDER BY u.name ASC
        `, [id]);

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Payroll');

        // Title
        ws.mergeCells('A1:S1');
        ws.getCell('A1').value = 'LAPORAN PAYROLL';
        ws.getCell('A1').font = { bold: true, size: 16 };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:S2');
        ws.getCell('A2').value = `Periode: ${formatPayrollPeriod(run)} | Status: ${run.status === 'finalized' ? 'Final' : 'Draft'}`;
        ws.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        const headers = ['No', 'ID', 'Nama', 'Departemen', 'Nama Bank', 'No. Rekening', 'Gaji Pokok', 'T. Transport', 'T. Makan', 'T. Apresiasi', 'Jam Lembur', 'Nilai Lembur', 'Tuang', 'Gross', 'BPJS (Karyawan)', 'PPh 21', 'Pot. Telat', 'Pot. Pinjaman', 'Gaji Bersih'];
        ws.getRow(4).values = headers;
        ws.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

        // Data
        let totalNet = 0;
        itemsResult.rows.forEach((item, idx) => {
            const bpjsEmp = parseFloat(item.bpjs_kes_employee) + parseFloat(item.bpjs_jht_employee) + parseFloat(item.bpjs_jp_employee);
            totalNet += parseFloat(item.net_salary);
            ws.addRow([
                idx + 1,
                item.employee_id,
                item.user_name,
                item.department || '-',
                item.bank_name || '-',
                item.bank_account || '-',
                parseFloat(item.basic_salary),
                parseFloat(item.transport_allowance),
                parseFloat(item.meal_allowance),
                parseFloat(item.appreciation_allowance || 0),
                parseFloat(item.overtime_hours),
                parseFloat(item.overtime_amount),
                parseFloat(item.tuang_amount || 0),
                parseFloat(item.gross_income),
                bpjsEmp,
                parseFloat(item.pph21_amount),
                parseFloat(item.late_deduction || 0),
                parseFloat(item.loan_deduction),
                parseFloat(item.net_salary)
            ]);
        });

        // Total row
        const totalRow = ws.addRow(['', '', 'TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', totalNet]);
        totalRow.font = { bold: true };
        totalRow.getCell(19).numFmt = '#,##0';

        // Format currency columns
        for (let col = 7; col <= 19; col++) {
            if (col === 11) {
                // Jam Lembur
                ws.getColumn(col).numFmt = '0';
                ws.getColumn(col).width = 12;
            } else {
                ws.getColumn(col).numFmt = '#,##0';
                ws.getColumn(col).width = 16;
            }
        }
        ws.getColumn(1).width = 5;
        ws.getColumn(2).width = 12;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 15;
        ws.getColumn(5).width = 18;
        ws.getColumn(6).width = 20;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=payroll-${run.period_year}-${run.period_month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export payroll Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

// Export Slip Gaji as PDF
router.get('/:id/slip/:userId/pdf', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        const result = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   pr.period_month, pr.period_year, pr.period_type,
                   to_char(pr.week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(pr.week_end, 'YYYY-MM-DD') AS week_end,
                   ed.department, ed.position, ed.bank_name, ed.bank_account, ed.npwp
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1 AND pi.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Slip gaji tidak ditemukan' });
        const slip = result.rows[0];
        const logoFile = await getPayslipLogoFile();
        const sections = await payslipSectionsFor(slip);

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=slip-gaji-${slip.employee_id}-${slip.period_year}-${slip.period_month}.pdf`);
        doc.pipe(res);

        // Header
        if (logoFile) {
            const fitW = 150;
            const fitH = 58;
            const startY = doc.y;
            doc.image(logoFile, (doc.page.width - fitW) / 2, startY, { fit: [fitW, fitH], align: 'center', valign: 'center' });
            doc.y = startY + fitH + 10;
        }
        doc.fontSize(18).font('Helvetica-Bold').text('SLIP GAJI', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text(`Periode: ${formatPayrollPeriod(slip)}`, { align: 'center' });
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // Employee info
        doc.fontSize(10).font('Helvetica');
        if (sections.identity.length > 0) {
            for (let i = 0; i < sections.identity.length; i += 2) {
                const y = doc.y;
                const left = sections.identity[i];
                const right = sections.identity[i + 1];
                doc.text(`${left[0].padEnd(11, ' ')}: ${left[1]}`, 50, y, { width: 240 });
                if (right) doc.text(`${right[0].padEnd(11, ' ')}: ${right[1]}`, 300, y, { width: 240 });
                doc.moveDown(0.2);
            }
            doc.moveDown(0.6);
        }
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        function addRow(label, amount, isDeduction = false, isBold = false) {
            const y = doc.y;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.text(label, 60, y, { width: 300 });
            const prefix = isDeduction ? '- ' : '';
            doc.text(prefix + fmtCurrency(amount), 360, y, { width: 180, align: 'right' });
            doc.moveDown(0.4);
        }

        if (sections.income.length > 0 || sections.showGross) {
            doc.font('Helvetica-Bold').fontSize(11).text('PENDAPATAN', 50);
            doc.moveDown(0.3);
            sections.income.forEach((line) => addRow(line.label, line.amount));
            if (sections.showGross) {
                doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
                doc.moveDown(0.3);
                addRow('Total Pendapatan', slip.gross_income, false, true);
            }
            doc.moveDown(0.5);
        }

        if (sections.deductions.length > 0 || sections.showTotalDeduct) {
            doc.font('Helvetica-Bold').fontSize(11).text('POTONGAN', 50);
            doc.moveDown(0.3);
            sections.deductions.forEach((line) => addRow(line.label, line.amount, true));
            if (sections.showTotalDeduct) {
                doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
                doc.moveDown(0.3);
                addRow('Total Potongan', slip.total_deductions, true, true);
            }
            doc.moveDown(0.5);
        }

        if (sections.company.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10).text('KONTRIBUSI PERUSAHAAN (Informasi)', 50);
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(9);
            sections.company.forEach((line) => {
                const cy = doc.y;
                doc.text(line.label, 60, cy, { width: 300 });
                doc.text(fmtCurrency(line.amount), 360, cy, { width: 180, align: 'right' });
                doc.moveDown(0.3);
            });
            doc.moveDown(0.5);
        }

        if (sections.showNet) {
            doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(2).stroke();
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(12).text('GAJI BERSIH (Take Home Pay)', { align: 'center' });
            doc.fontSize(20).text(fmtCurrency(slip.net_salary), { align: 'center' });
            doc.moveDown(0.3);
            if (sections.showBank) {
                doc.font('Helvetica').fontSize(9).text(`Transfer ke: ${slip.bank_name} - ${slip.bank_account}`, { align: 'center' });
            }
        }

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50);

        doc.end();
    } catch (error) {
        console.error('Export slip PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Slip Gaji as Excel
router.get('/:id/slip/:userId/excel', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Tidak memiliki akses' });
        }

        const result = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   pr.period_month, pr.period_year, pr.period_type,
                   to_char(pr.week_start, 'YYYY-MM-DD') AS week_start,
                   to_char(pr.week_end, 'YYYY-MM-DD') AS week_end,
                   ed.department, ed.position, ed.bank_name, ed.bank_account, ed.npwp
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1 AND pi.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Slip gaji tidak ditemukan' });
        const slip = result.rows[0];
        const sections = await payslipSectionsFor(slip);

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Slip Gaji');

        // Title
        ws.mergeCells('A1:C1');
        ws.getCell('A1').value = 'SLIP GAJI';
        ws.getCell('A1').font = { bold: true, size: 16 };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:C2');
        ws.getCell('A2').value = `Periode: ${formatPayrollPeriod(slip)}`;
        ws.getCell('A2').alignment = { horizontal: 'center' };

        let infoRow = 4;
        sections.identity.forEach(([label, text], index) => {
            ws.getCell(`A${infoRow}`).value = label;
            ws.getCell(`B${infoRow}`).value = text;
            if (index === 0) ws.getRow(infoRow).font = { bold: true };
            infoRow++;
        });

        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } } };
        const deductHeaderStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } } };
        const infoStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } } };

        let row = infoRow + 1;
        function writeMoney(label, amount, bold = false) {
            ws.getCell(`A${row}`).value = label;
            ws.getCell(`C${row}`).value = amount;
            ws.getCell(`C${row}`).numFmt = '#,##0';
            if (bold) {
                ws.getCell(`A${row}`).font = { bold: true };
                ws.getCell(`C${row}`).font = { bold: true };
            }
            row++;
        }

        if (sections.income.length > 0 || sections.showGross) {
            ws.getRow(row).values = ['PENDAPATAN', '', 'Jumlah'];
            Object.assign(ws.getCell(`A${row}`), headerStyle);
            Object.assign(ws.getCell(`B${row}`), headerStyle);
            Object.assign(ws.getCell(`C${row}`), headerStyle);
            row++;
            sections.income.forEach((line) => writeMoney(line.label, line.amount));
            if (sections.showGross) writeMoney('Total Pendapatan', parseFloat(slip.gross_income), true);
            row++;
        }

        if (sections.deductions.length > 0 || sections.showTotalDeduct) {
            ws.getRow(row).values = ['POTONGAN', '', 'Jumlah'];
            Object.assign(ws.getCell(`A${row}`), deductHeaderStyle);
            Object.assign(ws.getCell(`B${row}`), deductHeaderStyle);
            Object.assign(ws.getCell(`C${row}`), deductHeaderStyle);
            row++;
            sections.deductions.forEach((line) => writeMoney(line.label, line.amount));
            if (sections.showTotalDeduct) writeMoney('Total Potongan', parseFloat(slip.total_deductions), true);
            row++;
        }

        if (sections.company.length > 0) {
            ws.getRow(row).values = ['KONTRIBUSI PERUSAHAAN', '', 'Jumlah'];
            Object.assign(ws.getCell(`A${row}`), infoStyle);
            Object.assign(ws.getCell(`B${row}`), infoStyle);
            Object.assign(ws.getCell(`C${row}`), infoStyle);
            row++;
            sections.company.forEach((line) => writeMoney(line.label, line.amount));
            row++;
        }

        if (sections.showNet) {
            ws.getCell(`A${row}`).value = 'GAJI BERSIH (Take Home Pay)';
            ws.getCell(`A${row}`).font = { bold: true, size: 12 };
            ws.getCell(`C${row}`).value = parseFloat(slip.net_salary);
            ws.getCell(`C${row}`).numFmt = '#,##0';
            ws.getCell(`C${row}`).font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
            row++;
            if (sections.showBank) {
                ws.getCell(`A${row}`).value = `Transfer ke: ${slip.bank_name} - ${slip.bank_account}`;
            }
        }

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 25;
        ws.getColumn(3).width = 20;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=slip-gaji-${slip.employee_id}-${slip.period_year}-${slip.period_month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export slip Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

module.exports = router;

