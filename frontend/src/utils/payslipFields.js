export const PAYSLIP_GROUPS = [
    {
        id: 'identitas',
        title: 'Identitas',
        fields: [
            { key: 'name', label: 'Nama' },
            { key: 'employee_id', label: 'ID karyawan' },
            { key: 'department', label: 'Departemen' },
            { key: 'position', label: 'Jabatan' },
            { key: 'npwp', label: 'NPWP' },
            { key: 'bank_name', label: 'Nama Bank' },
            { key: 'bank_account', label: 'No. Rekening' },
        ],
    },
    {
        id: 'pendapatan',
        title: 'Pendapatan',
        fields: [
            { key: 'basic_salary', label: 'Gaji pokok' },
            { key: 'transport_allowance', label: 'Tunjangan transport' },
            { key: 'meal_allowance', label: 'Tunjangan makan' },
            { key: 'appreciation_allowance', label: 'Tunjangan apresiasi' },
            { key: 'overtime', label: 'Lembur' },
            { key: 'driver_subuh', label: 'Uang jalan subuh' },
            { key: 'driver_rit', label: 'Uang mel/RIT' },
            { key: 'driver_overnight', label: 'Uang menginap' },
            { key: 'driver_ritase_dekat', label: 'Uang ritase dekat' },
            { key: 'driver_ritase_jauh', label: 'Uang ritase jauh' },
            { key: 'tuang', label: 'Insentif tuang' },
            { key: 'gross_income', label: 'Total pendapatan' },
        ],
    },
    {
        id: 'potongan',
        title: 'Potongan',
        fields: [
            { key: 'bpjs_kes_employee', label: 'BPJS Kesehatan' },
            { key: 'bpjs_jht_employee', label: 'BPJS JHT' },
            { key: 'bpjs_jp_employee', label: 'BPJS JP' },
            { key: 'pph21', label: 'PPh 21' },
            { key: 'loan', label: 'Potongan pinjaman' },
            { key: 'late_deduction', label: 'Potongan keterlambatan' },
            { key: 'total_deductions', label: 'Total potongan' },
        ],
    },
    {
        id: 'perusahaan',
        title: 'Kontribusi perusahaan',
        fields: [
            { key: 'bpjs_kes_company', label: 'BPJS Kesehatan perusahaan' },
            { key: 'bpjs_jht_company', label: 'BPJS JHT perusahaan' },
            { key: 'bpjs_jp_company', label: 'BPJS JP perusahaan' },
            { key: 'bpjs_jkk', label: 'BPJS JKK' },
            { key: 'bpjs_jkm', label: 'BPJS JKM' },
        ],
    },
    {
        id: 'ringkasan',
        title: 'Ringkasan',
        fields: [
            { key: 'net_salary', label: 'Gaji bersih' },
            { key: 'bank', label: 'Rekening transfer' },
        ],
    },
];

const POSITIVE_ONLY = new Set([
    'driver_subuh',
    'driver_rit',
    'driver_overnight',
    'driver_ritase_dekat',
    'driver_ritase_jauh',
    'tuang',
    'bpjs_kes_employee',
    'bpjs_jht_employee',
    'bpjs_jp_employee',
    'late_deduction',
    'bpjs_kes_company',
    'bpjs_jht_company',
    'bpjs_jp_company',
    'bpjs_jkk',
    'bpjs_jkm',
]);

const SKIP_HIDE_ZERO = new Set(['gross_income', 'total_deductions', 'net_salary']);

export function parsePayslipFields(raw) {
    let parsed = {};
    if (typeof raw === 'string' && raw.trim()) {
        try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    } else if (raw && typeof raw === 'object') {
        parsed = raw;
    }
    const stored = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {};
    const fields = {};
    PAYSLIP_GROUPS.forEach((group) => {
        group.fields.forEach((field) => {
            fields[field.key] = stored[field.key] !== false;
        });
    });
    return { hideZero: parsed.hide_zero === true, fields };
}

export function payslipShows(config, key, amount, positiveOnly = false) {
    if (config?.fields?.[key] === false) return false;
    if (amount === undefined) return true;
    const value = parseFloat(amount) || 0;
    if (config?.hideZero && value === 0 && !SKIP_HIDE_ZERO.has(key)) return false;
    if ((positiveOnly || POSITIVE_ONLY.has(key)) && value <= 0) return false;
    return true;
}
