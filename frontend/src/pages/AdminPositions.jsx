import { useState, useEffect } from 'react';
import { positionsAPI } from '../utils/api';

export default function AdminPositions() {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    
    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    useEffect(() => {
        fetchPositions();
    }, []);

    async function fetchPositions() {
        try {
            const data = await positionsAPI.getAll();
            setPositions(data);
        } catch (err) {
            console.error('Failed to fetch positions:', err);
            setError('Gagal memuat data jabatan');
        } finally {
            setLoading(false);
        }
    }

    function openModal(pos = null) {
        if (pos) {
            setFormData({ id: pos.id, name: pos.name, description: pos.description || '' });
        } else {
            setFormData({ id: null, name: '', description: '' });
        }
        setError('');
        setSuccess('');
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!formData.name) {
            setError('Nama jabatan harus diisi');
            return;
        }

        setSaving(true);
        setError('');
        
        try {
            if (formData.id) {
                await positionsAPI.update(formData.id, { name: formData.name, description: formData.description });
                setSuccess('Berhasil memperbarui jabatan');
            } else {
                await positionsAPI.create({ name: formData.name, description: formData.description });
                setSuccess('Berhasil menambahkan jabatan baru');
            }
            setShowModal(false);
            fetchPositions();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus jabatan ini?')) return;
        
        try {
            await positionsAPI.delete(id);
            setSuccess('Jabatan berhasil dihapus');
            fetchPositions();
        } catch (err) {
            setError(err.message || 'Gagal menghapus jabatan');
        }
    }

    const filteredData = positions.filter(d => 
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🏅 Master Jabatan</h1>
                <p className="page-subtitle">Kelola daftar jabatan perusahaan</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span> {success}
                </div>
            )}
            {error && !showModal && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span> {error}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Jabatan</h2>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            ➕ Tambah Jabatan
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari jabatan..."
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
                        <div className="empty-state-icon">🏅</div>
                        <p className="empty-state-text">Belum ada data jabatan</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Jabatan Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Nama Jabatan</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(pos => (
                                    <tr key={pos.id}>
                                        <td style={{ color: 'var(--gray-400)' }}>#{pos.id}</td>
                                        <td style={{ fontWeight: 500 }}>{pos.name}</td>
                                        <td style={{ color: 'var(--gray-300)' }}>{pos.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => openModal(pos)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(pos.id)}
                                                >
                                                    🗑️ Hapus
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

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{formData.id ? 'Edit Jabatan' : 'Tambah Jabatan'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger mb-3">
                                        <span className="alert-icon">⚠️</span> {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Nama Jabatan</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="Contoh: Manager, Supervisor, Staff"
                                        required 
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Keterangan (Opsional)</label>
                                    <textarea 
                                        className="form-input" 
                                        value={formData.description} 
                                        onChange={e => setFormData({...formData, description: e.target.value})} 
                                        rows="3"
                                        placeholder="Penjelasan singkat mengenai jabatan..."
                                    ></textarea>
                                </div>
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
