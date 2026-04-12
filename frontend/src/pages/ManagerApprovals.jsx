import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function ManagerApprovals() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    useEffect(() => {
        fetchRequests();
    }, []);

    async function fetchRequests() {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/work-schedules/overtime-requests/list?status=pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Gagal memuat persetujuan');
            const data = await res.json();
            setRequests(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(id, isApproved) {
        if (!confirm(`Apakah Anda yakin ingin ${isApproved ? 'MENYETUJUI' : 'MENOLAK'} pengajuan lembur ini?`)) return;

        setActionLoading(id);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/work-schedules/overtime-requests/${id}/status`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: isApproved ? 'approved' : 'rejected',
                    admin_notes: adminNotes[id] || ''
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal mengubah status');
            }

            setSuccess(`Pengajuan lembur berhasil di${isApproved ? 'setujui' : 'tolak'}!`);
            
            // Remove from list
            setRequests(prev => prev.filter(r => r.id !== id));
            
            // Clear notes
            setAdminNotes(prev => {
                const nn = { ...prev };
                delete nn[id];
                return nn;
            });
            
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setActionLoading(null);
        }
    }

    function formatTime(t) {
        if (!t) return '-';
        return t.substring(0, 5);
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">✅ Persetujuan Pimpinan</h1>
                <p className="page-subtitle">Persetujuan pengajuan lembur tim (SPL)</p>
            </div>

            {error && <div className="alert alert-danger mb-4">⚠️ {error}</div>}
            {success && <div className="alert alert-success mb-4">✅ {success}</div>}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar Menunggu Persetujuan</h2>
                    <button className="btn btn-outline" onClick={fetchRequests} disabled={loading}>
                        🔄 Refresh
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🎉</div>
                        <p className="empty-state-text">Tidak ada pengajuan lembur yang perlu disetujui saat ini.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {requests.map(req => (
                            <div key={req.id} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span className="badge badge-warning">Menunggu</span>
                                            <span style={{ fontFamily: 'monospace', color: 'var(--gray-300)', fontSize: '0.9rem' }}>{req.spl_number}</span>
                                        </div>
                                        <h3 style={{ margin: '0 0 0.25rem 0', color: 'white' }}>
                                            Lembur {new Date(req.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </h3>
                                        <p style={{ margin: '0', color: 'var(--gray-400)', fontSize: '0.95rem' }}>
                                            Mulai pkl. <strong>{formatTime(req.overtime_start)}</strong> s/d <strong>{formatTime(req.overtime_end)}</strong> 
                                            <span style={{ margin: '0 0.5rem' }}>•</span> 
                                            Estimasi: <strong>{req.estimated_hours} jam</strong>
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.25rem' }}>Diajukan Oleh:</div>
                                        <div style={{ fontWeight: 600, color: 'var(--gray-100)' }}>{req.requested_by_name}</div>
                                        {req.department && <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>Dept: {req.department}</div>}
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--gray-200)' }}>📝 Alasan / Pekerjaan:</h4>
                                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gray-300)', whiteSpace: 'pre-wrap' }}>{req.reason}</p>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--gray-200)' }}>👥 Anggota Lembur ({req.employees?.length || 0}):</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {req.employees?.map(emp => (
                                            <span key={emp.id} style={{ 
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem', 
                                                background: 'rgba(255,255,255,0.05)', 
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}>
                                                {emp.user_name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Catatan pimpinan (opsional)" 
                                        value={adminNotes[req.id] || ''}
                                        onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        style={{ flex: 1, margin: 0 }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            className="btn btn-danger" 
                                            onClick={() => handleApprove(req.id, false)}
                                            disabled={actionLoading === req.id}
                                        >
                                            {actionLoading === req.id ? '...' : '❌ Tolak'}
                                        </button>
                                        <button 
                                            className="btn btn-success" 
                                            onClick={() => handleApprove(req.id, true)}
                                            disabled={actionLoading === req.id}
                                        >
                                            {actionLoading === req.id ? '...' : '✅ Setujui'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
