import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const THEME_PRESETS = [
    { name: 'Merah Marun', icon: '🔴', primary: '#6D0000', bg: '#fff8f8' },
    { name: 'Biru Navy', icon: '🔵', primary: '#0A1929', bg: '#f0f4ff' },
    { name: 'Hijau Emerald', icon: '🟢', primary: '#064E3B', bg: '#f0fdf4' },
    { name: 'Ungu Royal', icon: '🟣', primary: '#4C1D95', bg: '#faf5ff' },
    { name: 'Slate Dark', icon: '⚫', primary: '#1E293B', bg: '#f8fafc' },
    { name: 'Amber Gold', icon: '🟠', primary: '#78350F', bg: '#fffbeb' },
];

export default function AdminSettings() {
    const { settings, updateLogo, themeColors, updateTheme, previewTheme, resetPreview, DEFAULT_THEME } = useSettings();
    const [logoFile, setLogoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(settings.app_logo);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Theme state
    const [selectedPrimary, setSelectedPrimary] = useState(themeColors.primary);
    const [selectedBg, setSelectedBg] = useState(themeColors.bg);
    const [themeLoading, setThemeLoading] = useState(false);
    const [themeMessage, setThemeMessage] = useState({ type: '', text: '' });
    const [activePreset, setActivePreset] = useState(null);

    // Sync when themeColors change (e.g. after save)
    useEffect(() => {
        setSelectedPrimary(themeColors.primary);
        setSelectedBg(themeColors.bg);
        // find active preset
        const match = THEME_PRESETS.findIndex(
            p => p.primary.toLowerCase() === themeColors.primary.toLowerCase() && p.bg.toLowerCase() === themeColors.bg.toLowerCase()
        );
        setActivePreset(match >= 0 ? match : null);
    }, [themeColors]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setMessage({ type: 'danger', text: 'Ukuran file maksimal 2MB' });
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
            setMessage({ type: '', text: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!logoFile) {
            setMessage({ type: 'danger', text: 'Silakan pilih file logo terlebih dahulu' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        const formData = new FormData();
        formData.append('logo', logoFile);

        try {
            await updateLogo(formData);
            setMessage({ type: 'success', text: 'Logo berhasil diperbarui' });
            setLogoFile(null);
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || 'Gagal memperbarui logo' });
        } finally {
            setLoading(false);
        }
    };

    // Theme handlers
    const handlePresetSelect = (index) => {
        const preset = THEME_PRESETS[index];
        setActivePreset(index);
        setSelectedPrimary(preset.primary);
        setSelectedBg(preset.bg);
        previewTheme({ primary: preset.primary, bg: preset.bg });
    };

    const handleCustomColorChange = (field, value) => {
        setActivePreset(null);
        if (field === 'primary') {
            setSelectedPrimary(value);
            previewTheme({ primary: value, bg: selectedBg });
        } else {
            setSelectedBg(value);
            previewTheme({ primary: selectedPrimary, bg: value });
        }
    };

    const handleThemeSave = async () => {
        setThemeLoading(true);
        setThemeMessage({ type: '', text: '' });
        try {
            await updateTheme({ primary: selectedPrimary, bg: selectedBg });
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
        setActivePreset(0);
        previewTheme({ primary: DEFAULT_THEME.primary, bg: DEFAULT_THEME.bg });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">⚙️ Pengaturan Aplikasi</h1>
                <p className="page-subtitle">Kelola konfigurasi sistem dan tampilan</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '800px' }}>

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
                            gridTemplateColumns: '1fr 1fr',
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
                                        <div style={{ borderRadius: '4px', background: 'rgba(255,255,255,0.8)', border: '1px solid var(--gray-200)' }} />
                                        <div style={{ borderRadius: '4px', background: 'rgba(255,255,255,0.8)', border: '1px solid var(--gray-200)' }} />
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
                        <h2 className="card-title">Ganti Logo Aplikasi</h2>
                    </div>

                    <div style={{ padding: '1.5rem 0' }}>
                        {message.text && (
                            <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{message.type === 'success' ? '✅' : '⚠️'}</span>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--gray-400)', marginBottom: '0.75rem' }}>
                                    Preview Logo Saat Ini:
                                </p>
                                <div style={{
                                    border: '2px dashed rgba(255, 255, 255, 0.1)',
                                    borderRadius: '1rem',
                                    padding: '2.5rem',
                                    display: 'inline-block',
                                    background: 'rgba(255, 255, 255, 0.03)'
                                }}>
                                    <img
                                        src={previewUrl}
                                        alt="Preview Logo"
                                        style={{ maxHeight: '120px', width: 'auto', borderRadius: '0.5rem' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="logo">
                                    Pilih File Logo Baru (PNG, JPG, SVG)
                                </label>
                                <input
                                    type="file"
                                    id="logo"
                                    className="form-input"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                                    Ukuran file maksimal: 2MB. Disarankan aspek rasio 1:1 atau horizontal.
                                </p>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1rem' }}
                                disabled={loading || !logoFile}
                            >
                                {loading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan Perubahan Logo'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
