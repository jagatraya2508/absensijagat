import { useState, useEffect } from 'react';
import { leavesAPI } from '../utils/api';
import ApprovalTimeline from '../components/ApprovalTimeline';
import Icon from '../components/Icon';

export default function Leaves() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [filter, setFilter] = useState('');
    const [quota, setQuota] = useState(null);

    // Form state
    const [type, setType] = useState('late');
    const [isHourly, setIsHourly] = useState(false);
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('12:00');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [replacementDate, setReplacementDate] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);

    const leaveTypes = {
        late: { label: 'Izin Terlambat', icon: 'Clock', color: 'warning' },
        sick: { label: 'Izin Sakit', icon: 'HeartPulse', color: 'danger' },
        permission: { label: 'Izin Tidak Masuk', icon: 'FileText', color: 'secondary' },
        leave: { label: 'Cuti', icon: 'Palmtree', color: 'primary' },
        change_off: { label: 'Tukar Libur', icon: 'RefreshCw', color: 'info' }
    };

    const statusLabels = {
        pending: { label: 'Menunggu', color: 'warning', icon: 'Hourglass' },
        approved: { label: 'Disetujui', color: 'success', icon: 'CheckCircle2' },
        rejected: { label: 'Ditolak', color: 'danger', icon: 'XCircle' }
    };

    useEffect(() => {
        fetchRequests();
        fetchQuota();
    }, [filter]);

    async function fetchQuota() {
        try {
            const data = await leavesAPI.getQuota();
            setQuota(data);
        } catch (error) {
            console.error('Failed to fetch quota:', error);
        }
    }

    async function fetchRequests() {
        setLoading(true);
        try {
            const data = await leavesAPI.getMy(filter || undefined);
            setRequests(data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('start_date', startDate);
            formData.append('end_date', type === 'leave' && isHourly ? startDate : endDate);
            if (type === 'leave' && isHourly) {
                formData.append('is_hourly', 'true');
                formData.append('start_time', startTime);
                formData.append('end_time', endTime);
            }
            if (type === 'change_off' && replacementDate) {
                formData.append('replacement_date', replacementDate);
            }
            formData.append('reason', reason);
            if (attachment) {
                formData.append('attachment', attachment);
            }

            await leavesAPI.create(formData);

            // Reset form
            setType('late');
            setIsHourly(false);
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
            setStartTime('08:00');
            setEndTime('12:00');
            setReplacementDate('');
            setReason('');
            setAttachment(null);
            setShowForm(false);

            // Refresh list & quota
            fetchRequests();
            fetchQuota();
            alert('Pengajuan berhasil dibuat!');
        } catch (error) {
            alert(error.message || 'Gagal membuat pengajuan');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus pengajuan ini?')) {
            return;
        }

        try {
            await leavesAPI.delete(id);
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            alert(error.message || 'Gagal menghapus pengajuan');
        }
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function calculateDays(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        return String(timeStr).substring(0, 5);
    }

    function calculateHours(start, end) {
        if (!start || !end) return 0;
        const [sh, sm] = start.substring(0, 5).split(':').map(Number);
        const [eh, em] = end.substring(0, 5).split(':').map(Number);
        let s = sh * 60 + sm;
        let e = eh * 60 + em;
        if (e < s) e += 1440;
        return Math.round(((e - s) / 60) * 100) / 100;
    }

    function adjustHour(baseTime, addHours) {
        if (!baseTime) return '';
        const [h, m] = baseTime.substring(0, 5).split(':').map(Number);
        let totalMins = h * 60 + m + Math.round(addHours * 60);
        totalMins = ((totalMins % 1440) + 1440) % 1440;
        const resH = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const resM = String(totalMins % 60).padStart(2, '0');
        return `${resH}:${resM}`;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="FileText" size={16} inline /> Pengajuan Izin & Cuti</h1>
                <p className="page-subtitle">Ajukan izin terlambat, sakit, atau cuti</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-3 mb-4">
                <button
                    className="card status-card"
                    onClick={() => { setType('late'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                >
                    <div className="status-card-icon warning"><Icon name="Clock" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>Izin Terlambat</h3>
                        <p style={{ fontSize: '0.85rem' }}>Datang tidak tepat waktu</p>
                    </div>
                </button>
                <button
                    className="card status-card"
                    onClick={() => { setType('sick'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                >
                    <div className="status-card-icon danger"><Icon name="HeartPulse" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>Izin Sakit</h3>
                        <p style={{ fontSize: '0.85rem' }}>Tidak masuk karena sakit</p>
                    </div>
                </button>
                <button
                    className="card status-card"
                    onClick={() => { setType('permission'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                >
                    <div className="status-card-icon secondary"><Icon name="FileText" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>Izin Tidak Masuk</h3>
                        <p style={{ fontSize: '0.85rem' }}>Izin absen seharian penuh</p>
                    </div>
                </button>
                <button
                    className="card status-card"
                    onClick={() => {
                        setType('leave');
                        if (quota?.leave_calculation_mode === 'hourly') {
                            setIsHourly(true);
                        } else {
                            setIsHourly(false);
                        }
                        setShowForm(true);
                    }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                    disabled={quota && quota.remaining <= 0}
                >
                    <div className="status-card-icon primary"><Icon name="Palmtree" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>Cuti</h3>
                        <p style={{ fontSize: '0.85rem' }}>
                            {quota ? (
                                <>
                                    Sisa: <strong>{quota.remaining}</strong> hari
                                    {quota.remaining_hours != null && (
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary-400)' }}>
                                            ({quota.remaining_hours} jam • @{quota.hours_per_leave_day || 8} jam/hari)
                                        </span>
                                    )}
                                </>
                            ) : (
                                'Ambil cuti tahunan'
                            )}
                        </p>
                    </div>
                </button>
                <button
                    className="card status-card"
                    onClick={() => { setType('change_off'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                >
                    <div className="status-card-icon info"><Icon name="RefreshCw" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>Tukar Libur</h3>
                        <p style={{ fontSize: '0.85rem' }}>Ganti hari libur/off</p>
                    </div>
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary-500)' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            <Icon name={leaveTypes[type].icon} size={18} inline /> Ajukan {leaveTypes[type].label}
                        </h2>
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowForm(false)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            <Icon name="X" size={16} inline />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Mode Selection if Type is Leave and Mode is Both or Hourly */}
                        {type === 'leave' && (quota?.leave_calculation_mode === 'both' || quota?.leave_calculation_mode === 'hourly' || !quota?.leave_calculation_mode) && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Tipe Pengajuan Cuti</label>
                                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.35rem', borderRadius: 'var(--radius-md)' }}>
                                    <button
                                        type="button"
                                        className={`btn ${!isHourly ? 'btn-primary' : 'btn-outline'}`}
                                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.85rem' }}
                                        onClick={() => setIsHourly(false)}
                                        disabled={quota?.leave_calculation_mode === 'hourly'}
                                    >
                                        📅 Cuti Harian (Full Day)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${isHourly ? 'btn-primary' : 'btn-outline'}`}
                                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.85rem' }}
                                        onClick={() => setIsHourly(true)}
                                        disabled={quota?.leave_calculation_mode === 'daily'}
                                    >
                                        ⏱️ Cuti Per Jam (Hourly)
                                    </button>
                                </div>
                            </div>
                        )}

                        {type === 'leave' && isHourly ? (
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1rem',
                                marginBottom: '1rem'
                            }}>
                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label className="form-label">Tanggal Cuti *</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            setEndDate(e.target.value);
                                        }}
                                        required
                                    />
                                </div>

                                <div className="grid grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Jam Mulai Cuti *</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Jam Selesai Cuti *</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Quick duration shortcuts */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-400)', fontWeight: 600 }}>Shortcut Durasi:</span>
                                    {[1, 2, 3, 4].map(h => (
                                        <button
                                            key={h}
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                            onClick={() => setEndTime(adjustHour(startTime, h))}
                                        >
                                            +{h} Jam
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                        onClick={() => setEndTime(adjustHour(startTime, quota?.hours_per_leave_day || 8))}
                                    >
                                        1 Hari ({quota?.hours_per_leave_day || 8} Jam)
                                    </button>
                                </div>

                                {/* Live Calculation Alert */}
                                {(() => {
                                    const durHours = calculateHours(startTime, endTime);
                                    const hoursPerDay = quota?.hours_per_leave_day || 8;
                                    const durDays = Math.round((durHours / hoursPerDay) * 100) / 100;
                                    const isExceeded = quota && durDays > (quota.remaining || 0);

                                    return (
                                        <div style={{
                                            padding: '0.6rem 0.85rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: isExceeded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            border: `1px solid ${isExceeded ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.82rem'
                                        }}>
                                            <Icon name={isExceeded ? 'AlertTriangle' : 'Info'} size={16} inline />
                                            <div>
                                                <strong>Kalkulasi Durasi:</strong> {durHours} Jam ({durDays} hari cuti).
                                                {isExceeded ? (
                                                    <span style={{ color: '#ef4444', marginLeft: '0.35rem', fontWeight: 600 }}>
                                                        Melebihi sisa kuota cuti Anda ({quota?.remaining} hari / {quota?.remaining_hours} jam)!
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#10b981', marginLeft: '0.35rem' }}>
                                                        Sisa cuti setelah pengajuan: {Math.round(((quota?.remaining || 0) - durDays) * 100) / 100} hari
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="grid grid-2" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Mulai</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Selesai</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {type === 'change_off' && (
                            <div className="form-group">
                                <label className="form-label">Tanggal Pengganti (Masuk Kerja)</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={replacementDate}
                                    onChange={(e) => setReplacementDate(e.target.value)}
                                    required
                                />
                                <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>
                                    Pilih tanggal di mana Anda bersedia masuk sebagai pengganti libur ini.
                                </small>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Alasan</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                placeholder="Jelaskan alasan pengajuan izin/cuti (minimal 10 karakter)"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                minLength={10}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Lampiran (Opsional)</label>
                            <input
                                type="file"
                                className="form-input"
                                accept="image/*,.pdf"
                                onChange={(e) => setAttachment(e.target.files[0])}
                                style={{ padding: '0.5rem' }}
                            />
                            <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>
                                Format: JPG, PNG, atau PDF (maks. 5MB)
                            </small>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setShowForm(false)}
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting}
                            >
                                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter & List */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title"><Icon name="ClipboardList" size={16} inline /> Riwayat Pengajuan</h2>
                    <select
                        className="form-input form-select"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ width: 'auto', minWidth: 150 }}
                    >
                        <option value="">Semua Status</option>
                        <option value="pending">Menunggu</option>
                        <option value="approved">Disetujui</option>
                        <option value="rejected">Ditolak</option>
                    </select>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="FileText" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada pengajuan</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {requests.map((req) => (
                            <div
                                key={req.id}
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '1.5rem' }}><Icon name={leaveTypes[req.type].icon} size={18} inline /></span>
                                        <div>
                                            <h4 style={{ margin: 0, color: 'white' }}>{leaveTypes[req.type].label}</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                {formatDate(req.start_date)}
                                                {!req.is_hourly && req.start_date !== req.end_date && ` - ${formatDate(req.end_date)}`}
                                                {req.is_hourly ? (
                                                    <span className="badge badge-info" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                                                        ⏱️ {req.duration_hours || 0} Jam ({formatTime(req.start_time)} - {formatTime(req.end_time)}) • {req.duration_days} hari
                                                    </span>
                                                ) : (
                                                    <span style={{ marginLeft: '0.5rem' }}>
                                                        ({calculateDays(req.start_date, req.end_date)} hari)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`badge badge-${statusLabels[req.status].color}`}>
                                        <Icon name={statusLabels[req.status].icon} size={14} inline /> {statusLabels[req.status].label}
                                        {req.status === 'pending' && req.total_steps > 1 ? ` (${req.current_step || 1}/${req.total_steps})` : ''}
                                    </span>
                                </div>

                                <p style={{ margin: '0.75rem 0', color: 'var(--gray-300)', fontSize: '0.9rem' }}>
                                    {req.reason}
                                </p>

                                <ApprovalTimeline steps={req.approval_steps} currentStep={req.current_step} status={req.status} />

                                {req.admin_notes && (
                                    <p style={{
                                        margin: '0.5rem 0',
                                        padding: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '0.85rem',
                                        color: 'var(--gray-400)'
                                    }}>
                                        <strong>Catatan Admin:</strong> {req.admin_notes}
                                    </p>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                    <small style={{ color: 'var(--gray-500)' }}>
                                        Dibuat: {new Date(req.created_at).toLocaleString('id-ID')}
                                    </small>
                                    <button
                                        className="btn btn-danger"
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                        onClick={() => handleDelete(req.id)}
                                    >
                                        <Icon name="Trash2" size={16} inline /> Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
