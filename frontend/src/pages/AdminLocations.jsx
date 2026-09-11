import { useState, useEffect } from 'react';
import { locationsAPI } from '../utils/api';
import Icon from '../components/Icon';

export default function AdminLocations() {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        radius_meters: 100,
        is_active: true
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLocations();
    }, []);

    async function fetchLocations() {
        try {
            const data = await locationsAPI.getAll();
            setLocations(data);
        } catch (error) {
            console.error('Failed to fetch locations:', error);
        } finally {
            setLoading(false);
        }
    }

    function openAddModal() {
        setEditingLocation(null);
        setFormData({
            name: '',
            latitude: '',
            longitude: '',
            radius_meters: 100,
            is_active: true
        });
        setShowModal(true);
        setError('');
    }

    function openEditModal(location) {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            radius_meters: location.radius_meters,
            is_active: location.is_active
        });
        setShowModal(true);
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (editingLocation) {
                await locationsAPI.update(editingLocation.id, formData);
            } else {
                await locationsAPI.create(formData);
            }
            setShowModal(false);
            fetchLocations();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan lokasi');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus lokasi ini?')) return;

        try {
            await locationsAPI.delete(id);
            fetchLocations();
        } catch (error) {
            alert(error.message || 'Gagal menghapus lokasi');
        }
    }

    function getCurrentLocation() {
        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung browser ini');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: position.coords.latitude.toFixed(8),
                    longitude: position.coords.longitude.toFixed(8)
                }));
            },
            (err) => {
                setError('Gagal mendapatkan lokasi: ' + err.message);
            }
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="MapPin" size={16} inline /> Kelola Lokasi Absensi</h1>
                <p className="page-subtitle">Atur lokasi kantor untuk validasi absensi</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar Lokasi</h2>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        + Tambah Lokasi
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : locations.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="MapPin" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada lokasi terdaftar</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nama Lokasi</th>
                                    <th>Koordinat</th>
                                    <th>Radius</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((loc) => (
                                    <tr key={loc.id}>
                                        <td style={{ fontWeight: 500 }}>{loc.name}</td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {parseFloat(loc.latitude).toFixed(6)}, {parseFloat(loc.longitude).toFixed(6)}
                                        </td>
                                        <td>{loc.radius_meters}m</td>
                                        <td>
                                            <span className={`badge ${loc.is_active ? 'badge-success' : 'badge-warning'}`}>
                                                {loc.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => openEditModal(loc)}
                                                >
                                                    <Icon name="Pencil" size={16} inline /> Edit
                                                </button>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(loc.id)}
                                                >
                                                    <Icon name="Trash2" size={16} inline />
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
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="X" size={16} /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger mb-3">
                                        <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span>
                                        {error}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Nama Lokasi *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Contoh: Kantor Pusat"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Latitude *</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            placeholder="-6.XXXXXX"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Longitude *</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            placeholder="106.XXXXXX"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-outline btn-block mb-3"
                                    onClick={getCurrentLocation}
                                >
                                    <Icon name="MapPin" size={16} inline /> Gunakan Lokasi Saat Ini
                                </button>

                                <div className="form-group">
                                    <label className="form-label">Radius Valid (meter)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="100"
                                        value={formData.radius_meters}
                                        onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) || 100 })}
                                    />
                                    <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                        Jarak maksimal dari titik koordinat agar absensi dianggap valid
                                    </p>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            style={{ width: 18, height: 18 }}
                                        />
                                        <span>Lokasi Aktif</span>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                    Batal
                                </button>
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
