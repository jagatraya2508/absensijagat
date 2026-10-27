import Icon from '../components/Icon';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { employeesAPI, authAPI, departmentsAPI, positionsAPI, locationsAPI, settingsAPI, vehicleTypesAPI, organizationAPI, employmentStatusesAPI, divisionsAPI } from '../utils/api';
import { AVAILABLE_EMPLOYEE_COLUMNS, DEFAULT_VISIBLE_COLUMNS, STORAGE_KEY_EMPLOYEE_COLUMNS, getInitialVisibleColumns } from '../utils/employeeColumns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TABS = [
    { id: 'personal', label: 'Data Pribadi' },
    { id: 'work', label: 'Data Kerja' },
    { id: 'bank', label: 'Bank & Pajak' },
    { id: 'salary', label: 'Gaji & Tunjangan' },
    { id: 'bpjs', label: 'BPJS & PPh' },
    { id: 'locations', label: 'Lokasi Absen' },
    { id: 'documents', label: 'Dokumen' },
];

const LEGACY_STATUS_LABELS = {
    permanen: 'Permanen',
    kontrak: 'Kontrak',
    honor_harian: 'Honor Harian',
    percobaan: 'Percobaan',
    magang: 'Magang',
    paruh_waktu: 'Paruh Waktu',
    outsourcing: 'Outsourcing',
    freelance: 'Freelance',
    konsultan: 'Konsultan',
};

function employmentStatusLabel(value) {
    if (!value) return '-';
    return LEGACY_STATUS_LABELS[value] || value;
}

const DOC_TYPES = [
    { value: 'KTP', label: 'KTP (Kartu Tanda Penduduk)' },
    { value: 'KK', label: 'Kartu Keluarga' },
    { value: 'IJAZAH', label: 'Ijazah' },
    { value: 'SKCK', label: 'SKCK' },
    { value: 'SIM', label: 'SIM (Surat Izin Mengemudi)' },
    { value: 'SURAT_LAMARAN', label: 'Surat Lamaran' },
    { value: 'CV', label: 'Curriculum Vitae' },
    { value: 'SERTIFIKAT', label: 'Sertifikat' },
    { value: 'KONTRAK', label: 'Kontrak Kerja' },
    { value: 'LAINNYA', label: 'Lainnya' },
];

