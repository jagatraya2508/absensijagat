import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Careers() {
    const { settings } = useSettings();
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPosition, setSelectedPosition] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        education: '',
        experience_years: '',
        source: 'website',
        resume: null
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formMessage, setFormMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchPositions();
    }, []);

    const fetchPositions = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/api/recruitment/public/positions`);
            if (res.ok) {
                const data = await res.json();
                setPositions(data);
            }
        } catch (error) {
            console.error('Failed to fetch positions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyClick = (position) => {
        setSelectedPosition(position);
        setFormMessage({ type: '', text: '' });
        setFormData({
            full_name: '',
            email: '',
            phone: '',
            address: '',
            education: '',
            experience_years: '',
            source: 'website',
            resume: null
        });
    };

    const handleCloseModal = () => {
        setSelectedPosition(null);
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, resume: e.target.files[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setFormMessage({ type: '', text: '' });

        try {
            const data = new FormData();
            data.append('applied_position_id', selectedPosition.id);
            Object.keys(formData).forEach(key => {
                if (key !== 'resume' && key !== 'resumes' && formData[key] !== null && formData[key] !== undefined) {
                    data.append(key, formData[key]);
                }
            });

            if (formData.resumes) {
                for (let i = 0; i < formData.resumes.length; i++) {
                    data.append('resume', formData.resumes[i]);
                }
            } else if (formData.resume) {
                data.append('resume', formData.resume);
            }

            const res = await fetch(`${API}/api/recruitment/public/candidates`, {
                method: 'POST',
                body: data
            });

            const result = await res.json();

            if (res.ok) {
                setFormMessage({ type: 'success', text: 'Lamaran Anda berhasil dikirim! Tim HR kami akan segera menghubungi Anda jika Anda memenuhi kualifikasi.' });
                setFormData({
                    full_name: '', email: '', phone: '', address: '', education: '', experience_years: '', source: 'website', resume: null
                });
                setTimeout(() => {
                    handleCloseModal();
                }, 3000);
            } else {
                setFormMessage({ type: 'danger', text: result.error || 'Terjadi kesalahan saat mengirim lamaran.' });
            }
        } catch (error) {
            console.error('Submit error:', error);
            setFormMessage({ type: 'danger', text: 'Terjadi kesalahan koneksi.' });
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-50)', fontFamily: 'var(--font-family)', color: 'var(--gray-800)' }}>
            {/* Header */}
            <header style={{ background: 'white', padding: '1rem 2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {settings?.app_logo ? (
                        <img src={settings.app_logo} alt="Company Logo" style={{ height: '40px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-600)' }}>COMPANY</div>
                    )}
                </div>
                <div style={{ fontWeight: 600, color: 'var(--gray-600)' }}>
                    Karir & Lowongan
                </div>
            </header>

            {/* Hero Section */}
            <div style={{ background: 'var(--primary-600)', color: 'white', padding: '4rem 2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: 'white' }}>Mari Bergabung Bersama Kami</h1>
                <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', opacity: 0.9 }}>
                    Temukan peluang karir terbaik dan jadilah bagian dari perjalanan luar biasa kami. Kami selalu mencari talenta-talenta hebat.
                </p>
            </div>

            {/* Main Content */}
            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 1rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>Lowongan Terbuka ({positions.length})</h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="loading-spinner" style={{ borderColor: 'var(--primary-600)', borderRightColor: 'transparent' }} />
                    </div>
                ) : positions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '1rem', border: '1px dashed var(--gray-300)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Belum Ada Lowongan</h3>
                        <p style={{ color: 'var(--gray-500)' }}>Maaf, saat ini belum ada posisi yang terbuka. Silakan kunjungi kembali halaman ini nanti.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {positions.map(pos => (
                            <div key={pos.id} style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: '1', minWidth: '250px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{pos.title}</h3>
                                        <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{pos.employment_type}</span>
                                    </div>
                                    <div style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        {pos.department && <span>🏢 {pos.department}</span>}
                                        {(pos.salary_range_min || pos.salary_range_max) && (
                                            <span>
                                                💰 {pos.salary_range_min ? `Rp ${Number(pos.salary_range_min).toLocaleString('id-ID')}` : ''}
                                                {pos.salary_range_min && pos.salary_range_max ? ' - ' : ''}
                                                {pos.salary_range_max ? `Rp ${Number(pos.salary_range_max).toLocaleString('id-ID')}` : ''}
                                            </span>
                                        )}
                                        <span>🕒 Diposting: {new Date(pos.created_at).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    {pos.description && (
                                        <div style={{ fontSize: '0.95rem', color: 'var(--gray-700)', marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                                            {pos.description}
                                        </div>
                                    )}
                                    {pos.requirements && (
                                        <div>
                                            <strong style={{ fontSize: '0.9rem', color: 'var(--gray-900)' }}>Persyaratan:</strong>
                                            <div style={{ fontSize: '0.95rem', color: 'var(--gray-700)', whiteSpace: 'pre-line', marginTop: '0.25rem' }}>
                                                {pos.requirements}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ minWidth: '150px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleApplyClick(pos)}
                                        className="btn btn-primary"
                                        style={{ width: '100%', padding: '0.8rem 1.5rem', fontSize: '1rem', borderRadius: '2rem' }}
                                    >
                                        Lamar Sekarang
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={{ background: 'white', padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--gray-200)', marginTop: '4rem', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                <p>&copy; {new Date().getFullYear()} Hak Cipta Dilindungi.</p>
            </footer>

            {/* Apply Modal */}
            {selectedPosition && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', background: 'white' }}>
                        <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)', position: 'sticky', top: 0, zIndex: 1 }}>
                            <h2 className="modal-title" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--gray-900)' }}>
                                Lamar Posisi: {selectedPosition.title}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
                        </div>
                        
                        <div style={{ padding: '1.5rem' }}>
                            {formMessage.text && (
                                <div className={`alert alert-${formMessage.type}`} style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.5rem', background: formMessage.type === 'success' ? 'var(--success-50)' : 'var(--danger-50)', color: formMessage.type === 'success' ? 'var(--success-800)' : 'var(--danger-800)', border: `1px solid ${formMessage.type === 'success' ? 'var(--success-200)' : 'var(--danger-200)'}` }}>
                                    {formMessage.text}
                                </div>
                            )}

                            {!formMessage.text || formMessage.type !== 'success' ? (
                                <form onSubmit={handleSubmit}>
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Nama Lengkap *</label>
                                            <input type="text" className="form-input" value={formData.full_name} required
                                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Email *</label>
                                                <input type="email" className="form-input" value={formData.email} required
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>No. WhatsApp / Telepon *</label>
                                                <input type="text" className="form-input" value={formData.phone} required
                                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Pendidikan Terakhir</label>
                                                <input type="text" className="form-input" value={formData.education} placeholder="Contoh: S1 Teknik Informatika"
                                                    onChange={e => setFormData({ ...formData, education: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Pengalaman (Tahun)</label>
                                                <input type="number" className="form-input" value={formData.experience_years} min="0" placeholder="0"
                                                    onChange={e => setFormData({ ...formData, experience_years: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Domisili / Alamat</label>
                                            <textarea className="form-input" rows="2" value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem' }} />
                                        </div>

                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--gray-700)' }}>Upload CV & Dokumen Lain (PDF/Word/Image) *</label>
                                            <input type="file" className="form-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple required
                                                onChange={e => setFormData({ ...formData, resumes: e.target.files })}
                                                style={{ width: '100%', padding: '0.5rem', border: '1px dashed var(--gray-400)', borderRadius: '0.5rem', background: 'var(--gray-50)' }} />
                                            <small style={{ color: 'var(--gray-500)', marginTop: '0.25rem', display: 'block' }}>Bisa lebih dari 1 file (Maks 5MB per file)</small>
                                        </div>

                                        <div style={{ marginTop: '1rem' }}>
                                            <button 
                                                type="submit" 
                                                className="btn btn-primary" 
                                                disabled={formLoading}
                                                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                            >
                                                {formLoading ? (
                                                    <>
                                                        <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderColor: 'white', borderRightColor: 'transparent' }} />
                                                        <span>Mengirim...</span>
                                                    </>
                                                ) : 'Kirim Lamaran'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
