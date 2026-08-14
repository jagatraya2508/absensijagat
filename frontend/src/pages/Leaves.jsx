import { useState, useEffect } from 'react';
import { leavesAPI } from '../utils/api';
import ApprovalTimeline from '../components/ApprovalTimeline';

export default function Leaves() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [filter, setFilter] = useState('');
    const [quota, setQuota] = useState(null);

    // Form state
    const [type, setType] = useState('late');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [replacementDate, setReplacementDate] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);

    const leaveTypes = {
        late: { label: 'Izin Terlambat', icon: '⏰', color: 'warning' },
        sick: { label: 'Izin Sakit', icon: '🏥', color: 'danger' },
        permission: { label: 'Izin Tidak Masuk', icon: '📝', color: 'secondary' },
        leave: { label: 'Cuti', icon: '🏖️', color: 'primary' },
        change_off: { label: 'Tukar Libur', icon: '🔄', color: 'info' }
    };

    const statusLabels = {
        pending: { label: 'Menunggu', color: 'warning', icon: '⏳' },
        approved: { label: 'Disetujui', color: 'success', icon: '✅' },
        rejected: { label: 'Ditolak', color: 'danger', icon: '❌' }
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
            formData.append('end_date', endDate);
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
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
            setReplacementDate('');
            setReason('');
            setAttachment(null);
            setShowForm(false);

            // Refresh list
            fetchRequests();
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

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📝 Pengajuan Izin & Cuti</h1>
                <p className="page-subtitle">Ajukan izin terlambat, sakit, atau cuti</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-3 mb-4">
                <button
                    className="card status-card"
                    onClick={() => { setType('late'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                >
                    <div className="status-card-icon warning">⏰</div>
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
                    <div className="status-card-icon danger">🏥</div>
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
                    <div className="status-card-icon secondary">📝</div>
                    <div className="status-card-content">
                        <h3>Izin Tidak Masuk</h3>
                        <p style={{ fontSize: '0.85rem' }}>Izin absen seharian penuh</p>
                    </div>
                </button>
                <button
                    className="card status-card"
                    onClick={() => { setType('leave'); setShowForm(true); }}
                    style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}
                    disabled={quota && quota.remaining <= 0}
                >
                    <div className="status-card-icon primary">🏖️</div>
                    <div className="status-card-content">
                        <h3>Cuti</h3>
                        <p style={{ fontSize: '0.85rem' }}>
                            {quota ? (
                                <>Sisa: <strong>{quota.remaining}</strong> dari {quota.quota} hari</>
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
                    <div className="status-card-icon info">🔄</div>
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
                            {leaveTypes[type].icon} Ajukan {leaveTypes[type].label}
                        </h2>
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowForm(false)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
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
                                {submitting ? '⏳ Mengirim...' : '📤 Kirim Pengajuan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter & List */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📋 Riwayat Pengajuan</h2>
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
                        <div className="empty-state-icon">📝</div>
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
                                        <span style={{ fontSize: '1.5rem' }}>{leaveTypes[req.type].icon}</span>
                                        <div>
                                            <h4 style={{ margin: 0, color: 'white' }}>{leaveTypes[req.type].label}</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                {formatDate(req.start_date)}
                                                {req.start_date !== req.end_date && ` - ${formatDate(req.end_date)}`}
                                                <span style={{ marginLeft: '0.5rem' }}>
                                                    ({calculateDays(req.start_date, req.end_date)} hari)
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`badge badge-${statusLabels[req.status].color}`}>
                                        {statusLabels[req.status].icon} {statusLabels[req.status].label}
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
                                        🗑️ Hapus
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
