import { useState, useEffect } from 'react';
import { vehicleTypesAPI } from '../utils/api';

export default function AdminVehicleTypes() {
    const [vehicleTypes, setVehicleTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    
    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    useEffect(() => {
        fetchVehicleTypes();
    }, []);

    async function fetchVehicleTypes() {
        try {
            const data = await vehicleTypesAPI.getAll();
            setVehicleTypes(data);
        } catch (err) {
            console.error('Failed to fetch vehicle types:', err);
            setError('Gagal memuat data jenis kendaraan');
        } finally {
            setLoading(false);
        }
    }

    function openModal(vt = null) {
        if (vt) {
            setFormData({ id: vt.id, name: vt.name, description: vt.description || '' });
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
            setError('Nama jenis kendaraan harus diisi');
            return;
        }

        setSaving(true);
        setError('');
        
        try {
            if (formData.id) {
                await vehicleTypesAPI.update(formData.id, { name: formData.name, description: formData.description });
                setSuccess('Berhasil memperbarui jenis kendaraan');
            } else {
                await vehicleTypesAPI.create({ name: formData.name, description: formData.description });
                setSuccess('Berhasil menambahkan jenis kendaraan baru');
            }
            setShowModal(false);
            fetchVehicleTypes();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus jenis kendaraan ini?')) return;
        
        try {
            await vehicleTypesAPI.delete(id);
            setSuccess('Jenis kendaraan berhasil dihapus');
            fetchVehicleTypes();
        } catch (err) {
            setError(err.message || 'Gagal menghapus jenis kendaraan');
        }
    }

    const filteredData = vehicleTypes.filter(vt => 
        vt.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🚚 Master Kendaraan</h1>
                <p className="page-subtitle">Kelola daftar jenis kendaraan operasional untuk driver</p>
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
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Jenis Kendaraan</h2>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            ➕ Tambah Kendaraan
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari kendaraan..."
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
                        <div className="empty-state-icon">🚚</div>
                        <p className="empty-state-text">Belum ada data jenis kendaraan</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Jenis Kendaraan Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Jenis Kendaraan</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(vt => (
                                    <tr key={vt.id}>
                                        <td style={{ color: 'var(--gray-400)' }}>#{vt.id}</td>
                                        <td style={{ fontWeight: 500 }}>{vt.name}</td>
                                        <td style={{ color: 'var(--gray-300)' }}>{vt.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => openModal(vt)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(vt.id)}
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
                            <h3 className="modal-title">{formData.id ? 'Edit Jenis Kendaraan' : 'Tambah Jenis Kendaraan'}</h3>
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
                                    <label className="form-label">Jenis Kendaraan</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="Contoh: Motor, Mobil Box, Truk Engkel"
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
                                        placeholder="Keterangan tambahan..."
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
