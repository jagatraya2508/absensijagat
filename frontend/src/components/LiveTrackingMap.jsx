import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { driverTrackingAPI } from '../utils/api';
import { getTrackingTypeMeta } from '../utils/tracking';

const TRAIL_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899'];

function vehicleIcon({ heading, online, name, motion }) {
    const deg = Number.isFinite(heading) && heading >= 0 ? heading : 0;
    const color = online ? '#10b981' : '#94a3b8';
    const emoji = motion?.icon || '📍';
    const html = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);">
            <div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);max-width:140px;overflow:hidden;text-overflow:ellipsis;">
                ${emoji} ${String(name || '').replace(/[&<>"']/g, '')}
            </div>
            <svg width="34" height="34" viewBox="0 0 24 24" style="transform:rotate(${deg}deg);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));margin-top:2px;">
                <path d="M12 2 L20 21 L12 16 L4 21 Z" fill="${color}" stroke="#fff" stroke-width="1.4"/>
            </svg>
        </div>
    `;
    return L.divIcon({
        className: 'live-vehicle-marker',
        html,
        iconSize: [48, 56],
        iconAnchor: [24, 50],
        popupAnchor: [0, -46],
    });
}

function FitVehicles({ vehicles, selectedId }) {
    const map = useMap();
    const fitted = useRef(false);

    useEffect(() => {
        if (!vehicles.length) return;
        if (selectedId) {
            const v = vehicles.find((x) => x.user_id === selectedId);
            if (v) map.panTo([v.latitude, v.longitude], { animate: true });
            return;
        }
        if (fitted.current) return;
        const pts = vehicles.map((v) => [v.latitude, v.longitude]);
        if (pts.length === 1) {
            map.setView(pts[0], 15);
        } else {
            map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
        }
        fitted.current = true;
    }, [vehicles, selectedId, map]);

    return null;
}

function formatAge(sec) {
    if (sec < 10) return 'baru saja';
    if (sec < 60) return `${sec} dtk lalu`;
    const m = Math.floor(sec / 60);
    return `${m} mnt lalu`;
}

function formatSpeed(ms) {
    if (ms == null || Number.isNaN(ms) || ms < 0.4) return 'diam';
    return `${Math.round(ms * 3.6)} km/jam`;
}

function motionText(v) {
    const m = v.motion;
    if (!m) return formatSpeed(v.speed);
    const kmh = m.speed_kmh != null ? `${Math.round(m.speed_kmh)} km/jam` : formatSpeed(v.speed);
    const guess = m.guessed ? ' (perkiraan)' : '';
    return `${m.icon} ${m.label}${guess} · ${kmh}`;
}

function taskLabel(v) {
    if (v.visit_status === 'checked_in' && v.tracking_type) {
        return getTrackingTypeMeta(v.tracking_type).label;
    }
    const parts = [];
    if (v.is_driver) parts.push('Driver');
    if (v.is_collector) parts.push('Kolektor');
    if (v.is_sales) parts.push('Sales');
    return parts.join(' / ') || 'Lapangan';
}

export default function LiveTrackingMap() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    async function fetchLive() {
        try {
            const data = await driverTrackingAPI.getLive();
            setVehicles(data.vehicles || []);
            setError('');
        } catch (e) {
            setError(e.message || 'Gagal memuat peta live');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLive();
        const id = setInterval(fetchLive, 5000);
        return () => clearInterval(id);
    }, []);

    const onlineCount = vehicles.filter((v) => v.online).length;
    const selected = vehicles.find((v) => v.user_id === selectedId) || null;
    const center = useMemo(() => {
        if (selected) return [selected.latitude, selected.longitude];
        if (vehicles[0]) return [vehicles[0].latitude, vehicles[0].longitude];
        return [-6.2, 106.816];
    }, [vehicles, selected]);

    return (
        <div className="card mb-4" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 className="card-title">📡 Peta Live Kendaraan</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>● {onlineCount} online</span>
                    <span>{vehicles.length} di peta</span>
                    <span title="Deteksi dari kecepatan GPS">🚶 motor/mobil/jalan kaki</span>
                    <button className="btn btn-outline" onClick={fetchLive} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>
                        🔄
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger" style={{ margin: '0.75rem 1rem' }}>
                    <span className="alert-icon">⚠️</span>{error}
                </div>
            )}

            <div className="live-map-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', minHeight: 520 }}>
                <style>{`
                    .live-vehicle-marker { background: none !important; border: none !important; }
                    @media (max-width: 800px) {
                        .live-map-grid { grid-template-columns: 1fr !important; }
                        .live-map-list { max-height: 220px !important; }
                    }
                `}</style>
                <div className="live-map-list" style={{ borderRight: '1px solid var(--gray-200)', maxHeight: 560, overflowY: 'auto' }}>
                    {loading && !vehicles.length ? (
                        <div style={{ padding: '1.5rem', color: 'var(--gray-400)' }}>Memuat posisi...</div>
                    ) : vehicles.length === 0 ? (
                        <div style={{ padding: '1.25rem', color: 'var(--gray-500)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            Belum ada kendaraan live. Karyawan dengan akses tracking harus membuka aplikasi (izin GPS aktif) agar posisinya tampil di sini.
                        </div>
                    ) : vehicles.map((v, idx) => (
                        <button
                            key={v.user_id}
                            type="button"
                            onClick={() => setSelectedId(v.user_id === selectedId ? null : v.user_id)}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                background: selectedId === v.user_id ? 'rgba(16,185,129,0.1)' : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--gray-200)',
                                padding: '0.85rem 1rem',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div style={{ fontWeight: 700 }}>{v.name}</div>
                                <span style={{ color: v.online ? '#10b981' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {v.online ? 'LIVE' : 'idle'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                {v.employee_id} · {taskLabel(v)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                {motionText(v)} · {formatAge(v.age_sec)}
                            </div>
                            {v.customer_name && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--success-400)', marginTop: 2 }}>
                                    🏪 {v.customer_name}
                                </div>
                            )}
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: TRAIL_COLORS[idx % TRAIL_COLORS.length], marginTop: 6 }} />
                        </button>
                    ))}
                </div>

                <div style={{ height: 560, position: 'relative' }}>
                    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <FitVehicles vehicles={vehicles} selectedId={selectedId} />
                        {vehicles.map((v, idx) => {
                            const color = TRAIL_COLORS[idx % TRAIL_COLORS.length];
                            const trail = (v.trail || []).map((p) => [p.lat, p.lng]);
                            const dim = selectedId && selectedId !== v.user_id;
                            return (
                                <span key={v.user_id}>
                                    {trail.length > 1 && (
                                        <Polyline
                                            positions={trail}
                                            pathOptions={{
                                                color,
                                                weight: selectedId === v.user_id ? 5 : 3,
                                                opacity: dim ? 0.25 : 0.85,
                                            }}
                                        />
                                    )}
                                    <Marker
                                        position={[v.latitude, v.longitude]}
                                        icon={vehicleIcon({ heading: v.heading, online: v.online, name: v.name.split(' ')[0], motion: v.motion })}
                                        eventHandlers={{ click: () => setSelectedId(v.user_id) }}
                                        opacity={dim ? 0.45 : 1}
                                    >
                                        <Popup>
                                            <div style={{ color: '#333', minWidth: 180 }}>
                                                <strong>{v.name}</strong><br />
                                                {v.employee_id} · {taskLabel(v)}<br />
                                                {v.motion ? `${v.motion.icon} ${v.motion.label}${v.motion.guessed ? ' (perkiraan)' : ''}` : formatSpeed(v.speed)}
                                                {v.motion?.speed_kmh != null ? ` · ${Math.round(v.motion.speed_kmh)} km/jam` : null}<br />
                                                ⏱ {formatAge(v.age_sec)}
                                                {v.customer_name ? <><br />🏪 {v.customer_name}</> : null}
                                            </div>
                                        </Popup>
                                    </Marker>
                                </span>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
