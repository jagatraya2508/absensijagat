import { useState, useEffect, useCallback } from 'react';
import { dailyWorkReportAPI } from '../utils/api';

const STATUS_MAP = {
    completed: { label: 'Selesai', icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    in_progress: { label: 'Dikerjakan', icon: '🔄', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    pending: { label: 'Pending', icon: '⏳', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    blocked: { label: 'Blocked', icon: '🚫', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
};

const PRIORITY_MAP = {
    urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    high: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    medium: { label: 'Medium', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    low: { label: 'Low', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
};

const CATEGORY_MAP = {
    task: { label: 'Task', icon: '📋', color: '#3b82f6' },
    meeting: { label: 'Meeting', icon: '👥', color: '#8b5cf6' },
    admin: { label: 'Administrasi', icon: '📁', color: '#f59e0b' },
    other: { label: 'Lainnya', icon: '📌', color: '#6b7280' }
};

const REPORT_STATUS_MAP = {
    draft: { label: 'Draft', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    submitted: { label: 'Submitted', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    reviewed: { label: 'Reviewed', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
};

export default function AdminDailyWorkReport() {
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Filters
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSearch, setFilterSearch] = useState('');

    // Review form
    const [reviewForm, setReviewForm] = useState({ review_notes: '', status: 'reviewed' });

    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (filterDate) {
                params.start_date = filterDate;
                params.end_date = filterDate;
            }
            if (filterStatus) params.status = filterStatus;
            if (filterSearch) params.search = filterSearch;

            const data = await dailyWorkReportAPI.adminGetAll(params);
            setReports(data);
        } catch (e) {
            console.error('Error fetching reports:', e);
        } finally {
            setLoading(false);
        }
    }, [filterDate, filterStatus, filterSearch]);

    const fetchStats = useCallback(async () => {
        try {
            const data = await dailyWorkReportAPI.adminGetStats(filterDate);
            setStats(data);
        } catch (e) { console.error(e); }
    }, [filterDate]);

    useEffect(() => {
        fetchReports();
        fetchStats();
    }, [fetchReports, fetchStats]);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    async function openDetail(report) {
        try {
            const data = await dailyWorkReportAPI.getById(report.id);
            setSelectedReport(data);
            setShowDetailModal(true);
        } catch (e) {
            alert('Gagal memuat detail: ' + e.message);
        }
    }

    function openReview(report) {
        setSelectedReport(report);
        setReviewForm({ review_notes: report.review_notes || '', status: 'reviewed' });
        setShowReviewModal(true);
        setError('');
    }

    async function handleReview(e) {
        e.preventDefault();
        if (!selectedReport) return;
        try {
            setSaving(true);
            setError('');
            await dailyWorkReportAPI.adminReview(selectedReport.id, reviewForm);
            setSuccess('Laporan berhasil direview');
            setShowReviewModal(false);
            fetchReports();
            fetchStats();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '-';
        return timeStr.substring(0, 5);
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📊 Review Laporan Kerjaan Harian</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    Review dan kelola laporan kerjaan harian karyawan
                </p>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅</span> {success}
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--theme-primary)' }}>
                            {stats.total_submitted || 0}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Total Laporan</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            dari {stats.total_employees || 0} karyawan
                        </div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#6b7280' }}>
                            {stats.draft_count || 0}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Draft</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>
                            {stats.submitted_count || 0}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Perlu Direview</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>
                            {stats.reviewed_count || 0}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Sudah Direview</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>📅 Tanggal:</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="form-input"
                            style={{ width: 'auto' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Status:</label>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="form-input"
                            style={{ width: 'auto' }}
                        >
                            <option value="">Semua</option>
                            <option value="draft">Draft</option>
                            <option value="submitted">Submitted</option>
                            <option value="reviewed">Reviewed</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                        <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>🔍</label>
                        <input
                            type="text"
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            className="form-input"
                            placeholder="Cari nama karyawan..."
                            style={{ flex: 1 }}
                        />
                    </div>
                    <button className="btn btn-secondary" onClick={() => { setFilterDate(new Date().toISOString().split('T')[0]); setFilterStatus(''); setFilterSearch(''); }} style={{ fontSize: '0.8rem' }}>
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* Reports Table */}
            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
                        <p style={{ color: 'var(--text-secondary)' }}>Memuat data laporan...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                        <h3 style={{ marginBottom: 8 }}>Tidak ada laporan</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Tidak ada laporan harian untuk filter yang dipilih
                        </p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Karyawan</th>
                                    <th style={{ width: 120 }}>Tanggal</th>
                                    <th style={{ width: 100 }}>Departemen</th>
                                    <th style={{ width: 70 }}>Items</th>
                                    <th style={{ width: 80 }}>Pending</th>
                                    <th style={{ width: 90 }}>Status</th>
                                    <th style={{ width: 140 }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map(report => (
                                    <tr key={report.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{report.user_name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{report.employee_id}</div>
                                        </td>
                                        <td style={{ fontSize: '0.82rem' }}>
                                            {formatDate(report.report_date)}
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {report.department || '-'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                background: 'var(--bg-secondary)', padding: '2px 10px',
                                                borderRadius: 12, fontSize: '0.8rem', fontWeight: 600
                                            }}>
                                                {report.item_count || 0}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {(report.pending_count || 0) > 0 ? (
                                                <span style={{
                                                    background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                                                    padding: '2px 10px', borderRadius: 12,
                                                    fontSize: '0.8rem', fontWeight: 600
                                                }}>
                                                    {report.pending_count}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>0</span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                                                background: REPORT_STATUS_MAP[report.status]?.bg,
                                                color: REPORT_STATUS_MAP[report.status]?.color
                                            }}>
                                                {REPORT_STATUS_MAP[report.status]?.label}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => openDetail(report)}
                                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                >
                                                    👁️ Detail
                                                </button>
                                                {report.status === 'submitted' && (
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => openReview(report)}
                                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        ✅ Review
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ========== MODAL: Report Detail ========== */}
            {showDetailModal && selectedReport && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <div>
                                <h3>📋 Detail Laporan Harian</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {selectedReport.user_name} — {formatDate(selectedReport.report_date)}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            {/* Status Badge */}
                            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>Status:</span>
                                <span style={{
                                    padding: '3px 12px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                                    background: REPORT_STATUS_MAP[selectedReport.status]?.bg,
                                    color: REPORT_STATUS_MAP[selectedReport.status]?.color
                                }}>
                                    {REPORT_STATUS_MAP[selectedReport.status]?.label}
                                </span>
                            </div>

                            {/* Summary */}
                            {selectedReport.summary && (
                                <div style={{
                                    padding: 14, borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-secondary)', marginBottom: 16,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>📝 Ringkasan:</div>
                                    <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{selectedReport.summary}</div>
                                </div>
                            )}

                            {/* Review Notes */}
                            {selectedReport.review_notes && (
                                <div style={{
                                    padding: 14, borderRadius: 'var(--radius-md)',
                                    background: 'rgba(16,185,129,0.06)', marginBottom: 16,
                                    border: '1px solid rgba(16,185,129,0.2)'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: '#10b981' }}>
                                        💬 Catatan Review ({selectedReport.reviewer_name || 'Admin'}):
                                    </div>
                                    <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{selectedReport.review_notes}</div>
                                </div>
                            )}

                            {/* Items List */}
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10 }}>
                                ⏰ Daftar Pekerjaan ({selectedReport.items?.length || 0} item)
                            </div>

                            {(!selectedReport.items || selectedReport.items.length === 0) ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>
                                    Tidak ada item pekerjaan
                                </p>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {selectedReport.items.map(item => (
                                        <div key={item.id} style={{
                                            padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            borderLeft: `4px solid ${PRIORITY_MAP[item.priority]?.color || '#6b7280'}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1, minWidth: 100 }}>
                                                    {item.title}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                                                    background: `${CATEGORY_MAP[item.category]?.color}18`,
                                                    color: CATEGORY_MAP[item.category]?.color
                                                }}>
                                                    {CATEGORY_MAP[item.category]?.icon} {CATEGORY_MAP[item.category]?.label}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                                                    background: STATUS_MAP[item.status]?.bg,
                                                    color: STATUS_MAP[item.status]?.color, fontWeight: 600
                                                }}>
                                                    {STATUS_MAP[item.status]?.icon} {STATUS_MAP[item.status]?.label}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                                                    background: PRIORITY_MAP[item.priority]?.bg,
                                                    color: PRIORITY_MAP[item.priority]?.color, fontWeight: 600
                                                }}>
                                                    {PRIORITY_MAP[item.priority]?.label}
                                                </span>
                                            </div>

                                            {item.description && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                                                    {item.description}
                                                </p>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                                                {(item.start_time || item.end_time) && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                        🕐 {formatTime(item.start_time)} — {formatTime(item.end_time)}
                                                    </span>
                                                )}
                                                {item.due_date && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        📅 Due: {formatDate(item.due_date)}
                                                    </span>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                                                    <div style={{
                                                        width: 80, height: 5, borderRadius: 3,
                                                        background: 'var(--border-color)', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 3,
                                                            width: `${item.completion_percentage}%`,
                                                            background: item.completion_percentage === 100 ? '#10b981' :
                                                                item.completion_percentage >= 50 ? '#f59e0b' : '#ef4444'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                                        {item.completion_percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                                Tutup
                            </button>
                            {selectedReport.status === 'submitted' && (
                                <button className="btn btn-primary" onClick={() => {
                                    setShowDetailModal(false);
                                    openReview(selectedReport);
                                }}>
                                    ✅ Review Laporan
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========== MODAL: Review Report ========== */}
            {showReviewModal && selectedReport && (
                <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <div>
                                <h3>✅ Review Laporan</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {selectedReport.user_name} — {formatDate(selectedReport.report_date)}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleReview}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                                        {error}
                                    </div>
                                )}

                                <div style={{
                                    padding: 12, borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-secondary)', marginBottom: 16,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ fontSize: '0.82rem' }}>
                                        <strong>Karyawan:</strong> {selectedReport.user_name}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                                        <strong>Items:</strong> {selectedReport.item_count || 0} pekerjaan
                                    </div>
                                    {selectedReport.summary && (
                                        <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                                            <strong>Ringkasan:</strong> {selectedReport.summary}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Status Review</label>
                                    <select
                                        className="form-input"
                                        value={reviewForm.status}
                                        onChange={e => setReviewForm({ ...reviewForm, status: e.target.value })}
                                    >
                                        <option value="reviewed">✅ Approved / Reviewed</option>
                                        <option value="submitted">🔄 Kembalikan ke Submitted</option>
                                        <option value="draft">📝 Kembalikan ke Draft</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Catatan Review</label>
                                    <textarea
                                        className="form-input"
                                        value={reviewForm.review_notes}
                                        onChange={e => setReviewForm({ ...reviewForm, review_notes: e.target.value })}
                                        placeholder="Berikan catatan atau feedback untuk karyawan..."
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : '✅ Submit Review'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
