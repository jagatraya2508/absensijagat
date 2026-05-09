import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { manualAttendanceAPI } from '../utils/api';

export default function AdminManualAttendance() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    
    // Modal states for processing
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [processStatus, setProcessStatus] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await manualAttendanceAPI.getAll(filterStatus);
            setRequests(data);
        } catch (error) {
            console.error('Error fetching requests:', error);
            alert('Gagal mengambil data pengajuan: ' + (error.message || 'Error'));
        } finally {
            setLoading(false);
        }
    };

    const openProcessModal = (request, status) => {
        setSelectedRequest(request);
        setProcessStatus(status);
        setAdminNotes('');
        setShowProcessModal(true);
    };

    const handleProcess = async (e) => {
        e.preventDefault();
        try {
            setProcessing(true);
            
            await manualAttendanceAPI.updateStatus(selectedRequest.id, processStatus, adminNotes);

            alert(`Pengajuan berhasil ${processStatus === 'approved' ? 'disetujui' : 'ditolak'}`);

            setShowProcessModal(false);
            fetchRequests();
        } catch (error) {
            console.error('Error processing request:', error);
            alert(error.message || 'Gagal memproses pengajuan');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'approved': return 'bg-success';
            case 'rejected': return 'bg-danger';
            default: return 'bg-warning text-dark';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'approved': return 'Disetujui';
            case 'rejected': return 'Ditolak';
            default: return 'Menunggu';
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📋 Persetujuan Absen Manual</h1>
                <p className="page-subtitle">Kelola pengajuan absensi manual dari karyawan</p>
            </div>

            <div className="card mb-4">
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select 
                        className="form-input form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ width: 'auto', minWidth: 200 }}
                    >
                        <option value="all">📋 Semua Status</option>
                        <option value="pending">⏳ Menunggu</option>
                        <option value="approved">✅ Disetujui</option>
                        <option value="rejected">❌ Ditolak</option>
                    </select>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        {filterStatus === 'pending' ? '⏳ Pengajuan Menunggu Persetujuan' :
                         filterStatus === 'approved' ? '✅ Pengajuan Disetujui' :
                         filterStatus === 'rejected' ? '❌ Pengajuan Ditolak' : '📋 Semua Pengajuan'}
                    </h2>
                    <span className="badge badge-primary">{requests.length}</span>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <p className="empty-state-text">Tidak ada pengajuan ditemukan</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                style={{
                                    padding: '1.25rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: request.status === 'pending' ? '2px solid var(--warning-500)' : '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '1.25rem' }}>👤</span>
                                            <strong style={{ color: 'white' }}>{request.employee_name}</strong>
                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>({request.employee_id})</span>
                                        </div>
                                        <p style={{ margin: 0, color: 'var(--gray-300)', fontSize: '0.9rem' }}>
                                            {format(new Date(request.date), 'dd MMMM yyyy', { locale: id })}
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--primary-400)' }}>
                                                (Masuk: {request.time_in ? request.time_in.substring(0, 5) : '-'} | Pulang: {request.time_out ? request.time_out.substring(0, 5) : '-'})
                                            </span>
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className={`badge ${getStatusBadgeClass(request.status)}`} style={{ display: 'inline-block', marginBottom: '0.25rem' }}>
                                            {getStatusText(request.status)}
                                        </span>
                                        {request.approver_name && (
                                            <div style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>Oleh: {request.approver_name}</div>
                                        )}
                                    </div>
                                </div>

                                <div style={{
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 'var(--radius)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <p style={{ margin: 0, color: 'var(--gray-200)', fontSize: '0.9rem' }}>
                                        <strong>Alasan:</strong> {request.reason}
                                    </p>
                                    {request.attachment_path && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <a
                                                href={`http://localhost:5000${request.attachment_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                            >
                                                📎 Lihat Lampiran
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {request.admin_notes && (
                                    <p style={{
                                        margin: '0 0 0.75rem',
                                        padding: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '0.85rem',
                                        color: 'var(--gray-400)'
                                    }}>
                                        <strong>Catatan Admin:</strong> {request.admin_notes}
                                    </p>
                                )}

                                {request.status === 'pending' && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn btn-success"
                                                onClick={() => openProcessModal(request, 'approved')}
                                                style={{ padding: '0.5rem 1rem' }}
                                            >
                                                ✅ Setujui
                                            </button>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => openProcessModal(request, 'rejected')}
                                                style={{ padding: '0.5rem 1rem' }}
                                            >
                                                ❌ Tolak
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Process Modal */}
            {showProcessModal && selectedRequest && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary-500)', marginTop: '1rem' }}>
                    <div className="card-header">
                        <h2 className="card-title">{processStatus === 'approved' ? '✅ Setujui Pengajuan' : '❌ Tolak Pengajuan'}</h2>
                        <button className="btn btn-outline" onClick={() => setShowProcessModal(false)} style={{ padding: '0.5rem 1rem' }}>
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleProcess}>
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 'var(--radius)',
                            marginBottom: '1rem'
                        }}>
                            <p style={{ margin: '0 0 0.5rem' }}><strong>Karyawan:</strong> {selectedRequest.employee_name} ({selectedRequest.employee_id})</p>
                            <p style={{ margin: '0 0 0.5rem' }}><strong>Tanggal:</strong> {format(new Date(selectedRequest.date), 'dd MMMM yyyy', { locale: id })}</p>
                            {selectedRequest.time_in && <p style={{ margin: '0 0 0.5rem' }}><strong>Jam Masuk:</strong> {selectedRequest.time_in.substring(0, 5)}</p>}
                            {selectedRequest.time_out && <p style={{ margin: '0 0 0.5rem' }}><strong>Jam Pulang:</strong> {selectedRequest.time_out.substring(0, 5)}</p>}
                            <p style={{ margin: '0 0 0.5rem' }}><strong>Alasan:</strong> {selectedRequest.reason}</p>
                            {selectedRequest.attachment_path && (
                                <p style={{ margin: 0 }}>
                                    <strong>Lampiran:</strong>{' '}
                                    <a
                                        href={`http://localhost:5000${selectedRequest.attachment_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--primary-400)', textDecoration: 'underline' }}
                                    >
                                        Buka Dokumen
                                    </a>
                                </p>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Catatan (Opsional)</label>
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                className="form-input"
                                rows="3"
                                placeholder="Tambahkan catatan jika diperlukan..."
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" onClick={() => setShowProcessModal(false)}>
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                className={`btn ${processStatus === 'approved' ? 'btn-success' : 'btn-danger'}`}
                                disabled={processing}
                            >
                                {processing ? '⏳ Memproses...' : (processStatus === 'approved' ? '✅ Setujui' : '❌ Tolak')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
