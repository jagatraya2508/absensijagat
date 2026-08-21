import { useState, useEffect } from 'react';
import { driverTrackingAPI } from '../utils/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTrackingTypeMeta, TRACKING_TYPES } from '../utils/tracking';
import LiveTrackingMap from '../components/LiveTrackingMap';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const checkinIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const checkoutIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

export default function AdminDriverTracking() {
    const [records, setRecords] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [selectedDriver, setSelectedDriver] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [viewMode, setViewMode] = useState('live');

    // Detail modal
    const [detailModal, setDetailModal] = useState({ open: false, record: null });

    // Map modal
    const [mapModal, setMapModal] = useState({ open: false, records: [], center: [-6.2, 106.8] });

    // Image modal
    const [imageModal, setImageModal] = useState({ open: false, src: '', caption: '' });

    useEffect(() => {
        fetchDrivers();
        fetchRecords();
    }, []);

    async function fetchDrivers() {
        try {
            const data = await driverTrackingAPI.getDrivers();
            setDrivers(data);
        } catch (e) {
            console.error('Failed to fetch drivers:', e);
        }
    }

    async function fetchRecords() {
        try {
            setLoading(true);
            const params = {};
            if (selectedDriver) params.user_id = selectedDriver;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.tracking_type = typeFilter;
            const data = await driverTrackingAPI.getAll(params);
            setRecords(data);
        } catch (e) {
            console.error('Failed to fetch records:', e);
            setError('Gagal memuat data tracking');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Hapus data tracking ini?')) return;
        try {
            await driverTrackingAPI.delete(id);
            setSuccess('Data berhasil dihapus');
            fetchRecords();
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message || 'Gagal menghapus data');
        }
    }

    function formatTime(ts) {
        if (!ts) return '-';
        return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateTime(ts) {
        if (!ts) return '-';
        return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(d) {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    }

    function calcDuration(checkin, checkout) {
        if (!checkin || !checkout) return '-';
        const diff = new Date(checkout) - new Date(checkin);
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return hours > 0 ? `${hours}j ${remMins}m` : `${remMins}m`;
    }

    function formatCoord(lat, lng) {
        if (!lat || !lng) return '-';
        return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    }

    function openGoogleMaps(lat, lng) {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }

    function openMapForRecords(recs) {
        const valid = recs.filter(r => r.checkin_latitude);
        if (valid.length === 0) return;
        const center = [parseFloat(valid[0].checkin_latitude), parseFloat(valid[0].checkin_longitude)];
        setMapModal({ open: true, records: valid, center });
    }

    function formatCurrencyHelper(val) {
        if (!val) return '0';
        return parseInt(val, 10).toLocaleString('id-ID');
    }

    // Stats
    const totalToday = records.filter(r => r.tracking_date === new Date().toISOString().split('T')[0]).length;
    const totalActive = records.filter(r => r.status === 'checked_in').length;
    const totalCompleted = records.filter(r => r.status === 'completed').length;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📍 Tracking Kunjungan</h1>
                <p className="page-subtitle">Peta live kendaraan dan riwayat check-in/check-out di lokasi customer</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                    type="button"
                    className={`btn ${viewMode === 'live' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setViewMode('live')}
                >
                    📡 Peta Live
                </button>
                <button
                    type="button"
                    className={`btn ${viewMode === 'records' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setViewMode('records')}
                >
                    📋 Data Kunjungan
                </button>
            </div>

            {viewMode === 'live' && <LiveTrackingMap />}

            {viewMode === 'records' && (
            <>

            {error && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span>{error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
                </div>
            )}
            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span>{success}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-3 mb-4">
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))', borderLeft: '4px solid var(--success-500)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.3rem' }}>🟢 Sedang Aktif</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success-400)' }}>{totalActive}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))', borderLeft: '4px solid var(--primary-500)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.3rem' }}>✅ Selesai</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-400)' }}>{totalCompleted}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', borderLeft: '4px solid var(--warning-500)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.3rem' }}>📊 Total Data</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--warning-400)' }}>{records.length}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: 160, flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Karyawan</label>
                        <select className="form-input form-select" value={selectedDriver}
                            onChange={e => setSelectedDriver(e.target.value)}>
                            <option value="">Semua Karyawan</option>
                            {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.employee_id})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Dari Tanggal</label>
                        <input type="date" className="form-input" value={startDate}
                            onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Sampai Tanggal</label>
                        <input type="date" className="form-input" value={endDate}
                            onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Status</label>
                        <select className="form-input form-select" value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">Semua</option>
                            <option value="checked_in">Aktif</option>
                            <option value="completed">Selesai</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Tipe / Tugas</label>
                        <select className="form-input form-select" value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">Semua Tugas</option>
                            {Object.values(TRACKING_TYPES).map((t) => (
                                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={fetchRecords} style={{ height: 42 }}>🔍 Filter</button>
                        <button className="btn btn-outline" onClick={() => openMapForRecords(records)}
                            style={{ height: 42 }} title="Lihat semua di peta">🗺️ Peta</button>
                    </div>
                </div>
            </div>

            {/* Inline Map Preview (always show if there are records with coords) */}
            {records.length > 0 && records.some(r => r.checkin_latitude) && (
                <div className="card mb-4" style={{ overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="card-title">🗺️ Peta Lokasi Kunjungan</h2>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                            <span>🟢 Check-in</span>
                            <span>🔴 Check-out</span>
                        </div>
                    </div>
                    <div style={{ height: 350 }}>
                        <MapContainer
                            center={(() => {
                                const first = records.find(r => r.checkin_latitude);
                                return first ? [parseFloat(first.checkin_latitude), parseFloat(first.checkin_longitude)] : [-6.2, 106.8];
                            })()}
                            zoom={11}
                            style={{ height: '100%', width: '100%' }}
                            key={records.map(r => r.id).join('-')}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {records.map(rec => (
                                <span key={rec.id}>
                                    {rec.checkin_latitude && (
                                        <Marker position={[parseFloat(rec.checkin_latitude), parseFloat(rec.checkin_longitude)]} icon={checkinIcon}>
                                            <Popup>
                                                <div style={{ color: '#333', minWidth: 180 }}>
                                                    <strong>📥 Check-in</strong><br />
                                                    <strong>{rec.driver_name || 'Karyawan'}</strong><br />
                                                    🏪 {rec.customer_name}<br />
                                                    🕐 {formatDateTime(rec.checkin_time)}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                    {rec.checkout_latitude && (
                                        <Marker position={[parseFloat(rec.checkout_latitude), parseFloat(rec.checkout_longitude)]} icon={checkoutIcon}>
                                            <Popup>
                                                <div style={{ color: '#333', minWidth: 180 }}>
                                                    <strong>📤 Check-out</strong><br />
                                                    <strong>{rec.driver_name || 'Karyawan'}</strong><br />
                                                    🏪 {rec.customer_name}<br />
                                                    🕐 {formatDateTime(rec.checkout_time)}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                </span>
                            ))}
                        </MapContainer>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📋 Data Tracking ({records.length})</h2>
                </div>

                {loading ? (
                    <div className="empty-state" style={{ padding: '3rem' }}>
                        <div className="loading-spinner" style={{ width: 40, height: 40, margin: '0 auto' }} />
                    </div>
                ) : records.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📍</div>
                        <p className="empty-state-text">Tidak ada data tracking untuk filter yang dipilih</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Karyawan</th>
                                    <th>Customer</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Durasi</th>
                                    <th>Foto</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(rec => (
                                    <tr key={rec.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(rec.tracking_date)}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{rec.driver_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{rec.employee_id}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>
                                                {rec.customer_name}
                                                {rec.tracking_type && rec.tracking_type !== 'delivery' && (
                                                    <span className={`badge ${getTrackingTypeMeta(rec.tracking_type).badgeClass}`} style={{ marginLeft: 6, fontSize: '0.65rem', padding: '0.15rem 0.35rem' }}>
                                                        {getTrackingTypeMeta(rec.tracking_type).label}
                                                    </span>
                                                )}
                                            </div>
                                            {rec.address && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{rec.address}</div>}
                                            {rec.tracking_type === 'collection' && rec.invoice_number && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary-400)', marginTop: 2 }}>INV: {rec.invoice_number}</div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ color: 'var(--success-400)', fontWeight: 600 }}>{formatTime(rec.checkin_time)}</div>
                                            {rec.checkin_latitude && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', cursor: 'pointer', textDecoration: 'underline' }}
                                                    onClick={() => openGoogleMaps(rec.checkin_latitude, rec.checkin_longitude)}
                                                    title="Buka di Google Maps">
                                                    📍 {formatCoord(rec.checkin_latitude, rec.checkin_longitude)}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {rec.checkout_time ? (
                                                <>
                                                    <div style={{ color: 'var(--danger-400)', fontWeight: 600 }}>{formatTime(rec.checkout_time)}</div>
                                                    {rec.checkout_latitude && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', cursor: 'pointer', textDecoration: 'underline' }}
                                                            onClick={() => openGoogleMaps(rec.checkout_latitude, rec.checkout_longitude)}
                                                            title="Buka di Google Maps">
                                                            📍 {formatCoord(rec.checkout_latitude, rec.checkout_longitude)}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={{ color: 'var(--gray-500)' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{calcDuration(rec.checkin_time, rec.checkout_time)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                                                {rec.checkin_photo_path && (
                                                    <img src={rec.checkin_photo_path} alt="In"
                                                        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--success-500)' }}
                                                        onClick={() => setImageModal({ open: true, src: rec.checkin_photo_path, caption: `Check-in - ${rec.customer_name}` })}
                                                    />
                                                )}
                                                {rec.checkout_photo_path && (
                                                    <img src={rec.checkout_photo_path} alt="Out"
                                                        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--danger-500)' }}
                                                        onClick={() => setImageModal({ open: true, src: rec.checkout_photo_path, caption: `Check-out - ${rec.customer_name}` })}
                                                    />
                                                )}
                                                {!rec.checkin_photo_path && !rec.checkout_photo_path && <span style={{ color: 'var(--gray-600)', fontSize: '0.8rem' }}>-</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${rec.status === 'checked_in' ? 'badge-success' : 'badge-primary'}`}>
                                                {rec.status === 'checked_in' ? '🟢 Aktif' : '✅ Selesai'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                <button className="btn btn-outline" onClick={() => setDetailModal({ open: true, record: rec })}
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }} title="Detail">
                                                    👁️
                                                </button>
                                                <button className="btn btn-outline" onClick={() => openMapForRecords([rec])}
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }} title="Peta">
                                                    🗺️
                                                </button>
                                                <button className="btn btn-outline" onClick={() => handleDelete(rec.id)}
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger-400)' }} title="Hapus">
                                                    🗑️
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

            {/* Detail Modal */}
            {detailModal.open && detailModal.record && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setDetailModal({ open: false, record: null })}>
                    <div style={{
                        background: 'var(--gray-900)', borderRadius: 'var(--radius-xl)',
                        width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📍 Detail Tracking</h3>
                            <button onClick={() => setDetailModal({ open: false, record: null })}
                                style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ padding: '1.25rem' }}>
                            {(() => {
                                const r = detailModal.record;
                                return (
                                    <>
                                        <div className="grid grid-2 mb-3" style={{ gap: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.3rem' }}>Karyawan</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{r.driver_name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>{r.employee_id}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.3rem' }}>Customer</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{r.customer_name}</div>
                                                {r.address && <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>{r.address}</div>}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                            <span className={`badge ${r.status === 'checked_in' ? 'badge-success' : 'badge-primary'}`}>
                                                {r.status === 'checked_in' ? '🟢 Aktif' : '✅ Selesai'}
                                            </span>
                                            <span className={`badge ${r.tracking_type === 'collection' ? 'badge-warning' : r.tracking_type === 'sales' ? 'badge-success' : 'badge-outline'}`}>
                                                {getTrackingTypeMeta(r.tracking_type).icon} {getTrackingTypeMeta(r.tracking_type).label}
                                            </span>
                                            <span className="badge badge-outline">{formatDate(r.tracking_date)}</span>
                                            {r.checkout_time && <span className="badge badge-warning">⏱️ {calcDuration(r.checkin_time, r.checkout_time)}</span>}
                                        </div>

                                        {/* Bila jenisnya Collection */}
                                        {r.tracking_type === 'collection' && (
                                            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <h4 style={{ margin: 0, color: 'var(--warning-400)', fontSize: '0.9rem' }}>💰 Rincian Penagihan</h4>
                                                    {r.collection_status && (
                                                        <span className={`badge ${r.collection_status === 'Lunas' ? 'badge-success' : r.collection_status === 'Gagal' ? 'badge-danger' : 'badge-warning'}`}>
                                                            {r.collection_status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>No. Invoice</div>
                                                        <div style={{ fontWeight: 600 }}>{r.invoice_number || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Metode Bayar</div>
                                                        <div style={{ fontWeight: 600 }}>{r.payment_method || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Nilai Tagihan</div>
                                                        <div style={{ fontWeight: 600 }}>Rp {formatCurrencyHelper(r.amount_billed)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Berhasil Ditagih</div>
                                                        <div style={{ fontWeight: 600, color: 'var(--success-400)' }}>Rp {formatCurrencyHelper(r.amount_collected)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Photos */}
                                        {(r.checkin_photo_path || r.checkout_photo_path) && (
                                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
                                                {r.checkin_photo_path && (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <img src={r.checkin_photo_path} alt="Check-in"
                                                            style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '3px solid var(--success-500)' }}
                                                            onClick={() => setImageModal({ open: true, src: r.checkin_photo_path, caption: `Check-in - ${r.customer_name}` })}
                                                        />
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--success-400)', marginTop: '0.3rem' }}>📥 Check-in</div>
                                                    </div>
                                                )}
                                                {r.checkout_photo_path && (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <img src={r.checkout_photo_path} alt="Check-out"
                                                            style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '3px solid var(--danger-500)' }}
                                                            onClick={() => setImageModal({ open: true, src: r.checkout_photo_path, caption: `Check-out - ${r.customer_name}` })}
                                                        />
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--danger-400)', marginTop: '0.3rem' }}>📤 Check-out</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Check-in details */}
                                        <div style={{
                                            background: 'rgba(16,185,129,0.08)',
                                            border: '1px solid rgba(16,185,129,0.2)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '1rem',
                                            marginBottom: '0.75rem'
                                        }}>
                                            <div style={{ fontWeight: 700, color: 'var(--success-400)', marginBottom: '0.5rem' }}>📥 Check-in</div>
                                            <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                                                🕐 <strong>{formatDateTime(r.checkin_time)}</strong>
                                            </div>
                                            {r.checkin_latitude && (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                    📍 Koordinat: {formatCoord(r.checkin_latitude, r.checkin_longitude)}{' '}
                                                    <span style={{ cursor: 'pointer', color: 'var(--primary-400)', textDecoration: 'underline' }}
                                                        onClick={() => openGoogleMaps(r.checkin_latitude, r.checkin_longitude)}>
                                                        Buka Maps ↗
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Check-out details */}
                                        <div style={{
                                            background: r.checkout_time ? 'rgba(239,68,68,0.08)' : 'rgba(156,163,175,0.08)',
                                            border: `1px solid ${r.checkout_time ? 'rgba(239,68,68,0.2)' : 'rgba(156,163,175,0.2)'}`,
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '1rem',
                                            marginBottom: '0.75rem'
                                        }}>
                                            <div style={{ fontWeight: 700, color: r.checkout_time ? 'var(--danger-400)' : 'var(--gray-500)', marginBottom: '0.5rem' }}>
                                                📤 Check-out
                                            </div>
                                            {r.checkout_time ? (
                                                <>
                                                    <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                                                        🕐 <strong>{formatDateTime(r.checkout_time)}</strong>
                                                    </div>
                                                    {r.checkout_latitude && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                            📍 Koordinat: {formatCoord(r.checkout_latitude, r.checkout_longitude)}{' '}
                                                            <span style={{ cursor: 'pointer', color: 'var(--primary-400)', textDecoration: 'underline' }}
                                                                onClick={() => openGoogleMaps(r.checkout_latitude, r.checkout_longitude)}>
                                                                Buka Maps ↗
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)' }}>Belum check-out</div>
                                            )}
                                        </div>

                                        {r.notes && (
                                            <div style={{
                                                background: 'rgba(99,102,241,0.06)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '0.75rem',
                                                marginBottom: '0.75rem'
                                            }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.3rem' }}>💬 Catatan</div>
                                                <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{r.notes}</div>
                                            </div>
                                        )}

                                        {/* Inline Map */}
                                        {r.checkin_latitude && (
                                            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--gray-700)' }}>
                                                <div style={{ height: 280 }}>
                                                    <MapContainer
                                                        center={[parseFloat(r.checkin_latitude), parseFloat(r.checkin_longitude)]}
                                                        zoom={15}
                                                        style={{ height: '100%', width: '100%' }}
                                                    >
                                                        <TileLayer
                                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                        />
                                                        <Marker position={[parseFloat(r.checkin_latitude), parseFloat(r.checkin_longitude)]} icon={checkinIcon}>
                                                            <Popup><div style={{ color: '#333' }}><strong>📥 Check-in</strong><br />{formatDateTime(r.checkin_time)}</div></Popup>
                                                        </Marker>
                                                        {r.checkout_latitude && (
                                                            <Marker position={[parseFloat(r.checkout_latitude), parseFloat(r.checkout_longitude)]} icon={checkoutIcon}>
                                                                <Popup><div style={{ color: '#333' }}><strong>📤 Check-out</strong><br />{formatDateTime(r.checkout_time)}</div></Popup>
                                                            </Marker>
                                                        )}
                                                    </MapContainer>
                                                </div>
                                                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', gap: '1rem', background: 'var(--gray-800)' }}>
                                                    <span>🟢 Check-in</span>
                                                    {r.checkout_latitude && <span>🔴 Check-out</span>}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Full Map Modal */}
            {mapModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setMapModal({ ...mapModal, open: false })}>
                    <div style={{
                        background: 'var(--gray-900)', borderRadius: 'var(--radius-xl)',
                        width: '100%', maxWidth: 900, maxHeight: '85vh',
                        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-700)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🗺️ Peta Lokasi Tracking ({mapModal.records.length} titik)</h3>
                            <button onClick={() => setMapModal({ ...mapModal, open: false })}
                                style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ height: 500 }}>
                            <MapContainer center={mapModal.center} zoom={12} style={{ height: '100%', width: '100%' }}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {mapModal.records.map(rec => (
                                    <span key={rec.id}>
                                        {rec.checkin_latitude && (
                                            <Marker position={[parseFloat(rec.checkin_latitude), parseFloat(rec.checkin_longitude)]} icon={checkinIcon}>
                                                <Popup>
                                                    <div style={{ color: '#333', minWidth: 180 }}>
                                                        <strong>📥 Check-in</strong><br />
                                                        <strong>{rec.driver_name || 'Karyawan'}</strong><br />
                                                        🏪 {rec.customer_name}<br />
                                                        🕐 {formatDateTime(rec.checkin_time)}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                        {rec.checkout_latitude && (
                                            <Marker position={[parseFloat(rec.checkout_latitude), parseFloat(rec.checkout_longitude)]} icon={checkoutIcon}>
                                                <Popup>
                                                    <div style={{ color: '#333', minWidth: 180 }}>
                                                        <strong>📤 Check-out</strong><br />
                                                        <strong>{rec.driver_name || 'Karyawan'}</strong><br />
                                                        🏪 {rec.customer_name}<br />
                                                        🕐 {formatDateTime(rec.checkout_time)}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                    </span>
                                ))}
                            </MapContainer>
                        </div>
                        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--gray-400)', borderTop: '1px solid var(--gray-700)' }}>
                            <span>🟢 = Check-in</span>
                            <span>🔴 = Check-out</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {imageModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 99999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setImageModal({ ...imageModal, open: false })}>
                    <div style={{ textAlign: 'center', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <img src={imageModal.src} alt={imageModal.caption}
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-lg)', border: '2px solid var(--gray-600)' }} />
                        <p style={{ marginTop: '0.75rem', color: 'var(--gray-300)', fontSize: '0.9rem' }}>{imageModal.caption}</p>
                        <button className="btn btn-outline" onClick={() => setImageModal({ ...imageModal, open: false })}
                            style={{ marginTop: '0.5rem' }}>✕ Tutup</button>
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    );
}
