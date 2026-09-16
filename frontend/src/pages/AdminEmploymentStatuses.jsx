import { useState, useEffect } from 'react';
import { employmentStatusesAPI } from '../utils/api';
import Icon from '../components/Icon';

export default function AdminEmploymentStatuses() {
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');

    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    useEffect(() => {
        fetchStatuses();
    }, []);

    async function fetchStatuses() {
        try {
            const data = await employmentStatusesAPI.getAll();
            setStatuses(data);
        } catch (err) {
            console.error('Failed to fetch employment statuses:', err);
            setError('Gagal memuat master status karyawan');
        } finally {
            setLoading(false);
        }
    }

    function openModal(item = null) {
        if (item) {
            setFormData({ id: item.id, name: item.name, description: item.description || '' });
        } else {
            setFormData({ id: null, name: '', description: '' });
        }
        setError('');
        setSuccess('');
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Nama status harus diisi');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (formData.id) {
                await employmentStatusesAPI.update(formData.id, { name: formData.name.trim(), description: formData.description });
                setSuccess('Berhasil memperbarui status karyawan');
            } else {
                await employmentStatusesAPI.create({ name: formData.name.trim(), description: formData.description });
                setSuccess('Berhasil menambahkan status karyawan baru');
            }
            setShowModal(false);
            fetchStatuses();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus status karyawan ini?')) return;

        try {
            await employmentStatusesAPI.delete(id);
            setSuccess('Status karyawan berhasil dihapus');
            fetchStatuses();
        } catch (err) {
            setError(err.message || 'Gagal menghapus status karyawan');
        }
    }

    const filteredData = statuses.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Briefcase" size={16} inline /> Master Status Karyawan</h1>
                <p className="page-subtitle">Kelola pilihan status kepegawaian yang muncul di data karyawan</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon"><Icon name="Check" size={16} inline /></span> {success}
                </div>
            )}
            {error && !showModal && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Status Karyawan</h2>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            <Icon name="Plus" size={16} inline /> Tambah Status
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Cari status karyawan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ maxWidth: 300, margin: 0 }}
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="Briefcase" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada data status karyawan</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Status Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Nama Status</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(item => (
                                    <tr key={item.id}>
                                        <td style={{ color: 'var(--gray-500)' }}>#{item.id}</td>
                                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                                        <td style={{ color: 'var(--gray-600)' }}>{item.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => openModal(item)}
                                                >
                                                    <Icon name="Pencil" size={16} inline /> Edit
                                                </button>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(item.id)}
                                                >
                                                    <Icon name="Trash2" size={16} inline /> Hapus
                                                </button>
                                            </div>
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
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{formData.id ? 'Edit Status Karyawan' : 'Tambah Status Karyawan'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="X" size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger mb-3">
                                        <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Nama Status</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Contoh: Permanen, Kontrak, Honor Harian"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Keterangan (Opsional)</label>
                                    <textarea
                                        className="form-input"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        placeholder="Penjelasan singkat status kepegawaian..."
                                    ></textarea>
                                </div>
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
        </div>
    );
}
