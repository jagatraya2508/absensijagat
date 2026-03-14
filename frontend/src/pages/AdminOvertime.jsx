import { useState, useEffect } from 'react';
import { overtimeAPI, authAPI } from '../utils/api';

export default function AdminOvertime() {
    const [records, setRecords] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterUser, setFilterUser] = useState('');
    const [formData, setFormData] = useState({
        user_id: '', date: '', hours: '', description: ''
    });

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => { fetchRecords(); }, [filterMonth, filterYear, filterUser]);

    async function fetchUsers() {
        try {
            const data = await authAPI.getUsers();
            setUsers(data.filter(u => u.role === 'employee'));
        } catch (e) { console.error(e); }
    }

    async function fetchRecords() {
        try {
            setLoading(true);
            const params = { month: filterMonth, year: filterYear };
            if (filterUser) params.user_id = filterUser;
            const data = await overtimeAPI.getAll(params);
            setRecords(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    function openAddModal() {
        setEditingRecord(null);
        setFormData({ user_id: '', date: '', hours: '', description: '' });
        setShowModal(true);
        setError('');
    }

    function openEditModal(rec) {
        setEditingRecord(rec);
        setFormData({
            user_id: rec.user_id, date: rec.date.split('T')[0],
            hours: rec.hours, description: rec.description || ''
        });
        setShowModal(true);
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editingRecord) {
                await overtimeAPI.update(editingRecord.id, formData);
                setSuccess('Data lembur berhasil diupdate');
            } else {
                await overtimeAPI.create(formData);
                setSuccess('Data lembur berhasil ditambahkan');
            }
            setShowModal(false);
            fetchRecords();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan');
        } finally { setSaving(false); }
    }

    async function handleStatus(id, status) {
        try {
            await overtimeAPI.updateStatus(id, status);
            setSuccess(`Lembur berhasil di-${status === 'approved' ? 'approve' : 'reject'}`);
            fetchRecords();
        } catch (err) { alert(err.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus data lembur ini?')) return;
        try {
            await overtimeAPI.delete(id);
            fetchRecords();
        } catch (err) { alert(err.message); }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    const totalApproved = records.filter(r => r.status === 'approved').reduce((sum, r) => sum + parseFloat(r.total_amount), 0);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">⏰ Kelola Lembur</h1>
                <p className="page-subtitle">Catat dan kelola data lembur karyawan</p>
            </div>

            {success && <div className="alert alert-success mb-3"><span className="alert-icon">✓</span> {success}</div>}

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card status-card">
                    <div className="status-card-icon primary">📋</div>
                    <div className="status-card-content">
                        <h3>Total Record</h3>
                        <p>{records.length}</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon success">✅</div>
                    <div className="status-card-content">
                        <h3>Total Approved</h3>
                        <p>{formatCurrency(totalApproved)}</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">Data Lembur</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select className="form-input form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 120 }}>
                            {[...Array(12)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('id-ID', { month: 'long' })}</option>
                            ))}
                        </select>
                        <input className="form-input" type="number" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ width: 90 }} />
                        <select className="form-input form-select" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ width: 160 }}>
                            <option value="">Semua Karyawan</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={openAddModal}>+ Tambah Lembur</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : records.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⏰</div>
                        <p className="empty-state-text">Tidak ada data lembur</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Karyawan</th>
                                    <th>Jam</th>
                                    <th>Tarif/Jam</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(rec => (
                                    <tr key={rec.id}>
                                        <td>{new Date(rec.date).toLocaleDateString('id-ID')}</td>
                                        <td>{rec.user_name}</td>
                                        <td>{rec.hours} jam</td>
                                        <td>{formatCurrency(rec.rate_per_hour)}</td>
                                        <td style={{ fontWeight: 600 }}>{formatCurrency(rec.total_amount)}</td>
                                        <td>
                                            <span className={`badge ${rec.status === 'approved' ? 'badge-success' : rec.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                                {rec.status === 'approved' ? 'Approved' : rec.status === 'rejected' ? 'Rejected' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {rec.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleStatus(rec.id, 'approved')}>✅</button>
                                                        <button className="btn btn-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleStatus(rec.id, 'rejected')}>❌</button>
                                                    </>
                                                )}
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => openEditModal(rec)}>✏️</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger-500)' }} onClick={() => handleDelete(rec.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingRecord ? 'Edit Lembur' : 'Tambah Lembur'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}
                                <div className="form-group">
                                    <label className="form-label">Karyawan *</label>
                                    <select className="form-input form-select" value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value })} required>
                                        <option value="">Pilih karyawan...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal *</label>
                                    <input className="form-input" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Jam *</label>
                                    <input className="form-input" type="number" step="0.5" min="0.5" value={formData.hours} onChange={e => setFormData({ ...formData, hours: e.target.value })} required placeholder="Cth: 2" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Keterangan</label>
                                    <textarea className="form-input" rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Keterangan lembur" />
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
