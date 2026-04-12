import { useState, useEffect } from 'react';
import { employeesAPI, authAPI, departmentsAPI, positionsAPI } from '../utils/api';

const TABS = [
    { id: 'personal', label: '👤 Data Pribadi' },
    { id: 'work', label: '💼 Data Kerja' },
    { id: 'bank', label: '🏦 Bank & Pajak' },
    { id: 'salary', label: '💰 Gaji & Tunjangan' },
];

export default function AdminEmployees() {
    const [employees, setEmployees] = useState([]);
    const [masterDepartments, setMasterDepartments] = useState([]);
    const [masterPositions, setMasterPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [activeTab, setActiveTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        nik: '', phone: '', address: '', birth_date: '', birth_place: '',
        gender: '', marital_status: 'Belum Menikah', religion: '', education: '',
        department: '', position: '', join_date: '',
        bank_name: '', bank_account: '', bank_holder: '',
        npwp: '', bpjs_kesehatan_no: '', bpjs_ketenagakerjaan_no: '',
        basic_salary: 0, salary_type: 'monthly', transport_allowance: 0, meal_allowance: 0, overtime_rate: 50000,
        tax_status: 'TK/0', emergency_contact_name: '', emergency_contact_phone: ''
    });

    useEffect(() => { 
        fetchEmployees(); 
        fetchMasters();
    }, []);

    async function fetchMasters() {
        try {
            const depts = await departmentsAPI.getAll();
            const pos = await positionsAPI.getAll();
            setMasterDepartments(depts);
            setMasterPositions(pos);
        } catch (err) {
            console.error('Failed to fetch masters:', err);
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
                nik: d.nik || '', phone: d.phone || '', address: d.address || '',
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
                tax_status: d.tax_status || 'TK/0',
                emergency_contact_name: d.emergency_contact_name || '',
                emergency_contact_phone: d.emergency_contact_phone || ''
            });
            setActiveTab('personal');
            setShowModal(true);
            setError('');
            setSuccess('');
        } catch (err) {
            alert('Gagal memuat detail karyawan');
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await employeesAPI.update(selectedEmployee.id, formData);
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

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(search.toLowerCase())
    );

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
                <div className="card-header">
                    <h2 className="card-title">Daftar Karyawan</h2>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari karyawan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ maxWidth: 280 }}
                    />
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
                                    <th>ID</th>
                                    <th>Nama</th>
                                    <th>Departemen</th>
                                    <th>Jabatan</th>
                                    <th>Gaji Pokok</th>
                                    <th>Tipe</th>
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
                        <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                                        color: activeTab === tab.id ? 'var(--primary-400)' : 'var(--gray-400)',
                                        borderBottom: activeTab === tab.id ? '2px solid var(--primary-400)' : '2px solid transparent',
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
                                        <div style={{ gridColumn: '1 / -1', padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-300)' }}>
                                            ℹ️ <strong>Info tipe gaji:</strong><br />
                                            • <strong>Harian</strong> = gaji per hari × jumlah hari hadir (absensi)<br />
                                            • <strong>Mingguan</strong> = gaji per minggu × jumlah minggu bekerja<br />
                                            • <strong>Bulanan</strong> = gaji tetap per bulan
                                        </div>
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
