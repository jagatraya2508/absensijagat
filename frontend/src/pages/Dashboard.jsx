import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { attendanceAPI, announcementsAPI, scheduleAPI } from '../utils/api';
import ImageModal from '../components/ImageModal';


export default function Dashboard() {
    const { user, hasPermission, logout } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [todayStatus, setTodayStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Image Modal State
    const [selectedImg, setSelectedImg] = useState({ src: '', caption: '', isOpen: false });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [statusData, historyData, announcementsData] = await Promise.all([
                attendanceAPI.getToday(),
                attendanceAPI.getHistory({ limit: 10 }),
                announcementsAPI.getActive()
            ]);
            setTodayStatus(statusData);
            setHistory(historyData);
            setAnnouncements(announcementsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    }

    function formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    if (loading) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '50vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });


    return (
        <div>
            <div className="page-header">
                <h1 className="page-title" style={{ color: 'var(--theme-primary)' }}>Selamat Datang, {user?.name?.split(' ')[0]}! 👋</h1>
                <p className="page-subtitle" style={{ color: 'var(--gray-600)' }}>{today}</p>
            </div>


            {/* Status Absensi Hari Ini */}
            <div className="grid grid-2 mb-4">
                <div className="card status-card">
                    <div className={`status-card-icon ${todayStatus?.is_off_day ? 'primary' : todayStatus?.checked_in ? 'success' : 'warning'}`}>
                        {todayStatus?.is_off_day ? '🏖️' : todayStatus?.checked_in ? '✓' : '○'}
                    </div>
                    <div className="status-card-content">
                        <h3>Check-in</h3>
                        <p>{todayStatus?.is_off_day ? 'OFF' : todayStatus?.check_in ? formatTime(todayStatus.check_in.recorded_at) : 'Belum'}</p>
                    </div>
                </div>

                <div className="card status-card">
                    <div className={`status-card-icon ${todayStatus?.is_off_day ? 'primary' : todayStatus?.checked_out ? 'success' : 'warning'}`}>
                        {todayStatus?.is_off_day ? '🏖️' : todayStatus?.checked_out ? '✓' : '○'}
                    </div>
                    <div className="status-card-content">
                        <h3>Check-out</h3>
                        <p>{todayStatus?.is_off_day ? 'OFF' : todayStatus?.check_out ? formatTime(todayStatus.check_out.recorded_at) : 'Belum'}</p>
                    </div>
                </div>
            </div>


            {/* Riwayat Absensi Terbaru */}
            {Array.isArray(history) && history.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>📋 Riwayat Absensi</h2>
                        <Link to="/history" className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                            Lihat Semua
                        </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {history.slice(0, 8).map((record) => (
                            <div
                                key={record.id}
                                className="history-record-item"
                                style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'center',
                                    padding: '0.65rem 0.25rem',
                                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <span className={`badge ${record.type === 'check_out' ? 'badge-warning' : record.type === 'leave' ? 'badge-primary' : record.type === 'off_day' ? 'badge-secondary' : 'badge-primary'}`}>
                                            {record.type === 'check_in' ? '📥 Masuk' : record.type === 'check_out' ? '📤 Pulang' : record.type === 'leave' ? '📝 Izin' : record.type === 'off_day' ? '🏖️ Libur' : record.type}
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                            {record.recorded_at ? formatTime(record.recorded_at) : ''}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        {record.recorded_at ? formatDate(record.recorded_at) : ''}
                                        {record.location_name ? ` · ${record.location_name}` : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Actions & Menus (Talenta Style) */}
            <div className="mb-4">
                {/* Attendance Buttons - Compact & Side by Side */}
                <div className="attendance-action-grid gap-3 mb-4">
                    {todayStatus?.is_off_day ? (
                        <div
                            style={{
                                gridColumn: '1 / -1',
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem'
                            }}
                        >
                            <span style={{ fontSize: '1.8rem' }}>🏖️</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--theme-primary)' }}>Hari Ini Libur</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>Absensi tidak diperlukan hari ini</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link
                                to="/attendance?type=check-in"
                                className={`btn-attendance-compact ${todayStatus?.checked_in ? 'disabled' : 'primary'}`}
                                style={{ pointerEvents: todayStatus?.checked_in ? 'none' : 'auto' }}
                            >
                                <div className="icon-wrapper">
                                    <span className="icon">📥</span>
                                </div>
                                <div className="text-wrapper">
                                    <span className="label">Check-in</span>
                                    <span className="sub-label">{todayStatus?.checked_in ? 'Sudah Absen' : 'Masuk Kerja'}</span>
                                </div>
                                {todayStatus?.checked_in && <div className="status-badge">✓</div>}
                            </Link>

                            <Link
                                to="/attendance?type=check-out"
                                className={`btn-attendance-compact ${(!todayStatus?.checked_in || todayStatus?.checked_out) ? 'disabled' : 'danger'}`}
                                style={{ pointerEvents: (!todayStatus?.checked_in || todayStatus?.checked_out) ? 'none' : 'auto' }}
                            >
                                <div className="icon-wrapper">
                                    <span className="icon">📤</span>
                                </div>
                                <div className="text-wrapper">
                                    <span className="label">Check-out</span>
                                    <span className="sub-label">{todayStatus?.checked_out ? 'Sudah Absen' : 'Pulang Kerja'}</span>
                                </div>
                                {todayStatus?.checked_out && <div className="status-badge">✓</div>}
                            </Link>
                        </>
                    )}
                </div>

                {/* ===== MENU KARYAWAN ===== */}
                <div className="menu-grid">
                    <Link to="/attendance" className="menu-item">
                        <div className="menu-icon bg-blue-100 text-blue-600">📸</div>
                        <span className="menu-label">Absensi</span>
                    </Link>
                    {/* Kiosk Mode */}
                    {hasPermission('admin.kiosk') && (
                        <Link to="/kiosk" className="menu-item">
                            <div className="menu-icon bg-blue-100 text-blue-600">🖥️</div>
                            <span className="menu-label">Mode Kiosk</span>
                        </Link>
                    )}
                    <Link to="/manual-attendance" className="menu-item">
                        <div className="menu-icon bg-amber-100 text-amber-600">📝</div>
                        <span className="menu-label">Pengajuan Absen</span>
                    </Link>
                    <Link to="/history" className="menu-item">
                        <div className="menu-icon bg-cyan-100 text-cyan-600">📋</div>
                        <span className="menu-label">Riwayat</span>
                    </Link>
                    <Link to="/schedule" className="menu-item">
                        <div className="menu-icon bg-purple-100 text-purple-600">🗓️</div>
                        <span className="menu-label">Kalender</span>
                    </Link>
                    <Link to="/leaves" className="menu-item">
                        <div className="menu-icon bg-green-100 text-green-600">📝</div>
                        <span className="menu-label">Izin & Cuti</span>
                    </Link>
                    <Link to="/overtime" className="menu-item">
                        <div className="menu-icon bg-orange-100 text-orange-600">⏰</div>
                        <span className="menu-label">Lembur</span>
                    </Link>
                    {/* Tracking - sesuai tugas yang diaktifkan */}
                    {(user?.use_tracking || user?.role === 'admin') && (
                        <Link to="/driver-tracking" className="menu-item">
                            <div className="menu-icon bg-teal-100 text-teal-600">📍</div>
                            <span className="menu-label">Tracking</span>
                        </Link>
                    )}

                    {hasPermission('admin.assets') && (
                        <Link to="/admin/assets" className="menu-item">
                            <div className="menu-icon bg-slate-100 text-slate-600">📦</div>
                            <span className="menu-label">Manajemen Aset</span>
                        </Link>
                    )}

                    <Link to="/change-password" className="menu-item">
                        <div className="menu-icon bg-slate-100 text-slate-600">🔑</div>
                        <span className="menu-label">Ubah Password</span>
                    </Link>

                    {/* Logout button for mobile */}
                    <button
                        className="menu-item"
                        onClick={() => { logout(); navigate('/login'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                    >
                        <div className="menu-icon bg-red-100 text-red-600">🚪</div>
                        <span className="menu-label">Logout</span>
                    </button>
                </div>

                {/* ===== MENU MANAGER ===== */}
                {(hasPermission('manager.approvals') || hasPermission('manager.leave_approvals') || user?.is_supervisor || hasPermission('admin.leaves') || hasPermission('admin.manual_attendance') || hasPermission('admin.off_days') || hasPermission('admin.announcements') || hasPermission('admin.driver_activities') || hasPermission('admin.driver_tracking') || hasPermission('admin.loans') || hasPermission('admin.payroll') || hasPermission('admin.assessments') || hasPermission('admin.recruitment') || hasPermission('admin.assets') || hasPermission('admin.reports')) && (
                    <>
                        <div className="dashboard-section-header">
                            <span className="dashboard-section-title">✅ Task Pimpinan</span>
                            <span className="dashboard-section-line" />
                        </div>
                        <div className="menu-grid">
                            {hasPermission('manager.approvals') && (
                                <Link to="/approvals" className="menu-item">
                                    <div className="menu-icon bg-emerald-100 text-emerald-600">✅</div>
                                    <span className="menu-label">Persetujuan Lembur</span>
                                </Link>
                            )}
                            {(hasPermission('manager.leave_approvals') || user?.is_supervisor || hasPermission('admin.leaves')) && (
                                <Link to="/leave-approvals" className="menu-item">
                                    <div className="menu-icon bg-lime-100 text-lime-600">✅</div>
                                    <span className="menu-label">Persetujuan Izin</span>
                                </Link>
                            )}
                            {hasPermission('admin.leaves') && (
                                <Link to="/admin/leaves" className="menu-item">
                                    <div className="menu-icon bg-green-100 text-green-600">📝</div>
                                    <span className="menu-label">Kelola Izin</span>
                                </Link>
                            )}
                            {hasPermission('admin.manual_attendance') && (
                                <Link to="/admin/manual-attendance" className="menu-item">
                                    <div className="menu-icon bg-cyan-100 text-cyan-600">📋</div>
                                    <span className="menu-label">Persetujuan Absen</span>
                                </Link>
                            )}
                            {hasPermission('admin.off_days') && (
                                <Link to="/off-days" className="menu-item">
                                    <div className="menu-icon bg-red-100 text-red-600">📅</div>
                                    <span className="menu-label">Atur Libur</span>
                                </Link>
                            )}
                            {hasPermission('admin.announcements') && (
                                <Link to="/admin/announcements" className="menu-item">
                                    <div className="menu-icon bg-yellow-100 text-yellow-600">📢</div>
                                    <span className="menu-label">Pengumuman</span>
                                </Link>
                            )}
                            {hasPermission('admin.driver_activities') && (
                                <Link to="/admin/driver-activities" className="menu-item">
                                    <div className="menu-icon bg-orange-100 text-orange-600">🚛</div>
                                    <span className="menu-label">Aktivitas Driver</span>
                                </Link>
                            )}
                            {hasPermission('admin.driver_tracking') && (
                                <Link to="/admin/driver-tracking" className="menu-item">
                                    <div className="menu-icon bg-teal-100 text-teal-600">📍</div>
                                    <span className="menu-label">Tracking Kunjungan</span>
                                </Link>
                            )}
                            {hasPermission('admin.loans') && (
                                <Link to="/admin/loans" className="menu-item">
                                    <div className="menu-icon bg-amber-100 text-amber-600">💰</div>
                                    <span className="menu-label">Pinjaman</span>
                                </Link>
                            )}
                            {hasPermission('admin.payroll') && (
                                <Link to="/admin/payroll" className="menu-item">
                                    <div className="menu-icon bg-emerald-100 text-emerald-600">💵</div>
                                    <span className="menu-label">Payroll</span>
                                </Link>
                            )}
                            {hasPermission('admin.assessments') && (
                                <Link to="/admin/assessments" className="menu-item">
                                    <div className="menu-icon bg-indigo-100 text-indigo-600">📋</div>
                                    <span className="menu-label">Penilaian</span>
                                </Link>
                            )}
                            {hasPermission('admin.recruitment') && (
                                <Link to="/admin/recruitment" className="menu-item">
                                    <div className="menu-icon bg-purple-100 text-purple-600">🧑‍💼</div>
                                    <span className="menu-label">Recruitment</span>
                                </Link>
                            )}
                            {hasPermission('admin.reports') && (
                                <Link to="/admin/reports" className="menu-item">
                                    <div className="menu-icon bg-orange-100 text-orange-600">📊</div>
                                    <span className="menu-label">Laporan</span>
                                </Link>
                            )}
                        </div>
                    </>
                )}

                {/* ===== MENU ADMIN - MASTER DATA ===== */}
                {(hasPermission('admin.locations') || hasPermission('admin.departments') || hasPermission('admin.positions') || hasPermission('admin.vehicle_types') || hasPermission('admin.employees') || hasPermission('admin.organization') || hasPermission('admin.face_registration') || hasPermission('admin.work_schedule') || hasPermission('admin.customers')) && (
                    <>
                        <div className="dashboard-section-header">
                            <span className="dashboard-section-title">📦 Master Data</span>
                            <span className="dashboard-section-line" />
                        </div>
                        <div className="menu-grid">
                            {hasPermission('admin.locations') && (
                                <Link to="/admin/locations" className="menu-item">
                                    <div className="menu-icon bg-red-100 text-red-600">📍</div>
                                    <span className="menu-label">Kelola Lokasi</span>
                                </Link>
                            )}
                            {hasPermission('admin.departments') && (
                                <Link to="/admin/departments" className="menu-item">
                                    <div className="menu-icon bg-blue-100 text-blue-600">🏢</div>
                                    <span className="menu-label">Departemen</span>
                                </Link>
                            )}
                            {hasPermission('admin.positions') && (
                                <Link to="/admin/positions" className="menu-item">
                                    <div className="menu-icon bg-amber-100 text-amber-600">🏅</div>
                                    <span className="menu-label">Jabatan</span>
                                </Link>
                            )}
                            {hasPermission('admin.vehicle_types') && (
                                <Link to="/admin/vehicle-types" className="menu-item">
                                    <div className="menu-icon bg-cyan-100 text-cyan-600">🚚</div>
                                    <span className="menu-label">Kendaraan</span>
                                </Link>
                            )}
                            {hasPermission('admin.employees') && (
                                <Link to="/admin/employees" className="menu-item">
                                    <div className="menu-icon bg-purple-100 text-purple-600">👤</div>
                                    <span className="menu-label">Data Karyawan</span>
                                </Link>
                            )}
                            {(hasPermission('admin.employees') || hasPermission('admin.organization')) && (
                                <Link to="/admin/organization" className="menu-item">
                                    <div className="menu-icon bg-slate-100 text-slate-600">🗂️</div>
                                    <span className="menu-label">Struktur Organisasi</span>
                                </Link>
                            )}
                            {hasPermission('admin.face_registration') && (
                                <Link to="/admin/face-registration" className="menu-item">
                                    <div className="menu-icon bg-indigo-100 text-indigo-600">🔐</div>
                                    <span className="menu-label">Registrasi Wajah</span>
                                </Link>
                            )}
                            {hasPermission('admin.work_schedule') && (
                                <Link to="/admin/work-schedule" className="menu-item">
                                    <div className="menu-icon bg-teal-100 text-teal-600">🕐</div>
                                    <span className="menu-label">Jadwal Kerja</span>
                                </Link>
                            )}
                            {hasPermission('admin.customers') && (
                                <Link to="/admin/customers" className="menu-item">
                                    <div className="menu-icon bg-rose-100 text-rose-600">🏪</div>
                                    <span className="menu-label">Customer</span>
                                </Link>
                            )}
                        </div>
                    </>
                )}

                {/* ===== MENU ADMIN - OPERASIONAL ===== */}
                {(hasPermission('admin.users') || hasPermission('admin.roles') || hasPermission('admin.settings') || hasPermission('admin.license')) && (
                    <>
                        <div className="dashboard-section-header">
                            <span className="dashboard-section-title">⚙️ Admin Panel</span>
                            <span className="dashboard-section-line" />
                        </div>
                        <div className="menu-grid">
                            {hasPermission('admin.users') && (
                                <Link to="/admin/users" className="menu-item">
                                    <div className="menu-icon bg-pink-100 text-pink-600">👥</div>
                                    <span className="menu-label">Kelola User</span>
                                </Link>
                            )}
                            {hasPermission('admin.roles') && (
                                <Link to="/admin/roles" className="menu-item">
                                    <div className="menu-icon bg-rose-100 text-rose-600">🔑</div>
                                    <span className="menu-label">Kelola Role</span>
                                </Link>
                            )}
                            {hasPermission('admin.settings') && (
                                <Link to="/admin/settings" className="menu-item">
                                    <div className="menu-icon bg-slate-100 text-slate-600">⚙️</div>
                                    <span className="menu-label">Pengaturan</span>
                                </Link>
                            )}
                            {hasPermission('admin.license') && (
                                <Link to="/admin/license" className="menu-item">
                                    <div className="menu-icon bg-amber-100 text-amber-600">🔑</div>
                                    <span className="menu-label">License</span>
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>


            {/* Detail Absensi Hari Ini */}
            {(todayStatus?.check_in || todayStatus?.check_out) && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h2 className="card-title">Detail Hari Ini</h2>
                    </div>

                    <div className="grid grid-2">
                        {todayStatus?.check_in && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                {todayStatus.check_in.photo_path && todayStatus.check_in.photo_path !== 'manual' ? (
                                    <img
                                        src={todayStatus.check_in.photo_path}
                                        alt="Check-in"
                                        className="photo-thumb-lg"
                                        onClick={() => setSelectedImg({
                                            src: todayStatus.check_in.photo_path,
                                            caption: `Check-in - ${formatDate(todayStatus.check_in.recorded_at)} ${formatTime(todayStatus.check_in.recorded_at)}`,
                                            isOpen: true
                                        })}
                                    />
                                ) : user?.photo ? (
                                    <img
                                        src={user.photo}
                                        alt="Check-in Fallback"
                                        className="photo-thumb-lg"
                                        style={{ objectFit: 'cover' }}
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
                                        {(user?.name || '?').charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Check-in</div>
                                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                        {formatTime(todayStatus.check_in.recorded_at)}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                        {todayStatus.check_in.location_name || 'Lokasi tidak diketahui'}
                                    </div>
                                    <span className={`badge ${todayStatus.check_in.is_valid ? 'badge-success' : 'badge-warning'}`}>
                                        {todayStatus.check_in.is_valid ? 'Valid' : `${Math.round(todayStatus.check_in.distance_meters)}m dari kantor`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {todayStatus?.check_out && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                {todayStatus.check_out.photo_path && todayStatus.check_out.photo_path !== 'manual' ? (
                                    <img
                                        src={todayStatus.check_out.photo_path}
                                        alt="Check-out"
                                        className="photo-thumb-lg"
                                        onClick={() => setSelectedImg({
                                            src: todayStatus.check_out.photo_path,
                                            caption: `Check-out - ${formatDate(todayStatus.check_out.recorded_at)} ${formatTime(todayStatus.check_out.recorded_at)}`,
                                            isOpen: true
                                        })}
                                    />
                                ) : user?.photo ? (
                                    <img
                                        src={user.photo}
                                        alt="Check-out Fallback"
                                        className="photo-thumb-lg"
                                        style={{ objectFit: 'cover' }}
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
                                        {(user?.name || '?').charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Check-out</div>
                                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                        {formatTime(todayStatus.check_out.recorded_at)}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                        {todayStatus.check_out.location_name || 'Lokasi tidak diketahui'}
                                    </div>
                                    <span className={`badge ${todayStatus.check_out.is_valid ? 'badge-success' : 'badge-warning'}`}>
                                        {todayStatus.check_out.is_valid ? 'Valid' : `${Math.round(todayStatus.check_out.distance_meters)}m dari kantor`}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Announcements Section (Bottom) */}
            {announcements.length > 0 && (
                <div className="mb-4">
                    <div style={{ marginBottom: '0.75rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--theme-primary)', margin: 0 }}>📢 Pengumuman</h2>
                    </div>
                    {announcements.map(item => (
                        <div key={item.id} className="card-glass mb-3" style={{
                            background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))',
                            borderLeft: '4px solid var(--primary-500)',
                            padding: '1rem 1.5rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '5rem', opacity: 0.05, transform: 'rotate(15deg)' }}>
                                📢
                            </div>
                            <div className="d-flex align-items-center gap-3 mb-2">
                                <div style={{
                                    background: 'var(--primary-500)',
                                    color: 'white',
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.9rem'
                                }}>
                                    📢
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--theme-primary)' }}>
                                        {item.title}
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>
                                        {formatDate(item.created_at)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ paddingLeft: '3.25rem' }}>
                                <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--gray-800)', lineHeight: '1.6' }}>
                                    {item.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ImageModal
                isOpen={selectedImg.isOpen}
                onClose={() => setSelectedImg({ ...selectedImg, isOpen: false })}
                imgSrc={selectedImg.src}
                caption={selectedImg.caption}
            />


        </div>
    );
}
