import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { manualAttendanceAPI } from '../utils/api';

export default function ManualAttendance() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        date: '',
        time_in: '',
        time_out: '',
        reason: '',
        attachment: null
    });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await manualAttendanceAPI.getMy();
            setRequests(data);
        } catch (error) {
            console.error('Error fetching manual attendances:', error);
            alert('Gagal mengambil data pengajuan absen manual: ' + (error.message || 'Error'));
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'attachment') {
            setFormData(prev => ({
                ...prev,
                attachment: files[0]
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.time_in && !formData.time_out) {
            alert('Minimal harus mengisi Jam Masuk atau Jam Pulang!');
            return;
        }

        try {
            setSubmitting(true);
            
            const submitData = new FormData();
            submitData.append('date', formData.date);
            submitData.append('reason', formData.reason);
            if (formData.time_in) submitData.append('time_in', formData.time_in);
            if (formData.time_out) submitData.append('time_out', formData.time_out);
            if (formData.attachment) submitData.append('attachment', formData.attachment);

            await manualAttendanceAPI.create(submitData);

            alert('Pengajuan absen manual berhasil dibuat');

            setShowModal(false);
            setFormData({
                date: '',
                time_in: '',
                time_out: '',
                reason: '',
                attachment: null
            });
            fetchRequests();
        } catch (error) {
            console.error('Error submitting request:', error);
            alert(error.message || 'Gagal membuat pengajuan absen manual');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Anda tidak dapat mengembalikan pengajuan yang sudah dihapus! Ya, Hapus?')) {
            return;
        }
        
        try {
            await manualAttendanceAPI.delete(id);
            alert('Pengajuan berhasil dihapus');
            fetchRequests();
        } catch (error) {
            console.error('Error deleting request:', error);
            alert(error.message || 'Gagal menghapus pengajuan');
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
                <h1 className="page-title">📝 Pengajuan Absen Manual</h1>
                <p className="page-subtitle">Ajukan absensi jika Anda lupa absen masuk atau pulang</p>
            </div>

            <div className="card mb-4">
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    ➕ Buat Pengajuan
                </button>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📋 Riwayat Pengajuan</h2>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📝</div>
                        <p className="empty-state-text">Belum ada riwayat pengajuan absen manual</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '1.5rem' }}>⏰</span>
                                        <div>
                                            <h4 style={{ margin: 0, color: 'white' }}>{format(new Date(request.date), 'dd MMMM yyyy', { locale: id })}</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                Masuk: <strong>{request.time_in ? request.time_in.substring(0, 5) : '-'}</strong> | 
                                                Pulang: <strong>{request.time_out ? request.time_out.substring(0, 5) : '-'}</strong>
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                                        {getStatusText(request.status)}
                                    </span>
                                </div>

                                <p style={{ margin: '0.75rem 0', color: 'var(--gray-300)', fontSize: '0.9rem' }}>
                                    {request.reason}
                                </p>

                                {request.attachment_path && (
                                    <div style={{ marginBottom: '0.75rem' }}>
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

                                {request.admin_notes && (
                                    <p style={{
                                        margin: '0.5rem 0',
                                        padding: '0.5rem',
                                        background: 'var(--gray-50)',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '0.85rem',
                                        color: 'var(--gray-400)'
                                    }}>
                                        <strong>Catatan Admin:</strong> {request.admin_notes}
                                    </p>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                    <small style={{ color: 'var(--gray-500)' }}>
                                        Dibuat: {new Date(request.created_at || new Date()).toLocaleString('id-ID')}
                                    </small>
                                    {request.status === 'pending' && (
                                        <button
                                            className="btn btn-danger"
                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                            onClick={() => handleDelete(request.id)}
                                        >
                                            🗑️ Hapus
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary-500)', marginTop: '1rem' }}>
                    <div className="card-header">
                        <h2 className="card-title">⏰ Buat Pengajuan Absen Manual</h2>
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowModal(false)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Tanggal Absen <span className="text-danger">*</span></label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                required
                                className="form-input"
                            />
                        </div>

                        <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Jam Masuk</label>
                                <input
                                    type="time"
                                    name="time_in"
                                    value={formData.time_in}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                                <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Kosongkan jika tidak perlu</small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jam Pulang</label>
                                <input
                                    type="time"
                                    name="time_out"
                                    value={formData.time_out}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                                <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Kosongkan jika tidak perlu</small>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Alasan / Keterangan <span className="text-danger">*</span></label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleInputChange}
                                required
                                className="form-input"
                                rows="3"
                                placeholder="Contoh: Lupa absen masuk karena terburu-buru meeting"
                            ></textarea>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Bukti Foto / Dokumen (Opsional)</label>
                            <input
                                type="file"
                                name="attachment"
                                accept="image/*,.pdf"
                                onChange={handleInputChange}
                                className="form-input"
                                style={{ padding: '0.5rem' }}
                            />
                            <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>
                                Format: JPG, PNG, atau PDF (maks. 5MB)
                            </small>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                Batal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳ Menyimpan...' : '📤 Ajukan Absen'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
