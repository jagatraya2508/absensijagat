import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState({ master: true });

    function toggleMenu(key) {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const menuItems = [
        { path: '/', icon: '🏠', label: 'Dashboard' },
        { path: '/attendance', icon: '📸', label: 'Absensi' },
        { path: '/history', icon: '📋', label: 'Riwayat' },
        { path: '/schedule', icon: '🗓️', label: 'Kalender' },
        { path: '/leaves', icon: '📝', label: 'Izin & Cuti' },
        { path: '/overtime', icon: '⏰', label: 'Pengajuan Lembur' },
        ...(user?.use_tracking ? [{ path: '/driver-tracking', icon: '📍', label: 'Tracking' }] : []),
        { path: '/change-password', icon: '🔑', label: 'Ubah Password' },
    ];

    // Master submenu items
    const masterItems = [
        { path: '/admin/locations', icon: '📍', label: 'Kelola Lokasi' },
        { path: '/admin/departments', icon: '🏢', label: 'Master Departemen' },
        { path: '/admin/positions', icon: '🏅', label: 'Master Jabatan' },
        { path: '/admin/vehicle-types', icon: '🚚', label: 'Master Kendaraan' },
        { path: '/admin/employees', icon: '👤', label: 'Data Karyawan' },
        { path: '/admin/face-registration', icon: '🔐', label: 'Registrasi Wajah' },
        { path: '/admin/work-schedule', icon: '🕐', label: 'Jadwal Kerja' },
    ];

    // Other admin items (flat)
    const adminItems = [
        { path: '/off-days', icon: '📅', label: 'Atur Libur' },
        { path: '/admin/announcements', icon: '📢', label: 'Kelola Pengumuman' },
        { path: '/admin/driver-activities', icon: '🚛', label: 'Aktivitas Driver' },
        { path: '/admin/driver-tracking', icon: '📍', label: 'Tracking Kunjungan' },
        { path: '/admin/leaves', icon: '📝', label: 'Kelola Izin' },
        { path: '/admin/loans', icon: '💰', label: 'Pinjaman' },
        { path: '/admin/payroll', icon: '💵', label: 'Payroll' },
        { path: '/admin/assessments', icon: '📋', label: 'Penilaian' },
        { path: '/admin/recruitment', icon: '🧑‍💼', label: 'Recruitment' },
        { path: '/admin/assets', icon: '📦', label: 'Manajemen Aset' },
        { path: '/admin/reports', icon: '📊', label: 'Laporan' },
        { path: '/admin/users', icon: '👥', label: 'Kelola User' },
        { path: '/admin/settings', icon: '⚙️', label: 'Pengaturan' },
        { path: '/admin/license', icon: '🔑', label: 'License' },
    ];

    const isMasterActive = masterItems.some(item => location.pathname === item.path);

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div>
                        <h1>Absensi</h1>
                        <span>Attendance System</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            end={item.path === '/'}
                        >
                            <span className="sidebar-link-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}

                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <>
                            <div style={{
                                margin: '1.25rem 0 0.5rem 0',
                                padding: '0 1rem',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                color: 'rgba(255, 255, 255, 0.6)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <span>Task Pimpinan</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>
                            <NavLink to="/approvals" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                                <span className="sidebar-link-icon">✅</span>
                                Persetujuan Lembur
                            </NavLink>
                        </>
                    )}

                    {user?.role === 'admin' && (
                        <>
                            <div style={{
                                margin: '1.25rem 0 0.5rem 0',
                                padding: '0 1rem',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                color: 'rgba(255, 255, 255, 0.6)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <span>Admin</span>
                                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            </div>

                            {/* Master Submenu */}
                            <div
                                onClick={() => toggleMenu('master')}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.6rem 1rem', margin: '0.15rem 0', borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer', transition: 'all 0.25s ease',
                                    background: isMasterActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: isMasterActive ? 'white' : 'rgba(255, 255, 255, 0.95)',
                                    fontWeight: 600, fontSize: '0.85rem',
                                    borderLeft: isMasterActive ? '3px solid var(--theme-primary-light)' : '3px solid transparent',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span className="sidebar-link-icon">📦</span>
                                    Master
                                </div>
                                <span style={{
                                    fontSize: '0.6rem', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: openMenus.master ? 'rotate(180deg)' : 'rotate(0deg)',
                                    opacity: 0.5
                                }}>▼</span>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                flexShrink: 0,
                                overflow: 'hidden',
                                maxHeight: openMenus.master ? '600px' : '0px',
                                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: openMenus.master ? 1 : 0,
                                paddingLeft: '0.75rem',
                                borderLeft: '2px solid rgba(var(--theme-primary-rgb, 109, 0, 0), 0.3)',
                                marginLeft: '1.5rem',
                                marginTop: openMenus.master ? '0.25rem' : '0',
                                marginBottom: openMenus.master ? '0.25rem' : '0',
                                gap: '0.25rem'
                            }}>
                                {masterItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `sidebar-link ${isActive ? 'active' : ''}`
                                        }
                                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
                                    >
                                        <span className="sidebar-link-icon">{item.icon}</span>
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>

                            {/* Other Admin Items */}
                            {adminItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span className="sidebar-link-icon">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </>
                    )}
                </nav>

                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {user?.name?.charAt(0) || '?'}
                    </div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">
                            {user?.role === 'admin' ? 'Administrator' : user?.role === 'manager' ? 'Pimpinan / Manager' : 'Karyawan'}
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleLogout} title="Logout">
                        🚪
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="mobile-nav">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `mobile-nav-link ${isActive ? 'active' : ''}`
                        }
                        end={item.path === '/'}
                    >
                        <span className="mobile-nav-link-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
                {user?.role === 'admin' && (
                    <NavLink
                        to="/admin/reports"
                        className={({ isActive }) =>
                            `mobile-nav-link ${isActive ? 'active' : ''}`
                        }
                    >
                        <span className="mobile-nav-link-icon">📊</span>
                        Admin
                    </NavLink>
                )}
                <button
                    className="mobile-nav-link"
                    onClick={handleLogout}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}
                >
                    <span className="mobile-nav-link-icon" style={{ color: 'var(--danger-500)' }}>🚪</span>
                    Logout
                </button>
            </nav>
        </>
    );
}
