const PAYSLIP_FIELD_KEYS = [
    'name', 'employee_id', 'department', 'position', 'npwp',
    'basic_salary', 'transport_allowance', 'meal_allowance', 'appreciation_allowance', 'overtime',
    'driver_subuh', 'driver_rit', 'driver_overnight', 'driver_ritase_dekat', 'driver_ritase_jauh', 'tuang',
    'gross_income',
    'bpjs_kes_employee', 'bpjs_jht_employee', 'bpjs_jp_employee', 'pph21', 'loan', 'total_deductions',
    'bpjs_kes_company', 'bpjs_jht_company', 'bpjs_jp_company', 'bpjs_jkk', 'bpjs_jkm',
    'net_salary', 'bank',
];

const POSITIVE_ONLY = new Set([
    'driver_subuh', 'driver_rit', 'driver_overnight', 'driver_ritase_dekat', 'driver_ritase_jauh', 'tuang',
    'bpjs_kes_employee', 'bpjs_jht_employee', 'bpjs_jp_employee',
    'bpjs_kes_company', 'bpjs_jht_company', 'bpjs_jp_company', 'bpjs_jkk', 'bpjs_jkm',
]);

const SKIP_HIDE_ZERO = new Set(['gross_income', 'total_deductions', 'net_salary']);

function safeParse(text) {
    if (!text) return {};
    if (typeof text === 'object') return text;
    try { return JSON.parse(text); } catch { return {}; }
}

function configFromParts(hideZero, fields) {
    const stored = fields && typeof fields === 'object' ? fields : safeParse(fields);
    return {
        hide_zero: hideZero === true,
        fields: stored,
    };
}

function configFromRaw(raw) {
    const parsed = typeof raw === 'string' || !raw ? safeParse(raw) : raw;
    return configFromParts(parsed.hide_zero === true || parsed.hideZero === true, parsed.fields || {});
}

async function resolvePayslipLayout(pool, userId, departmentHint) {
    let department = String(departmentHint || '').trim();
    if (!department && userId) {
        const detail = await pool.query(
            `SELECT department FROM employee_details
             WHERE user_id = $1 AND COALESCE(department, '') <> ''
             ORDER BY id DESC LIMIT 1`,
            [userId]
        );
        department = detail.rows[0]?.department || '';
    }

    const params = [String(userId || '')];
    let sql = `SELECT scope_type, scope_key, hide_zero, fields
               FROM payslip_layouts
               WHERE scope_type = 'employee' AND scope_key = $1`;
    if (department) {
        params.push(department);
        sql += ` OR (scope_type = 'department' AND scope_key = $2)`;
    }
    const rules = userId ? await pool.query(sql, params) : { rows: [] };
    const employeeRule = rules.rows.find((row) => row.scope_type === 'employee') || null;
    const departmentRule = rules.rows.find((row) => row.scope_type === 'department') || null;
    const globalRow = await pool.query(`SELECT value FROM settings WHERE key = 'payslip_fields'`);
    const globalConfig = configFromRaw(globalRow.rows[0]?.value);
    const departmentConfig = departmentRule
        ? configFromParts(departmentRule.hide_zero, departmentRule.fields)
        : null;
    const employeeConfig = employeeRule
        ? configFromParts(employeeRule.hide_zero, employeeRule.fields)
        : null;
    const chosen = employeeConfig || departmentConfig || globalConfig;
    const source = employeeConfig ? 'employee' : departmentConfig ? 'department' : 'global';

    return {
        ...chosen,
        source,
        department,
        vis: parsePayslipVisibility(JSON.stringify(chosen)),
        global: globalConfig,
        department_rule: departmentConfig,
        employee_rule: employeeConfig,
    };
}

function parsePayslipVisibility(raw) {
    let parsed = {};
    if (raw) {
        try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    }
    const stored = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {};
    const hideZero = parsed.hide_zero === true;
    return {
        hideZero,
        show(key, amount) {
            if (stored[key] === false) return false;
            if (amount === undefined) return true;
            const value = parseFloat(amount) || 0;
            if (hideZero && value === 0 && !SKIP_HIDE_ZERO.has(key)) return false;
            if (POSITIVE_ONLY.has(key) && value <= 0) return false;
            return true;
        },
    };
}

function slipPercent(base, amount) {
    const pct = (parseFloat(amount) || 0) / (parseFloat(base) || 1) * 100;
    return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2);
}

