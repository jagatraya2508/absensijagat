import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const menuItems = [
        { path: '/', icon: '🏠', label: 'Dashboard' },
        { path: '/attendance', icon: '📸', label: 'Absensi' },
        { path: '/history', icon: '📋', label: 'Riwayat' },
        { path: '/leaves', icon: '📝', label: 'Izin & Cuti' },
        { path: '/overtime', icon: '⏰', label: 'Pengajuan Lembur' },
        { path: '/change-password', icon: '🔑', label: 'Ubah Password' },
    ];

    const adminItems = [
        { path: '/off-days', icon: '📅', label: 'Atur Libur' },
        { path: '/admin/locations', icon: '📍', label: 'Kelola Lokasi' },
        { path: '/admin/departments', icon: '🏢', label: 'Master Departemen' },
        { path: '/admin/positions', icon: '🏅', label: 'Master Jabatan' },
        { path: '/admin/users', icon: '👥', label: 'Kelola User' },
        { path: '/admin/employees', icon: '👤', label: 'Data Karyawan' },
        { path: '/admin/face-registration', icon: '🔐', label: 'Registrasi Wajah' },
        { path: '/admin/leaves', icon: '📝', label: 'Kelola Izin' },
        { path: '/admin/work-schedule', icon: '🕐', label: 'Jadwal Kerja' },
        { path: '/admin/loans', icon: '💰', label: 'Pinjaman' },
        { path: '/admin/payroll', icon: '💵', label: 'Payroll' },
        { path: '/admin/assessments', icon: '📋', label: 'Penilaian' },
        { path: '/admin/recruitment', icon: '🧑‍💼', label: 'Recruitment' },
        { path: '/admin/announcements', icon: '📢', label: 'Kelola Pengumuman' },
        { path: '/admin/settings', icon: '⚙️', label: 'Pengaturan' },
        { path: '/admin/reports', icon: '📊', label: 'Laporan' },
    ];

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <img src={settings.app_logo} alt="Logo" style={{ width: '40px', height: 'auto' }} />
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
                                margin: '1rem 0',
                                padding: '0 1rem',
                                fontSize: '0.7rem',
                                color: 'var(--gray-500)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em'
                            }}>
                                Task Pimpinan
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
                                margin: '1rem 0',
                                padding: '0 1rem',
                                fontSize: '0.7rem',
                                color: 'var(--gray-500)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em'
                            }}>
                                Admin
                            </div>
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
