import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Icon from './Icon';

export default function Sidebar({ isOpen = false, onNavigate }) {
    const { user, logout, hasPermission, isKioskOnly, isSuperAdmin, updateHiddenMenus } = useAuth();
    const { settings, companyName } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState(() => {
        const phone = window.matchMedia('(max-width: 768px)').matches;
        return { master: !phone, laporanKerja: !phone, standardReport: !phone };
    });

    function toggleMenu(key) {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const kioskOnly = isKioskOnly();
    const isSuper = isSuperAdmin ? isSuperAdmin() : (user?.role === 'super_admin' || user?.role === 'superadmin');
    const isAdmin = user?.role === 'admin';
    const hiddenMenus = Array.isArray(user?.hidden_menus) ? user.hidden_menus : [];
    const isItemVisible = (path) => isSuper ? true : !hiddenMenus.includes(path);

    const [showMenuPrefModal, setShowMenuPrefModal] = useState(false);
    const [tempHidden, setTempHidden] = useState(new Set(hiddenMenus));
    const [menuSearch, setMenuSearch] = useState('');
    const [savingPref, setSavingPref] = useState(false);

    function openMenuPrefModal() {
        setTempHidden(new Set(hiddenMenus));
        setMenuSearch('');
        setShowMenuPrefModal(true);
    }

    async function handleSaveMenuPref() {
        setSavingPref(true);
        try {
            await updateHiddenMenus(Array.from(tempHidden));
            setShowMenuPrefModal(false);
        } catch (e) {
            alert('Gagal menyimpan preferensi menu: ' + (e.message || 'Terjadi kesalahan'));
        } finally {
            setSavingPref(false);
        }
    }

    const menuItemsTop = kioskOnly
        ? [{ path: '/kiosk', icon: 'Monitor', label: 'Mode Kiosk' }]
        : [
        { path: '/', icon: 'LayoutDashboard', label: 'Dashboard' },
        { path: '/attendance', icon: 'Camera', label: 'Absensi' },
        ...(hasPermission('admin.kiosk') ? [{ path: '/kiosk', icon: 'Monitor', label: 'Mode Kiosk' }] : []),
        { path: '/manual-attendance', icon: 'ClipboardPen', label: 'Pengajuan Absen' },
        { path: '/history', icon: 'History', label: 'Riwayat' },
        { path: '/leaves', icon: 'FileText', label: 'Izin & Cuti' },
        { path: '/overtime', icon: 'Clock', label: 'Pengajuan Lembur' },
        { path: '/schedule', icon: 'CalendarClock', label: 'Jadwal & Shift' },
        ...((user?.use_tracking || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin') ? [{ path: '/driver-tracking', icon: 'MapPin', label: 'Tracking' }] : []),
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
        { path: '/approvals', icon: 'CheckCircle2', label: 'Persetujuan Lembur', permissionKey: 'manager.approvals', showIfManager: true },
        { path: '/leave-approvals', icon: 'ClipboardCheck', label: 'Persetujuan Izin', permissionKey: 'manager.leave_approvals', extraKeys: ['admin.leaves'], showIfSupervisor: true },
        { path: '/admin/work-schedule?tab=shift_requests', icon: 'Repeat', label: 'Persetujuan Shift', permissionKey: 'admin.work_schedule', extraKeys: ['manager.approvals'], showIfSupervisor: true },
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
    ].filter(item => hasPermission(item.permissionKey) || (item.extraKeys || []).some(k => hasPermission(k)) || (item.showIfSupervisor && user?.is_supervisor) || (item.showIfManager && (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin')));

    // Standart Report submenu items
    const standardReportItems = [
        { path: '/admin/reports', icon: 'BarChart3', label: 'Laporan', permissionKey: 'admin.reports', showIfManager: true },
        { path: '/admin/contract-report', icon: 'FileWarning', label: 'Laporan Habis Kontrak', permissionKey: 'admin.reports', showIfManager: true },
    ].filter(item => hasPermission(item.permissionKey) || (item.extraKeys || []).some(k => hasPermission(k)) || (item.showIfSupervisor && user?.is_supervisor) || (item.showIfManager && (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin')));

    // Other admin items (flat)
    const adminItems = [
        { path: '/admin/users', icon: 'Users', label: 'Kelola User', permissionKey: 'admin.users' },
        { path: '/admin/roles', icon: 'Shield', label: 'Kelola Role', permissionKey: 'admin.roles' },
        { path: '/admin/settings', icon: 'Settings', label: 'Pengaturan', permissionKey: 'admin.settings' },
        { path: '/admin/license', icon: 'KeyRound', label: 'License', permissionKey: 'admin.license' },
    ].filter(item => hasPermission(item.permissionKey));

    // Visible filtered items (Respecting Admin's hidden_menus; Super Admin always sees everything)
    const visibleMenuItemsTop = menuItemsTop.filter(item => isItemVisible(item.path));
    const visibleLaporanKerjaItems = laporanKerjaItems.filter(item => isItemVisible(item.path));
    const visibleMenuItemsBottom = menuItemsBottom.filter(item => isItemVisible(item.path));
    const visiblePimpinanItems = pimpinanItems.filter(item => isItemVisible(item.path));
    const visibleStandardReportItems = standardReportItems.filter(item => isItemVisible(item.path));
    const visibleMasterItems = masterItems.filter(item => isItemVisible(item.path));
    const visibleAdminItems = adminItems.filter(item => isItemVisible(item.path));

    const isLaporanKerjaActive = visibleLaporanKerjaItems.some(item => location.pathname === item.path);
    const isStandardReportActive = visibleStandardReportItems.some(item => location.pathname === item.path);
    const isMasterActive = visibleMasterItems.some(item => location.pathname === item.path);

    useEffect(() => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        setOpenMenus({
            master: masterItems.some(item => item.path === location.pathname),
            laporanKerja: laporanKerjaItems.some(item => item.path === location.pathname),
            standardReport: standardReportItems.some(item => item.path === location.pathname),
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
                    {/* Admin Personal Menu Customization Button - Modern Aesthetic Card */}
                    {isAdmin && !kioskOnly && (
                        <div style={{ padding: '0.2rem 0.25rem 0.85rem 0.25rem' }}>
                            <button
                                type="button"
                                onClick={openMenuPrefModal}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '13px',
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
                                    border: '1px solid rgba(255, 255, 255, 0.18)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: '#ffffff'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.09) 100%)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.35)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)';
                                }}
                                title="Kustomisasi Tampilan Menu Sidebar (Sembunyikan / Tampilkan Menu)"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)'
                                    }}>
                                        <Icon name="SlidersHorizontal" size={14} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                                            Atur Menu
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {hiddenMenus.length > 0 ? `${hiddenMenus.length} disembunyikan` : 'Semua menu aktif'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ flexShrink: 0, marginLeft: '0.4rem' }}>
                                    {hiddenMenus.length > 0 ? (
                                        <span style={{
                                            fontSize: '0.64rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '20px',
                                            background: 'rgba(245, 158, 11, 0.25)',
                                            border: '1px solid rgba(245, 158, 11, 0.45)',
                                            color: '#fef08a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                            {hiddenMenus.length}
                                        </span>
                                    ) : (
                                        <span style={{
                                            fontSize: '0.64rem',
                                            fontWeight: 600,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '20px',
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            border: '1px solid rgba(255, 255, 255, 0.25)',
                                            color: 'rgba(255, 255, 255, 0.9)'
                                        }}>
                                            Semua
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Menu items up to Tracking */}
                    {visibleMenuItemsTop.map((item) => (
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
                    {!kioskOnly && visibleLaporanKerjaItems.length > 0 && (
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
                                {visibleLaporanKerjaItems.map((item) => (
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
                    {visibleMenuItemsBottom.map((item) => (
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

                    {(visiblePimpinanItems.length > 0 || visibleStandardReportItems.length > 0) && !kioskOnly && (
                        <>
                            <div className="sidebar-section">
                                <span>Task Pimpinan</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>
                            
                            {visiblePimpinanItems.map((item) => (
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

                            {/* Standart Report Submenu */}
                            {visibleStandardReportItems.length > 0 && (
                                <>
                                    <div
                                        onClick={() => toggleMenu('standardReport')}
                                        className={`sidebar-group${isStandardReportActive ? ' is-active' : ''}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                            <span className="sidebar-link-icon"><Icon name="FileBarChart" size={18} /></span>
                                            Standart Report
                                        </div>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '22px', height: '22px', borderRadius: '6px',
                                            background: 'rgba(255,255,255,0.12)',
                                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease',
                                            transform: openMenus.standardReport ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }}><Icon name="ChevronDown" size={16} /></span>
                                    </div>

                                    <div
                                        className={`sidebar-submenu${openMenus.standardReport ? ' is-open' : ''}`}
                                        style={{ maxHeight: openMenus.standardReport ? '240px' : '0px' }}
                                    >
                                        {visibleStandardReportItems.map((item) => (
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
                        </>
                    )}

                    {(visibleMasterItems.length > 0 || visibleAdminItems.length > 0) && !kioskOnly && (
                        <>
                            <div className="sidebar-section">
                                <span>Admin</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>

                            {/* Master Submenu */}
                            {visibleMasterItems.length > 0 && (
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
                                        {visibleMasterItems.map((item) => (
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
                            {visibleAdminItems.map((item) => (
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
                            {isSuper ? (
                                <span style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    👑 Super Admin
                                </span>
                            ) : user?.role === 'admin' ? (
                                <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                                    Administrator
                                </span>
                            ) : user?.role === 'manager' ? (
                                'Pimpinan / Manager'
                            ) : user?.role === 'kiosk' ? (
                                'Operator Kiosk'
                            ) : (
                                'Karyawan'
                            )}
                        </div>
                    </div>
                    {isAdmin && (
                        <button
                            className="sidebar-logout"
                            onClick={openMenuPrefModal}
                            title="Atur Tampilan Menu Sidebar (Hide / Unhide)"
                            style={{ color: 'var(--primary-400)', marginRight: '0.2rem' }}
                        >
                            <Icon name="SlidersHorizontal" size={16} />
                        </button>
                    )}
                    <button className="sidebar-logout" onClick={handleLogout} title="Logout">
                        <Icon name="LogOut" size={18} />
                    </button>
                </div>
            </aside>

            {/* MODAL - Atur Tampilan Menu Sidebar (Khusus Admin) */}
            {showMenuPrefModal && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Icon name="SlidersHorizontal" size={18} /> Atur Tampilan Menu Sidebar
                                </h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', margin: '0.25rem 0 0 0' }}>
                                    Centang menu yang ingin <strong>ditampilkan</strong>, dan hapus centang untuk <strong>menyembunyikan</strong> dari sidebar akun Anda.
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowMenuPrefModal(false)}>
                                <Icon name="X" size={16} />
                            </button>
                        </div>

                        {/* Search and Quick Filters */}
                        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari menu..."
                                    value={menuSearch}
                                    onChange={e => setMenuSearch(e.target.value)}
                                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                                />
                                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>
                                    <Icon name="Search" size={15} />
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 600 }}>Preset Cepat:</span>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => setTempHidden(new Set())}
                                >
                                    <Icon name="Eye" size={12} inline /> Tampilkan Semua
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => {
                                        setTempHidden(prev => {
                                            const next = new Set(prev);
                                            masterItems.forEach(i => next.add(i.path));
                                            return next;
                                        });
                                    }}
                                >
                                    Sembunyikan Master Data
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => {
                                        setTempHidden(prev => {
                                            const next = new Set(prev);
                                            adminItems.forEach(i => next.add(i.path));
                                            return next;
                                        });
                                    }}
                                >
                                    Sembunyikan Menu Sistem
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => setTempHidden(new Set())}
                                    title="Reset ke tampilan default (Semua Muncul)"
                                >
                                    <Icon name="RotateCcw" size={12} inline /> Reset
                                </button>
                            </div>
                        </div>

                        {/* Menu Categories List */}
                        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[
                                { category: '📌 Menu Utama', items: menuItemsTop },
                                { category: '📋 Laporan Kerja', items: laporanKerjaItems },
                                { category: '📦 Manajemen & Profil', items: menuItemsBottom },
                                { category: '👔 Task Pimpinan', items: pimpinanItems },
                                { category: '📊 Standart Report', items: standardReportItems },
                                { category: '📦 Master Data', items: masterItems },
                                { category: '⚙️ Administrasi Sistem', items: adminItems }
                            ].map((group) => {
                                const filteredItems = group.items.filter(item =>
                                    item.label.toLowerCase().includes(menuSearch.toLowerCase())
                                );
                                if (filteredItems.length === 0) return null;

                                return (
                                    <div key={group.category} style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.75rem'
                                    }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-400)', marginBottom: '0.5rem' }}>
                                            {group.category}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.45rem' }}>
                                            {filteredItems.map(item => {
                                                const isVisible = !tempHidden.has(item.path);
                                                return (
                                                    <label
                                                        key={item.path}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '0.45rem 0.6rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: isVisible ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                                                            background: isVisible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isVisible}
                                                                onChange={() => {
                                                                    setTempHidden(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(item.path)) {
                                                                            next.delete(item.path);
                                                                        } else {
                                                                            next.add(item.path);
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                            />
                                                            <span style={{ color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>
                                                                <Icon name={item.icon} size={15} />
                                                            </span>
                                                            <span style={{ fontSize: '0.82rem', fontWeight: isVisible ? 600 : 400, color: isVisible ? 'var(--gray-900)' : 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                        <span className={`badge ${isVisible ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', marginLeft: '0.4rem' }}>
                                                            {isVisible ? 'Tampil' : 'Sembunyi'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                                <strong>{tempHidden.size}</strong> menu disembunyikan
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setShowMenuPrefModal(false)}
                                    disabled={savingPref}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSaveMenuPref}
                                    disabled={savingPref}
                                >
                                    {savingPref ? 'Menyimpan...' : 'Simpan Tampilan Menu'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </>
    );
}
