import { useState, useEffect, useMemo } from 'react';
import { driverActivitiesAPI } from '../utils/api';

const MONTHS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function AdminDriverActivities() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [drivers, setDrivers] = useState([]);
    const [selectedDriver, setSelectedDriver] = useState('');
    const [activities, setActivities] = useState([]);
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeView, setActiveView] = useState('calendar'); // 'calendar' or 'summary'

    const [formData, setFormData] = useState({
        user_id: '', activity_date: '', is_subuh: false,
        departure_time: '', rit_count: 1, rit_notes: '',
        is_overnight: false, notes: ''
    });

    useEffect(() => {
        fetchDrivers();
    }, []);

    useEffect(() => {
        fetchActivities();
        fetchSummary();
    }, [month, year, selectedDriver]);

    async function fetchDrivers() {
        try {
            const data = await driverActivitiesAPI.getDrivers();
            setDrivers(data);
            if (data.length > 0) setSelectedDriver(data[0].id);
        } catch (e) {
            console.error('Failed to fetch drivers:', e);
        }
    }

    async function fetchActivities() {
        setLoading(true);
        try {
            const params = { month, year };
            if (selectedDriver) params.user_id = selectedDriver;
            const data = await driverActivitiesAPI.getAll(params);
            setActivities(data);
        } catch (e) {
            console.error('Failed to fetch activities:', e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchSummary() {
        try {
            const data = await driverActivitiesAPI.getSummary(month, year);
            setSummary(data);
        } catch (e) {
            console.error('Failed to fetch summary:', e);
        }
    }

    function openAddModal(date) {
        setEditData(null);
        setFormData({
            user_id: selectedDriver || (drivers[0]?.id || ''),
            activity_date: date || '',
            is_subuh: false, departure_time: '', rit_count: 1,
            rit_notes: '', is_overnight: false, notes: ''
        });
        setShowModal(true);
        setError('');
    }

    function openEditModal(act) {
        setEditData(act);
        setFormData({
            user_id: act.user_id,
            activity_date: act.activity_date.split('T')[0],
            is_subuh: act.is_subuh,
            departure_time: act.departure_time || '',
            rit_count: act.rit_count || 1,
            rit_notes: act.rit_notes || '',
            is_overnight: act.is_overnight,
            notes: act.notes || ''
        });
        setShowModal(true);
        setError('');
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editData) {
                await driverActivitiesAPI.update(editData.id, formData);
            } else {
                await driverActivitiesAPI.create(formData);
            }
            setSuccess(editData ? 'Data berhasil diupdate' : 'Data berhasil disimpan');
            setShowModal(false);
            fetchActivities();
            fetchSummary();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin hapus data ini?')) return;
        try {
            await driverActivitiesAPI.delete(id);
            setSuccess('Data berhasil dihapus');
            fetchActivities();
            fetchSummary();
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            alert('Gagal menghapus: ' + e.message);
        }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const act = activities.find(a => a.activity_date.split('T')[0] === dateStr);
            days.push({ date: d, dateStr, dayOfWeek, activity: act });
        }
        return days;
    }, [activities, month, year]);

    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    // Summary stats
    const totalStats = useMemo(() => {
        return summary.reduce((acc, s) => ({
            subuh: acc.subuh + parseInt(s.total_subuh || 0),
            rit: acc.rit + parseInt(s.total_rit || 0),
            overnight: acc.overnight + parseInt(s.total_overnight || 0),
            extraRit: acc.extraRit + parseInt(s.extra_rit || 0),
            subuhAmount: acc.subuhAmount + (s.total_subuh_amount || 0),
            ritAmount: acc.ritAmount + (s.total_rit_amount || 0),
            overnightAmount: acc.overnightAmount + (s.total_overnight_amount || 0),
            ritaseAmount: acc.ritaseAmount + (s.total_ritase_amount || 0),
            grandTotal: acc.grandTotal + (s.grand_total || 0),
        }), { subuh: 0, rit: 0, overnight: 0, extraRit: 0, subuhAmount: 0, ritAmount: 0, overnightAmount: 0, ritaseAmount: 0, grandTotal: 0 });
    }, [summary]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🚛 Aktivitas Driver</h1>
                <p className="page-subtitle">Kelola aktivitas harian driver — Subuh, RIT, dan Menginap</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span> {success}
                </div>
            )}

            {/* Filters & Controls */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <select className="form-input form-select" value={month} onChange={e => setMonth(parseInt(e.target.value))}
                            style={{ width: 140 }}>
                            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                        </select>
                        <select className="form-input form-select" value={year} onChange={e => setYear(parseInt(e.target.value))}
                            style={{ width: 100 }}>
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select className="form-input form-select" value={selectedDriver}
                            onChange={e => setSelectedDriver(e.target.value)} style={{ width: 200 }}>
                            <option value="">Semua Driver</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.employee_id})</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setActiveView('calendar')}
                            style={{
                                padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)',
                                background: activeView === 'calendar' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'var(--gray-700)',
                                color: '#fff', cursor: 'pointer', transition: 'all 0.2s'
                            }}>📅 Kalender</button>
                        <button onClick={() => setActiveView('summary')}
                            style={{
                                padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)',
                                background: activeView === 'summary' ? 'linear-gradient(135deg, #10b981, #34d399)' : 'var(--gray-700)',
                                color: '#fff', cursor: 'pointer', transition: 'all 0.2s'
                            }}>📊 Rekap</button>
                        <button onClick={() => openAddModal('')}
                            style={{
                                padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', cursor: 'pointer'
                            }}>+ Tambah</button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: '🌙 Total Subuh', value: totalStats.subuh + ' hari', amount: totalStats.subuhAmount, color: '#6366f1' },
                    { label: '🔄 Total RIT', value: totalStats.rit + ' trip', amount: totalStats.ritAmount, color: '#f59e0b' },
                    { label: '🚚 Ritase Tambahan', value: totalStats.extraRit + ' trip', amount: totalStats.ritaseAmount, color: '#8b5cf6' },
                    { label: '🏨 Total Menginap', value: totalStats.overnight + ' hari', amount: totalStats.overnightAmount, color: '#ef4444' },
                    { label: '💰 Grand Total', value: '', amount: totalStats.grandTotal, color: '#10b981' },
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${stat.color}` }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.25rem' }}>{stat.label}</div>
                        {stat.value && <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>}
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(stat.amount)}</div>
                    </div>
                ))}
            </div>

            {/* Calendar View */}
            {activeView === 'calendar' && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📅 Aktivitas {MONTHS[month]} {year}</h2>
                    </div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto' }} />
                        </div>
                    ) : (
                        <div style={{ padding: '1rem' }}>
                            {/* Day header */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                                {dayNames.map(d => (
                                    <div key={d} style={{
                                        textAlign: 'center', padding: '0.5rem', fontWeight: 700, fontSize: '0.75rem',
                                        color: d === 'Min' || d === 'Sab' ? '#ef4444' : 'var(--gray-300)',
                                        background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)'
                                    }}>{d}</div>
                                ))}
                            </div>
                            {/* Calendar grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                                {/* Empty cells for first week offset */}
                                {Array.from({ length: calendarDays[0]?.dayOfWeek || 0 }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {calendarDays.map(day => {
                                    const act = day.activity;
                                    const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                                    const hasData = !!act;
                                    return (
                                        <div key={day.date}
                                            onClick={() => hasData ? openEditModal(act) : openAddModal(day.dateStr)}
                                            style={{
                                                minHeight: 80, padding: '0.4rem', borderRadius: 'var(--radius-sm)',
                                                background: hasData ? 'rgba(99,102,241,0.1)' : isWeekend ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                                                border: hasData ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                                            }}
                                        >
                                            <div style={{
                                                fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem',
                                                color: isWeekend ? '#ef4444' : 'var(--gray-300)'
                                            }}>{day.date}</div>
                                            {hasData && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    {act.is_subuh && (
                                                        <span style={{ fontSize: '0.6rem', background: 'rgba(99,102,241,0.3)', padding: '1px 4px', borderRadius: 4, color: '#a5b4fc' }}>🌙 Subuh</span>
                                                    )}
                                                    <span style={{ fontSize: '0.6rem', background: 'rgba(245,158,11,0.3)', padding: '1px 4px', borderRadius: 4, color: '#fcd34d' }}>
                                                        🔄 {act.rit_count} RIT
                                                    </span>
                                                    {act.rit_count > 1 && (
                                                        <span style={{ fontSize: '0.6rem', background: 'rgba(139,92,246,0.3)', padding: '1px 4px', borderRadius: 4, color: '#c4b5fd' }}>🚚 +{act.rit_count - 1} Ritase</span>
                                                    )}
                                                    {act.is_overnight && (
                                                        <span style={{ fontSize: '0.6rem', background: 'rgba(239,68,68,0.3)', padding: '1px 4px', borderRadius: 4, color: '#fca5a5' }}>🏨 Inap</span>
                                                    )}
                                                </div>
                                            )}
                                            {!hasData && !isWeekend && (
                                                <div style={{ fontSize: '0.6rem', color: 'var(--gray-600)', textAlign: 'center', marginTop: 8 }}>+ tambah</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary/Rekap View */}
            {activeView === 'summary' && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📊 Rekap Driver — {MONTHS[month]} {year}</h2>
                    </div>
                    {summary.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🚛</div>
                            <p className="empty-state-text">Belum ada data aktivitas driver bulan ini</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Driver</th>
                                        <th style={{ textAlign: 'center' }}>Hari Kerja</th>
                                        <th style={{ textAlign: 'center' }}>🌙 Subuh</th>
                                        <th style={{ textAlign: 'right' }}>Uang Subuh</th>
                                        <th style={{ textAlign: 'center' }}>🔄 Total RIT</th>
                                        <th style={{ textAlign: 'right' }}>Uang RIT</th>
                                        <th style={{ textAlign: 'center' }}>🚚 Ritase+</th>
                                        <th style={{ textAlign: 'right' }}>Uang Ritase</th>
                                        <th style={{ textAlign: 'center' }}>🏨 Menginap</th>
                                        <th style={{ textAlign: 'right' }}>Uang Inap</th>
                                        <th style={{ textAlign: 'right', fontWeight: 700 }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.map(s => (
                                        <tr key={s.user_id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.user_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{s.employee_id}</div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{s.total_days}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-info">{s.total_subuh}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(s.total_subuh_amount)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-warning">{s.total_rit}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(s.total_rit_amount)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge" style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>{s.extra_rit}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(s.total_ritase_amount)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-danger" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>{s.total_overnight}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(s.total_overnight_amount)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-400)' }}>
                                                {formatCurrency(s.grand_total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--gray-600)' }}>
                                        <td colSpan={2}>TOTAL</td>
                                        <td style={{ textAlign: 'center' }}>{totalStats.subuh}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.subuhAmount)}</td>
                                        <td style={{ textAlign: 'center' }}>{totalStats.rit}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.ritAmount)}</td>
                                        <td style={{ textAlign: 'center' }}>{totalStats.extraRit}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.ritaseAmount)}</td>
                                        <td style={{ textAlign: 'center' }}>{totalStats.overnight}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.overnightAmount)}</td>
                                        <td style={{ textAlign: 'right', color: '#10b981', fontSize: '1.1rem' }}>{formatCurrency(totalStats.grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editData ? '✏️ Edit Aktivitas' : '➕ Tambah Aktivitas'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Driver</label>
                                        <select className="form-input form-select" value={formData.user_id}
                                            onChange={e => setFormData(prev => ({ ...prev, user_id: parseInt(e.target.value) }))}
                                            disabled={!!editData} required>
                                            <option value="">Pilih Driver...</option>
                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tanggal</label>
                                        <input className="form-input" type="date" value={formData.activity_date}
                                            onChange={e => setFormData(prev => ({ ...prev, activity_date: e.target.value }))}
                                            disabled={!!editData} required />
                                    </div>
                                </div>

                                {/* Driver options */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', margin: '1rem 0' }}>
                                    {/* Subuh Toggle */}
                                    <div onClick={() => setFormData(prev => ({ ...prev, is_subuh: !prev.is_subuh }))}
                                        style={{
                                            padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer',
                                            background: formData.is_subuh ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                            border: formData.is_subuh ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                                            transition: 'all 0.2s'
                                        }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🌙</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: formData.is_subuh ? '#818cf8' : 'var(--gray-400)' }}>
                                            Jalan Subuh
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                            {formData.is_subuh ? '✓ Aktif' : 'Tidak'}
                                        </div>
                                    </div>

                                    {/* RIT Counter */}
                                    <div style={{
                                        padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center',
                                        background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)'
                                    }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🔄</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', marginBottom: 6 }}>Jumlah RIT</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, rit_count: Math.max(1, prev.rit_count - 1) }))}
                                                style={{
                                                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                                                    background: 'var(--gray-600)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
                                                }}>−</button>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', minWidth: 24 }}>{formData.rit_count}</span>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, rit_count: prev.rit_count + 1 }))}
                                                style={{
                                                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                                                    background: 'var(--gray-600)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
                                                }}>+</button>
                                        </div>
                                    </div>

                                    {/* Overnight Toggle */}
                                    <div onClick={() => setFormData(prev => ({ ...prev, is_overnight: !prev.is_overnight }))}
                                        style={{
                                            padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer',
                                            background: formData.is_overnight ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                                            border: formData.is_overnight ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.1)',
                                            transition: 'all 0.2s'
                                        }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🏨</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: formData.is_overnight ? '#f87171' : 'var(--gray-400)' }}>
                                            Menginap
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                            {formData.is_overnight ? '✓ Aktif' : 'Tidak'}
                                        </div>
                                    </div>
                                </div>

                                {/* Ritase Info Banner */}
                                {formData.rit_count > 1 && (
                                    <div style={{
                                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                                        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                        display: 'flex', alignItems: 'center', gap: '0.75rem'
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>🚚</span>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '0.85rem' }}>
                                                Ritase Tambahan: +{formData.rit_count - 1} trip
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                                                Driver melakukan {formData.rit_count} RIT → {formData.rit_count - 1} ritase tambahan akan dihitung otomatis di payroll
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {formData.is_subuh && (
                                    <div className="form-group">
                                        <label className="form-label">Jam Berangkat</label>
                                        <input className="form-input" type="time" value={formData.departure_time}
                                            onChange={e => setFormData(prev => ({ ...prev, departure_time: e.target.value }))} />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Catatan Rute/RIT</label>
                                    <input className="form-input" value={formData.rit_notes}
                                        onChange={e => setFormData(prev => ({ ...prev, rit_notes: e.target.value }))}
                                        placeholder="Contoh: Jakarta - Surabaya - Jakarta" />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Catatan Lain</label>
                                    <textarea className="form-input" rows={2} value={formData.notes}
                                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Catatan tambahan (opsional)" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                {editData && (
                                    <button type="button" className="btn" onClick={() => { setShowModal(false); handleDelete(editData.id); }}
                                        style={{ marginRight: 'auto', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                                        🗑️ Hapus
                                    </button>
                                )}
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
