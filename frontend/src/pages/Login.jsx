import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { authAPI } from '../utils/api';

export default function Login() {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password State
    const [showForgot, setShowForgot] = useState(false);
    const [forgotId, setForgotId] = useState('');
    const [forgotErr, setForgotErr] = useState('');
    const [forgotMsg, setForgotMsg] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    const { login } = useAuth();
    const { settings, companyName } = useSettings();
    const navigate = useNavigate();

    // Check if running in a native Capacitor wrapper
    const isNativeApp = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    function handleResetServer() {
        if (confirm('Anda yakin ingin keluar dan mengganti URL server?')) {
            window.location.href = 'http://localhost?reset=true';
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(employeeId, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login gagal. Periksa kembali Employee ID dan password.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-logo">
                        <img src={settings.login_logo || settings.app_logo} alt="Logo" style={{ width: '150px', maxWidth: '100%', height: 'auto', marginBottom: '1rem' }} />
                        <h1>{companyName || 'Absensi Karyawan'}</h1>
                        <p>Silakan login untuk melanjutkan</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger">
                            <span className="alert-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="employeeId">
                                Employee ID
                            </label>
                            <input
                                type="text"
                                id="employeeId"
                                className="form-input"
                                placeholder="Masukkan Employee ID"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                required
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">
                                Password
                            </label>
                            <div className="password-input-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="form-input"
                                    placeholder="Masukkan password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--primary-300)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                                onClick={() => { setShowForgot(true); setForgotErr(''); setForgotMsg(''); setForgotId(''); }}
                            >
                                Lupa Password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                    Memproses...
                                </>
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>
                </div>

                {isNativeApp && (
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button
                            onClick={handleResetServer}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary-color)',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Bukan server perusahaan Anda? Ganti URL Server
                        </button>
                    </div>
                )}

                <p className="text-center text-muted" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
                    © 2024 {companyName || 'Absensi Karyawan'}. All rights reserved.
                </p>
            </div>

            {/* Forgot Password Modal */}
            {showForgot && (
                <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Lupa Password</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--gray-400)', marginBottom: '1.5rem' }}>
                            Masukkan Employee ID Anda. Password baru akan dikirimkan ke email Anda yang terdaftar.
                        </p>
                        
                        {forgotErr && <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.85rem' }}>{forgotErr}</div>}
                        {forgotMsg && <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.85rem' }}>{forgotMsg}</div>}

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setForgotErr('');
                            setForgotMsg('');
                            setForgotLoading(true);
                            try {
                                const res = await authAPI.forgotPassword(forgotId);
                                setForgotMsg(res.message || 'Password baru berhasil dikirim!');
                                setForgotId('');
                            } catch (err) {
                                // Provide helpful feedback if SMTP isn't set up yet
                                if (err.message && err.message.includes('fallback_password')) {
                                    // Not strictly possible to get fallback_password from err object usually unless backend sends it in the error response body and the request wrapper passes it.
                                    // Our wrapper `throw new Error(data.error)` so we only get the string. We modified the backend to send it, but `request` might not expose it.
                                    setForgotErr(err.message);
                                } else {
                                    setForgotErr(err.message || 'Gagal mereset password');
                                }
                            } finally {
                                setForgotLoading(false);
                            }
                        }}>
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--text-primary)' }}>Employee ID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={forgotId}
                                    onChange={(e) => setForgotId(e.target.value)}
                                    required
                                    placeholder="Masukkan Employee ID"
                                    disabled={forgotLoading}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowForgot(false)} disabled={forgotLoading}>
                                    Tutup
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                                    {forgotLoading ? 'Mengirim...' : 'Kirim Email'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
