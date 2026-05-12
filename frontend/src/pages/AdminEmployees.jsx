import { useState, useEffect, useCallback, useMemo } from 'react';
import { employeesAPI, authAPI, departmentsAPI, positionsAPI, locationsAPI, settingsAPI, vehicleTypesAPI } from '../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TABS = [
    { id: 'personal', label: '👤 Data Pribadi' },
    { id: 'work', label: '💼 Data Kerja' },
    { id: 'bank', label: '🏦 Bank & Pajak' },
    { id: 'salary', label: '💰 Gaji & Tunjangan' },
    { id: 'bpjs', label: '🏥 BPJS & PPh' },
    { id: 'locations', label: '📍 Lokasi Absen' },
    { id: 'documents', label: '📎 Dokumen' },
];

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
    const [masterLocations, setMasterLocations] = useState([]);
    const [masterVehicleTypes, setMasterVehicleTypes] = useState([]);
    const [bpjsDefaults, setBpjsDefaults] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [activeTab, setActiveTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'employee_id', direction: 'asc' });
    const [documents, setDocuments] = useState([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docType, setDocType] = useState('KTP');
    const [docNotes, setDocNotes] = useState('');
    const [formData, setFormData] = useState({
        nik: '', no_kk: '', phone: '', address: '', birth_date: '', birth_place: '',
        gender: '', marital_status: 'Belum Menikah', religion: '', education: '',
        department: '', position: '', join_date: '',
        bank_name: '', bank_account: '', bank_holder: '',
        npwp: '', bpjs_kesehatan_no: '', bpjs_ketenagakerjaan_no: '',
        basic_salary: 0, salary_type: 'monthly', transport_allowance: 0, meal_allowance: 0, overtime_rate: 50000,
        is_driver: false, driver_subuh_allowance: 0, driver_rit_allowance: 0, driver_inap_allowance: 0, driver_ritase_allowance: 0,
        vehicle_type_id: '', tax_status: 'TK/0', emergency_contact_name: '', emergency_contact_phone: '',
        location_ids: [],
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
    }, []);

    async function fetchMasters() {
        try {
            const depts = await departmentsAPI.getAll();
            const pos = await positionsAPI.getAll();
            const loc = await locationsAPI.getAll();
            const vts = await vehicleTypesAPI.getAll();
            setMasterDepartments(depts);
            setMasterPositions(pos);
            setMasterLocations(loc.filter(l => l.is_active));
            setMasterVehicleTypes(vts);
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
            setEmployees(data);
        } catch (err) {
            console.error('Failed to fetch employees:', err);
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
                join_date: d.join_date ? d.join_date.split('T')[0] : '',
                bank_name: d.bank_name || '', bank_account: d.bank_account || '',
                bank_holder: d.bank_holder || '',
                npwp: d.npwp || '', bpjs_kesehatan_no: d.bpjs_kesehatan_no || '',
                bpjs_ketenagakerjaan_no: d.bpjs_ketenagakerjaan_no || '',
                basic_salary: d.basic_salary || 0, salary_type: d.salary_type || 'monthly',
                transport_allowance: d.transport_allowance || 0,
                meal_allowance: d.meal_allowance || 0, overtime_rate: d.overtime_rate || 50000,
                is_driver: d.is_driver || false,
                is_collector: d.is_collector || false,
                use_tracking: d.use_tracking || false,
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
        setFormData(prev => ({ ...prev, [field]: value }));
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
        if (sortConfig.key !== key) return '⇅';
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    }

    const filteredEmployees = useMemo(() => {
        let result = employees.filter(e =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase())
        );

        // Sort
        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Handle numeric fields
                if (sortConfig.key === 'basic_salary') {
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
    }, [employees, search, sortConfig]);

    // Export to Excel
    function handleExportExcel() {
        const data = filteredEmployees.map((emp, i) => ({
            'No': i + 1,
            'ID Karyawan': emp.employee_id,
            'Nama': emp.name,
            'Departemen': emp.department || '-',
            'Jabatan': emp.position || '-',
            'Gaji Pokok': emp.basic_salary || 0,
            'Tipe Gaji': emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 14 }, // ID
            { wch: 28 }, // Nama
            { wch: 18 }, // Departemen
            { wch: 18 }, // Jabatan
            { wch: 18 }, // Gaji Pokok
            { wch: 12 }, // Tipe Gaji
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');
        XLSX.writeFile(wb, `Data_Karyawan_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // Export to PDF
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

        const tableData = filteredEmployees.map((emp, i) => [
            i + 1,
            emp.employee_id,
            emp.name,
            emp.department || '-',
            emp.position || '-',
            formatCurrency(emp.basic_salary),
            emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'
        ]);

        doc.autoTable({
            startY: 28,
            head: [['No', 'ID Karyawan', 'Nama', 'Departemen', 'Jabatan', 'Gaji Pokok', 'Tipe Gaji']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [30, 41, 82], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            alternateRowStyles: { fillColor: [240, 243, 255] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 28 },
                2: { cellWidth: 50 },
                5: { halign: 'right' },
                6: { halign: 'center', cellWidth: 22 }
            },
            didDrawPage: (data) => {
                // Footer
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(`Halaman ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 7, { align: 'center' });
            }
        });

        doc.save(`Data_Karyawan_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    // Print
    function handlePrint() {
        const printContent = `
            <html>
            <head>
                <title>Data Karyawan</title>
                <style>
                    @page { size: landscape; margin: 15mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
                    .print-header { text-align: center; margin-bottom: 20px; }
                    .print-header h1 { font-size: 20px; margin: 0 0 4px; color: #1e2952; }
                    .print-header p { font-size: 11px; color: #666; margin: 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { background: #1e2952; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
                    td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
                    tr:nth-child(even) td { background: #f5f7ff; }
                    tr:hover td { background: #eef1ff; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
                    .badge-success { background: #d1fae5; color: #065f46; }
                    .badge-warning { background: #fef3c7; color: #92400e; }
                    .badge-info { background: #dbeafe; color: #1e40af; }
                    .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #999; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>📋 Data Karyawan</h1>
                    <p>Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}  •  Total: ${filteredEmployees.length} karyawan</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="text-center">No</th>
                            <th>ID Karyawan</th>
                            <th>Nama</th>
                            <th>Departemen</th>
                            <th>Jabatan</th>
                            <th class="text-right">Gaji Pokok</th>
                            <th class="text-center">Tipe Gaji</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredEmployees.map((emp, i) => `
                            <tr>
                                <td class="text-center">${i + 1}</td>
                                <td>${emp.employee_id}</td>
                                <td>${emp.name}</td>
                                <td>${emp.department || '-'}</td>
                                <td>${emp.position || '-'}</td>
                                <td class="text-right">${formatCurrency(emp.basic_salary)}</td>
                                <td class="text-center">
                                    <span class="badge ${emp.salary_type === 'daily' ? 'badge-info' : emp.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}">
                                        ${emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
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
                <h1 className="page-title">👤 Data Karyawan</h1>
                <p className="page-subtitle">Kelola data lengkap karyawan</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span> {success}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">Daftar Karyawan</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Cari karyawan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: 240 }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                                🖨️ Print
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
                                📄 PDF
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
                                📊 Excel
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
                        <div className="empty-state-icon">👤</div>
                        <p className="empty-state-text">Belum ada karyawan</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('employee_id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        ID <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'employee_id' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('employee_id')}</span>
                                    </th>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Nama <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'name' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('name')}</span>
                                    </th>
                                    <th onClick={() => handleSort('department')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Departemen <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'department' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('department')}</span>
                                    </th>
                                    <th onClick={() => handleSort('position')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Jabatan <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'position' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('position')}</span>
                                    </th>
                                    <th onClick={() => handleSort('basic_salary')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Gaji Pokok <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'basic_salary' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('basic_salary')}</span>
                                    </th>
                                    <th onClick={() => handleSort('salary_type')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Tipe <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'salary_type' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('salary_type')}</span>
                                    </th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ fontWeight: 500 }}>{emp.employee_id}</td>
                                        <td>{emp.name}</td>
                                        <td>{emp.department || '-'}</td>
                                        <td>{emp.position || '-'}</td>
                                        <td>{formatCurrency(emp.basic_salary)}</td>
                                        <td>
                                            <span className={`badge ${emp.salary_type === 'daily' ? 'badge-info' : emp.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                                                {emp.salary_type === 'daily' ? 'Harian' : emp.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => openDetail(emp)}>
                                                📝 Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showModal && selectedEmployee && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Detail: {selectedEmployee.name} ({selectedEmployee.employee_id})
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
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
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}

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
                                            <label className="form-label">Tanggal Masuk</label>
                                            <input className="form-input" type="date" value={formData.join_date} onChange={e => updateField('join_date', e.target.value)} />
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
                                            <input className="form-input" type="number" value={formData.basic_salary} onChange={e => updateField('basic_salary', parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tunjangan Transport (Rp/bln)</label>
                                            <input className="form-input" type="number" value={formData.transport_allowance} onChange={e => updateField('transport_allowance', parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tunjangan Makan (Rp/bln)</label>
                                            <input className="form-input" type="number" value={formData.meal_allowance} onChange={e => updateField('meal_allowance', parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tarif Lembur/Jam (Rp)</label>
                                            <input className="form-input" type="number" value={formData.overtime_rate} onChange={e => updateField('overtime_rate', parseFloat(e.target.value) || 0)} />
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
                                                        🚛 Driver & Kenek
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini adalah driver atau kenek
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.is_driver && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🌙 Uang Jalan Subuh (Rp)</label>
                                                        <input className="form-input" type="number" value={formData.driver_subuh_allowance} onChange={e => updateField('driver_subuh_allowance', parseFloat(e.target.value) || 0)} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🔄 Uang Mel / RIT (Rp)</label>
                                                        <input className="form-input" type="number" value={formData.driver_rit_allowance} onChange={e => updateField('driver_rit_allowance', parseFloat(e.target.value) || 0)} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🏨 Uang Menginap/Hari (Rp)</label>
                                                        <input className="form-input" type="number" value={formData.driver_inap_allowance} onChange={e => updateField('driver_inap_allowance', parseFloat(e.target.value) || 0)} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🚚 Uang Ritase Jarak Dekat (Rp)</label>
                                                        <input className="form-input" type="number" value={formData.driver_ritase_dekat_allowance || 0} onChange={e => updateField('driver_ritase_dekat_allowance', parseFloat(e.target.value) || 0)} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🚚 Uang Ritase Jarak Jauh (Rp)</label>
                                                        <input className="form-input" type="number" value={formData.driver_ritase_jauh_allowance || 0} onChange={e => updateField('driver_ritase_jauh_allowance', parseFloat(e.target.value) || 0)} />
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', gridColumn: '1 / -1', marginTop: '-0.25rem', marginBottom: '0.25rem', lineHeight: 1.2 }}>
                                                        *Otomatis dihitung mulai dari perjalanan (RIT) ke-2 dan seterusnya
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>🚙 Jenis Kendaraan</label>
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
                                                        💰 Collector / Penagih
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini bertugas menagih ke customer (membuka menu Tracking Penagihan)
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
                                                        📍 Akses Fitur Tracking
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                        Aktifkan jika karyawan ini wajib melakukan laporan kunjungan (Check-in/Check-out via GPS)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            ℹ️ <strong>Info tipe gaji:</strong><br />
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
                                            ℹ️ <strong>Pengaturan BPJS & PPh 21 per karyawan.</strong><br />
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
                                                                    {isActive ? '✅ Aktif' : '❌ Tidak aktif - tidak dipotong saat payroll'}
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
                                                        💰 PPh 21 (Pajak Penghasilan)
                                                    </span>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                        {formData.pph21_enabled ? '✅ Aktif - dihitung otomatis berdasarkan tarif progresif' : '❌ Tidak aktif - PPh 21 tidak dipotong'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Lokasi Absen */}
                                {activeTab === 'locations' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                            ℹ️ <strong>Pengaturan Lokasi Absen:</strong><br />
                                            Centang lokasi mana saja yang diizinkan untuk karyawan ini melakukan absensi. <br/>
                                            <em>Jika tidak ada satupun yang dicentang, maka karyawan diizinkan absen di semua lokasi (Default).</em>
                                        </div>

                                        <div className="card" style={{ padding: '1rem', border: '1px solid var(--gray-700)' }}>
                                            {masterLocations.length === 0 ? (
                                                <p style={{ textAlign: 'center', color: 'var(--gray-400)', margin: '1rem 0' }}>Belum ada master lokasi yang aktif.</p>
                                            ) : (
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
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Dokumen */}
                                {activeTab === 'documents' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            📎 <strong>Upload dokumen karyawan</strong> (KTP, KK, Ijazah, dll). Max 10MB per file. Format: JPG, PNG, PDF, DOC.
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
                                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--gray-300)' }}>Klik atau drag & drop file di sini</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 4 }}>JPG, PNG, PDF, DOC • Max 10MB</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Document List */}
                                        {documents.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                                                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
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
                                                                {isImage ? '🖼️' : isPDF ? '📄' : '📃'}
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
                                                                    👁️
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
                                                                    🗑️
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
                                    {saving ? 'Menyimpan...' : '💾 Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
