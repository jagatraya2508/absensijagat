import { useState, useRef } from 'react';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import Camera from '../components/Camera';

export default function ChangePassword() {
    const { user, setUser } = useAuth();

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const fileInputRef = useRef(null);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    function applySelectedFile(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Hanya file gambar yang diperbolehkan');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Ukuran gambar maksimal 5MB');
            return;
        }
        if (photoPreview && photoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setShowCamera(false);
        setError('');
        setSuccess('');
    }

    function handlePhotoChange(e) {
        applySelectedFile(e.target.files?.[0]);
        e.target.value = '';
    }

    function handleCameraCapture(blob, dataUrl) {
        if (!blob) {
            setError('Gagal mengambil foto dari kamera');
            return;
        }
        const file = new File([blob], 'profil-kamera.jpg', { type: blob.type || 'image/jpeg' });
        if (photoPreview && photoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(file);
        setPhotoPreview(dataUrl || URL.createObjectURL(file));
        setShowCamera(false);
        setError('');
        setSuccess('');
    }

    async function handlePhotoUpload() {
        if (!photoFile) return;

        setError('');
        setSuccess('');
        setPhotoLoading(true);

        try {
            const formData = new FormData();
            formData.append('photo', photoFile);

            const updatedUser = await authAPI.updateProfilePhoto(formData);
            setUser(updatedUser);
            setSuccess('Foto profil berhasil diperbarui');
            setPhotoFile(null);
        } catch (err) {
            setError(err.message || 'Gagal mengupload foto profil');
        } finally {
            setPhotoLoading(false);
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="User" size={16} inline /> Profil Saya</h1>
                <p className="page-subtitle">Kelola foto profil Anda</p>
            </div>

            <div className="card" style={{ maxWidth: 600, margin: '0 auto', marginBottom: '2rem' }}>
                {error && (
                    <div className="alert alert-danger mb-3">
                        <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="alert alert-success mb-3">
                        <span className="alert-icon"><Icon name="Check" size={16} inline /></span>
                        {success}
                    </div>
                )}

                <div style={{ padding: '1rem', textAlign: 'center' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>Foto Profil</h3>

                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '3px solid var(--theme-primary-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem',
                            color: 'white',
                            overflow: 'hidden',
                            margin: '0 auto',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : user?.photo ? (
                                <img src={user.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                user?.name?.charAt(0) || '?'
                            )}
                        </div>
                    </div>

                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,image/webp"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                    />

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={photoLoading}
                        >
                            <Icon name="Image" size={16} inline /> Pilih Foto
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => {
                                setShowCamera(true);
                                setError('');
                                setSuccess('');
                            }}
                            disabled={photoLoading}
                        >
                            <Icon name="Camera" size={16} inline /> Ambil dari Kamera
                        </button>
                        {photoFile && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handlePhotoUpload}
                                disabled={photoLoading}
                            >
                                {photoLoading ? 'Mengupload...' : 'Simpan Foto'}
                            </button>
                        )}
                    </div>
                    <p style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                        Pilih dari galeri/file, atau foto langsung lewat kamera HP/webcam.
                    </p>
                </div>
            </div>

            {showCamera && (
                <div className="modal-overlay" onClick={() => setShowCamera(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '94%' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Ambil Foto Profil</h2>
                            <button type="button" className="modal-close" onClick={() => setShowCamera(false)}>
                                <Icon name="X" size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
                            <Camera
                                onCapture={handleCameraCapture}
                                onReset={() => {
                                    setPhotoFile(null);
                                }}
                            />
                            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--gray-500)', textAlign: 'center' }}>
                                Izinkan akses kamera di browser, lalu tekan tombol shutter.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
