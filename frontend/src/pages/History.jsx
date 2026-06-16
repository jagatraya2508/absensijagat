import { useState, useEffect } from 'react';
import { attendanceAPI, authAPI, reportsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ImageModal from '../components/ImageModal';

export default function History() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const _today = new Date();
    const _firstDay = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-01`;
    const _lastDayObj = new Date(_today.getFullYear(), _today.getMonth() + 1, 0);
    const _lastDay = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_lastDayObj.getDate()).padStart(2, '0')}`;

    const [startDate, setStartDate] = useState(_firstDay);
    const [endDate, setEndDate] = useState(_lastDay);
    const [selectedUser, setSelectedUser] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc');
    const [exporting, setExporting] = useState(false);

    // Image Modal State
    const [selectedImg, setSelectedImg] = useState({ src: '', caption: '', isOpen: false });

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        }
        fetchHistory();
    }, []);

    async function fetchUsers() {
        try {
            const data = await authAPI.getUsers();
            setUsers(data || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }

    async function fetchHistory() {
        setLoading(true);
        setError('');
        try {
            const params = { limit: 100 };
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (isAdmin && selectedUser) params.user_id = selectedUser;

            const data = await attendanceAPI.getHistory(params);
            setRecords(data || []);
        } catch (err) {
            console.error('Failed to fetch history:', err);
            setError(err.message || 'Gagal memuat riwayat absensi');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }

    function handleFilter(e) {
        e.preventDefault();
        fetchHistory();
    }

    function formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Group records by date, then by user
    const groupedRecords = Array.isArray(records) ? records.reduce((acc, record) => {
        if (record && record.recorded_at) {
            const date = new Date(record.recorded_at).toDateString();
            if (!acc[date]) acc[date] = {};
            
            const userKey = record.user_id || 'unknown';
            if (!acc[date][userKey]) {
                acc[date][userKey] = {
                    user_name: record.user_name,
                    employee_id: record.employee_id,
                    records: []
                };
            }
            acc[date][userKey].records.push(record);
        }
        return acc;
    }, {}) : {};

    function getLeaveLabel(leaveType) {
        switch (leaveType) {
            case 'late': return '⏰ Izin Terlambat';
            case 'sick': return '🏥 Izin Sakit';
            case 'leave': return '🏖️ Cuti';
            case 'change_off': return '🔁 Tukar Libur';
            default: return '📝 Izin';
        }
    }

    function getLeaveBadgeClass(leaveType) {
        switch (leaveType) {
            case 'late': return 'badge-warning';
            case 'sick': return 'badge-danger';
            case 'leave': return 'badge-primary';
            case 'change_off': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📋 Riwayat Absensi</h1>
                <p className="page-subtitle">
                    {isAdmin ? 'Lihat riwayat absensi semua karyawan' : 'Lihat riwayat absensi Anda'}
                </p>
            </div>

            {/* Filter */}
            <div className="card mb-4">
                <form onSubmit={handleFilter} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {isAdmin && (
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                            <label className="form-label">Karyawan</label>
                            <select
                                className="form-input form-select"
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                            >
                                <option value="all">Semua Karyawan</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.employee_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tanggal Mulai</label>
                        <input
                            type="date"
                            className="form-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tanggal Akhir</label>
                        <input
                            type="date"
                            className="form-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Urutkan</label>
                        <select
                            className="form-input form-select"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="desc">Terbaru</option>
                            <option value="asc">Terlama</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary">
                        🔍 Filter
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                            setStartDate(_firstDay);
                            setEndDate(_lastDay);
                            setSelectedUser('all');
                            setTimeout(fetchHistory, 0);
                        }}
                    >
                        Reset
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                type="button"
                                className="btn btn-outline"
                                disabled={exporting}
                                onClick={async () => {
                                    setExporting(true);
                                    try {
                                        const s = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                                        const e = endDate || new Date().toISOString().split('T')[0];
                                        await reportsAPI.exportHistoryPDF(s, e, selectedUser);
                                    } catch (err) {
                                        console.error('Export PDF failed:', err);
                                        alert('Gagal mengunduh PDF');
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                {exporting ? '⏳' : '📄'} PDF
                            </button>
                            <button
                                type="button"
                                className="btn btn-success"
                                disabled={exporting}
                                onClick={async () => {
                                    setExporting(true);
                                    try {
                                        const s = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                                        const e = endDate || new Date().toISOString().split('T')[0];
                                        await reportsAPI.exportHistoryExcel(s, e, selectedUser);
                                    } catch (err) {
                                        console.error('Export Excel failed:', err);
                                        alert('Gagal mengunduh Excel');
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                {exporting ? '⏳' : '📊'} Excel
                            </button>
                        </>
                    )}
                </form>
            </div>

            {error && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                </div>
            ) : records.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <p className="empty-state-text">Tidak ada riwayat absensi</p>
                    </div>
                </div>
            ) : (
                Object.keys(groupedRecords)
                    .sort((a, b) => {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                    })
                    .map((date) => {
                        const dayUsers = groupedRecords[date];
                        return (
                            <div key={date} className="card mb-3">
                                <div className="card-header">
                                    <h3 className="card-title" style={{ fontSize: '1rem' }}>
                                        {formatDate(new Date(date))}
                                    </h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {Object.values(dayUsers).map((userData, idx) => (
                                        <div key={idx} style={{ 
                                            padding: '1rem', 
                                            background: 'rgba(0,0,0,0.02)', 
                                            borderRadius: 'var(--radius-md)', 
                                            border: '1px solid rgba(0,0,0,0.05)' 
                                        }}>
                                            {isAdmin && userData.user_name && (
                                                <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1.05rem', color: 'var(--gray-800)' }}>
                                                    {userData.user_name}
                                                    <span style={{ color: 'var(--gray-500)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                                                        ({userData.employee_id})
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                                                {userData.records.map((record) => (
                                                    record.type === 'off_day' ? (
                                                        <div
                                                            key={record.id}
                                                            style={{
                                                                display: 'flex',
                                                                gap: '1rem',
                                                                alignItems: 'center',
                                                                padding: '1rem',
                                                                background: 'rgba(99, 102, 241, 0.1)',
                                                                borderRadius: 'var(--radius-lg)',
                                                                border: '1px solid rgba(99, 102, 241, 0.3)'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: 50, height: 50,
                                                                borderRadius: 'var(--radius)',
                                                                background: 'rgba(99, 102, 241, 0.2)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '1.5rem', flexShrink: 0
                                                            }}>
                                                                🏖️
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 600, color: 'var(--primary-300)' }}>Hari Libur</div>
                                                </div>
                                                <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                    OFF
                                                </span>
                                            </div>
                                        ) : record.type === 'leave' ? (
                                            <div
                                                key={record.id}
                                                style={{
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    alignItems: 'center',
                                                    padding: '1rem',
                                                    background: 'rgba(16, 185, 129, 0.08)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    border: '1px solid rgba(16, 185, 129, 0.25)'
                                                }}
                                            >
                                                <div style={{
                                                    width: 50, height: 50,
                                                    borderRadius: 'var(--radius)',
                                                    background: 'rgba(16, 185, 129, 0.18)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.5rem', flexShrink: 0
                                                }}>
                                                    📝
                                                </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span className={`badge ${getLeaveBadgeClass(record.leave_type)}`}>
                                                            {getLeaveLabel(record.leave_type)}
                                                        </span>
                                                    </div>
                                                    {record.notes && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--gray-300)', marginTop: '0.35rem' }}>
                                                            💬 {record.notes}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`badge ${getLeaveBadgeClass(record.leave_type)}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                                    IZIN
                                                </span>
                                            </div>
                                        ) : (
                                            <div
                                                key={record.id}
                                                style={{
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    alignItems: 'center',
                                                    padding: '0.75rem',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: 'var(--radius-lg)'
                                                }}
                                            >
                                                {record.photo_path && record.photo_path !== 'manual' ? (
                                                    <img
                                                        src={record.photo_path}
                                                        alt={record.type}
                                                        className="photo-thumb-lg"
                                                        onClick={() => setSelectedImg({
                                                            src: record.photo_path,
                                                            caption: `${record.user_name || user?.name} - ${formatDate(record.recorded_at)} ${formatTime(record.recorded_at)}`,
                                                            isOpen: true
                                                        })}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="photo-thumb-lg"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: 'var(--primary-500)',
                                                            color: 'white',
                                                            fontSize: '1.5rem',
                                                            fontWeight: 'bold',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        {(record.user_name || user?.name || '?').charAt(0)}
                                                    </div>
                                                )}
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                        <span className={`badge ${record.type === 'check_in' ? 'badge-primary' : 'badge-warning'}`}>
                                                            {record.type === 'check_in' ? '📥 Masuk' : '📤 Pulang'}
                                                        </span>
                                                        <span style={{ fontWeight: 600 }}>{formatTime(record.recorded_at)}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                                        📍 {record.location_name || 'Lokasi tidak diketahui'}
                                                    </div>
                                                    {record.notes && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--gray-300)', marginTop: '0.25rem' }}>
                                                            💬 {record.notes}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span className={`badge ${record.is_valid ? 'badge-success' : 'badge-warning'}`}>
                                                        {record.is_valid ? '✓ Valid' : `⚠ ${Math.round(record.distance_meters || 0)}m`}
                                                    </span>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                                        {record.latitude ? parseFloat(record.latitude).toFixed(4) : '-'}, {record.longitude ? parseFloat(record.longitude).toFixed(4) : '-'}
                                                    </div>
                                                    {isAdmin && (
                                                        <button
                                                            className="btn btn-danger"
                                                            style={{
                                                                padding: '0.25rem 0.5rem',
                                                                fontSize: '0.75rem',
                                                                marginTop: '0.5rem',
                                                                width: 'auto',
                                                                marginLeft: 'auto',
                                                                display: 'block'
                                                            }}
                                                            onClick={() => handleDelete(record.id)}
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
            )}

            <ImageModal
                isOpen={selectedImg.isOpen}
                onClose={() => setSelectedImg({ ...selectedImg, isOpen: false })}
                imgSrc={selectedImg.src}
                caption={selectedImg.caption}
            />
        </div>
    );

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus data absensi ini? Foto dan data tidak bisa dikembalikan.')) {
            return;
        }

        try {
            await attendanceAPI.delete(id);
            setRecords(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error('Failed to delete attendance:', err);
            alert(err.message || 'Gagal menghapus data absensi');
        }
    }
}