function pushLine(list, vis, key, label, amount) {
    if (!vis.show(key, amount)) return;
    list.push({ label, amount: parseFloat(amount) || 0 });
}

function buildSlipSections(slip, vis) {
    const income = [];
    pushLine(income, vis, 'basic_salary', 'Gaji Pokok', slip.basic_salary);
    pushLine(income, vis, 'transport_allowance', 'Tunjangan Transport', slip.transport_allowance);
    pushLine(income, vis, 'meal_allowance', 'Tunjangan Makan', slip.meal_allowance);
    pushLine(income, vis, 'appreciation_allowance', 'Tunjangan Apresiasi', slip.appreciation_allowance);
    pushLine(income, vis, 'overtime', `Lembur (${slip.overtime_hours} jam)`, slip.overtime_amount);
    pushLine(income, vis, 'driver_subuh', `Uang Jalan Subuh (${slip.driver_subuh_days || 0} hari)`, slip.driver_subuh_amount);
    pushLine(income, vis, 'driver_rit', `Uang Mel/RIT (${slip.driver_rit_total || 0} trip)`, slip.driver_rit_amount);
    pushLine(income, vis, 'driver_overnight', `Uang Menginap (${slip.driver_overnight_days || 0} hari)`, slip.driver_overnight_amount);
    pushLine(income, vis, 'driver_ritase_dekat', `Uang Ritase Dekat (${slip.driver_extra_rit_dekat || 0} trip)`, slip.driver_ritase_dekat_amount);
    pushLine(income, vis, 'driver_ritase_jauh', `Uang Ritase Jauh (${slip.driver_extra_rit_jauh || 0} trip)`, slip.driver_ritase_jauh_amount);
    pushLine(income, vis, 'tuang', `Insentif Tuang (${slip.tuang_days || 0} hari)`, slip.tuang_amount);

    const base = slip.basic_salary;
    const deductions = [];
    pushLine(deductions, vis, 'bpjs_kes_employee', `BPJS Kesehatan (${slipPercent(base, slip.bpjs_kes_employee)}%)`, slip.bpjs_kes_employee);
    pushLine(deductions, vis, 'bpjs_jht_employee', `BPJS JHT (${slipPercent(base, slip.bpjs_jht_employee)}%)`, slip.bpjs_jht_employee);
    pushLine(deductions, vis, 'bpjs_jp_employee', `BPJS JP (${slipPercent(base, slip.bpjs_jp_employee)}%)`, slip.bpjs_jp_employee);
    pushLine(deductions, vis, 'pph21', 'PPh 21', slip.pph21_amount);
    pushLine(deductions, vis, 'loan', 'Potongan Pinjaman', slip.loan_deduction);

    const company = [];
    pushLine(company, vis, 'bpjs_kes_company', `BPJS Kesehatan (${slipPercent(base, slip.bpjs_kes_company)}%)`, slip.bpjs_kes_company);
    pushLine(company, vis, 'bpjs_jht_company', `BPJS JHT (${slipPercent(base, slip.bpjs_jht_company)}%)`, slip.bpjs_jht_company);
    pushLine(company, vis, 'bpjs_jp_company', `BPJS JP (${slipPercent(base, slip.bpjs_jp_company)}%)`, slip.bpjs_jp_company);
    pushLine(company, vis, 'bpjs_jkk', `BPJS JKK (${slipPercent(base, slip.bpjs_jkk)}%)`, slip.bpjs_jkk);
    pushLine(company, vis, 'bpjs_jkm', `BPJS JKM (${slipPercent(base, slip.bpjs_jkm)}%)`, slip.bpjs_jkm);

    const identity = [];
    if (vis.show('name')) identity.push(['Nama', slip.user_name || '-']);
    if (vis.show('employee_id')) identity.push(['ID', slip.employee_id || '-']);
    if (vis.show('department')) identity.push(['Departemen', slip.department || '-']);
    if (vis.show('position')) identity.push(['Jabatan', slip.position || '-']);
    if (vis.show('npwp') && slip.npwp) identity.push(['NPWP', slip.npwp]);

    return {
        identity,
        income,
        deductions,
        company,
        showGross: vis.show('gross_income'),
        showTotalDeduct: vis.show('total_deductions'),
        showNet: vis.show('net_salary'),
        showBank: vis.show('bank') && !!slip.bank_name,
    };
}

module.exports = {
    PAYSLIP_FIELD_KEYS,
    parsePayslipVisibility,
    buildSlipSections,
    resolvePayslipLayout,
    configFromRaw,
};
