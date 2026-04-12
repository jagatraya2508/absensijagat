import { useState, useEffect } from 'react';
import { departmentsAPI } from '../utils/api';

export default function AdminDepartments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    
    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    useEffect(() => {
        fetchDepartments();
    }, []);

    async function fetchDepartments() {
        try {
            const data = await departmentsAPI.getAll();
            setDepartments(data);
        } catch (err) {
            console.error('Failed to fetch departments:', err);
            setError('Gagal memuat data departemen');
        } finally {
            setLoading(false);
        }
    }

    function openModal(dept = null) {
        if (dept) {
            setFormData({ id: dept.id, name: dept.name, description: dept.description || '' });
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
            setError('Nama departemen harus diisi');
            return;
        }

        setSaving(true);
        setError('');
        
        try {
            if (formData.id) {
                await departmentsAPI.update(formData.id, { name: formData.name, description: formData.description });
                setSuccess('Berhasil memperbarui departemen');
            } else {
                await departmentsAPI.create({ name: formData.name, description: formData.description });
                setSuccess('Berhasil menambahkan departemen baru');
            }
            setShowModal(false);
            fetchDepartments();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus departemen ini?')) return;
        
        try {
            await departmentsAPI.delete(id);
            setSuccess('Departemen berhasil dihapus');
            fetchDepartments();
        } catch (err) {
            setError(err.message || 'Gagal menghapus departemen');
        }
    }

    const filteredData = departments.filter(d => 
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🏢 Master Departemen</h1>
                <p className="page-subtitle">Kelola daftar departemen perusahaan</p>
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
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Departemen</h2>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            ➕ Tambah Departemen
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari departemen..."
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
                        <div className="empty-state-icon">🏢</div>
                        <p className="empty-state-text">Belum ada data departemen</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Departemen Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Nama Departemen</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(dept => (
                                    <tr key={dept.id}>
                                        <td style={{ color: 'var(--gray-400)' }}>#{dept.id}</td>
                                        <td style={{ fontWeight: 500 }}>{dept.name}</td>
                                        <td style={{ color: 'var(--gray-300)' }}>{dept.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => openModal(dept)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(dept.id)}
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
                            <h3 className="modal-title">{formData.id ? 'Edit Departemen' : 'Tambah Departemen'}</h3>
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
                                    <label className="form-label">Nama Departemen</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="Contoh: IT, HRD, Finance"
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
                                        placeholder="Penjelasan singkat tugas departemen..."
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
