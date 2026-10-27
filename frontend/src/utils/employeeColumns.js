// Konfigurasi kolom yang dapat ditampilkan pada tabel Data Karyawan
export const AVAILABLE_EMPLOYEE_COLUMNS = [
    { key: 'employee_id', label: 'ID Karyawan', defaultVisible: true, sortable: true, category: 'Identitas' },
    { key: 'name', label: 'Nama Lengkap', defaultVisible: true, sortable: true, category: 'Identitas', required: true },
    { key: 'department', label: 'Departemen', defaultVisible: true, sortable: true, category: 'Pekerjaan' },
    { key: 'division', label: 'Divisi', defaultVisible: true, sortable: true, category: 'Pekerjaan' },
    { key: 'position', label: 'Jabatan', defaultVisible: true, sortable: true, category: 'Pekerjaan' },
    { key: 'employment_status', label: 'Status Karyawan', defaultVisible: true, sortable: true, category: 'Pekerjaan' },
    { key: 'basic_salary', label: 'Gaji Pokok', defaultVisible: true, sortable: true, category: 'Kompensasi' },
    { key: 'appreciation_allowance', label: 'Tunjangan Apresiasi', defaultVisible: true, sortable: true, category: 'Kompensasi' },
    { key: 'transport_allowance', label: 'Tunjangan Transport', defaultVisible: false, sortable: true, category: 'Kompensasi' },
    { key: 'meal_allowance', label: 'Tunjangan Makan', defaultVisible: false, sortable: true, category: 'Kompensasi' },
    { key: 'salary_type', label: 'Tipe Gaji', defaultVisible: true, sortable: true, category: 'Kompensasi' },
    { key: 'receives_tuang', label: 'Tuang', defaultVisible: true, sortable: false, category: 'Kompensasi' },
    { key: 'phone', label: 'No. Telepon', defaultVisible: false, sortable: false, category: 'Kontak' },
    { key: 'nik', label: 'NIK', defaultVisible: false, sortable: false, category: 'Identitas' },
    { key: 'join_date', label: 'Tanggal Masuk', defaultVisible: false, sortable: true, category: 'Pekerjaan' },
    { key: 'gender', label: 'Jenis Kelamin', defaultVisible: false, sortable: true, category: 'Identitas' },
    { key: 'actions', label: 'Aksi', defaultVisible: true, sortable: false, category: 'Aksi', required: true }
];

export const DEFAULT_VISIBLE_COLUMNS = AVAILABLE_EMPLOYEE_COLUMNS
    .filter(col => col.defaultVisible)
    .map(col => col.key);

export const STORAGE_KEY_EMPLOYEE_COLUMNS = 'admin_employee_table_columns';

export function getInitialVisibleColumns(savedFromApi) {
    if (savedFromApi && Array.isArray(savedFromApi) && savedFromApi.length > 0) {
        const set = new Set(savedFromApi);
        set.add('name');
        set.add('actions');
        return Array.from(set);
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY_EMPLOYEE_COLUMNS);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const set = new Set(parsed);
                set.add('name');
                set.add('actions');
                return Array.from(set);
            }
        }
    } catch (e) {
        console.warn('Failed to parse stored employee columns:', e);
    }
    return DEFAULT_VISIBLE_COLUMNS;
}
