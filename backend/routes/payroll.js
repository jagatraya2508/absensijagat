const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

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

// Get all payroll runs
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pr.*, u.name as created_by_name,
                   (SELECT COUNT(*) FROM payroll_items WHERE payroll_run_id = pr.id) as employee_count,
                   (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_items WHERE payroll_run_id = pr.id) as total_net_salary
            FROM payroll_runs pr
            LEFT JOIN users u ON pr.created_by = u.id
            ORDER BY pr.period_year DESC, pr.period_month DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get payroll runs error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get payroll run detail with items
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        }

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
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
router.post('/generate', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { month, year, notes } = req.body;
        if (!month || !year) {
            return res.status(400).json({ error: 'Bulan dan tahun harus diisi' });
        }

        await client.query('BEGIN');

        // Check if payroll already exists
        const existing = await client.query(
            'SELECT id FROM payroll_runs WHERE period_month = $1 AND period_year = $2',
            [month, year]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Payroll untuk bulan ini sudah ada. Hapus dulu jika ingin generate ulang.' });
        }

        // Create payroll run
        const runResult = await client.query(`
            INSERT INTO payroll_runs (period_month, period_year, created_by, notes)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [month, year, req.user.id, notes || null]);
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
                   COALESCE(ed.overtime_rate, 50000) as overtime_rate,
                   COALESCE(ed.tax_status, 'TK/0') as tax_status,
                   COALESCE(ed.is_driver, false) as is_driver,
                   COALESCE(ed.driver_subuh_allowance, 0) as driver_subuh_allowance,
                   COALESCE(ed.driver_rit_allowance, 0) as driver_rit_allowance,
                   COALESCE(ed.driver_inap_allowance, 0) as driver_inap_allowance,
                   COALESCE(ed.driver_ritase_allowance, 0) as driver_ritase_allowance,
                   COALESCE(ed.bpjs_kes_enrolled, true) as bpjs_kes_enrolled,
                   COALESCE(ed.bpjs_jht_enrolled, true) as bpjs_jht_enrolled,
                   COALESCE(ed.bpjs_jp_enrolled, true) as bpjs_jp_enrolled,
                   COALESCE(ed.bpjs_jkk_enrolled, true) as bpjs_jkk_enrolled,
                   COALESCE(ed.bpjs_jkm_enrolled, true) as bpjs_jkm_enrolled,
                   COALESCE(ed.pph21_enabled, true) as pph21_enabled,
                   ed.bpjs_kes_employee_rate, ed.bpjs_kes_company_rate,
                   ed.bpjs_jht_employee_rate, ed.bpjs_jht_company_rate,
                   ed.bpjs_jp_employee_rate, ed.bpjs_jp_company_rate,
                   ed.bpjs_jkk_rate, ed.bpjs_jkm_rate
            FROM users u
            LEFT JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee'
        `);

        // Calculate working days in the month (Mon-Fri)
        const daysInMonth = new Date(year, month, 0).getDate();
        let totalWorkingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay();
            if (dow !== 0 && dow !== 6) totalWorkingDays++;
        }
        const weeksInMonth = Math.ceil(daysInMonth / 7);

        for (const emp of employees.rows) {
            const salaryType = emp.salary_type || 'monthly';
            const baseSalaryRate = parseFloat(emp.basic_salary);
            const transportAllowance = parseFloat(emp.transport_allowance);
            const mealAllowance = parseFloat(emp.meal_allowance);

            // Count actual attendance (check-in days) for this employee in this month
            const attendanceResult = await client.query(`
                SELECT COUNT(DISTINCT DATE(recorded_at)) as days_worked
                FROM attendance_records
                WHERE user_id = $1
                  AND type = 'check_in'
                  AND EXTRACT(MONTH FROM recorded_at) = $2
                  AND EXTRACT(YEAR FROM recorded_at) = $3
            `, [emp.id, month, year]);
            const daysWorked = parseInt(attendanceResult.rows[0].days_worked) || totalWorkingDays;

            // Calculate working days for this employee based on salary type
            let workingDays = 0;
            let basicSalary = 0;
            if (salaryType === 'daily') {
                workingDays = daysWorked;
                basicSalary = baseSalaryRate * daysWorked;
            } else if (salaryType === 'weekly') {
                // Count weeks the employee actually worked in
                const weeksResult = await client.query(`
                    SELECT COUNT(DISTINCT EXTRACT(WEEK FROM recorded_at)) as weeks_worked
                    FROM attendance_records
                    WHERE user_id = $1
                      AND type = 'check_in'
                      AND EXTRACT(MONTH FROM recorded_at) = $2
                      AND EXTRACT(YEAR FROM recorded_at) = $3
                `, [emp.id, month, year]);
                const weeksWorked = parseInt(weeksResult.rows[0].weeks_worked) || weeksInMonth;
                workingDays = daysWorked;
                basicSalary = baseSalaryRate * weeksWorked;
            } else {
                // monthly
                workingDays = totalWorkingDays;
                basicSalary = baseSalaryRate;
            }

            // Get approved overtime for this month
            const overtimeResult = await client.query(`
                SELECT COALESCE(SUM(hours), 0) as total_hours,
                       COALESCE(SUM(total_amount), 0) as total_amount
                FROM overtime_records
                WHERE user_id = $1
                  AND EXTRACT(MONTH FROM date) = $2
                  AND EXTRACT(YEAR FROM date) = $3
                  AND status = 'approved'
            `, [emp.id, month, year]);

            const overtimeHours = parseFloat(overtimeResult.rows[0].total_hours);
            const overtimeAmount = parseFloat(overtimeResult.rows[0].total_amount);

            // Calculate driver allowances
            let driverSubuhDays = 0, driverSubuhAmount = 0;
            let driverRitTotal = 0, driverRitAmount = 0;
            let driverOvernightDays = 0, driverOvernightAmount = 0;
            let driverExtraRit = 0, driverRitaseAmount = 0;
            let driverTotalAllowance = 0;

            if (emp.is_driver) {
                const driverResult = await client.query(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN is_subuh THEN 1 ELSE 0 END), 0) as total_subuh,
                        COALESCE(SUM(rit_count), 0) as total_rit,
                        COALESCE(SUM(CASE WHEN is_overnight THEN 1 ELSE 0 END), 0) as total_overnight,
                        COALESCE(SUM(GREATEST(rit_count - 1, 0)), 0) as extra_rit
                    FROM driver_activities
                    WHERE user_id = $1
                      AND EXTRACT(MONTH FROM activity_date) = $2
                      AND EXTRACT(YEAR FROM activity_date) = $3
                `, [emp.id, month, year]);

                driverSubuhDays = parseInt(driverResult.rows[0].total_subuh);
                driverRitTotal = parseInt(driverResult.rows[0].total_rit);
                driverOvernightDays = parseInt(driverResult.rows[0].total_overnight);
                driverExtraRit = parseInt(driverResult.rows[0].extra_rit);

                driverSubuhAmount = driverSubuhDays * parseFloat(emp.driver_subuh_allowance);
                driverRitAmount = driverRitTotal * parseFloat(emp.driver_rit_allowance);
                   driverOvernightAmount = driverOvernightDays * parseFloat(emp.driver_inap_allowance);
                driverRitaseAmount = driverExtraRit * parseFloat(emp.driver_ritase_allowance);
                driverTotalAllowance = driverSubuhAmount + driverRitAmount + driverOvernightAmount + driverRitaseAmount;
            }

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
            const grossIncome = basicSalary + transportAllowance + mealAllowance + overtimeAmount + driverTotalAllowance;

            // Calculate PPh 21 (monthly) - only if enabled for this employee
            let monthlyPPh = 0;
            if (emp.pph21_enabled) {
                const annualGross = grossIncome * 12;
                const annualBpjsDeduction = (bpjsJhtEmployee + bpjsJpEmployee) * 12;
                const ptkp = getPTKP(emp.tax_status);
                const annualTaxableIncome = annualGross - annualBpjsDeduction - ptkp;
                const annualPPh = calculatePPh21(annualTaxableIncome);
                monthlyPPh = Math.round(annualPPh / 12);
            }

            // Get active loan deduction
            const loanResult = await client.query(`
                SELECT COALESCE(SUM(installment_amount), 0) as total_deduction
                FROM employee_loans
                WHERE user_id = $1 AND status = 'active'
            `, [emp.id]);
            const loanDeduction = parseFloat(loanResult.rows[0].total_deduction);

            // Total deductions
            const totalDeductions = bpjsKesEmployee + bpjsJhtEmployee + bpjsJpEmployee + monthlyPPh + loanDeduction;

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
                    driver_extra_rit, driver_ritase_amount
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
            `, [
                payrollRunId, emp.id, basicSalary, transportAllowance, mealAllowance,
                overtimeHours, overtimeAmount,
                bpjsKesEmployee, bpjsKesCompany, bpjsJhtEmployee, bpjsJhtCompany,
                bpjsJpEmployee, bpjsJpCompany, bpjsJkk, bpjsJkm,
                grossIncome, monthlyPPh, loanDeduction, totalDeductions, netSalary,
                salaryType, workingDays,
                driverSubuhDays, driverSubuhAmount, driverRitTotal, driverRitAmount,
                driverOvernightDays, driverOvernightAmount, driverTotalAllowance,
                driverExtraRit, driverRitaseAmount
            ]);
        }

        await client.query('COMMIT');

        // Return the created payroll
        const result = await pool.query(`
            SELECT pr.*,
                   (SELECT COUNT(*) FROM payroll_items WHERE payroll_run_id = pr.id) as employee_count,
                   (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_items WHERE payroll_run_id = pr.id) as total_net_salary
            FROM payroll_runs pr WHERE pr.id = $1
        `, [payrollRunId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Generate payroll error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Finalize payroll (also process loan deductions)
router.put('/:id/finalize', authenticateToken, isAdmin, async (req, res) => {
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

        for (const item of items.rows) {
            // Get active loans for this employee
            const loans = await client.query(
                "SELECT * FROM employee_loans WHERE user_id = $1 AND status = 'active' ORDER BY created_at ASC",
                [item.user_id]
            );

            let remainingDeduction = parseFloat(item.loan_deduction);
            for (const loan of loans.rows) {
                if (remainingDeduction <= 0) break;
                const payAmount = Math.min(remainingDeduction, parseFloat(loan.remaining_balance), parseFloat(loan.installment_amount));

                // Record payment
                await client.query(`
                    INSERT INTO loan_payments (loan_id, payment_date, amount, payment_method, payroll_item_id) 
                    VALUES ($1, CURRENT_DATE, $2, 'payroll_deduction', $3)
                `, [loan.id, payAmount, item.item_id]);

                // Update loan balance
                const newBalance = parseFloat(loan.remaining_balance) - payAmount;
                const newPaid = parseInt(loan.paid_installments) + 1;
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
                   pr.period_month, pr.period_year,
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get slip error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete payroll run (draft only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT status FROM payroll_runs WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        }
        if (check.rows[0].status === 'finalized') {
            return res.status(400).json({ error: 'Tidak dapat menghapus payroll yang sudah difinalisasi' });
        }

        await pool.query('DELETE FROM payroll_runs WHERE id = $1', [id]);
        res.json({ message: 'Payroll berhasil dihapus' });
    } catch (error) {
        console.error('Delete payroll error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
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
router.get('/:id/export/pdf', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
        if (runResult.rows.length === 0) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        const run = runResult.rows[0];

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   ed.department, ed.position
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
        doc.fontSize(11).font('Helvetica').text(`Periode: ${monthNamesID[run.period_month]} ${run.period_year}`, { align: 'center' });
        doc.fontSize(9).text(`Status: ${run.status === 'finalized' ? 'Final' : 'Draft'}`, { align: 'center' });
        doc.moveDown(1);

        // Table columns
        const cols = [
            { x: 30, w: 30, label: 'No' },
            { x: 60, w: 110, label: 'Nama Karyawan' },
            { x: 170, w: 75, label: 'Gaji Pokok' },
            { x: 245, w: 70, label: 'Tunjangan' },
            { x: 315, w: 60, label: 'Jam Lembur' },
            { x: 375, w: 65, label: 'Nilai Lembur' },
            { x: 440, w: 75, label: 'Gross' },
            { x: 515, w: 65, label: 'BPJS' },
            { x: 580, w: 65, label: 'PPh 21' },
            { x: 645, w: 65, label: 'Pot.Pinjaman' },
            { x: 710, w: 80, label: 'Gaji Bersih' },
        ];

        // Header
        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(7);
        cols.forEach(c => doc.text(c.label, c.x, y, { width: c.w, align: c.x > 160 ? 'right' : 'left' }));
        y += 14;
        doc.moveTo(30, y).lineTo(790, y).stroke();
        y += 5;

        // Rows
        doc.font('Helvetica').fontSize(7);
        let totalBasic = 0, totalTunj = 0, totalOT = 0, totalGross = 0, totalBPJS = 0, totalPPh = 0, totalLoan = 0, totalNet = 0;

        itemsResult.rows.forEach((item, idx) => {
            if (y > 530) { doc.addPage(); y = 30; }
            const bpjs = parseFloat(item.bpjs_kes_employee) + parseFloat(item.bpjs_jht_employee) + parseFloat(item.bpjs_jp_employee);
            const tunj = parseFloat(item.transport_allowance) + parseFloat(item.meal_allowance);

            doc.text(String(idx + 1), cols[0].x, y, { width: cols[0].w });
            doc.text(item.user_name, cols[1].x, y, { width: cols[1].w });
            doc.text(fmtCurrency(item.basic_salary), cols[2].x, y, { width: cols[2].w, align: 'right' });
            doc.text(fmtCurrency(tunj), cols[3].x, y, { width: cols[3].w, align: 'right' });
            doc.text(item.overtime_hours + ' jam', cols[4].x, y, { width: cols[4].w, align: 'right' });
            doc.text(fmtCurrency(item.overtime_amount), cols[5].x, y, { width: cols[5].w, align: 'right' });
            doc.text(fmtCurrency(item.gross_income), cols[6].x, y, { width: cols[6].w, align: 'right' });
            doc.text(fmtCurrency(bpjs), cols[7].x, y, { width: cols[7].w, align: 'right' });
            doc.text(fmtCurrency(item.pph21_amount), cols[8].x, y, { width: cols[8].w, align: 'right' });
            doc.text(fmtCurrency(item.loan_deduction), cols[9].x, y, { width: cols[9].w, align: 'right' });
            doc.text(fmtCurrency(item.net_salary), cols[10].x, y, { width: cols[10].w, align: 'right' });

            totalBasic += parseFloat(item.basic_salary);
            totalTunj += tunj;
            totalOT += parseFloat(item.overtime_amount);
            totalGross += parseFloat(item.gross_income);
            totalBPJS += bpjs;
            totalPPh += parseFloat(item.pph21_amount);
            totalLoan += parseFloat(item.loan_deduction);
            totalNet += parseFloat(item.net_salary);
            y += 16;
        });

        // Total row
        y += 5;
        doc.moveTo(30, y).lineTo(790, y).stroke();
        y += 5;
        doc.font('Helvetica-Bold').fontSize(7);
        doc.text('TOTAL', cols[1].x, y, { width: cols[1].w });
        doc.text(fmtCurrency(totalBasic), cols[2].x, y, { width: cols[2].w, align: 'right' });
        doc.text(fmtCurrency(totalTunj), cols[3].x, y, { width: cols[3].w, align: 'right' });
        doc.text('', cols[4].x, y, { width: cols[4].w, align: 'right' });
        doc.text(fmtCurrency(totalOT), cols[5].x, y, { width: cols[5].w, align: 'right' });
        doc.text(fmtCurrency(totalGross), cols[6].x, y, { width: cols[6].w, align: 'right' });
        doc.text(fmtCurrency(totalBPJS), cols[7].x, y, { width: cols[7].w, align: 'right' });
        doc.text(fmtCurrency(totalPPh), cols[8].x, y, { width: cols[8].w, align: 'right' });
        doc.text(fmtCurrency(totalLoan), cols[9].x, y, { width: cols[9].w, align: 'right' });
        doc.text(fmtCurrency(totalNet), cols[10].x, y, { width: cols[10].w, align: 'right' });

        doc.fontSize(7).font('Helvetica').text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 30, 560);
        doc.end();
    } catch (error) {
        console.error('Export payroll PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Payroll Report as Excel
router.get('/:id/export/excel', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const runResult = await pool.query('SELECT * FROM payroll_runs WHERE id = $1', [id]);
        if (runResult.rows.length === 0) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
        const run = runResult.rows[0];

        const itemsResult = await pool.query(`
            SELECT pi.*, u.name as user_name, u.employee_id,
                   ed.department, ed.position
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
        ws.mergeCells('A1:L1');
        ws.getCell('A1').value = 'LAPORAN PAYROLL';
        ws.getCell('A1').font = { bold: true, size: 16 };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:L2');
        ws.getCell('A2').value = `Periode: ${monthNamesID[run.period_month]} ${run.period_year} | Status: ${run.status === 'finalized' ? 'Final' : 'Draft'}`;
        ws.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        const headers = ['No', 'ID', 'Nama', 'Departemen', 'Gaji Pokok', 'T. Transport', 'T. Makan', 'Jam Lembur', 'Nilai Lembur', 'Gross', 'BPJS (Karyawan)', 'PPh 21', 'Pot. Pinjaman', 'Gaji Bersih'];
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
                parseFloat(item.basic_salary),
                parseFloat(item.transport_allowance),
                parseFloat(item.meal_allowance),
                parseFloat(item.overtime_hours),
                parseFloat(item.overtime_amount),
                parseFloat(item.gross_income),
                bpjsEmp,
                parseFloat(item.pph21_amount),
                parseFloat(item.loan_deduction),
                parseFloat(item.net_salary)
            ]);
        });

        // Total row
        const totalRow = ws.addRow(['', '', 'TOTAL', '', '', '', '', '', '', '', '', '', '', totalNet]);
        totalRow.font = { bold: true };
        totalRow.getCell(14).numFmt = '#,##0';

        // Format currency columns
        for (let col = 5; col <= 14; col++) {
            if (col === 8) {
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
                   pr.period_month, pr.period_year,
                   ed.department, ed.position, ed.bank_name, ed.bank_account, ed.npwp
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1 AND pi.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Slip gaji tidak ditemukan' });
        const slip = result.rows[0];

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=slip-gaji-${slip.employee_id}-${slip.period_year}-${slip.period_month}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text('SLIP GAJI', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text(`Periode: ${monthNamesID[slip.period_month]} ${slip.period_year}`, { align: 'center' });
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // Employee info
        doc.fontSize(10);
        const infoY = doc.y;
        doc.text(`Nama       : ${slip.user_name}`, 50, infoY);
        doc.text(`Departemen : ${slip.department || '-'}`, 300, infoY);
        doc.text(`ID         : ${slip.employee_id}`, 50, infoY + 16);
        doc.text(`Jabatan    : ${slip.position || '-'}`, 300, infoY + 16);
        if (slip.npwp) doc.text(`NPWP       : ${slip.npwp}`, 50, infoY + 32);
        doc.moveDown(3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // Helper for row
        function addRow(label, amount, isDeduction = false, isBold = false) {
            const y = doc.y;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.text(label, 60, y, { width: 300 });
            const prefix = isDeduction ? '- ' : '';
            doc.text(prefix + fmtCurrency(amount), 360, y, { width: 180, align: 'right' });
            doc.moveDown(0.4);
        }

        // Pendapatan
        doc.font('Helvetica-Bold').fontSize(11).text('PENDAPATAN', 50);
        doc.moveDown(0.3);
        addRow('Gaji Pokok', slip.basic_salary);
        addRow('Tunjangan Transport', slip.transport_allowance);
        addRow('Tunjangan Makan', slip.meal_allowance);
        addRow(`Lembur (${slip.overtime_hours} jam)`, slip.overtime_amount);
        // Driver allowances (if any)
        if (parseFloat(slip.driver_total_allowance) > 0) {
            if (parseFloat(slip.driver_subuh_amount) > 0)
                addRow(`Uang Jalan Subuh (${slip.driver_subuh_days} hari)`, slip.driver_subuh_amount);
            if (parseFloat(slip.driver_rit_amount) > 0)
                addRow(`Uang Mel/RIT (${slip.driver_rit_total} trip)`, slip.driver_rit_amount);
            if (parseFloat(slip.driver_overnight_amount) > 0)
                addRow(`Uang Menginap (${slip.driver_overnight_days} hari)`, slip.driver_overnight_amount);
            if (parseFloat(slip.driver_ritase_amount) > 0)
                addRow(`Uang Ritase Tambahan (${slip.driver_extra_rit} trip)`, slip.driver_ritase_amount);
        }
        doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
        doc.moveDown(0.3);
        addRow('Total Pendapatan', slip.gross_income, false, true);
        doc.moveDown(0.5);

        // Potongan
        doc.font('Helvetica-Bold').fontSize(11).text('POTONGAN', 50);
        doc.moveDown(0.3);
        const bpjsBase = parseFloat(slip.basic_salary) || 1;
        function fmtPct(val) { const pct = (parseFloat(val) / bpjsBase * 100); return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2); }
        if (parseFloat(slip.bpjs_kes_employee) > 0) addRow(`BPJS Kesehatan (${fmtPct(slip.bpjs_kes_employee)}%)`, slip.bpjs_kes_employee, true);
        if (parseFloat(slip.bpjs_jht_employee) > 0) addRow(`BPJS JHT (${fmtPct(slip.bpjs_jht_employee)}%)`, slip.bpjs_jht_employee, true);
        if (parseFloat(slip.bpjs_jp_employee) > 0) addRow(`BPJS JP (${fmtPct(slip.bpjs_jp_employee)}%)`, slip.bpjs_jp_employee, true);
        if (parseFloat(slip.pph21_amount) > 0) addRow('PPh 21', slip.pph21_amount, true);
        if (parseFloat(slip.loan_deduction) > 0) addRow('Potongan Pinjaman', slip.loan_deduction, true);
        doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
        doc.moveDown(0.3);
        addRow('Total Potongan', slip.total_deductions, true, true);
        doc.moveDown(0.5);

        // Kontribusi perusahaan
        doc.font('Helvetica-Bold').fontSize(10).text('KONTRIBUSI PERUSAHAAN (Informasi)', 50);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(9);
        const compItems = [
            [parseFloat(slip.bpjs_kes_company) > 0 ? `BPJS Kesehatan (${fmtPct(slip.bpjs_kes_company)}%)` : null, slip.bpjs_kes_company],
            [parseFloat(slip.bpjs_jht_company) > 0 ? `BPJS JHT (${fmtPct(slip.bpjs_jht_company)}%)` : null, slip.bpjs_jht_company],
            [parseFloat(slip.bpjs_jp_company) > 0 ? `BPJS JP (${fmtPct(slip.bpjs_jp_company)}%)` : null, slip.bpjs_jp_company],
            [parseFloat(slip.bpjs_jkk) > 0 ? `BPJS JKK (${fmtPct(slip.bpjs_jkk)}%)` : null, slip.bpjs_jkk],
            [parseFloat(slip.bpjs_jkm) > 0 ? `BPJS JKM (${fmtPct(slip.bpjs_jkm)}%)` : null, slip.bpjs_jkm],
        ].filter(([label]) => label !== null);
        compItems.forEach(([label, val]) => {
            const cy = doc.y;
            doc.text(label, 60, cy, { width: 300 });
            doc.text(fmtCurrency(val), 360, cy, { width: 180, align: 'right' });
            doc.moveDown(0.3);
        });
        doc.moveDown(0.5);

        // Net salary box
        doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(2).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12).text('GAJI BERSIH (Take Home Pay)', { align: 'center' });
        doc.fontSize(20).text(fmtCurrency(slip.net_salary), { align: 'center' });
        doc.moveDown(0.3);
        if (slip.bank_name) {
            doc.font('Helvetica').fontSize(9).text(`Transfer ke: ${slip.bank_name} - ${slip.bank_account}`, { align: 'center' });
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
                   pr.period_month, pr.period_year,
                   ed.department, ed.position, ed.bank_name, ed.bank_account, ed.npwp
            FROM payroll_items pi
            JOIN users u ON pi.user_id = u.id
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            LEFT JOIN employee_details ed ON pi.user_id = ed.user_id
            WHERE pi.payroll_run_id = $1 AND pi.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Slip gaji tidak ditemukan' });
        const slip = result.rows[0];

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Slip Gaji');

        // Title
        ws.mergeCells('A1:C1');
        ws.getCell('A1').value = 'SLIP GAJI';
        ws.getCell('A1').font = { bold: true, size: 16 };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:C2');
        ws.getCell('A2').value = `Periode: ${monthNamesID[slip.period_month]} ${slip.period_year}`;
        ws.getCell('A2').alignment = { horizontal: 'center' };

        // Employee info
        ws.getCell('A4').value = 'Nama'; ws.getCell('B4').value = slip.user_name;
        ws.getCell('A5').value = 'ID Karyawan'; ws.getCell('B5').value = slip.employee_id;
        ws.getCell('A6').value = 'Departemen'; ws.getCell('B6').value = slip.department || '-';
        ws.getCell('A7').value = 'Jabatan'; ws.getCell('B7').value = slip.position || '-';
        ws.getRow(4).font = { bold: true };

        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } } };
        const deductHeaderStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } } };

        // Pendapatan
        let row = 9;
        ws.getRow(row).values = ['PENDAPATAN', '', 'Jumlah'];
        Object.assign(ws.getCell(`A${row}`), headerStyle);
        Object.assign(ws.getCell(`B${row}`), headerStyle);
        Object.assign(ws.getCell(`C${row}`), headerStyle);
        row++;

        const incomeItems = [
            ['Gaji Pokok', parseFloat(slip.basic_salary)],
            ['Tunjangan Transport', parseFloat(slip.transport_allowance)],
            ['Tunjangan Makan', parseFloat(slip.meal_allowance)],
            [`Lembur (${slip.overtime_hours} jam)`, parseFloat(slip.overtime_amount)],
        ];
        incomeItems.forEach(([label, val]) => {
            ws.getCell(`A${row}`).value = label;
            ws.getCell(`C${row}`).value = val;
            ws.getCell(`C${row}`).numFmt = '#,##0';
            row++;
        });
        ws.getCell(`A${row}`).value = 'Total Pendapatan';
        ws.getCell(`A${row}`).font = { bold: true };
        ws.getCell(`C${row}`).value = parseFloat(slip.gross_income);
        ws.getCell(`C${row}`).numFmt = '#,##0';
        ws.getCell(`C${row}`).font = { bold: true };
        row += 2;

        // Potongan
        ws.getRow(row).values = ['POTONGAN', '', 'Jumlah'];
        Object.assign(ws.getCell(`A${row}`), deductHeaderStyle);
        Object.assign(ws.getCell(`B${row}`), deductHeaderStyle);
        Object.assign(ws.getCell(`C${row}`), deductHeaderStyle);
        row++;

        const deductItems = [];
        const excelBpjsBase = parseFloat(slip.basic_salary) || 1;
        function excelFmtPct(val) { const pct = (parseFloat(val) / excelBpjsBase * 100); return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2); }
        if (parseFloat(slip.bpjs_kes_employee) > 0) deductItems.push([`BPJS Kesehatan (${excelFmtPct(slip.bpjs_kes_employee)}%)`, parseFloat(slip.bpjs_kes_employee)]);
        if (parseFloat(slip.bpjs_jht_employee) > 0) deductItems.push([`BPJS JHT (${excelFmtPct(slip.bpjs_jht_employee)}%)`, parseFloat(slip.bpjs_jht_employee)]);
        if (parseFloat(slip.bpjs_jp_employee) > 0) deductItems.push([`BPJS JP (${excelFmtPct(slip.bpjs_jp_employee)}%)`, parseFloat(slip.bpjs_jp_employee)]);
        deductItems.push(['PPh 21', parseFloat(slip.pph21_amount)]);
        deductItems.push(['Potongan Pinjaman', parseFloat(slip.loan_deduction)]);
        deductItems.forEach(([label, val]) => {
            ws.getCell(`A${row}`).value = label;
            ws.getCell(`C${row}`).value = val;
            ws.getCell(`C${row}`).numFmt = '#,##0';
            row++;
        });
        ws.getCell(`A${row}`).value = 'Total Potongan';
        ws.getCell(`A${row}`).font = { bold: true };
        ws.getCell(`C${row}`).value = parseFloat(slip.total_deductions);
        ws.getCell(`C${row}`).numFmt = '#,##0';
        ws.getCell(`C${row}`).font = { bold: true };
        row += 2;

        // Net
        ws.getCell(`A${row}`).value = 'GAJI BERSIH (Take Home Pay)';
        ws.getCell(`A${row}`).font = { bold: true, size: 12 };
        ws.getCell(`C${row}`).value = parseFloat(slip.net_salary);
        ws.getCell(`C${row}`).numFmt = '#,##0';
        ws.getCell(`C${row}`).font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
        row++;
        if (slip.bank_name) {
            ws.getCell(`A${row}`).value = `Transfer ke: ${slip.bank_name} - ${slip.bank_account}`;
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

