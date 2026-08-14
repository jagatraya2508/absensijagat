import { useState, useEffect } from 'react';
import { licenseAPI } from '../utils/api';

export default function LicenseSettings() {
    const [licenseInfo, setLicenseInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [licenseKey, setLicenseKey] = useState('');
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchLicenseInfo();
    }, []);

    async function fetchLicenseInfo() {
        setLoading(true);
        try {
            const data = await licenseAPI.getInfo();
            setLicenseInfo(data);
        } catch (error) {
            console.error('Failed to fetch license info:', error);
            setError('Gagal memuat info license');
        } finally {
            setLoading(false);
        }
    }

    async function handleActivate(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!licenseKey.trim()) {
            setError('Masukkan lisensi key terlebih dahulu');
            return;
        }

        setActivating(true);
        try {
            await licenseAPI.activate(licenseKey.trim());
            setSuccess('License berhasil diaktifkan!');
            setLicenseKey('');
            fetchLicenseInfo();
        } catch (error) {
            setError(error.message || 'Gagal mengaktifkan license. Pastikan key valid.');
        } finally {
            setActivating(false);
        }
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔑 Info & Pengaturan License</h1>
                <p className="page-subtitle">Kelola lisensi aplikasi dan batas pengguna</p>
            </div>

            {error && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span>
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span>
                    {success}
                </div>
            )}

            {licenseInfo?.wrong_machine && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span>
                    License terpasang terikat ke mesin lain, jadi tidak berlaku di server ini. Aktifkan license yang dibuat untuk ID Mesin di bawah.
                </div>
            )}

            <div className="card mb-4">
                <div className="card-header">
                    <h2 className="card-title">ID Mesin Server Ini</h2>
                </div>
                <div className="card-body">
                    <p style={{ marginBottom: '0.75rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                        Kirim ID ini ke developer saat minta license. Key hanya berlaku di mesin ini dan tidak bisa disalin ke server lain.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{
                            background: 'var(--surface-300, #f1f5f9)',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            letterSpacing: '0.04em',
                            fontWeight: 700
                        }}>
                            {licenseInfo?.machine_id || '-'}
                        </code>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(licenseInfo?.machine_id || '');
                                    setSuccess('ID Mesin disalin');
                                } catch (_) {
                                    setError('Gagal menyalin ID Mesin');
                                }
                            }}
                        >
                            Salin ID Mesin
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Info Card */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Status License</h2>
                    </div>
                    <div className="card-body">
                        {licenseInfo?.active ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="badge badge-success" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                                        {licenseInfo.expired ? 'EXPIRED' : 'ACTIVE'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Perusahaan:</span>
                                    <span className="detail-value" style={{ fontWeight: 600 }}>{licenseInfo.company}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Maksimal Pengguna:</span>
                                    <span className="detail-value">{licenseInfo.max_users} users</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Pengguna Terdaftar:</span>
                                    <span className="detail-value">{licenseInfo.current_users || 0} users</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Berlaku Sampai:</span>
                                    <span className={`detail-value ${licenseInfo.expired ? 'text-danger' : ''}`}>
                                        {new Date(licenseInfo.expires_at).toLocaleDateString('id-ID', {
                                            day: 'numeric', month: 'long', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                {licenseInfo.bound_machine_id && (
                                    <div className="detail-row">
                                        <span className="detail-label">Terikat ke Mesin:</span>
                                        <span className="detail-value"><code>{licenseInfo.bound_machine_id}</code></span>
                                    </div>
                                )}
                                
                                {/* Progress bar usage */}
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                        <span>Penggunaan Kuota</span>
                                        <span>{Math.round(((licenseInfo.current_users || 0) / licenseInfo.max_users) * 100)}%</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div 
                                            style={{ 
                                                height: '100%', 
                                                width: `${Math.min(100, ((licenseInfo.current_users || 0) / licenseInfo.max_users) * 100)}%`,
                                                background: ((licenseInfo.current_users || 0) / licenseInfo.max_users) > 0.9 ? 'var(--danger-500)' : 'var(--primary-color)',
                                                borderRadius: '4px'
                                            }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                <div className="empty-state-icon" style={{ opacity: 0.5 }}>⚠️</div>
                                <h3 style={{ marginBottom: '0.5rem' }}>TRIAL MODE</h3>
                                <p className="empty-state-text">Aplikasi berjalan pada mode trial dengan batasan 5 pengguna.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Activation Card */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Aktivasi License Baru</h2>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleActivate}>
                            <p style={{ marginBottom: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                                Tempel license key yang dibuat khusus untuk ID Mesin server ini. Key dari mesin lain akan ditolak.
                            </p>
                            <div className="form-group">
                                <label className="form-label">License Key</label>
                                <textarea
                                    className="form-input"
                                    placeholder="Tempel license key (eyJh...)"
                                    value={licenseKey}
                                    onChange={(e) => setLicenseKey(e.target.value)}
                                    required
                                    rows="5"
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                style={{ width: '100%' }}
                                disabled={activating || !licenseKey.trim()}
                            >
                                {activating ? 'Memproses Aktivasi...' : 'Aktivasi Sekarang'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
