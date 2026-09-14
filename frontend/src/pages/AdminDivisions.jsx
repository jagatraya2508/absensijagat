import { useState, useEffect } from 'react';
import { divisionsAPI } from '../utils/api';
import Icon from '../components/Icon';

export default function AdminDivisions() {
    const [divisions, setDivisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');

    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    useEffect(() => {
        fetchDivisions();
    }, []);

    async function fetchDivisions() {
        try {
            const data = await divisionsAPI.getAll();
            setDivisions(data);
        } catch (err) {
            console.error('Failed to fetch divisions:', err);
            setError('Gagal memuat master divisi');
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
            setError('Nama divisi harus diisi');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (formData.id) {
                await divisionsAPI.update(formData.id, { name: formData.name.trim(), description: formData.description });
                setSuccess('Berhasil memperbarui divisi');
            } else {
                await divisionsAPI.create({ name: formData.name.trim(), description: formData.description });
                setSuccess('Berhasil menambahkan divisi baru');
            }
            setShowModal(false);
            fetchDivisions();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus divisi ini?')) return;

        try {
            await divisionsAPI.delete(id);
            setSuccess('Divisi berhasil dihapus');
            fetchDivisions();
        } catch (err) {
            setError(err.message || 'Gagal menghapus divisi');
        }
    }

    const filteredData = divisions.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Folder" size={16} inline /> Master Divisi</h1>
                <p className="page-subtitle">Kelola daftar divisi yang muncul di data karyawan</p>
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
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Divisi</h2>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            <Icon name="Plus" size={16} inline /> Tambah Divisi
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Cari divisi..."
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
                        <div className="empty-state-icon"><Icon name="Folder" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada data divisi</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Divisi Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Nama Divisi</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(item => (
                                    <tr key={item.id}>
                                        <td style={{ color: 'var(--gray-400)' }}>#{item.id}</td>
                                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                                        <td style={{ color: 'var(--gray-300)' }}>{item.description || '-'}</td>
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
                            <h3 className="modal-title">{formData.id ? 'Edit Divisi' : 'Tambah Divisi'}</h3>
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
                                    <label className="form-label">Nama Divisi</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Contoh: Divisi Produksi, Divisi Pemasaran"
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
                                        placeholder="Penjelasan singkat divisi..."
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
