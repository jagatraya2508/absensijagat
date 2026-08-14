import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const THEME_PRESETS = [
    { name: 'Merah Marun', icon: '🔴', primary: '#6D0000', bg: '#fff8f8', card_bg: '#ffffff', btn_bg: '#ef4444' },
    { name: 'Biru Navy', icon: '🔵', primary: '#0A1929', bg: '#f0f4ff', card_bg: '#ffffff', btn_bg: '#3b82f6' },
    { name: 'Hijau Emerald', icon: '🟢', primary: '#064E3B', bg: '#f0fdf4', card_bg: '#ffffff', btn_bg: '#10b981' },
    { name: 'Ungu Royal', icon: '🟣', primary: '#4C1D95', bg: '#faf5ff', card_bg: '#ffffff', btn_bg: '#8b5cf6' },
    { name: 'Slate Dark', icon: '⚫', primary: '#1E293B', bg: '#f8fafc', card_bg: '#ffffff', btn_bg: '#64748b' },
    { name: 'Amber Gold', icon: '🟠', primary: '#78350F', bg: '#fffbeb', card_bg: '#ffffff', btn_bg: '#f59e0b' },
];

function LogoUploader({ title, type, currentLogoUrl, updateLogoFn }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(currentLogoUrl || '/logo.png');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            if (f.size > 2 * 1024 * 1024) {
                setMessage({ type: 'danger', text: 'Ukuran file maksimal 2MB' });
                return;
            }
            setFile(f);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(f);
            setMessage({ type: '', text: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage({ type: 'danger', text: 'Silakan pilih file logo terlebih dahulu' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        const formData = new FormData();
        formData.append('logo', file);
        formData.append('type', type);

        try {
            await updateLogoFn(formData);
            setMessage({ type: 'success', text: `${title} berhasil diperbarui` });
            setFile(null);
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || `Gagal memperbarui ${title.toLowerCase()}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: '1rem' }}>
                {title}
            </h3>
            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
                    <span className="alert-icon">{message.type === 'success' ? '✅' : '⚠️'}</span>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor={`logo_${type}`}>
                                Pilih File Logo Baru (PNG, JPG, SVG)
                            </label>
                            <input
                                type="file"
                                id={`logo_${type}`}
                                className="form-input"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                                Ukuran maksimal: 2MB. {type === 'favicon_logo' ? 'Disarankan 1:1 (persegi).' : 'Disarankan aspek rasio 1:1 atau horizontal.'}
                            </p>
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '0.5rem' }}
                            disabled={loading || !file}
                        >
                            {loading ? (
                                <>
                                    <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                `Simpan ${title}`
                            )}
                        </button>
                    </div>
                    <div style={{ width: '160px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: '0.5rem' }}>Preview</p>
                        <div style={{
                            border: '1px solid var(--gray-200)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            background: 'var(--gray-50)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '120px'
                        }}>
                            <img
                                src={previewUrl}
                                alt={`Preview ${title}`}
                                style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default function AdminSettings() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { settings, updateLogo, themeColors, updateTheme, previewTheme, resetPreview, companyName, updateCompanyName, DEFAULT_THEME } = useSettings();

    // Company Name state
    const [editCompanyName, setEditCompanyName] = useState(companyName || 'Absensi');
    const [companyLoading, setCompanyLoading] = useState(false);
    const [companyMessage, setCompanyMessage] = useState({ type: '', text: '' });

    // Theme state
    const [selectedPrimary, setSelectedPrimary] = useState(themeColors.primary);
    const [selectedBg, setSelectedBg] = useState(themeColors.bg);
    const [selectedCardBg, setSelectedCardBg] = useState(themeColors.card_bg || '#ffffff');
    const [selectedBtnBg, setSelectedBtnBg] = useState(themeColors.btn_bg || '#ef4444');
    const [themeLoading, setThemeLoading] = useState(false);
    const [themeMessage, setThemeMessage] = useState({ type: '', text: '' });
    const [activePreset, setActivePreset] = useState(null);

    // Leave Settings state
    const [leaveSettings, setLeaveSettings] = useState({
        annual_leave_quota: 12,
        late_deducts_leave: false,
        sick_deducts_leave: false,
        permission_deducts_leave: false
    });
    const [approvalConfig, setApprovalConfig] = useState([
        { leave_type: 'late', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'sick', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'permission', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'leave', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'change_off', approval_levels: 1, fallback_to_admin: true }
    ]);
    const [bigLeaveRules, setBigLeaveRules] = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(false);
    const [leaveMessage, setLeaveMessage] = useState({ type: '', text: '' });

    // SMTP Settings state
    const [smtpSettings, setSmtpSettings] = useState({
        smtp_host: '',
        smtp_port: '',
        smtp_user: '',
        smtp_pass: '',
        smtp_secure: false
    });
    const [smtpLoading, setSmtpLoading] = useState(false);
    const [smtpMessage, setSmtpMessage] = useState({ type: '', text: '' });

    // Backup & Restore state
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [backupMessage, setBackupMessage] = useState({ type: '', text: '' });
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreConfirm, setRestoreConfirm] = useState('');
    const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });

    // Sync when themeColors change (e.g. after save)
    useEffect(() => {
        setSelectedPrimary(themeColors.primary);
        setSelectedBg(themeColors.bg);
        setSelectedCardBg(themeColors.card_bg || '#ffffff');
        setSelectedBtnBg(themeColors.btn_bg || '#ef4444');
        // find active preset
        const match = THEME_PRESETS.findIndex(
            p => p.primary.toLowerCase() === themeColors.primary.toLowerCase() && p.bg.toLowerCase() === themeColors.bg.toLowerCase() && p.card_bg.toLowerCase() === (themeColors.card_bg || '#ffffff').toLowerCase() && p.btn_bg.toLowerCase() === (themeColors.btn_bg || '#ef4444').toLowerCase()
        );
        setActivePreset(match >= 0 ? match : null);
    }, [themeColors]);

    useEffect(() => {
        setEditCompanyName(companyName || 'Absensi');
    }, [companyName]);

    useEffect(() => {
        fetchLeaveSettings();
        fetchSmtpSettings();
    }, []);

    const fetchSmtpSettings = async () => {
        try {
            const { settingsAPI } = await import('../utils/api');
            const data = await settingsAPI.getAll();
            setSmtpSettings({
                smtp_host: data.smtp_host || '',
                smtp_port: data.smtp_port || '',
                smtp_user: data.smtp_user || '',
                smtp_pass: data.smtp_pass || '',
                smtp_secure: data.smtp_secure === 'true'
            });
        } catch (error) {
            console.error('Failed to load SMTP settings:', error);
        }
    };

    const fetchLeaveSettings = async () => {
        try {
            const { settingsAPI } = await import('../utils/api');
            const data = await settingsAPI.getLeave();
            if (data.settings) {
                setLeaveSettings({
                    annual_leave_quota: data.settings.annual_leave_quota,
                    late_deducts_leave: data.settings.late_deducts_leave,
                    sick_deducts_leave: data.settings.sick_deducts_leave,
                    permission_deducts_leave: data.settings.permission_deducts_leave
                });
            }
            if (data.approval_config && data.approval_config.length > 0) {
                setApprovalConfig((prev) => prev.map((item) => {
                    const found = data.approval_config.find((c) => c.leave_type === item.leave_type);
                    return found ? { ...item, ...found } : item;
                }));
            }
            if (data.big_leave_rules) {
                setBigLeaveRules(data.big_leave_rules);
            }
        } catch (error) {
            console.error('Failed to load leave settings:', error);
        }
    };
    const handlePresetSelect = (index) => {
        const preset = THEME_PRESETS[index];
        setActivePreset(index);
        setSelectedPrimary(preset.primary);
        setSelectedBg(preset.bg);
        setSelectedCardBg(preset.card_bg);
        setSelectedBtnBg(preset.btn_bg);
        previewTheme({ primary: preset.primary, bg: preset.bg, card_bg: preset.card_bg, btn_bg: preset.btn_bg });
    };

    const handleCustomColorChange = (field, value) => {
        setActivePreset(null);
        if (field === 'primary') {
            setSelectedPrimary(value);
            previewTheme({ primary: value, bg: selectedBg, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
        } else if (field === 'bg') {
            setSelectedBg(value);
            previewTheme({ primary: selectedPrimary, bg: value, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
        } else if (field === 'card_bg') {
            setSelectedCardBg(value);
            previewTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: value, btn_bg: selectedBtnBg });
        } else if (field === 'btn_bg') {
            setSelectedBtnBg(value);
            previewTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: selectedCardBg, btn_bg: value });
        }
    };

    const handleThemeSave = async () => {
        setThemeLoading(true);
        setThemeMessage({ type: '', text: '' });
        try {
            await updateTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
            setThemeMessage({ type: 'success', text: 'Tema berhasil disimpan!' });
        } catch (error) {
            setThemeMessage({ type: 'danger', text: error.message || 'Gagal menyimpan tema' });
            resetPreview();
        } finally {
            setThemeLoading(false);
        }
    };

    const handleThemeReset = () => {
        setSelectedPrimary(DEFAULT_THEME.primary);
        setSelectedBg(DEFAULT_THEME.bg);
        setSelectedCardBg(DEFAULT_THEME.card_bg);
        setSelectedBtnBg(DEFAULT_THEME.btn_bg);
        setActivePreset(0);
        previewTheme({ primary: DEFAULT_THEME.primary, bg: DEFAULT_THEME.bg, card_bg: DEFAULT_THEME.card_bg, btn_bg: DEFAULT_THEME.btn_bg });
    };

    // Leave Settings Handlers
    const handleLeaveSave = async (e) => {
        e.preventDefault();
        setLeaveLoading(true);
        setLeaveMessage({ type: '', text: '' });
        try {
            const { settingsAPI } = await import('../utils/api');
            await settingsAPI.updateLeave({
                ...leaveSettings,
                big_leave_rules: bigLeaveRules,
                approval_config: approvalConfig
            });
            setLeaveMessage({ type: 'success', text: 'Pengaturan cuti berhasil disimpan!' });
        } catch (error) {
            setLeaveMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan cuti' });
        } finally {
            setLeaveLoading(false);
        }
    };

    const addBigLeaveRule = () => {
        setBigLeaveRules([...bigLeaveRules, { min_years: 0, leave_days: 0, is_active: true }]);
    };

    const removeBigLeaveRule = (index) => {
        const newRules = [...bigLeaveRules];
        newRules.splice(index, 1);
        setBigLeaveRules(newRules);
    };

    const updateBigLeaveRule = (index, field, value) => {
        const newRules = [...bigLeaveRules];
        newRules[index][field] = value;
        setBigLeaveRules(newRules);
    };

    const handleSmtpSave = async (e) => {
        e.preventDefault();
        setSmtpLoading(true);
        setSmtpMessage({ type: '', text: '' });
        try {
            const { settingsAPI } = await import('../utils/api');
            await settingsAPI.updateSmtp(smtpSettings);
            setSmtpMessage({ type: 'success', text: 'Pengaturan SMTP berhasil disimpan!' });
        } catch (error) {
            setSmtpMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan SMTP' });
        } finally {
            setSmtpLoading(false);
        }
    };

    const handleBackupDownload = async () => {
        setBackupLoading(true);
        setBackupMessage({ type: '', text: '' });
        try {
            const { backupAPI } = await import('../utils/api');
            await backupAPI.download();
            setBackupMessage({ type: 'success', text: 'Backup berhasil diunduh.' });
        } catch (error) {
            setBackupMessage({ type: 'danger', text: error.message || 'Gagal membuat backup' });
        } finally {
            setBackupLoading(false);
        }
    };

    const handleRestore = async (e) => {
        e.preventDefault();
        if (!restoreFile) {
            setRestoreMessage({ type: 'danger', text: 'Pilih file backup terlebih dahulu' });
            return;
        }
        if (restoreConfirm.trim().toUpperCase() !== 'TIMPA') {
            setRestoreMessage({ type: 'danger', text: 'Ketik TIMPA untuk konfirmasi restore' });
            return;
        }

        const ok = window.confirm(
            'PERINGATAN: Restore akan menimpa SELURUH data database saat ini dengan isi file backup.\n\nLanjutkan?'
        );
        if (!ok) return;

        setRestoreLoading(true);
        setRestoreMessage({ type: '', text: '' });
        try {
            const { backupAPI } = await import('../utils/api');
            const formData = new FormData();
            formData.append('backup', restoreFile);
            formData.append('confirm', 'TIMPA');
            const result = await backupAPI.restore(formData);
            const extra = result.summary ? ` (${result.summary})` : '';
            setRestoreMessage({
                type: 'success',
                text: `${result.message || 'Restore berhasil.'}${extra} Anda akan diarahkan ke halaman login.`
            });
            setRestoreFile(null);
            setRestoreConfirm('');
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2500);
        } catch (error) {
            setRestoreMessage({ type: 'danger', text: error.message || 'Gagal restore database' });
        } finally {
            setRestoreLoading(false);
        }
    };

    const handleCompanyNameSave = async () => {
        if (!editCompanyName.trim()) return;
        setCompanyLoading(true);
        setCompanyMessage({ type: '', text: '' });
        try {
            await updateCompanyName(editCompanyName.trim());
            setCompanyMessage({ type: 'success', text: 'Nama perusahaan berhasil disimpan!' });
        } catch (error) {
            setCompanyMessage({ type: 'danger', text: error.message || 'Gagal menyimpan nama perusahaan' });
        } finally {
            setCompanyLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">⚙️ Pengaturan Aplikasi</h1>
                <p className="page-subtitle">Kelola konfigurasi sistem dan tampilan</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '800px' }}>

                {/* ============ COMPANY NAME SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title">🏢 Nama Perusahaan</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {companyMessage.text && (
                            <div className={`alert alert-${companyMessage.type}`} style={{ marginBottom: '1rem' }}>
                                <span className="alert-icon">{companyMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                {companyMessage.text}
                            </div>
                        )}

                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                            Nama ini akan ditampilkan di sidebar navigasi dan area branding aplikasi.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Nama Perusahaan
                                </label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={editCompanyName}
                                    onChange={(e) => setEditCompanyName(e.target.value)}
                                    placeholder="Contoh: PT Jagatraya"
                                    maxLength={50}
                                    style={{ background: 'white', color: 'var(--gray-900)', border: '1.5px solid var(--gray-200)' }}
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleCompanyNameSave}
                                disabled={companyLoading || !editCompanyName.trim()}
                                style={{ minWidth: '120px', height: '42px' }}
                            >
                                {companyLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        <span>Simpan...</span>
                                    </>
                                ) : (
                                    '💾 Simpan'
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ============ THEME COLOR SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title">🎨 Kustomisasi Warna Tema</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {themeMessage.text && (
                            <div className={`alert alert-${themeMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{themeMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                {themeMessage.text}
                            </div>
                        )}

                        {/* Color Presets */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: 'var(--gray-600)',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                            }}>
                                Pilih Tema Preset
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                {THEME_PRESETS.map((preset, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handlePresetSelect(index)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '1rem 0.75rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: activePreset === index
                                                ? `2.5px solid ${preset.primary}`
                                                : '2px solid var(--gray-200)',
                                            background: activePreset === index
                                                ? `linear-gradient(135deg, ${preset.bg}, white)`
                                                : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s ease',
                                            transform: activePreset === index ? 'scale(1.03)' : 'scale(1)',
                                            boxShadow: activePreset === index
                                                ? `0 4px 16px ${preset.primary}30`
                                                : 'var(--shadow-sm)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Color swatch */}
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${preset.primary}, ${preset.primary}cc)`,
                                            boxShadow: `0 2px 8px ${preset.primary}40`,
                                            border: '3px solid white',
                                            transition: 'transform 0.3s ease',
                                            transform: activePreset === index ? 'scale(1.1)' : 'scale(1)',
                                        }} />
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            color: activePreset === index ? preset.primary : 'var(--gray-600)',
                                            textAlign: 'center',
                                            lineHeight: 1.2,
                                        }}>
                                            {preset.name}
                                        </span>
                                        {/* Active check */}
                                        {activePreset === index && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '6px',
                                                right: '6px',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                background: preset.primary,
                                                color: 'white',
                                                fontSize: '0.6rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                            }}>✓</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Color Pickers */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1.25rem',
                            marginBottom: '1.5rem'
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Utama (Sidebar)
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedPrimary}
                                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedPrimary}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Sidebar, header, aksen
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Background
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedBg}
                                        onChange={(e) => handleCustomColorChange('bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Latar belakang halaman
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Card / Form BG Color */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Dasar Card/Form
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedCardBg}
                                        onChange={(e) => handleCustomColorChange('card_bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedCardBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Form input & master
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Button BG Color */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Tombol
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedBtnBg}
                                        onChange={(e) => handleCustomColorChange('btn_bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedBtnBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Tombol aksi utama
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid var(--gray-200)',
                            background: 'var(--gray-50)'
                        }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--gray-500)',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Preview Tema
                            </label>
                            <div style={{
                                display: 'flex',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-md)',
                                height: '90px',
                            }}>
                                {/* Mini sidebar preview */}
                                <div style={{
                                    width: '60px',
                                    background: `linear-gradient(180deg, ${selectedPrimary}, ${selectedPrimary}cc)`,
                                    padding: '0.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
                                </div>
                                {/* Mini content preview */}
                                <div style={{
                                    flex: 1,
                                    background: selectedBg,
                                    padding: '0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                }}>
                                    <div style={{ width: '40%', height: '8px', borderRadius: '3px', background: selectedPrimary, opacity: 0.8 }} />
                                    <div style={{ width: '60%', height: '5px', borderRadius: '2px', background: 'var(--gray-300)' }} />
                                    <div style={{
                                        flex: 1,
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '0.3rem',
                                        marginTop: '0.25rem'
                                    }}>
                                        <div style={{ borderRadius: '4px', background: selectedCardBg, border: '1px solid var(--gray-200)' }} />
                                        <div style={{ borderRadius: '4px', background: selectedCardBg, border: '1px solid var(--gray-200)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleThemeSave}
                                disabled={themeLoading}
                                style={{ flex: 1 }}
                            >
                                {themeLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    '💾 Simpan Tema'
                                )}
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={handleThemeReset}
                                disabled={themeLoading}
                                style={{ minWidth: '140px' }}
                            >
                                🔄 Reset Default
                            </button>
                        </div>
                    </div>
                </div>


                {/* ============ LOGO SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">🖼️ Manajemen Logo</h2>
                    </div>
                    
                    <div style={{ padding: '0 0.5rem' }}>
                        <LogoUploader 
                            title="Logo Utama Aplikasi" 
                            type="app_logo" 
                            currentLogoUrl={settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />
                        
                        <LogoUploader 
                            title="Logo Login Page" 
                            type="login_logo" 
                            currentLogoUrl={settings.login_logo || settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />
                        
                        <LogoUploader 
                            title="Favicon (Ikon Tab Browser)" 
                            type="favicon_logo" 
                            currentLogoUrl={settings.favicon_logo || settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />
                    </div>
                </div>

                {/* ============ SMTP SETTINGS SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📧 Konfigurasi SMTP Email</h2>
                    </div>

                    <div style={{ padding: '1.5rem 0' }}>
                        {smtpMessage.text && (
                            <div className={`alert alert-${smtpMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{smtpMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                {smtpMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleSmtpSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">SMTP Host</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Contoh: smtp.gmail.com"
                                        value={smtpSettings.smtp_host}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SMTP Port</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Contoh: 587 atau 465"
                                        value={smtpSettings.smtp_port}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Username (Email)</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="Alamat Email"
                                        value={smtpSettings.smtp_user}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password / App Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Password"
                                        value={smtpSettings.smtp_pass}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_pass: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={smtpSettings.smtp_secure}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_secure: e.target.checked })}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Gunakan SSL/TLS (Secure)</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Biasanya dicentang jika menggunakan port 465</div>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={smtpLoading}
                            >
                                {smtpLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    '💾 Simpan SMTP'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ============ BACKUP & RESTORE SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title">💾 Backup & Restore Database</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1.25rem' }}>
                            Unduh salinan database dari aplikasi yang datanya ingin disalin, lalu restore di sini.
                            Restore akan menghapus seluruh data lokal dan menggantinya dengan isi file backup.
                            File upload di folder server (foto absensi, logo, dll.) tidak ikut ter-backup.
                        </p>

                        {/* Backup */}
                        <div style={{
                            padding: '1.25rem',
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1.25rem',
                            background: 'var(--gray-50)'
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--gray-800)' }}>
                                Backup Database
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                Menghasilkan file SQL data lengkap (siap dipakai untuk restore di aplikasi ini).
                            </p>
                            {backupMessage.text && (
                                <div className={`alert alert-${backupMessage.type}`} style={{ marginBottom: '1rem' }}>
                                    <span className="alert-icon">{backupMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                    {backupMessage.text}
                                </div>
                            )}
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleBackupDownload}
                                disabled={backupLoading || restoreLoading}
                            >
                                {backupLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Membuat backup...</span>
                                    </>
                                ) : (
                                    '⬇️ Unduh Backup (.sql)'
                                )}
                            </button>
                        </div>

                        {/* Restore */}
                        <div style={{
                            padding: '1.25rem',
                            border: '1px solid #fecaca',
                            borderRadius: 'var(--radius-md)',
                            background: '#fff5f5'
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#991b1b' }}>
                                Restore Database (Menimpa Data)
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: '#b91c1c', marginBottom: '1rem' }}>
                                Perhatian: semua data saat ini akan diganti dengan isi file backup. Tindakan ini tidak bisa dibatalkan.
                            </p>
                            {restoreMessage.text && (
                                <div className={`alert alert-${restoreMessage.type}`} style={{ marginBottom: '1rem' }}>
                                    <span className="alert-icon">{restoreMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                    {restoreMessage.text}
                                </div>
                            )}
                            <form onSubmit={handleRestore}>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">File Backup (.sql / .dump)</label>
                                    <input
                                        type="file"
                                        className="form-input"
                                        accept=".sql,.dump,.backup,.json"
                                        disabled={restoreLoading || backupLoading}
                                        onChange={(e) => {
                                            setRestoreFile(e.target.files?.[0] || null);
                                            setRestoreMessage({ type: '', text: '' });
                                        }}
                                    />
                                    {restoreFile && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.35rem' }}>
                                            Dipilih: {restoreFile.name} ({Math.round(restoreFile.size / 1024)} KB)
                                        </p>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">
                                        Ketik <strong>TIMPA</strong> untuk konfirmasi
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={restoreConfirm}
                                        onChange={(e) => setRestoreConfirm(e.target.value)}
                                        placeholder="TIMPA"
                                        disabled={restoreLoading || backupLoading}
                                        autoComplete="off"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-danger"
                                    disabled={restoreLoading || backupLoading || !restoreFile || restoreConfirm.trim().toUpperCase() !== 'TIMPA'}
                                >
                                    {restoreLoading ? (
                                        <>
                                            <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                            <span>Merestore...</span>
                                        </>
                                    ) : (
                                        '⚠️ Restore & Timpa Database'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* ============ LEAVE SETTINGS SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">🏖️ Pengaturan Cuti & Izin</h2>
                    </div>

                    <div style={{ padding: '1.5rem 0' }}>
                        {leaveMessage.text && (
                            <div className={`alert alert-${leaveMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{leaveMessage.type === 'success' ? '✅' : '⚠️'}</span>
                                {leaveMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleLeaveSave}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Kuota Cuti Tahunan Standar (Hari)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={leaveSettings.annual_leave_quota}
                                    onChange={(e) => setLeaveSettings({ ...leaveSettings, annual_leave_quota: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    required
                                />
                                <small style={{ color: 'var(--gray-500)', marginTop: '0.25rem', display: 'block' }}>
                                    Jumlah hari cuti yang didapatkan setiap tahun.
                                </small>
                            </div>

                            <div style={{
                                padding: '1.25rem',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--gray-200)',
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--gray-800)' }}>Aturan Potong Cuti</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                    Aktifkan toggle di bawah jika pengajuan izin berikut akan mengurangi sisa kuota cuti karyawan.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.sick_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, sick_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Sakit Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin sakit akan mengurangi kuota cuti tahunan</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.permission_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, permission_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Tidak Masuk Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin seharian (keperluan lain) akan mengurangi cuti</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.late_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, late_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Terlambat Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin datang terlambat akan mengurangi cuti</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{
                                padding: '1.25rem',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--gray-200)',
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--gray-800)' }}>Tingkat Approval Izin & Cuti</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                    1 tingkat = cukup atasan langsung. 2+ tingkat = bertingkat mengikuti struktur organisasi (atasan → atasan dari atasan). Jika rantai atasan kurang, dilanjutkan ke Admin/HR.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {[
                                        { type: 'late', label: '⏰ Izin Terlambat' },
                                        { type: 'sick', label: '🏥 Izin Sakit' },
                                        { type: 'permission', label: '📝 Izin Tidak Masuk' },
                                        { type: 'leave', label: '🏖️ Cuti' },
                                        { type: 'change_off', label: '🔄 Tukar Libur' }
                                    ].map((item) => {
                                        const cfg = approvalConfig.find((c) => c.leave_type === item.type) || { approval_levels: 1, fallback_to_admin: true };
                                        return (
                                            <div key={item.type} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.4fr 160px 1fr',
                                                gap: '0.75rem',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: 'white',
                                                border: '1px solid var(--gray-200)',
                                                borderRadius: 'var(--radius-md)'
                                            }}>
                                                <div style={{ fontWeight: 600 }}>{item.label}</div>
                                                <select
                                                    className="form-input form-select"
                                                    value={cfg.approval_levels}
                                                    onChange={(e) => setApprovalConfig((prev) => prev.map((c) =>
                                                        c.leave_type === item.type
                                                            ? { ...c, approval_levels: parseInt(e.target.value, 10) }
                                                            : c
                                                    ))}
                                                >
                                                    <option value={1}>1 tingkat</option>
                                                    <option value={2}>2 tingkat</option>
                                                    <option value={3}>3 tingkat</option>
                                                </select>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={cfg.fallback_to_admin !== false}
                                                        onChange={(e) => setApprovalConfig((prev) => prev.map((c) =>
                                                            c.leave_type === item.type
                                                                ? { ...c, fallback_to_admin: e.target.checked }
                                                                : c
                                                        ))}
                                                    />
                                                    Lanjut ke Admin/HR jika atasan tidak lengkap
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', color: 'var(--gray-800)' }}>Bonus Cuti Besar</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Tambahan kuota cuti di tahun tertentu berdasarkan masa kerja.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={addBigLeaveRule}
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                    >
                                        + Tambah Aturan
                                    </button>
                                </div>

                                {bigLeaveRules.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px dashed var(--gray-300)' }}>
                                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', margin: 0 }}>Belum ada aturan cuti besar.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {bigLeaveRules.map((rule, index) => (
                                            <div key={index} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto auto',
                                                gap: '1rem',
                                                alignItems: 'end',
                                                padding: '1rem',
                                                background: 'white',
                                                border: '1px solid var(--gray-200)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', display: 'block', marginBottom: '0.25rem' }}>Masa Kerja (Tahun)</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={rule.min_years}
                                                        onChange={(e) => updateBigLeaveRule(index, 'min_years', parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', display: 'block', marginBottom: '0.25rem' }}>Bonus Kuota (Hari)</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={rule.leave_days}
                                                        onChange={(e) => updateBigLeaveRule(index, 'leave_days', parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={rule.is_active}
                                                            onChange={(e) => updateBigLeaveRule(index, 'is_active', e.target.checked)}
                                                        />
                                                        <span style={{ fontSize: '0.85rem' }}>Aktif</span>
                                                    </label>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger"
                                                    onClick={() => removeBigLeaveRule(index)}
                                                    style={{ height: '42px', padding: '0 1rem' }}
                                                    title="Hapus"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled={leaveLoading}
                            >
                                {leaveLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan Pengaturan Cuti'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
