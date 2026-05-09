import { useState, useEffect } from 'react';
import { leavesAPI } from '../utils/api';

export default function AdminLeaves() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [processing, setProcessing] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);

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
    }, [filter]);

    async function fetchRequests() {
        setLoading(true);
        try {
            const data = await leavesAPI.getAll(filter || undefined);
            setRequests(data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateStatus(id, status) {
        setProcessing(id);
        try {
            await leavesAPI.updateStatus(id, status, adminNotes);
            setAdminNotes('');
            setSelectedRequest(null);
            fetchRequests();
        } catch (error) {
            alert(error.message || 'Gagal memproses pengajuan');
        } finally {
            setProcessing(null);
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
                <h1 className="page-title">📋 Kelola Izin & Cuti</h1>
                <p className="page-subtitle">Setujui atau tolak pengajuan karyawan</p>
            </div>

            {/* Filter */}
            <div className="card mb-4">
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['pending', 'approved', 'rejected', ''].map((status) => (
                        <button
                            key={status}
                            className={`btn ${filter === status ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setFilter(status)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            {status === '' ? '📋 Semua' :
                                status === 'pending' ? '⏳ Menunggu' :
                                    status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Requests List */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        {filter === 'pending' ? '⏳ Pengajuan Menunggu Persetujuan' :
                            filter === 'approved' ? '✅ Pengajuan Disetujui' :
                                filter === 'rejected' ? '❌ Pengajuan Ditolak' : '📋 Semua Pengajuan'}
                    </h2>
                    <span className="badge badge-primary">{requests.length}</span>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📝</div>
                        <p className="empty-state-text">Tidak ada pengajuan</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {requests.map((req) => (
                            <div
                                key={req.id}
                                style={{
                                    padding: '1.25rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: req.status === 'pending' ? '2px solid var(--warning-500)' : '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '1.25rem' }}>{leaveTypes[req.type].icon}</span>
                                            <strong style={{ color: 'white' }}>{req.employee_name}</strong>
                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>({req.employee_id})</span>
                                        </div>
                                        <p style={{ margin: 0, color: 'var(--gray-300)', fontSize: '0.9rem' }}>
                                            {leaveTypes[req.type].label} • {formatDate(req.start_date)}
                                            {req.start_date !== req.end_date && ` - ${formatDate(req.end_date)}`}
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--primary-400)' }}>
                                                ({calculateDays(req.start_date, req.end_date)} hari)
                                            </span>
                                        </p>
                                    </div>
                                    <span className={`badge badge-${statusLabels[req.status].color}`}>
                                        {statusLabels[req.status].icon} {statusLabels[req.status].label}
                                    </span>
                                </div>

                                {/* Reason */}
                                <div style={{
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 'var(--radius)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <p style={{ margin: 0, color: 'var(--gray-200)', fontSize: '0.9rem' }}>
                                        <strong>Alasan:</strong> {req.reason}
                                    </p>
                                </div>

                                {/* Attachment */}
                                {req.attachment_path && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <a
                                            href={`http://localhost:5000${req.attachment_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                        >
                                            📎 Lihat Lampiran
                                        </a>
                                    </div>
                                )}

                                {/* Admin Notes (if processed) */}
                                {req.admin_notes && (
                                    <p style={{
                                        margin: '0 0 0.75rem',
                                        padding: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '0.85rem',
                                        color: 'var(--gray-400)'
                                    }}>
                                        <strong>Catatan Admin:</strong> {req.admin_notes}
                                        {req.approver_name && <span> (oleh {req.approver_name})</span>}
                                    </p>
                                )}

                                {/* Actions for Pending */}
                                {req.status === 'pending' && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                        {selectedRequest === req.id ? (
                                            <div>
                                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Catatan (opsional)"
                                                        value={adminNotes}
                                                        onChange={(e) => setAdminNotes(e.target.value)}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        className="btn btn-success"
                                                        onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                        disabled={processing === req.id}
                                                        style={{ padding: '0.5rem 1rem' }}
                                                    >
                                                        {processing === req.id ? '⏳' : '✅'} Setujui
                                                    </button>
                                                    <button
                                                        className="btn btn-danger"
                                                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                        disabled={processing === req.id}
                                                        style={{ padding: '0.5rem 1rem' }}
                                                    >
                                                        {processing === req.id ? '⏳' : '❌'} Tolak
                                                    </button>
                                                    <button
                                                        className="btn btn-outline"
                                                        onClick={() => { setSelectedRequest(null); setAdminNotes(''); }}
                                                        style={{ padding: '0.5rem 1rem' }}
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => setSelectedRequest(req.id)}
                                                style={{ padding: '0.5rem 1rem' }}
                                            >
                                                ⚡ Proses Pengajuan
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Timestamp */}
                                <small style={{ color: 'var(--gray-500)', display: 'block', marginTop: '0.5rem' }}>
                                    Diajukan: {new Date(req.created_at).toLocaleString('id-ID')}
                                </small>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