export default function AdminEmployees() {
    const [employees, setEmployees] = useState([]);
    const [masterDepartments, setMasterDepartments] = useState([]);
    const [masterPositions, setMasterPositions] = useState([]);
    const [masterEmploymentStatuses, setMasterEmploymentStatuses] = useState([]);
    const [masterDivisions, setMasterDivisions] = useState([]);
    const [masterLocations, setMasterLocations] = useState([]);
    const [masterVehicleTypes, setMasterVehicleTypes] = useState([]);
    const [orgMembers, setOrgMembers] = useState([]);
    const [bpjsDefaults, setBpjsDefaults] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [activeTab, setActiveTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [tuangFilter, setTuangFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'employee_id', direction: 'asc' });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [documents, setDocuments] = useState([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docType, setDocType] = useState('KTP');
    const [docNotes, setDocNotes] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState('');
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    // Pengaturan Kolom Tampilan
    const [visibleColumns, setVisibleColumns] = useState(() => getInitialVisibleColumns());
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [tempColumns, setTempColumns] = useState(() => getInitialVisibleColumns());
    const [savingColumns, setSavingColumns] = useState(false);

    const [formData, setFormData] = useState({
        nik: '', no_kk: '', phone: '', address: '', birth_date: '', birth_place: '',
        gender: '', marital_status: 'Belum Menikah', religion: '', education: '',
        department: '', division: '', position: '', employment_status: '', join_date: '', supervisor_id: '',
        bank_name: '', bank_account: '', bank_holder: '',
        npwp: '', bpjs_kesehatan_no: '', bpjs_ketenagakerjaan_no: '',
        basic_salary: 0, salary_type: 'monthly', transport_allowance: 0, meal_allowance: 0, appreciation_allowance: 0, overtime_rate: 50000,
        is_driver: false, is_collector: false, is_sales: false, use_tracking: false, receives_tuang: true, driver_subuh_allowance: 0, driver_rit_allowance: 0, driver_inap_allowance: 0, driver_ritase_allowance: 0,
        vehicle_type_id: '', tax_status: 'TK/0', emergency_contact_name: '', emergency_contact_phone: '',
        location_ids: [],
        require_different_checkout: false,
        bpjs_kes_enrolled: true, bpjs_jht_enrolled: true, bpjs_jp_enrolled: true,
        bpjs_jkk_enrolled: true, bpjs_jkm_enrolled: true, pph21_enabled: true,
        bpjs_kes_employee_rate: '', bpjs_kes_company_rate: '',
        bpjs_jht_employee_rate: '', bpjs_jht_company_rate: '',
        bpjs_jp_employee_rate: '', bpjs_jp_company_rate: '',
        bpjs_jkk_rate: '', bpjs_jkm_rate: ''
    });

    useEffect(() => { 
        fetchEmployees(); 
        fetchMasters();
        fetchColumnSettings();
    }, []);

    async function fetchColumnSettings() {
        try {
            const res = await settingsAPI.getEmployeeColumns();
            if (res && res.columns) {
                const cols = getInitialVisibleColumns(res.columns);
                setVisibleColumns(cols);
                try {
                    localStorage.setItem(STORAGE_KEY_EMPLOYEE_COLUMNS, JSON.stringify(cols));
                } catch (e) {}
            }
        } catch (err) {
            console.warn('Gagal memuat pengaturan kolom dari server:', err);
        }
    }

    function openColumnModal() {
        setTempColumns([...visibleColumns]);
        setShowColumnModal(true);
    }

    function toggleTempColumn(key) {
        if (key === 'name' || key === 'actions') return;
        setTempColumns(prev => {
            if (prev.includes(key)) {
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    }

    async function handleSaveColumns() {
        setSavingColumns(true);
        try {
            const colsToSave = [...tempColumns];
            if (!colsToSave.includes('name')) colsToSave.push('name');
            if (!colsToSave.includes('actions')) colsToSave.push('actions');

            setVisibleColumns(colsToSave);
            try {
                localStorage.setItem(STORAGE_KEY_EMPLOYEE_COLUMNS, JSON.stringify(colsToSave));
            } catch (e) {}

            await settingsAPI.updateEmployeeColumns(colsToSave);
            setShowColumnModal(false);
            setSuccess('Pengaturan kolom berhasil disimpan!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Failed to save columns:', err);
            setShowColumnModal(false);
        } finally {
            setSavingColumns(false);
        }
    }

    function handleResetColumns() {
        setTempColumns([...DEFAULT_VISIBLE_COLUMNS]);
    }

    function handleSelectAllColumns() {
        setTempColumns(AVAILABLE_EMPLOYEE_COLUMNS.map(c => c.key));
    }

    async function fetchMasters() {
        try {
            const depts = await departmentsAPI.getAll();
            const pos = await positionsAPI.getAll();
            const statuses = await employmentStatusesAPI.getAll();
            const divs = await divisionsAPI.getAll();
            const loc = await locationsAPI.getAll();
            const vts = await vehicleTypesAPI.getAll();
            setMasterDepartments(depts);
            setMasterPositions(pos);
            setMasterEmploymentStatuses(statuses);
            setMasterDivisions(divs);
            setMasterLocations(loc.filter(l => l.is_active));
            setMasterVehicleTypes(vts);
            try {
                const members = await organizationAPI.getMembers();
                setOrgMembers(members);
            } catch (e) {
                setOrgMembers([]);
            }
        } catch (err) {
            console.error('Failed to fetch masters:', err);
        }
        try {
            const bpjsList = await settingsAPI.getBpjs();
            const map = {};
            bpjsList.forEach(b => { map[b.code] = b; });
            setBpjsDefaults(map);
        } catch (err) {
            console.error('Failed to fetch BPJS settings:', err);
        }
    }

    async function fetchEmployees() {
        try {
            const data = await employeesAPI.getAll();
            setEmployees(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            console.error('Failed to fetch employees:', err);
            setEmployees([]);
            setError(err.message || 'Gagal memuat data karyawan');
        } finally {
            setLoading(false);
        }
    }

    async function openDetail(emp) {
        try {
            const data = await employeesAPI.getById(emp.id);
            setSelectedEmployee(data);
            const d = data.details || {};
            setFormData({
                nik: d.nik || '', no_kk: d.no_kk || '', phone: d.phone || '', address: d.address || '',
                birth_date: d.birth_date ? d.birth_date.split('T')[0] : '',
                birth_place: d.birth_place || '',
                gender: d.gender || '', marital_status: d.marital_status || 'Belum Menikah',
                religion: d.religion || '', education: d.education || '',
                department: d.department || '', position: d.position || '',
                division: d.division || '',
                employment_status: d.employment_status || '',
                supervisor_id: d.supervisor_id || '',
                join_date: d.join_date ? d.join_date.split('T')[0] : '',
                bank_name: d.bank_name || '', bank_account: d.bank_account || '',
                bank_holder: d.bank_holder || '',
                npwp: d.npwp || '', bpjs_kesehatan_no: d.bpjs_kesehatan_no || '',
                bpjs_ketenagakerjaan_no: d.bpjs_ketenagakerjaan_no || '',
                basic_salary: d.basic_salary || 0, salary_type: d.salary_type || 'monthly',
                transport_allowance: d.transport_allowance || 0,
                meal_allowance: d.meal_allowance || 0,
                appreciation_allowance: d.appreciation_allowance || 0,
                overtime_rate: d.overtime_rate || 50000,
                is_driver: d.is_driver || false,
                is_collector: d.is_collector || false,
                is_sales: d.is_sales || false,
                use_tracking: d.use_tracking || false,
                receives_tuang: d.receives_tuang !== false,
                driver_subuh_allowance: d.driver_subuh_allowance || 0,
                driver_rit_allowance: d.driver_rit_allowance || 0,
                driver_inap_allowance: d.driver_inap_allowance || 0,
                driver_ritase_dekat_allowance: d.driver_ritase_dekat_allowance || 0,
                driver_ritase_jauh_allowance: d.driver_ritase_jauh_allowance || 0,
                vehicle_type_id: d.vehicle_type_id || '',
                tax_status: d.tax_status || 'TK/0',
                emergency_contact_name: d.emergency_contact_name || '',
                emergency_contact_phone: d.emergency_contact_phone || '',
                location_ids: data.location_ids || [],
                require_different_checkout: !!(d.require_different_checkout || emp.require_different_checkout),
                bpjs_kes_enrolled: d.bpjs_kes_enrolled !== false,
                bpjs_jht_enrolled: d.bpjs_jht_enrolled !== false,
                bpjs_jp_enrolled: d.bpjs_jp_enrolled !== false,
                bpjs_jkk_enrolled: d.bpjs_jkk_enrolled !== false,
                bpjs_jkm_enrolled: d.bpjs_jkm_enrolled !== false,
                pph21_enabled: d.pph21_enabled !== false,
                bpjs_kes_employee_rate: d.bpjs_kes_employee_rate ? (parseFloat(d.bpjs_kes_employee_rate) * 100).toString() : '',
                bpjs_kes_company_rate: d.bpjs_kes_company_rate ? (parseFloat(d.bpjs_kes_company_rate) * 100).toString() : '',
                bpjs_jht_employee_rate: d.bpjs_jht_employee_rate ? (parseFloat(d.bpjs_jht_employee_rate) * 100).toString() : '',
                bpjs_jht_company_rate: d.bpjs_jht_company_rate ? (parseFloat(d.bpjs_jht_company_rate) * 100).toString() : '',
                bpjs_jp_employee_rate: d.bpjs_jp_employee_rate ? (parseFloat(d.bpjs_jp_employee_rate) * 100).toString() : '',
                bpjs_jp_company_rate: d.bpjs_jp_company_rate ? (parseFloat(d.bpjs_jp_company_rate) * 100).toString() : '',
                bpjs_jkk_rate: d.bpjs_jkk_rate ? (parseFloat(d.bpjs_jkk_rate) * 100).toString() : '',
                bpjs_jkm_rate: d.bpjs_jkm_rate ? (parseFloat(d.bpjs_jkm_rate) * 100).toString() : ''
            });
            setActiveTab('personal');
            setShowModal(true);
            setError('');
            setSuccess('');
            // Load documents
            try {
                const docs = await employeesAPI.getDocuments(emp.id);
                setDocuments(docs);
            } catch (e) {
                setDocuments([]);
            }
        } catch (err) {
            alert('Gagal memuat detail karyawan');
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            // Convert percentage rates to decimal before sending
            const rateFields = ['bpjs_kes_employee_rate', 'bpjs_kes_company_rate', 'bpjs_jht_employee_rate', 'bpjs_jht_company_rate', 'bpjs_jp_employee_rate', 'bpjs_jp_company_rate', 'bpjs_jkk_rate', 'bpjs_jkm_rate'];
            const payload = { ...formData };
            if (!payload.vehicle_type_id) {
                payload.vehicle_type_id = null;
            }
            if (!payload.supervisor_id) {
                payload.supervisor_id = null;
            }
            const moneyFields = [
                'basic_salary', 'transport_allowance', 'meal_allowance', 'appreciation_allowance', 'overtime_rate',
                'driver_subuh_allowance', 'driver_rit_allowance', 'driver_inap_allowance',
                'driver_ritase_dekat_allowance', 'driver_ritase_jauh_allowance'
            ];
            moneyFields.forEach(f => {
                payload[f] = payload[f] === '' || payload[f] == null ? 0 : parseFloat(payload[f]) || 0;
            });
            rateFields.forEach(f => {
                if (payload[f] !== '' && payload[f] != null) {
                    payload[f] = parseFloat(payload[f]) / 100;
                } else {
                    payload[f] = null;
                }
            });
            await employeesAPI.update(selectedEmployee.id, payload);
            setSuccess('Data karyawan berhasil disimpan');
            setShowModal(false);
            fetchEmployees();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    function updateField(field, value) {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if ((field === 'is_driver' || field === 'is_collector' || field === 'is_sales') && value) {
                next.use_tracking = true;
            }
            return next;
        });
    }

    async function toggleReceivesTuang(emp, enabled) {
        const previous = emp.receives_tuang !== false;
        setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, receives_tuang: enabled } : e));
        try {
            await employeesAPI.setReceivesTuang(emp.id, enabled);
        } catch (err) {
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, receives_tuang: previous } : e));
            alert(err.message || 'Gagal mengubah status tuang');
        }
    }

    function parseMoneyInput(raw) {
        if (raw === '') return '';
        const n = parseFloat(raw);
        return Number.isNaN(n) ? '' : n;
    }

    function updateMoneyField(field, raw) {
        updateField(field, parseMoneyInput(raw));
    }

    function commitMoneyField(field, raw) {
        if (raw === '' || raw == null) {
            updateField(field, 0);
            return;
        }
        const n = parseFloat(raw);
        updateField(field, Number.isNaN(n) ? 0 : n);
    }

    function moneyInputProps(field) {
        return {
            className: 'form-input',
            type: 'number',
            min: '0',
            value: formData[field] ?? '',
            onChange: e => updateMoneyField(field, e.target.value),
            onBlur: e => commitMoneyField(field, e.target.value),
            onFocus: e => e.target.select()
        };
    }

    function toggleLocation(locId) {
        setFormData(prev => {
            const ids = prev.location_ids || [];
            if (ids.includes(locId)) {
                return { ...prev, location_ids: ids.filter(id => id !== locId) };
            } else {
                return { ...prev, location_ids: [...ids, locId] };
            }
        });
    }

    function toggleAllLocations() {
        setFormData(prev => {
            const allIds = masterLocations.map(l => l.id);
            const ids = prev.location_ids || [];
            const allSelected = allIds.length > 0 && allIds.every(id => ids.includes(id));
            return { ...prev, location_ids: allSelected ? [] : allIds };
        });
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    // Sort handler
    function handleSort(key) {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }

    function getSortIcon(key) {
        if (sortConfig.key !== key) return <Icon name="ArrowUpDown" size={12} />;
        return sortConfig.direction === 'asc' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />;
    }

    const filteredEmployees = useMemo(() => {
        let result = employees.filter(e =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.division || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.position || '').toLowerCase().includes(search.toLowerCase()) ||
            employmentStatusLabel(e.employment_status).toLowerCase().includes(search.toLowerCase())
        );

        if (tuangFilter === 'yes') {
            result = result.filter(e => e.receives_tuang !== false);
        } else if (tuangFilter === 'no') {
            result = result.filter(e => e.receives_tuang === false);
        }

        // Sort
        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Handle numeric fields
                if (['basic_salary', 'appreciation_allowance', 'transport_allowance', 'meal_allowance'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else {
                    aVal = (aVal || '').toString().toLowerCase();
                    bVal = (bVal || '').toString().toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [employees, search, tuangFilter, sortConfig]);

    useEffect(() => {
        setPage(1);
    }, [search, tuangFilter, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
    const pageSafe = Math.min(page, totalPages);
    const pagedEmployees = filteredEmployees.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
    const pageStart = filteredEmployees.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
    const pageEnd = Math.min(pageSafe * PAGE_SIZE, filteredEmployees.length);

    const pageNumbers = useMemo(() => {
        const total = totalPages;
        const current = pageSafe;
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = new Set([1, total, current, current - 1, current + 1]);
        if (current <= 3) {
            pages.add(2); pages.add(3); pages.add(4);
        }
        if (current >= total - 2) {
            pages.add(total - 1); pages.add(total - 2); pages.add(total - 3);
        }
        const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
        const result = [];
        sorted.forEach((p, i) => {
            if (i > 0 && p - sorted[i - 1] > 1) result.push('ellipsis-' + sorted[i - 1]);
            result.push(p);
        });
        return result;
    }, [totalPages, pageSafe]);

    const pagerBtnStyle = (active, disabled) => ({
        minWidth: 36,
        height: 36,
        padding: '0 0.55rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: active ? '1px solid var(--primary, #7f1d1d)' : '1px solid var(--gray-200)',
        background: active ? 'var(--primary, #7f1d1d)' : '#fff',
        color: active ? '#fff' : 'var(--gray-800)',
        fontWeight: 600,
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
    });

    // Export to Excel (dinamis sesuai kolom yang dipilih)
    function handleExportExcel() {
        const data = filteredEmployees.map((emp, i) => {
            const row = { 'No': i + 1 };
            if (visibleColumns.includes('employee_id')) row['ID Karyawan'] = emp.employee_id;
            if (visibleColumns.includes('name')) row['Nama'] = emp.name;
            if (visibleColumns.includes('department')) row['Departemen'] = emp.department || '-';
            if (visibleColumns.includes('division')) row['Divisi'] = emp.division || '-';
            if (visibleColumns.includes('position')) row['Jabatan'] = emp.position || '-';
            if (visibleColumns.includes('employment_status')) row['Status Karyawan'] = employmentStatusLabel(emp.employment_status);
            if (visibleColumns.includes('basic_salary')) row['Gaji Pokok'] = parseFloat(emp.basic_salary) || 0;
            if (visibleColumns.includes('appreciation_allowance')) row['Tunjangan Apresiasi'] = parseFloat(emp.appreciation_allowance) || 0;
            if (visibleColumns.includes('transport_allowance')) row['Tunjangan Transport'] = parseFloat(emp.transport_allowance) || 0;
            if (visibleColumns.includes('meal_allowance')) row['Tunjangan Makan'] = parseFloat(emp.meal_allowance) || 0;
            if (visibleColumns.includes('salary_type')) row['Tipe Gaji'] = emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan';
            if (visibleColumns.includes('receives_tuang')) row['Tuang'] = emp.receives_tuang !== false ? 'Dapat' : 'Tidak';
            if (visibleColumns.includes('phone')) row['No. Telepon'] = emp.phone || '-';
            if (visibleColumns.includes('nik')) row['NIK'] = emp.nik || '-';
            if (visibleColumns.includes('join_date')) row['Tanggal Masuk'] = emp.join_date ? emp.join_date.split('T')[0] : '-';
            if (visibleColumns.includes('gender')) row['Jenis Kelamin'] = emp.gender || '-';
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');
        XLSX.writeFile(wb, `Data_Karyawan_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    function openImportModal() {
        setImportFile(null);
        setImportResult(null);
        setImportError('');
        setShowImportModal(true);
    }

    async function handleDownloadTemplate() {
        setDownloadingTemplate(true);
        try {
            await employeesAPI.downloadTemplate();
        } catch (err) {
            alert(err.message || 'Gagal mengunduh template');
        } finally {
            setDownloadingTemplate(false);
        }
    }

    async function handleImportEmployees() {
        if (!importFile) {
            setImportError('Pilih file Excel terlebih dahulu');
            return;
        }

        setImporting(true);
        setImportError('');
        setImportResult(null);

        try {
            const upload = new FormData();
            upload.append('file', importFile);
            const result = await employeesAPI.import(upload);
            setImportResult(result);
            const saved = (result.imported || 0) + (result.updated || 0);
            if (saved > 0) {
                setSuccess(`${result.imported || 0} karyawan ditambahkan, ${result.updated || 0} karyawan diperbarui`);
                fetchEmployees();
            }
        } catch (err) {
            setImportError(err.message || 'Gagal mengimpor data karyawan');
        } finally {
            setImporting(false);
        }
    }

    // Export to PDF (dinamis sesuai kolom yang dipilih)
    function handleExportPDF() {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Data Karyawan', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}  |  Total: ${filteredEmployees.length} karyawan`, pageWidth / 2, 22, { align: 'center' });

        const pdfHeaders = ['No'];
        if (visibleColumns.includes('employee_id')) pdfHeaders.push('ID Karyawan');
        if (visibleColumns.includes('name')) pdfHeaders.push('Nama');
        if (visibleColumns.includes('department')) pdfHeaders.push('Departemen');
        if (visibleColumns.includes('division')) pdfHeaders.push('Divisi');
        if (visibleColumns.includes('position')) pdfHeaders.push('Jabatan');
        if (visibleColumns.includes('employment_status')) pdfHeaders.push('Status');
        if (visibleColumns.includes('basic_salary')) pdfHeaders.push('Gaji Pokok');
        if (visibleColumns.includes('appreciation_allowance')) pdfHeaders.push('Tunj. Apresiasi');
        if (visibleColumns.includes('transport_allowance')) pdfHeaders.push('Tunj. Transport');
        if (visibleColumns.includes('meal_allowance')) pdfHeaders.push('Tunj. Makan');
        if (visibleColumns.includes('salary_type')) pdfHeaders.push('Tipe');
        if (visibleColumns.includes('receives_tuang')) pdfHeaders.push('Tuang');
        if (visibleColumns.includes('phone')) pdfHeaders.push('Telepon');
        if (visibleColumns.includes('nik')) pdfHeaders.push('NIK');
        if (visibleColumns.includes('join_date')) pdfHeaders.push('Tgl Masuk');
        if (visibleColumns.includes('gender')) pdfHeaders.push('Gender');

        const tableData = filteredEmployees.map((emp, i) => {
            const row = [i + 1];
            if (visibleColumns.includes('employee_id')) row.push(emp.employee_id);
            if (visibleColumns.includes('name')) row.push(emp.name);
            if (visibleColumns.includes('department')) row.push(emp.department || '-');
            if (visibleColumns.includes('division')) row.push(emp.division || '-');
            if (visibleColumns.includes('position')) row.push(emp.position || '-');
            if (visibleColumns.includes('employment_status')) row.push(employmentStatusLabel(emp.employment_status));
            if (visibleColumns.includes('basic_salary')) row.push(formatCurrency(emp.basic_salary));
            if (visibleColumns.includes('appreciation_allowance')) row.push(formatCurrency(emp.appreciation_allowance));
            if (visibleColumns.includes('transport_allowance')) row.push(formatCurrency(emp.transport_allowance));
            if (visibleColumns.includes('meal_allowance')) row.push(formatCurrency(emp.meal_allowance));
            if (visibleColumns.includes('salary_type')) row.push(emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan');
            if (visibleColumns.includes('receives_tuang')) row.push(emp.receives_tuang !== false ? 'Ya' : 'Tidak');
            if (visibleColumns.includes('phone')) row.push(emp.phone || '-');
            if (visibleColumns.includes('nik')) row.push(emp.nik || '-');
            if (visibleColumns.includes('join_date')) row.push(emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID') : '-');
            if (visibleColumns.includes('gender')) row.push(emp.gender || '-');
            return row;
        });

        autoTable(doc, {
            startY: 28,
            head: [pdfHeaders],
            body: tableData,
            styles: { fontSize: 7, cellPadding: 2.5 },
            headStyles: { fillColor: [30, 41, 82], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            alternateRowStyles: { fillColor: [240, 243, 255] },
            didDrawPage: (data) => {
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(`Halaman ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 7, { align: 'center' });
            }
        });

        doc.save(`Data_Karyawan_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    // Print (dinamis sesuai kolom yang dipilih)
    function handlePrint() {
        const printHeaders = ['<th class="text-center">No</th>'];
        if (visibleColumns.includes('employee_id')) printHeaders.push('<th>ID Karyawan</th>');
        if (visibleColumns.includes('name')) printHeaders.push('<th>Nama</th>');
        if (visibleColumns.includes('department')) printHeaders.push('<th>Departemen</th>');
        if (visibleColumns.includes('division')) printHeaders.push('<th>Divisi</th>');
        if (visibleColumns.includes('position')) printHeaders.push('<th>Jabatan</th>');
        if (visibleColumns.includes('employment_status')) printHeaders.push('<th>Status</th>');
        if (visibleColumns.includes('basic_salary')) printHeaders.push('<th class="text-right">Gaji Pokok</th>');
        if (visibleColumns.includes('appreciation_allowance')) printHeaders.push('<th class="text-right">Tunj. Apresiasi</th>');
        if (visibleColumns.includes('transport_allowance')) printHeaders.push('<th class="text-right">Tunj. Transport</th>');
        if (visibleColumns.includes('meal_allowance')) printHeaders.push('<th class="text-right">Tunj. Makan</th>');
        if (visibleColumns.includes('salary_type')) printHeaders.push('<th class="text-center">Tipe</th>');
        if (visibleColumns.includes('receives_tuang')) printHeaders.push('<th class="text-center">Tuang</th>');
        if (visibleColumns.includes('phone')) printHeaders.push('<th>Telepon</th>');
        if (visibleColumns.includes('nik')) printHeaders.push('<th>NIK</th>');
        if (visibleColumns.includes('join_date')) printHeaders.push('<th>Tgl Masuk</th>');
        if (visibleColumns.includes('gender')) printHeaders.push('<th>Gender</th>');

        const printRows = filteredEmployees.map((emp, i) => {
            const cols = [`<td class="text-center">${i + 1}</td>`];
            if (visibleColumns.includes('employee_id')) cols.push(`<td>${emp.employee_id}</td>`);
            if (visibleColumns.includes('name')) cols.push(`<td>${emp.name}</td>`);
            if (visibleColumns.includes('department')) cols.push(`<td>${emp.department || '-'}</td>`);
            if (visibleColumns.includes('division')) cols.push(`<td>${emp.division || '-'}</td>`);
            if (visibleColumns.includes('position')) cols.push(`<td>${emp.position || '-'}</td>`);
            if (visibleColumns.includes('employment_status')) cols.push(`<td>${employmentStatusLabel(emp.employment_status)}</td>`);
            if (visibleColumns.includes('basic_salary')) cols.push(`<td class="text-right">${formatCurrency(emp.basic_salary)}</td>`);
            if (visibleColumns.includes('appreciation_allowance')) cols.push(`<td class="text-right">${formatCurrency(emp.appreciation_allowance)}</td>`);
            if (visibleColumns.includes('transport_allowance')) cols.push(`<td class="text-right">${formatCurrency(emp.transport_allowance)}</td>`);
            if (visibleColumns.includes('meal_allowance')) cols.push(`<td class="text-right">${formatCurrency(emp.meal_allowance)}</td>`);
            if (visibleColumns.includes('salary_type')) cols.push(`<td class="text-center"><span class="badge ${emp.salary_type === 'daily' ? 'badge-info' : emp.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}">${emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}</span></td>`);
            if (visibleColumns.includes('receives_tuang')) cols.push(`<td class="text-center">${emp.receives_tuang !== false ? 'Ya' : 'Tidak'}</td>`);
            if (visibleColumns.includes('phone')) cols.push(`<td>${emp.phone || '-'}</td>`);
            if (visibleColumns.includes('nik')) cols.push(`<td>${emp.nik || '-'}</td>`);
            if (visibleColumns.includes('join_date')) cols.push(`<td>${emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID') : '-'}</td>`);
            if (visibleColumns.includes('gender')) cols.push(`<td>${emp.gender || '-'}</td>`);
            return `<tr>${cols.join('')}</tr>`;
        }).join('');

        const printContent = `
            <html>
            <head>
                <title>Data Karyawan</title>
                <style>
                    @page { size: landscape; margin: 12mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
                    .print-header { text-align: center; margin-bottom: 16px; }
                    .print-header h1 { font-size: 18px; margin: 0 0 4px; color: #1e2952; }
                    .print-header p { font-size: 11px; color: #666; margin: 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { background: #1e2952; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
                    td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
                    tr:nth-child(even) td { background: #f5f7ff; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }
                    .badge-success { background: #d1fae5; color: #065f46; }
                    .badge-warning { background: #fef3c7; color: #92400e; }
                    .badge-info { background: #dbeafe; color: #1e40af; }
                    .footer { text-align: center; margin-top: 16px; font-size: 9px; color: #999; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Data Karyawan</h1>
                    <p>Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} • Total: ${filteredEmployees.length} karyawan</p>
                </div>
                <table>
                    <thead><tr>${printHeaders.join('')}</tr></thead>
                    <tbody>${printRows}</tbody>
                </table>
                <div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Absensi Karyawan</div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="User" size={16} inline /> Data Karyawan</h1>
                <p className="page-subtitle">Kelola data lengkap karyawan</p>
            </div>

            {error && !showModal && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon"><Icon name="Check" size={16} inline /></span> {success}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">Daftar Karyawan</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Cari karyawan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: 240 }}
                        />
                        <select
                            className="form-input form-select"
                            value={tuangFilter}
                            onChange={e => setTuangFilter(e.target.value)}
                            title="Filter penerima tuang"
                            style={{ maxWidth: 180 }}
                        >
                            <option value="all">Semua Tuang</option>
                            <option value="yes">Dapat Tuang</option>
                            <option value="no">Tidak Dapat Tuang</option>
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn"
                                onClick={openColumnModal}
                                title="Atur kolom yang muncul pada tabel"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: '#fff', color: 'var(--gray-700)',
                                    border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                <Icon name="SlidersHorizontal" size={15} inline /> Atur Kolom
                            </button>
                            <button
                                className="btn"
                                onClick={handleDownloadTemplate}
                                disabled={downloadingTemplate}
                                title="Unduh template Excel untuk import karyawan"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    cursor: downloadingTemplate ? 'wait' : 'pointer',
                                    opacity: downloadingTemplate ? 0.7 : 1
                                }}
                            >
                                {downloadingTemplate ? 'Mengunduh...' : 'Template'}
                            </button>
                            <button
                                className="btn"
                                onClick={openImportModal}
                                title="Upload data karyawan dari Excel"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <Icon name="Upload" size={16} inline /> Upload Excel
                            </button>
                            <button
                                className="btn"
                                onClick={handlePrint}
                                title="Print Data Karyawan"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                            >
                                <Icon name="Printer" size={16} inline /> Print
                            </button>
                            <button
                                className="btn"
                                onClick={handleExportPDF}
                                title="Ekspor ke PDF"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #ef4444, #f87171)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                            >
                                <Icon name="FileText" size={16} inline /> PDF
                            </button>
                            <button
                                className="btn"
                                onClick={handleExportExcel}
                                title="Ekspor ke Excel"
                                style={{
                                    padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #22c55e, #4ade80)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                            >
                                <Icon name="BarChart3" size={16} inline /> Excel
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="User" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada karyawan</p>
                    </div>
                ) : (
                    <div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    {visibleColumns.includes('employee_id') && (
                                        <th onClick={() => handleSort('employee_id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            ID <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'employee_id' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('employee_id')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('name') && (
                                        <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Nama <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'name' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('name')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('department') && (
                                        <th onClick={() => handleSort('department')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Departemen <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'department' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('department')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('division') && (
                                        <th onClick={() => handleSort('division')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Divisi <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'division' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('division')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('position') && (
                                        <th onClick={() => handleSort('position')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Jabatan <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'position' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('position')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('employment_status') && (
                                        <th onClick={() => handleSort('employment_status')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Status <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'employment_status' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('employment_status')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('basic_salary') && (
                                        <th onClick={() => handleSort('basic_salary')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Gaji Pokok <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'basic_salary' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('basic_salary')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('appreciation_allowance') && (
                                        <th onClick={() => handleSort('appreciation_allowance')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Tunjangan Apresiasi <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'appreciation_allowance' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('appreciation_allowance')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('transport_allowance') && (
                                        <th onClick={() => handleSort('transport_allowance')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Tunj. Transport <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'transport_allowance' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('transport_allowance')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('meal_allowance') && (
                                        <th onClick={() => handleSort('meal_allowance')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Tunj. Makan <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'meal_allowance' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('meal_allowance')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('salary_type') && (
                                        <th onClick={() => handleSort('salary_type')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Tipe <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'salary_type' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('salary_type')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('receives_tuang') && (
                                        <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Tuang</th>
                                    )}
                                    {visibleColumns.includes('phone') && (
                                        <th style={{ whiteSpace: 'nowrap' }}>No. Telepon</th>
                                    )}
                                    {visibleColumns.includes('nik') && (
                                        <th style={{ whiteSpace: 'nowrap' }}>NIK</th>
                                    )}
                                    {visibleColumns.includes('join_date') && (
                                        <th onClick={() => handleSort('join_date')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Tgl Masuk <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'join_date' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('join_date')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('gender') && (
                                        <th onClick={() => handleSort('gender')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            Gender <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'gender' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('gender')}</span>
                                        </th>
                                    )}
                                    {visibleColumns.includes('actions') && <th>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedEmployees.map(emp => (
                                    <tr key={emp.id}>
                                        {visibleColumns.includes('employee_id') && <td style={{ fontWeight: 500 }}>{emp.employee_id}</td>}
                                        {visibleColumns.includes('name') && (
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{emp.name}</div>
                                                {emp.require_different_checkout && (
                                                    <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                        <Icon name="Compass" size={11} inline /> Beda Titik Pulang
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        {visibleColumns.includes('department') && <td>{emp.department || '-'}</td>}
                                        {visibleColumns.includes('division') && <td>{emp.division || '-'}</td>}
                                        {visibleColumns.includes('position') && <td>{emp.position || '-'}</td>}
                                        {visibleColumns.includes('employment_status') && <td>{employmentStatusLabel(emp.employment_status)}</td>}
                                        {visibleColumns.includes('basic_salary') && <td>{formatCurrency(emp.basic_salary)}</td>}
                                        {visibleColumns.includes('appreciation_allowance') && (
                                            <td style={{ fontWeight: 600, color: 'var(--primary, #7f1d1d)' }}>
                                                {formatCurrency(emp.appreciation_allowance)}
                                            </td>
                                        )}
                                        {visibleColumns.includes('transport_allowance') && <td>{formatCurrency(emp.transport_allowance)}</td>}
                                        {visibleColumns.includes('meal_allowance') && <td>{formatCurrency(emp.meal_allowance)}</td>}
                                        {visibleColumns.includes('salary_type') && (
                                            <td>
                                                <span className={`badge ${emp.salary_type === 'daily' ? 'badge-info' : emp.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                                                    {emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('receives_tuang') && (
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={emp.receives_tuang !== false}
                                                    onChange={e => toggleReceivesTuang(emp, e.target.checked)}
                                                    title={emp.receives_tuang !== false ? 'Dapat tuang (klik untuk menonaktifkan)' : 'Tidak dapat tuang (klik untuk mengaktifkan)'}
                                                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                                                />
                                            </td>
                                        )}
                                        {visibleColumns.includes('phone') && <td>{emp.phone || '-'}</td>}
                                        {visibleColumns.includes('nik') && <td>{emp.nik || '-'}</td>}
                                        {visibleColumns.includes('join_date') && <td>{emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID') : '-'}</td>}
                                        {visibleColumns.includes('gender') && <td>{emp.gender || '-'}</td>}
                                        {visibleColumns.includes('actions') && (
                                            <td>
                                                <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => openDetail(emp)}>
                                                    <Icon name="FileText" size={16} inline /> Detail
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        padding: '0.85rem 1.1rem 1.1rem',
                        borderTop: '1px solid var(--gray-100)',
                    }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                            Menampilkan {pageStart}-{pageEnd} dari {filteredEmployees.length} karyawan
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                title="Halaman pertama"
                                disabled={pageSafe <= 1}
                                onClick={() => setPage(1)}
                                style={pagerBtnStyle(false, pageSafe <= 1)}
                            >
                                <Icon name="ChevronsLeft" size={16} />
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline"
                                title="Halaman sebelumnya"
                                disabled={pageSafe <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                style={pagerBtnStyle(false, pageSafe <= 1)}
                            >
                                <Icon name="ChevronLeft" size={16} />
                            </button>
                            {pageNumbers.map((item) => (
                                typeof item === 'number' ? (
                                    <button
                                        key={item}
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => setPage(item)}
                                        style={pagerBtnStyle(item === pageSafe, false)}
                                    >
                                        {item}
                                    </button>
                                ) : (
                                    <span key={item} style={{ padding: '0 0.25rem', color: 'var(--gray-500)' }}>…</span>
                                )
                            ))}
                            <button
                                type="button"
                                className="btn btn-outline"
                                title="Halaman berikutnya"
                                disabled={pageSafe >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                style={pagerBtnStyle(false, pageSafe >= totalPages)}
                            >
                                <Icon name="ChevronRight" size={16} />
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline"
                                title="Halaman terakhir"
                                disabled={pageSafe >= totalPages}
                                onClick={() => setPage(totalPages)}
                                style={pagerBtnStyle(false, pageSafe >= totalPages)}
                            >
                                <Icon name="ChevronsRight" size={16} />
                            </button>
                        </div>
                    </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Upload Data Karyawan dari Excel</h2>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>&times;</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {importError && (
                                <div className="alert alert-danger mb-3">
                                    <Icon name="AlertTriangle" size={16} inline /> {importError}
                                </div>
                            )}

                            <div className="alert alert-info mb-3">
                                <Icon name="Info" size={16} inline /> Unduh template resmi, isi data, lalu unggah file .xlsx.
                                Kolom wajib: <strong>Employee ID</strong> dan <strong>Nama</strong>.
                                Password wajib hanya untuk karyawan baru (minimal 6 karakter).
                            </div>

                            <div className="form-group">
                                <label className="form-label">File Excel (.xlsx)</label>
                                <input
                                    type="file"
                                    className="form-input"
                                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={(e) => {
                                        setImportFile(e.target.files?.[0] || null);
                                        setImportResult(null);
                                        setImportError('');
                                    }}
                                />
                                {importFile && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                                        File dipilih: {importFile.name}
                                    </p>
                                )}
                            </div>

                            {importResult && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div className={`alert mb-3 ${(importResult.imported || 0) + (importResult.updated || 0) > 0 ? 'alert-success' : 'alert-warning'}`}>
                                        {(importResult.imported || 0) + (importResult.updated || 0) > 0 ? 'CheckCircle2' : 'AlertTriangle'}{' '}
                                        Ditambah: <strong>{importResult.imported || 0}</strong>
                                        {' · '}Diperbarui: <strong>{importResult.updated || 0}</strong>
                                        {' · '}Gagal: <strong>{importResult.failed || 0}</strong>
                                    </div>

                                    {importResult.results?.length > 0 && (
                                        <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                                            <table className="table" style={{ fontSize: '0.8rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Baris</th>
                                                        <th>ID</th>
                                                        <th>Status</th>
                                                        <th>Keterangan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importResult.results.map((item) => (
                                                        <tr key={`${item.row}-${item.name}`}>
                                                            <td>{item.row}</td>
                                                            <td>{item.name}</td>
                                                            <td>
                                                                <span style={{
                                                                    fontWeight: 600,
                                                                    color: item.status === 'success'
                                                                        ? 'var(--success-500, #10b981)'
                                                                        : 'var(--danger-500)'
                                                                }}>
                                                                    {item.status === 'success' ? 'Berhasil' : 'Gagal'}
                                                                </span>
                                                            </td>
                                                            <td>{item.message}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={handleDownloadTemplate}
                                    disabled={downloadingTemplate}
                                >
                                    {downloadingTemplate ? 'Mengunduh...' : 'Unduh Template'}
                                </button>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button type="button" className="btn btn-outline" onClick={() => setShowImportModal(false)}>
                                        Tutup
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleImportEmployees}
                                        disabled={importing || !importFile}
                                    >
                                        {importing ? 'Mengimpor...' : 'Unggah & Import'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showModal && selectedEmployee && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Detail: {selectedEmployee.name} ({selectedEmployee.employee_id})
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="X" size={16} /></button>
                        </div>

                        {/* Tab Navigation */}
                        <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#000000' }}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                                        color: activeTab === tab.id ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                                        borderBottom: activeTab === tab.id ? '2px solid #ffffff' : '2px solid transparent',
                                        fontWeight: activeTab === tab.id ? 600 : 400, fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error}</div>}

                                {/* Tab: Data Pribadi */}
                                {activeTab === 'personal' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">NIK</label>
                                            <input className="form-input" value={formData.nik} onChange={e => updateField('nik', e.target.value)} placeholder="Nomor Induk Kependudukan" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. Telepon</label>
                                            <input className="form-input" value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. Kartu Keluarga</label>
                                            <input className="form-input" value={formData.no_kk} onChange={e => updateField('no_kk', e.target.value)} placeholder="Nomor Kartu Keluarga" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tempat Lahir</label>
                                            <input className="form-input" value={formData.birth_place} onChange={e => updateField('birth_place', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tanggal Lahir</label>
                                            <input className="form-input" type="date" value={formData.birth_date} onChange={e => updateField('birth_date', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Jenis Kelamin</label>
                                            <select className="form-input form-select" value={formData.gender} onChange={e => updateField('gender', e.target.value)}>
                                                <option value="">Pilih...</option>
                                                <option value="Laki-laki">Laki-laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status Pernikahan</label>
                                            <select className="form-input form-select" value={formData.marital_status} onChange={e => updateField('marital_status', e.target.value)}>
                                                <option value="Belum Menikah">Belum Menikah</option>
                                                <option value="Menikah">Menikah</option>
                                                <option value="Cerai">Cerai</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Agama</label>
                                            <select className="form-input form-select" value={formData.religion} onChange={e => updateField('religion', e.target.value)}>
                                                <option value="">Pilih...</option>
                                                <option value="Islam">Islam</option>
                                                <option value="Kristen">Kristen</option>
                                                <option value="Katolik">Katolik</option>
                                                <option value="Hindu">Hindu</option>
                                                <option value="Buddha">Buddha</option>
                                                <option value="Konghucu">Konghucu</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Pendidikan Terakhir</label>
                                            <select className="form-input form-select" value={formData.education} onChange={e => updateField('education', e.target.value)}>
                                                <option value="">Pilih...</option>
                                                <option value="SD">SD</option>
                                                <option value="SMP">SMP</option>
                                                <option value="SMA/SMK">SMA/SMK</option>
                                                <option value="D3">D3</option>
                                                <option value="S1">S1</option>
                                                <option value="S2">S2</option>
                                                <option value="S3">S3</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">Alamat</label>
                                            <textarea className="form-input" rows={2} value={formData.address} onChange={e => updateField('address', e.target.value)} placeholder="Alamat lengkap" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Kontak Darurat (Nama)</label>
                                            <input className="form-input" value={formData.emergency_contact_name} onChange={e => updateField('emergency_contact_name', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Kontak Darurat (Telepon)</label>
                                            <input className="form-input" value={formData.emergency_contact_phone} onChange={e => updateField('emergency_contact_phone', e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Data Kerja */}
                                {activeTab === 'work' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">Departemen</label>
                                            <select className="form-input form-select" value={formData.department} onChange={e => updateField('department', e.target.value)}>
                                                <option value="">Pilih Departemen...</option>
                                                {masterDepartments.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name}</option>
                                                ))}
                                                {formData.department && !masterDepartments.find(d => d.name === formData.department) && (
                                                    <option value={formData.department}>{formData.department}</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Divisi</label>
                                            <select className="form-input form-select" value={formData.division} onChange={e => updateField('division', e.target.value)}>
                                                <option value="">Pilih Divisi...</option>
                                                {masterDivisions.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name}</option>
                                                ))}
                                                {formData.division && !masterDivisions.find(d => d.name === formData.division) && (
                                                    <option value={formData.division}>{formData.division}</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Jabatan</label>
                                            <select className="form-input form-select" value={formData.position} onChange={e => updateField('position', e.target.value)}>
                                                <option value="">Pilih Jabatan...</option>
                                                {masterPositions.map(p => (
                                                    <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                                {formData.position && !masterPositions.find(p => p.name === formData.position) && (
                                                    <option value={formData.position}>{formData.position}</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status Karyawan</label>
                                            <select className="form-input form-select" value={formData.employment_status} onChange={e => updateField('employment_status', e.target.value)}>
                                                <option value="">Pilih Status...</option>
                                                {masterEmploymentStatuses.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                                {formData.employment_status && !masterEmploymentStatuses.find(s => s.name === formData.employment_status) && (
                                                    <option value={formData.employment_status}>{employmentStatusLabel(formData.employment_status)}</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tanggal Masuk</label>
                                            <input className="form-input" type="date" value={formData.join_date} onChange={e => updateField('join_date', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Atasan Langsung</label>
                                            <select className="form-input form-select" value={formData.supervisor_id || ''} onChange={e => updateField('supervisor_id', e.target.value ? Number(e.target.value) : '')}>
                                                <option value="">— Tidak ada atasan —</option>
                                                {orgMembers.filter(m => m.id !== selectedEmployee?.id).map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name}{m.position ? ` (${m.position})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                                                Dipakai untuk rantai approval izin & cuti. Bisa juga diatur di menu Struktur Organisasi.
                                            </small>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Bank & Pajak */}
                                {activeTab === 'bank' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">Nama Bank</label>
                                            <input className="form-input" value={formData.bank_name} onChange={e => updateField('bank_name', e.target.value)} placeholder="BCA, Mandiri, BRI, dll" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. Rekening</label>
                                            <input className="form-input" value={formData.bank_account} onChange={e => updateField('bank_account', e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">Nama Pemilik Rekening</label>
                                            <input className="form-input" value={formData.bank_holder} onChange={e => updateField('bank_holder', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">NPWP</label>
                                            <input className="form-input" value={formData.npwp} onChange={e => updateField('npwp', e.target.value)} placeholder="XX.XXX.XXX.X-XXX.XXX" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status Pajak (PTKP)</label>
                                            <select className="form-input form-select" value={formData.tax_status} onChange={e => updateField('tax_status', e.target.value)}>
                                                <option value="TK/0">TK/0 - Tidak Kawin</option>
                                                <option value="TK/1">TK/1</option>
                                                <option value="TK/2">TK/2</option>
                                                <option value="TK/3">TK/3</option>
                                                <option value="K/0">K/0 - Kawin</option>
                                                <option value="K/1">K/1</option>
                                                <option value="K/2">K/2</option>
                                                <option value="K/3">K/3</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. BPJS Kesehatan</label>
                                            <input className="form-input" value={formData.bpjs_kesehatan_no} onChange={e => updateField('bpjs_kesehatan_no', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. BPJS Ketenagakerjaan</label>
                                            <input className="form-input" value={formData.bpjs_ketenagakerjaan_no} onChange={e => updateField('bpjs_ketenagakerjaan_no', e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Gaji & Tunjangan */}
                                {activeTab === 'salary' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">Tipe Gaji</label>
                                            <select className="form-input form-select" value={formData.salary_type} onChange={e => updateField('salary_type', e.target.value)}>
                                                <option value="monthly">Bulanan</option>
                                                <option value="weekly">Mingguan</option>
                                                <option value="daily">Harian</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">
                                                {formData.salary_type === 'daily' ? 'Gaji per Hari (Rp)' : formData.salary_type === 'weekly' ? 'Gaji per Minggu (Rp)' : 'Gaji per Bulan (Rp)'}
                                            </label>
                                            <input {...moneyInputProps('basic_salary')} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tunjangan Transport (Rp/bln)</label>
                                            <input {...moneyInputProps('transport_allowance')} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tunjangan Makan (Rp/bln)</label>
                                            <input {...moneyInputProps('meal_allowance')} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tunjangan Apresiasi (Rp/bln)</label>
                                            <input {...moneyInputProps('appreciation_allowance')} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tarif Lembur/Jam (Rp)</label>
                                            <input {...moneyInputProps('overtime_rate')} />
                                        </div>

                                        <div style={{ gridColumn: '1 / -1', padding: '1rem', background: 'rgba(234,88,12,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234,88,12,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.receives_tuang !== false}
                                                        onChange={e => updateField('receives_tuang', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.receives_tuang !== false ? 'linear-gradient(135deg, #ea580c, #f97316)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.receives_tuang !== false ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.receives_tuang !== false ? '#ea580c' : 'var(--gray-300)', fontSize: '0.9rem' }}>
                                                        Penerima Insentif Tuang
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Nonaktifkan jika karyawan ini tidak mendapat tuang produksi. Nama tidak akan muncul di daftar Input Harian Tuang.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Driver Toggle */}
                                        <div style={{ gridColumn: '1 / -1', padding: '1rem', background: 'rgba(168,85,247,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(168,85,247,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: formData.is_driver ? '1rem' : 0 }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_driver}
                                                        onChange={e => updateField('is_driver', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.is_driver ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.is_driver ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.is_driver ? 'var(--primary-300)' : 'var(--gray-300)', fontSize: '0.9rem' }}>
                                                        <Icon name="Truck" size={16} inline /> Driver & Kenek
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini adalah driver atau kenek. Menu tracking pengiriman ikut terbuka.
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.is_driver && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="Moon" size={16} inline /> Uang Jalan Subuh (Rp)</label>
                                                        <input {...moneyInputProps('driver_subuh_allowance')} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="RefreshCw" size={16} inline /> Uang Mel / RIT (Rp)</label>
                                                        <input {...moneyInputProps('driver_rit_allowance')} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="Building2" size={16} inline /> Uang Menginap/Hari (Rp)</label>
                                                        <input {...moneyInputProps('driver_inap_allowance')} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="Truck" size={16} inline /> Uang Ritase Jarak Dekat (Rp)</label>
                                                        <input {...moneyInputProps('driver_ritase_dekat_allowance')} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="Truck" size={16} inline /> Uang Ritase Jarak Jauh (Rp)</label>
                                                        <input {...moneyInputProps('driver_ritase_jauh_allowance')} />
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', gridColumn: '1 / -1', marginTop: '-0.25rem', marginBottom: '0.25rem', lineHeight: 1.2 }}>
                                                        *Otomatis dihitung mulai dari perjalanan (RIT) ke-2 dan seterusnya
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}><Icon name="Car" size={16} inline /> Jenis Kendaraan</label>
                                                        <select className="form-input form-select" value={formData.vehicle_type_id} onChange={e => updateField('vehicle_type_id', e.target.value)}>
                                                            <option value="">Pilih Jenis Kendaraan...</option>
                                                            {masterVehicleTypes.map(vt => (
                                                                <option key={vt.id} value={vt.id}>{vt.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Collector Toggle */}
                                        <div style={{ gridColumn: '1 / -1', padding: '1rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_collector}
                                                        onChange={e => updateField('is_collector', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.is_collector ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.is_collector ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.is_collector ? 'var(--warning-400)' : 'var(--gray-300)', fontSize: '0.9rem' }}>
                                                        <Icon name="Wallet" size={16} inline /> Collector / Penagih
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini bertugas menagih ke customer. Menu tracking penagihan ikut terbuka.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sales Toggle */}
                                        <div style={{ gridColumn: '1 / -1', padding: '1rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_sales}
                                                        onChange={e => updateField('is_sales', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.is_sales ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.is_sales ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.is_sales ? 'var(--success-400)' : 'var(--gray-300)', fontSize: '0.9rem' }}>
                                                        <Icon name="Handshake" size={16} inline /> Sales
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini bertugas kunjungan penjualan ke customer. Menu tracking sales ikut terbuka.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tracking App Access Toggle */}
                                        <div style={{ gridColumn: '1 / -1', padding: '1rem', background: 'rgba(20,184,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(20,184,166,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.use_tracking}
                                                        onChange={e => updateField('use_tracking', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.use_tracking ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.use_tracking ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.use_tracking ? 'var(--teal-400)' : 'var(--gray-300)', fontSize: '0.9rem' }}>
                                                        <Icon name="MapPin" size={16} inline /> Akses Fitur Tracking
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Wajib check-in/out GPS di lokasi. Otomatis aktif jika Driver, Collector, atau Sales diaktifkan. Bisa juga untuk tugas lapangan lain.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            <Icon name="Info" size={16} inline /> <strong>Info tipe gaji:</strong><br />
                                            • <strong>Harian</strong> = gaji per hari × jumlah hari hadir (absensi)<br />
                                            • <strong>Mingguan</strong> = gaji per minggu × jumlah minggu bekerja<br />
                                            • <strong>Bulanan</strong> = gaji tetap per bulan
                                        </div>
                                    </div>
                                )}

                                {/* Tab: BPJS & PPh */}
                                {activeTab === 'bpjs' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            <Icon name="Info" size={16} inline /> <strong>Pengaturan BPJS & PPh 21 per karyawan.</strong><br />
                                            Toggle OFF jika karyawan belum terdaftar (misal masih masa percobaan 3 bulan).<br />
                                            Rate kosong = gunakan rate default sesuai peraturan.
                                        </div>

                                        {/* BPJS Kesehatan */}
                                        {(() => {
                                            const bpjsItems = [
                                                { code: 'BPJS_KES', label: 'BPJS Kesehatan', enrollField: 'bpjs_kes_enrolled', empRateField: 'bpjs_kes_employee_rate', compRateField: 'bpjs_kes_company_rate', empDefault: 1, compDefault: 4, color: '#10b981' },
                                                { code: 'BPJS_JHT', label: 'BPJS JHT (Jaminan Hari Tua)', enrollField: 'bpjs_jht_enrolled', empRateField: 'bpjs_jht_employee_rate', compRateField: 'bpjs_jht_company_rate', empDefault: 2, compDefault: 3.7, color: '#3b82f6' },
                                                { code: 'BPJS_JP', label: 'BPJS JP (Jaminan Pensiun)', enrollField: 'bpjs_jp_enrolled', empRateField: 'bpjs_jp_employee_rate', compRateField: 'bpjs_jp_company_rate', empDefault: 1, compDefault: 2, color: '#8b5cf6' },
                                                { code: 'BPJS_JKK', label: 'BPJS JKK (Kecelakaan Kerja)', enrollField: 'bpjs_jkk_enrolled', empRateField: null, compRateField: 'bpjs_jkk_rate', empDefault: null, compDefault: 0.24, color: '#f59e0b' },
                                                { code: 'BPJS_JKM', label: 'BPJS JKM (Kematian)', enrollField: 'bpjs_jkm_enrolled', empRateField: null, compRateField: 'bpjs_jkm_rate', empDefault: null, compDefault: 0.3, color: '#ef4444' },
                                            ];
                                            return bpjsItems.map(item => {
                                                const isActive = formData[item.enrollField];
                                                const dbItem = bpjsDefaults[item.code];
                                                const defEmp = dbItem ? (parseFloat(dbItem.employee_rate) * 100).toFixed(2) : item.empDefault;
                                                const defComp = dbItem ? (parseFloat(dbItem.company_rate) * 100).toFixed(2) : item.compDefault;
                                                return (
                                                    <div key={item.code} style={{ padding: '1rem', background: isActive ? `${item.color}10` : 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: `1px solid ${isActive ? item.color + '40' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.3s' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: isActive ? '0.75rem' : 0 }}>
                                                            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isActive} onChange={e => updateField(item.enrollField, e.target.checked)} style={{ display: 'none' }} />
                                                                <span style={{ width: 44, height: 24, borderRadius: 12, background: isActive ? `linear-gradient(135deg, ${item.color}, ${item.color}cc)` : 'var(--gray-600)', position: 'relative', display: 'inline-block', transition: 'background 0.3s', flexShrink: 0 }}>
                                                                    <span style={{ position: 'absolute', top: 3, left: isActive ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                                                </span>
                                                            </label>
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--gray-500)', fontSize: '0.9rem' }}>
                                                                    {item.label}
                                                                </span>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                                    {isActive ? 'Aktif' : 'Tidak aktif - tidak dipotong saat payroll'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {isActive && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: item.empRateField ? '1fr 1fr' : '1fr', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
                                                                {item.empRateField && (
                                                                    <div className="form-group" style={{ margin: 0 }}>
                                                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Rate Karyawan (%)</label>
                                                                        <input className="form-input" type="number" step="0.01" value={formData[item.empRateField]} onChange={e => updateField(item.empRateField, e.target.value)} placeholder={`Default: ${defEmp}%`} />
                                                                    </div>
                                                                )}
                                                                <div className="form-group" style={{ margin: 0 }}>
                                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{item.empRateField ? 'Rate Perusahaan (%)' : 'Rate (%)'}</label>
                                                                    <input className="form-input" type="number" step="0.01" value={formData[item.compRateField]} onChange={e => updateField(item.compRateField, e.target.value)} placeholder={`Default: ${defComp}%`} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}

                                        {/* PPh 21 Toggle */}
                                        <div style={{ padding: '1rem', background: formData.pph21_enabled ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: `1px solid ${formData.pph21_enabled ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.3s' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={formData.pph21_enabled} onChange={e => updateField('pph21_enabled', e.target.checked)} style={{ display: 'none' }} />
                                                    <span style={{ width: 44, height: 24, borderRadius: 12, background: formData.pph21_enabled ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--gray-600)', position: 'relative', display: 'inline-block', transition: 'background 0.3s', flexShrink: 0 }}>
                                                        <span style={{ position: 'absolute', top: 3, left: formData.pph21_enabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                                    </span>
                                                </label>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: formData.pph21_enabled ? 'var(--text-primary)' : 'var(--gray-500)', fontSize: '0.9rem' }}>
                                                        <Icon name="Wallet" size={16} inline /> PPh 21 (Pajak Penghasilan)
                                                    </span>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                        {formData.pph21_enabled ? 'Aktif - dihitung otomatis berdasarkan tarif progresif' : 'Tidak aktif - PPh 21 tidak dipotong'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Lokasi Absen */}
                                {activeTab === 'locations' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {/* Toggle Wajib Beda Lokasi Checkout */}
                                        <div style={{
                                            padding: '1rem',
                                            background: formData.require_different_checkout ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                            borderRadius: 'var(--radius-md)',
                                            border: formData.require_different_checkout ? '1.5px solid var(--primary-500)' : '1px solid var(--gray-700)',
                                            transition: 'all 0.25s'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginTop: 2 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.require_different_checkout || false}
                                                        onChange={e => updateField('require_different_checkout', e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 44, height: 24, borderRadius: 12,
                                                        background: formData.require_different_checkout ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'var(--gray-600)',
                                                        position: 'relative', display: 'inline-block',
                                                        transition: 'background 0.3s', flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute', top: 3, left: formData.require_different_checkout ? 23 : 3,
                                                            width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.3s',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                        }} />
                                                    </span>
                                                </label>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontWeight: 600, color: formData.require_different_checkout ? 'var(--primary-400)' : 'var(--text-primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Icon name="Compass" size={16} inline /> Wajib Beda Titik / Lokasi Saat Pulang (Check-out)
                                                    </span>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 4, lineHeight: 1.4 }}>
                                                        Jika diaktifkan, karyawan ini <strong>tidak boleh</strong> absen pulang di titik koordinat / lokasi yang sama dengan saat ia absen masuk.
                                                        Sangat cocok khusus untuk kurir, sales lapangan, driver ritase, atau teknisi keliling.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                            <Icon name="Info" size={16} inline /> <strong>Pengaturan Lokasi Absen:</strong><br />
                                            Centang lokasi mana saja yang diizinkan untuk karyawan ini melakukan absensi. <br/>
                                            <em>Jika tidak ada satupun yang dicentang, maka karyawan diizinkan absen di semua lokasi (Default).</em>
                                        </div>

                                        <div className="card" style={{ padding: '1rem', border: '1px solid var(--gray-700)' }}>
                                            {masterLocations.length === 0 ? (
                                                <p style={{ textAlign: 'center', color: 'var(--gray-400)', margin: '1rem 0' }}>Belum ada master lokasi yang aktif.</p>
                                            ) : (
                                                <>
                                                    {(() => {
                                                        const selectedIds = formData.location_ids || [];
                                                        const allSelected = masterLocations.length > 0 && masterLocations.every(loc => selectedIds.includes(loc.id));
                                                        const someSelected = !allSelected && masterLocations.some(loc => selectedIds.includes(loc.id));
                                                        return (
                                                            <div
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                                    padding: '0.6rem 0.75rem', marginBottom: '0.75rem',
                                                                    background: allSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    border: allSelected ? '1px solid var(--primary-500)' : '1px solid var(--gray-700)',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={toggleAllLocations}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allSelected}
                                                                    ref={el => { if (el) el.indeterminate = someSelected; }}
                                                                    onChange={() => {}}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: allSelected ? 'var(--primary-400)' : 'var(--text-primary)' }}>
                                                                        Pilih Semua
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                                                                        {allSelected
                                                                            ? `${masterLocations.length} lokasi dipilih`
                                                                            : someSelected
                                                                                ? `${selectedIds.filter(id => masterLocations.some(l => l.id === id)).length} dari ${masterLocations.length} dipilih`
                                                                                : 'Centang untuk memilih semua lokasi'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    {masterLocations.map(loc => {
                                                        const isChecked = formData.location_ids && formData.location_ids.includes(loc.id);
                                                        return (
                                                            <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: isChecked ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: isChecked ? '1px solid var(--primary-500)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => toggleLocation(loc.id)}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked} 
                                                                    onChange={() => {}} // dummy onChange to suppress warning, handled by parent onClick
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontWeight: 500, color: isChecked ? 'var(--primary-400)' : 'var(--text-primary)' }}>{loc.name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Radius: {loc.radius_meters}m</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Dokumen */}
                                {activeTab === 'documents' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            <Icon name="Paperclip" size={16} inline /> <strong>Upload dokumen karyawan</strong> (KTP, KK, Ijazah, dll). Max 10MB per file. Format: JPG, PNG, PDF, DOC.
                                        </div>

                                        {/* Upload Form */}
                                        <div style={{ padding: '1rem', background: 'rgba(168,85,247,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(168,85,247,0.2)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Tipe Dokumen</label>
                                                    <select className="form-input form-select" value={docType} onChange={e => setDocType(e.target.value)}>
                                                        {DOC_TYPES.map(dt => (
                                                            <option key={dt.value} value={dt.value}>{dt.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Catatan (opsional)</label>
                                                    <input className="form-input" value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="Keterangan tambahan..." />
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    border: '2px dashed rgba(168,85,247,0.4)', borderRadius: 'var(--radius-md)',
                                                    padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
                                                    background: 'rgba(168,85,247,0.03)', transition: 'all 0.2s'
                                                }}
                                                onClick={() => document.getElementById('doc-upload-input').click()}
                                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
                                                onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; e.currentTarget.style.background = 'rgba(168,85,247,0.03)'; }}
                                                onDrop={async e => {
                                                    e.preventDefault();
                                                    e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)';
                                                    e.currentTarget.style.background = 'rgba(168,85,247,0.03)';
                                                    const file = e.dataTransfer.files[0];
                                                    if (file) {
                                                        setUploadingDoc(true);
                                                        try {
                                                            const fd = new FormData();
                                                            fd.append('file', file);
                                                            fd.append('doc_type', docType);
                                                            fd.append('notes', docNotes);
                                                            await employeesAPI.uploadDocument(selectedEmployee.id, fd);
                                                            const docs = await employeesAPI.getDocuments(selectedEmployee.id);
                                                            setDocuments(docs);
                                                            setDocNotes('');
                                                            setSuccess('Dokumen berhasil diupload');
                                                        } catch (err) {
                                                            setError(err.message || 'Gagal upload dokumen');
                                                        } finally {
                                                            setUploadingDoc(false);
                                                        }
                                                    }
                                                }}
                                            >
                                                <input
                                                    id="doc-upload-input" type="file" style={{ display: 'none' }}
                                                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                                                    onChange={async e => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        setUploadingDoc(true);
                                                        try {
                                                            const fd = new FormData();
                                                            fd.append('file', file);
                                                            fd.append('doc_type', docType);
                                                            fd.append('notes', docNotes);
                                                            await employeesAPI.uploadDocument(selectedEmployee.id, fd);
                                                            const docs = await employeesAPI.getDocuments(selectedEmployee.id);
                                                            setDocuments(docs);
                                                            setDocNotes('');
                                                            setSuccess('Dokumen berhasil diupload');
                                                        } catch (err) {
                                                            setError(err.message || 'Gagal upload dokumen');
                                                        } finally {
                                                            setUploadingDoc(false);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                                {uploadingDoc ? (
                                                    <div><div className="loading-spinner" style={{ margin: '0 auto', width: 24, height: 24 }} /> <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: 4 }}>Mengupload...</span></div>
                                                ) : (
                                                    <>
                                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><Icon name="Upload" size={16} inline /></div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--gray-300)' }}>Klik atau drag & drop file di sini</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 4 }}>JPG, PNG, PDF, DOC • Max 10MB</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Document List */}
                                        {documents.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                                                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}><Icon name="FolderOpen" size={16} inline /></div>
                                                <p>Belum ada dokumen yang diupload</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {documents.map(doc => {
                                                    const isImage = /\.(jpg|jpeg|png)$/i.test(doc.file_path);
                                                    const isPDF = /\.pdf$/i.test(doc.file_path);
                                                    const typeLabel = DOC_TYPES.find(dt => dt.value === doc.doc_type)?.label || doc.doc_type;
                                                    const fileSize = doc.file_size > 1024 * 1024 ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(doc.file_size / 1024)} KB`;
                                                    const typeColors = { KTP: '#3b82f6', KK: '#10b981', IJAZAH: '#f59e0b', SKCK: '#8b5cf6', SIM: '#06b6d4', SURAT_LAMARAN: '#ec4899', CV: '#6366f1', SERTIFIKAT: '#14b8a6', KONTRAK: '#ef4444', LAINNYA: '#6b7280' };
                                                    const color = typeColors[doc.doc_type] || '#6b7280';
                                                    return (
                                                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s' }}>
                                                            {/* Icon */}
                                                            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>
                                                                {isImage ? 'Image' : isPDF ? 'FileText' : 'FileText'}
                                                            </div>
                                                            {/* Info */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                                                                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: `${color}25`, color: color, fontWeight: 700, textTransform: 'uppercase' }}>{doc.doc_type}</span>
                                                                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.doc_name}</span>
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                                                    {fileSize} • {new Date(doc.uploaded_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    {doc.notes && ` • ${doc.notes}`}
                                                                </div>
                                                            </div>
                                                            {/* Actions */}
                                                            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                                                <a href={doc.file_path} target="_blank" rel="noopener noreferrer" title="Lihat / Download"
                                                                    style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                                                                    <Icon name="Eye" size={16} inline />
                                                                </a>
                                                                <button title="Hapus" onClick={async () => {
                                                                    if (!confirm(`Hapus dokumen "${doc.doc_name}"?`)) return;
                                                                    try {
                                                                        await employeesAPI.deleteDocument(selectedEmployee.id, doc.id);
                                                                        setDocuments(prev => prev.filter(d => d.id !== doc.id));
                                                                        setSuccess('Dokumen berhasil dihapus');
                                                                    } catch (err) {
                                                                        setError(err.message || 'Gagal menghapus dokumen');
                                                                    }
                                                                }}
                                                                    style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    <Icon name="Trash2" size={16} inline />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Pengaturan Kolom Tampilan */}
            {showColumnModal && (
                <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal" style={{ maxWidth: '620px', width: '92%', borderRadius: 'var(--radius-lg)', background: '#fff', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', margin: 0 }}>
                                    <Icon name="SlidersHorizontal" size={18} inline /> Pengaturan Kolom Tampilan
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                    Pilih kolom / field data karyawan yang ingin ditampilkan pada tabel
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setShowColumnModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--gray-400)', padding: '0.25rem' }}
                            >
                                <Icon name="X" size={18} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                                    <strong>{tempColumns.length}</strong> dari {AVAILABLE_EMPLOYEE_COLUMNS.length} kolom aktif
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={handleSelectAllColumns}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                    >
                                        Pilih Semua
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={handleResetColumns}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                    >
                                        Reset Bawaan
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.65rem' }}>
                                {AVAILABLE_EMPLOYEE_COLUMNS.map(col => {
                                    const isChecked = tempColumns.includes(col.key);
                                    const isRequired = col.required;
                                    const isHighlighted = col.key === 'appreciation_allowance';
                                    return (
                                        <label
                                            key={col.key}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 0.85rem',
                                                borderRadius: 'var(--radius-md)',
                                                border: `1.5px solid ${isChecked ? (isHighlighted ? 'var(--primary, #7f1d1d)' : 'var(--gray-400)') : 'var(--gray-200)'}`,
                                                background: isChecked ? (isHighlighted ? 'rgba(127, 29, 29, 0.04)' : '#f9fafb') : '#fff',
                                                cursor: isRequired ? 'not-allowed' : 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isRequired}
                                                onChange={() => toggleTempColumn(col.key)}
                                                style={{ width: '17px', height: '17px', cursor: isRequired ? 'not-allowed' : 'pointer' }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    {col.label}
                                                    {isRequired && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 400 }}>(Wajib)</span>
                                                    )}
                                                    {isHighlighted && (
                                                        <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                                                            Pilihan Baru
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                    Kategori: {col.category}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50, #f9fafb)' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setShowColumnModal(false)}
                                disabled={savingColumns}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveColumns}
                                disabled={savingColumns}
                                style={{ minWidth: '130px' }}
                            >
                                {savingColumns ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
