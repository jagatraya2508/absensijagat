import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Icon from './Icon';

export default function Sidebar({ isOpen = false, onNavigate }) {
    const { user, logout, hasPermission, isKioskOnly } = useAuth();
    const { settings, companyName } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState(() => {
        const phone = window.matchMedia('(max-width: 768px)').matches;
        return { master: !phone, laporanKerja: !phone };
    });

    function toggleMenu(key) {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const kioskOnly = isKioskOnly();

    const menuItemsTop = kioskOnly
        ? [{ path: '/kiosk', icon: 'Monitor', label: 'Mode Kiosk' }]
        : [
        { path: '/', icon: 'LayoutDashboard', label: 'Dashboard' },
        { path: '/attendance', icon: 'Camera', label: 'Absensi' },
        ...(hasPermission('admin.kiosk') ? [{ path: '/kiosk', icon: 'Monitor', label: 'Mode Kiosk' }] : []),
        { path: '/manual-attendance', icon: 'ClipboardPen', label: 'Pengajuan Absen' },
        { path: '/history', icon: 'History', label: 'Riwayat' },
        { path: '/schedule', icon: 'Calendar', label: 'Kalender' },
        { path: '/leaves', icon: 'FileText', label: 'Izin & Cuti' },
        { path: '/overtime', icon: 'Clock', label: 'Pengajuan Lembur' },
        ...((user?.use_tracking || user?.role === 'admin') ? [{ path: '/driver-tracking', icon: 'MapPin', label: 'Tracking' }] : []),
    ];

    const menuItemsBottom = kioskOnly ? [] : [
        ...(hasPermission('admin.assets') ? [{ path: '/admin/assets', icon: 'Package', label: 'Manajemen Aset' }] : []),
        { path: '/change-password', icon: 'User', label: 'Profil Saya' },
    ];

    // Laporan Kerja submenu items
    const laporanKerjaItems = [
        { path: '/daily-work-report', icon: 'NotebookPen', label: 'Laporan Harian' },
        { path: '/admin/daily-work-report', icon: 'BarChart3', label: 'Review Laporan Harian' },
    ];

    const isLaporanKerjaActive = laporanKerjaItems.some(item => location.pathname === item.path);

    // Master submenu items
    const masterItems = [
        { path: '/admin/locations', icon: 'MapPin', label: 'Kelola Lokasi', permissionKey: 'admin.locations' },
        { path: '/admin/departments', icon: 'Building2', label: 'Master Departemen', permissionKey: 'admin.departments' },
        { path: '/admin/positions', icon: 'Award', label: 'Master Jabatan', permissionKey: 'admin.positions' },
        { path: '/admin/employment-statuses', icon: 'Briefcase', label: 'Master Status Karyawan', permissionKey: 'admin.employment_statuses' },
        { path: '/admin/divisions', icon: 'Folder', label: 'Master Divisi', permissionKey: 'admin.divisions' },
        { path: '/admin/vehicle-types', icon: 'Truck', label: 'Master Kendaraan', permissionKey: 'admin.vehicle_types' },
        { path: '/admin/employees', icon: 'User', label: 'Data Karyawan', permissionKey: 'admin.employees' },
        { path: '/admin/organization', icon: 'Network', label: 'Struktur Organisasi', permissionKey: 'admin.organization', extraKeys: ['admin.employees'] },
        { path: '/admin/face-registration', icon: 'ScanFace', label: 'Registrasi Wajah', permissionKey: 'admin.face_registration' },
        { path: '/admin/work-schedule', icon: 'CalendarClock', label: 'Jadwal Kerja', permissionKey: 'admin.work_schedule' },
        { path: '/admin/customers', icon: 'Store', label: 'Master Customer', permissionKey: 'admin.customers' },
    ].filter(item => hasPermission(item.permissionKey) || (item.extraKeys || []).some(k => hasPermission(k)));

    const pimpinanItems = [
        { path: '/approvals', icon: 'CheckCircle2', label: 'Persetujuan Lembur', permissionKey: 'manager.approvals' },
        { path: '/leave-approvals', icon: 'ClipboardCheck', label: 'Persetujuan Izin', permissionKey: 'manager.leave_approvals', extraKeys: ['admin.leaves'], showIfSupervisor: true },
        { path: '/admin/leaves', icon: 'FileText', label: 'Kelola Izin', permissionKey: 'admin.leaves' },
        { path: '/admin/manual-attendance', icon: 'ClipboardList', label: 'Persetujuan Absen', permissionKey: 'admin.manual_attendance' },
        { path: '/off-days', icon: 'CalendarOff', label: 'Atur Libur', permissionKey: 'admin.off_days' },
        { path: '/admin/announcements', icon: 'Megaphone', label: 'Kelola Pengumuman', permissionKey: 'admin.announcements' },
        { path: '/admin/driver-activities', icon: 'Truck', label: 'Aktivitas Driver', permissionKey: 'admin.driver_activities' },
        { path: '/admin/tuang', icon: 'Banknote', label: 'Insentif Tuang', permissionKey: 'manager.tuang' },
        { path: '/admin/driver-tracking', icon: 'MapPin', label: 'Tracking Kunjungan', permissionKey: 'admin.driver_tracking' },
        { path: '/admin/loans', icon: 'Wallet', label: 'Pinjaman', permissionKey: 'admin.loans' },
        { path: '/admin/payroll', icon: 'Banknote', label: 'Payroll', permissionKey: 'admin.payroll' },
        { path: '/admin/assessments', icon: 'ClipboardList', label: 'Penilaian', permissionKey: 'admin.assessments' },
        { path: '/admin/recruitment', icon: 'Briefcase', label: 'Recruitment', permissionKey: 'admin.recruitment' },
        { path: '/admin/reports', icon: 'BarChart3', label: 'Laporan', permissionKey: 'admin.reports' },
    ].filter(item => hasPermission(item.permissionKey) || (item.extraKeys || []).some(k => hasPermission(k)) || (item.showIfSupervisor && user?.is_supervisor));

    // Other admin items (flat)
    const adminItems = [
        { path: '/admin/users', icon: 'Users', label: 'Kelola User', permissionKey: 'admin.users' },
        { path: '/admin/roles', icon: 'Shield', label: 'Kelola Role', permissionKey: 'admin.roles' },
        { path: '/admin/settings', icon: 'Settings', label: 'Pengaturan', permissionKey: 'admin.settings' },
        { path: '/admin/license', icon: 'KeyRound', label: 'License', permissionKey: 'admin.license' },
    ].filter(item => hasPermission(item.permissionKey));

    const isMasterActive = masterItems.some(item => location.pathname === item.path);

    useEffect(() => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        setOpenMenus({
            master: masterItems.some(item => item.path === location.pathname),
            laporanKerja: laporanKerjaItems.some(item => item.path === location.pathname),
        });
    }, [location.pathname]);

    return (
        <>
            <aside className={`sidebar${isOpen ? ' open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-text">
                        <h1>{companyName || 'Absensi'}</h1>
                        <span>Attendance System</span>
                    </div>
                    <button type="button" className="sidebar-close" onClick={onNavigate} aria-label="Tutup menu">
                        <Icon name="X" size={18} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {/* Menu items up to Tracking */}
                    {menuItemsTop.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            end={item.path === '/'}
                        >
                            <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                            {item.label}
                        </NavLink>
                    ))}

                    {/* Laporan Kerja Submenu */}
                    {!kioskOnly && (
                        <>
                            <div
                                onClick={() => toggleMenu('laporanKerja')}
                                className={`sidebar-group${isLaporanKerjaActive ? ' is-active' : ''}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                    <span className="sidebar-link-icon"><Icon name="ClipboardList" size={18} /></span>
                                    Laporan Kerja
                                </div>
                                <span style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '22px', height: '22px', borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.12)',
                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease',
                                    transform: openMenus.laporanKerja ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}><Icon name="ChevronDown" size={16} /></span>
                            </div>

                            <div
                                className={`sidebar-submenu${openMenus.laporanKerja ? ' is-open' : ''}`}
                                style={{ maxHeight: openMenus.laporanKerja ? '240px' : '0px' }}
                            >
                                {laporanKerjaItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onNavigate}
                                        className={({ isActive }) =>
                                            `sidebar-link ${isActive ? 'active' : ''}`
                                        }
                                    >
                                        <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Remaining menu items (Manajemen Aset, Profil Saya) */}
                    {menuItemsBottom.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                            {item.label}
                        </NavLink>
                    ))}

                    {pimpinanItems.length > 0 && !kioskOnly && (
                        <>
                            <div className="sidebar-section">
                                <span>Task Pimpinan</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>
                            
                            {pimpinanItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </>
                    )}

                    {(masterItems.length > 0 || adminItems.length > 0) && !kioskOnly && (
                        <>
                            <div className="sidebar-section">
                                <span>Admin</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>

                            {/* Master Submenu */}
                            {masterItems.length > 0 && (
                                <>
                                    <div
                                        onClick={() => toggleMenu('master')}
                                        className={`sidebar-group${isMasterActive ? ' is-active' : ''}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                            <span className="sidebar-link-icon"><Icon name="Box" size={18} /></span>
                                            Master
                                        </div>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '22px', height: '22px', borderRadius: '6px',
                                            background: 'rgba(255,255,255,0.12)',
                                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease',
                                            transform: openMenus.master ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }}><Icon name="ChevronDown" size={16} /></span>
                                    </div>

                                    <div
                                        className={`sidebar-submenu${openMenus.master ? ' is-open' : ''}`}
                                        style={{ maxHeight: openMenus.master ? '720px' : '0px' }}
                                    >
                                        {masterItems.map((item) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                onClick={onNavigate}
                                                className={({ isActive }) =>
                                                    `sidebar-link ${isActive ? 'active' : ''}`
                                                }
                                            >
                                                <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                                                {item.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Other Admin Items */}
                            {adminItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </>
                    )}
                </nav>

                <div className="sidebar-user">
                    {user?.photo ? (
                        <img src={user.photo} alt="Profile" className="sidebar-user-avatar" style={{ objectFit: 'cover', padding: 0, border: '2px solid rgba(255,255,255,0.2)' }} />
                    ) : (
                        <div className="sidebar-user-avatar">
                            {user?.name?.charAt(0) || '?'}
                        </div>
                    )}
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">
                            {user?.role === 'admin' ? 'Administrator' : user?.role === 'manager' ? 'Pimpinan / Manager' : user?.role === 'kiosk' ? 'Operator Kiosk' : 'Karyawan'}
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleLogout} title="Logout">
                        <Icon name="LogOut" size={18} />
                    </button>
                </div>
            </aside>


        </>
    );
}
