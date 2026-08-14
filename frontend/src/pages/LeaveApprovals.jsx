import { useEffect, useState } from 'react';
import { leavesAPI } from '../utils/api';
import ApprovalTimeline from '../components/ApprovalTimeline';

const leaveTypes = {
    late: { label: 'Izin Terlambat', icon: '⏰', color: 'warning' },
    sick: { label: 'Izin Sakit', icon: '🏥', color: 'danger' },
    permission: { label: 'Izin Tidak Masuk', icon: '📝', color: 'secondary' },
    leave: { label: 'Cuti', icon: '🏖️', color: 'primary' },
    change_off: { label: 'Tukar Libur', icon: '🔄', color: 'info' }
};

export default function LeaveApprovals() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [notes, setNotes] = useState({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchRequests();
    }, []);

    async function fetchRequests() {
        setLoading(true);
        try {
            const data = await leavesAPI.getPendingForMe();
            setRequests(data);
            setError('');
        } catch (err) {
            setError(err.message || 'Gagal memuat persetujuan');
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(id, status) {
        if (!window.confirm(`Yakin ingin ${status === 'approved' ? 'menyetujui' : 'menolak'} pengajuan ini?`)) return;
        setProcessing(id);
        setError('');
        try {
            const result = await leavesAPI.updateStatus(id, status, notes[id] || '');
            setSuccess(result.message || 'Berhasil diproses');
            setRequests((prev) => prev.filter((r) => r.id !== id));
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Gagal memproses pengajuan');
        } finally {
            setProcessing(null);
        }
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    function calculateDays(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">✅ Persetujuan Izin & Cuti</h1>
                <p className="page-subtitle">Setujui atau tolak pengajuan dari bawahan Anda sesuai tingkat approval</p>
            </div>

            {error && <div className="alert alert-danger mb-4">⚠️ {error}</div>}
            {success && <div className="alert alert-success mb-4">✅ {success}</div>}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Menunggu keputusan Anda</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="badge badge-warning">{requests.length}</span>
                        <button className="btn btn-outline" onClick={fetchRequests} disabled={loading}>🔄 Refresh</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🎉</div>
                        <p className="empty-state-text">Tidak ada pengajuan yang menunggu persetujuan Anda.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {requests.map((req) => (
                            <div key={req.id} style={{
                                padding: '1.25rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 'var(--radius-lg)',
                                border: '2px solid var(--warning-500)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                                            <span style={{ fontSize: '1.25rem' }}>{leaveTypes[req.type]?.icon}</span>
                                            <strong style={{ color: 'white' }}>{req.employee_name}</strong>
                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>({req.employee_id})</span>
                                        </div>
                                        <p style={{ margin: 0, color: 'var(--gray-300)', fontSize: '0.9rem' }}>
                                            {leaveTypes[req.type]?.label} • {formatDate(req.start_date)}
                                            {req.start_date !== req.end_date && ` - ${formatDate(req.end_date)}`}
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--primary-400)' }}>
                                                ({calculateDays(req.start_date, req.end_date)} hari)
                                            </span>
                                        </p>
                                        {(req.department || req.position) && (
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                                                {req.position}{req.department ? ` • ${req.department}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <span className="badge badge-warning">
                                        ⏳ Tingkat {req.current_step || req.current_step_order || 1}/{req.total_steps || (req.approval_steps?.length || 1)}
                                    </span>
                                </div>

                                <div style={{
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 'var(--radius)',
                                    marginTop: '0.75rem'
                                }}>
                                    <p style={{ margin: 0, color: 'var(--gray-200)', fontSize: '0.9rem' }}>
                                        <strong>Alasan:</strong> {req.reason}
                                    </p>
                                </div>

                                <ApprovalTimeline steps={req.approval_steps} currentStep={req.current_step} status={req.status} />

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Catatan (opsional)"
                                        value={notes[req.id] || ''}
                                        onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                        style={{ flex: 1, minWidth: 180, margin: 0 }}
                                    />
                                    <button
                                        className="btn btn-danger"
                                        disabled={processing === req.id}
                                        onClick={() => handleAction(req.id, 'rejected')}
                                    >
                                        ❌ Tolak
                                    </button>
                                    <button
                                        className="btn btn-success"
                                        disabled={processing === req.id}
                                        onClick={() => handleAction(req.id, 'approved')}
                                    >
                                        ✅ Setujui
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
