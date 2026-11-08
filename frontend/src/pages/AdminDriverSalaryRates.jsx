import { useEffect, useMemo, useState } from 'react';
import { departmentsAPI, divisionsAPI, driverSalaryRatesAPI, positionsAPI, vehicleTypesAPI } from '../utils/api';
import Icon from '../components/Icon';

const SALARY_TYPES = [
    { value: 'monthly', label: 'Bulanan', suffix: 'bulan' },
    { value: 'weekly', label: 'Mingguan', suffix: 'minggu' },
    { value: 'daily', label: 'Harian', suffix: 'hari' }
];

function salaryTypeMeta(type) {
    return SALARY_TYPES.find((item) => item.value === type) || SALARY_TYPES[2];
}

const EMPTY_FORM = {
    id: null,
    crew_role: 'supir',
    salary_type: 'daily',
    division_id: '',
    department_id: '',
    position_id: '',
    vehicle_type_id: '',
    standard_salary: ''
};

function formatCurrency(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
}

export default function AdminDriverSalaryRates() {
    const [rates, setRates] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [positions, setPositions] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        try {
            const [rateRows, divisionRows, departmentRows, positionRows, vehicleRows] = await Promise.all([
                driverSalaryRatesAPI.getAll(),
                divisionsAPI.getAll(),
                departmentsAPI.getAll(),
                positionsAPI.getAll(),
                vehicleTypesAPI.getAll()
            ]);
            setRates(rateRows);
            setDivisions(divisionRows);
            setDepartments(departmentRows);
            setPositions(positionRows);
            setVehicles(vehicleRows);
        } catch (err) {
            setError(err.message || 'Gagal memuat daftar gaji');
        } finally {
            setLoading(false);
        }
    }

    function openModal(row = null) {
        setFormData(row ? {
            id: row.id,
            crew_role: row.crew_role,
            salary_type: row.salary_type || 'daily',
            division_id: row.division_id,
            department_id: row.department_id,
            position_id: row.position_id,
            vehicle_type_id: row.vehicle_type_id,
            standard_salary: row.standard_salary
        } : EMPTY_FORM);
        setError('');
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...formData,
                standard_salary: parseFloat(formData.standard_salary) || 0
            };
            if (formData.id) {
                await driverSalaryRatesAPI.update(formData.id, payload);
                setSuccess('Standar gaji diperbarui');
            } else {
                await driverSalaryRatesAPI.create(payload);
                setSuccess('Standar gaji ditambahkan');
            }
            setShowModal(false);
            await loadAll();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan standar gaji');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(row) {
        const role = row.crew_role === 'kenek' ? 'Kenek' : 'Supir';
        if (!window.confirm(`Hapus standar gaji ${role} ${row.vehicle_type_name}?`)) return;
        try {
            await driverSalaryRatesAPI.delete(row.id);
            setSuccess('Standar gaji dihapus');
            setRates((prev) => prev.filter((item) => item.id !== row.id));
        } catch (err) {
            setError(err.message || 'Gagal menghapus standar gaji');
        }
    }

    const filtered = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return rates;
        return rates.filter((row) => [
            row.crew_role === 'kenek' ? 'kenek' : 'supir',
            salaryTypeMeta(row.salary_type).label,
            row.division_name,
            row.department_name,
            row.position_name,
            row.vehicle_type_name
        ].some((value) => String(value || '').toLowerCase().includes(keyword)));
    }, [rates, search]);

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 className="page-title"><Icon name="Banknote" size={16} inline /> Gaji Supir & Kenek</h1>
                    <p className="page-subtitle">Standar gaji berdasarkan tipe gaji, divisi, departemen, jabatan, dan jenis mobil</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Icon name="Plus" size={16} inline /> Tambah Standar Gaji
                </button>
            </div>

            {error && !showModal && <div className="alert alert-danger mb-3">{error}</div>}
            {success && <div className="alert alert-success mb-3">{success}</div>}

            <div className="card">
                <div className="card-header">
                    <input
                        className="form-input"
                        placeholder="Cari peran, tipe gaji, divisi, departemen, jabatan, atau mobil..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: 420 }}
                    />
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <p className="empty-state-text">Belum ada standar gaji supir atau kenek</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Peran</th>
                                    <th>Tipe Gaji</th>
                                    <th>Divisi</th>
                                    <th>Departemen</th>
                                    <th>Jabatan</th>
                                    <th>Jenis Mobil</th>
                                    <th style={{ textAlign: 'right' }}>Standar Gaji</th>
                                    <th style={{ textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <span className={`badge ${row.crew_role === 'kenek' ? 'badge-warning' : 'badge-primary'}`}>
                                                {row.crew_role === 'kenek' ? 'Kenek' : 'Supir'}
                                            </span>
                                        </td>
                                        <td>{salaryTypeMeta(row.salary_type).label}</td>
                                        <td>{row.division_name}</td>
                                        <td>{row.department_name}</td>
                                        <td>{row.position_name}</td>
                                        <td>{row.vehicle_type_name}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(row.standard_salary)} / {salaryTypeMeta(row.salary_type).suffix}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-sm btn-outline" onClick={() => openModal(row)}><Icon name="Pencil" size={14} inline /> Edit</button>
                                            <button className="btn btn-sm btn-outline" style={{ marginLeft: 8, color: '#ef4444' }} onClick={() => handleDelete(row)}><Icon name="Trash2" size={14} inline /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{formData.id ? 'Edit Standar Gaji' : 'Tambah Standar Gaji'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="X" size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3">{error}</div>}
                                <div className="form-group">
                                    <label className="form-label">Peran</label>
                                    <select className="form-input form-select" value={formData.crew_role} onChange={(e) => setFormData({ ...formData, crew_role: e.target.value })} required>
                                        <option value="supir">Supir</option>
                                        <option value="kenek">Kenek</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipe Gaji</label>
                                    <select className="form-input form-select" value={formData.salary_type} onChange={(e) => setFormData({ ...formData, salary_type: e.target.value })} required>
                                        {SALARY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Divisi</label>
                                    <select className="form-input form-select" value={formData.division_id} onChange={(e) => setFormData({ ...formData, division_id: e.target.value })} required>
                                        <option value="">Pilih Divisi...</option>
                                        {divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Departemen</label>
                                    <select className="form-input form-select" value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} required>
                                        <option value="">Pilih Departemen...</option>
                                        {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jabatan</label>
                                    <select className="form-input form-select" value={formData.position_id} onChange={(e) => setFormData({ ...formData, position_id: e.target.value })} required>
                                        <option value="">Pilih Jabatan...</option>
                                        {positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jenis Mobil</label>
                                    <select className="form-input form-select" value={formData.vehicle_type_id} onChange={(e) => setFormData({ ...formData, vehicle_type_id: e.target.value })} required>
                                        <option value="">Pilih Jenis Mobil...</option>
                                        {vehicles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Standar Gaji / {salaryTypeMeta(formData.salary_type).label}</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.standard_salary}
                                        onChange={(e) => setFormData({ ...formData, standard_salary: e.target.value })}
                                        placeholder="Contoh: 120000"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
