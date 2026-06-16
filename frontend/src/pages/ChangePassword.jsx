import { useState, useRef } from 'react';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword() {
    const { user, setUser } = useAuth();
    
    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    
    // Photo state
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Common state
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handlePasswordSubmit(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Semua field harus diisi');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password baru minimal 6 karakter');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Konfirmasi password tidak cocok');
            return;
        }

        setPasswordLoading(true);

        try {
            const result = await authAPI.changePassword(currentPassword, newPassword);
            setSuccess(result.message || 'Password berhasil diubah');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.message || 'Gagal mengubah password');
        } finally {
            setPasswordLoading(false);
        }
    }

    function handlePhotoChange(e) {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Hanya file gambar yang diperbolehkan');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('Ukuran gambar maksimal 5MB');
                return;
            }
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
            setError('');
            setSuccess('');
        }
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
                <h1 className="page-title">👤 Profil Saya</h1>
                <p className="page-subtitle">Kelola foto profil dan password akun Anda</p>
            </div>

            <div className="card" style={{ maxWidth: 600, margin: '0 auto', marginBottom: '2rem' }}>
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

                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', textAlign: 'center' }}>
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

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                        <input 
                            type="file" 
                            accept="image/jpeg, image/png, image/jpg" 
                            style={{ display: 'none' }} 
                            ref={fileInputRef}
                            onChange={handlePhotoChange}
                        />
                        <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={photoLoading}
                        >
                            Pilih Foto
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
                </div>

                <div style={{ padding: '1rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>Ubah Password</h3>
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="form-group">
                            <label className="form-label">Password Lama</label>
                            <input
                                type="password"
                                className="form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Masukkan password lama"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password Baru</label>
                            <input
                                type="password"
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimal 6 karakter"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Konfirmasi Password Baru</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Ulangi password baru"
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={passwordLoading}
                            >
                                {passwordLoading ? 'Menyimpan...' : 'Ubah Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
