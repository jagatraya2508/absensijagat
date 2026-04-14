import { useState, useEffect, useRef, useMemo } from 'react';
import { faceAPI } from '../utils/api';
import useFaceApi from '../hooks/useFaceApi';

export default function AdminFaceRegistration() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'employee_id', direction: 'asc' });
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'registered', 'unregistered'

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const { modelsLoaded, loading: modelsLoading, detectFaceFromImage } = useFaceApi();

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        // Cleanup stream on unmount
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    async function fetchUsers() {
        setLoading(true);
        try {
            const data = await faceAPI.getUsersStatus();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    }

    // Sort handler
    function handleSort(key) {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }

    function getSortIcon(key) {
        if (sortConfig.key !== key) return '⇅';
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    }

    // Filtered & sorted users
    const filteredUsers = useMemo(() => {
        let result = users.filter(u =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.employee_id.toLowerCase().includes(search.toLowerCase())
        );

        // Apply status filter
        if (filterStatus === 'registered') {
            result = result.filter(u => u.has_face);
        } else if (filterStatus === 'unregistered') {
            result = result.filter(u => !u.has_face);
        }

        // Sort
        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aVal, bVal;

                if (sortConfig.key === 'has_face') {
                    aVal = a.has_face ? 1 : 0;
                    bVal = b.has_face ? 1 : 0;
                } else {
                    aVal = (a[sortConfig.key] || '').toString().toLowerCase();
                    bVal = (b[sortConfig.key] || '').toString().toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [users, search, sortConfig, filterStatus]);

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setError('Gagal mengakses kamera: ' + err.message);
        }
    }

    function stopCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }

    async function handleOpenCamera(user) {
        console.log('Opening camera for user:', user);
        setSelectedUser(user);
        setShowCamera(true);
        setError('');
        setSuccess('');

        // Scroll to top so admin can see the camera card
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Wait for video element to mount
        setTimeout(() => {
            console.log('Starting camera...');
            startCamera();
        }, 300); // Increased delay to ensure mount
    }

    function handleCloseCamera() {
        stopCamera();
        setShowCamera(false);
        setSelectedUser(null);
    }

    async function handleCapture() {
        if (!videoRef.current || !canvasRef.current || !modelsLoaded) {
            setError('Kamera atau model belum siap');
            return;
        }

        setProcessing(true);
        setError('');

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current frame
            ctx.drawImage(video, 0, 0);

            // Get image data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

            // Detect face
            const detection = await detectFaceFromImage(dataUrl);

            if (!detection) {
                setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas.');
                setProcessing(false);
                return;
            }

            // Register face
            await faceAPI.register(selectedUser.id, detection.descriptor);

            setSuccess(`Wajah ${selectedUser.name} berhasil didaftarkan!`);

            // Refresh users list
            await fetchUsers();

            // Close camera after success
            setTimeout(() => {
                handleCloseCamera();
            }, 1500);
        } catch (err) {
            console.error('Face registration error:', err);
            setError(err.message || 'Gagal mendaftarkan wajah');
        } finally {
            setProcessing(false);
        }
    }

    async function handleDeleteFace(user) {
        if (!window.confirm(`Hapus registrasi wajah ${user.name}?`)) {
            return;
        }

        try {
            await faceAPI.delete(user.id);
            setSuccess(`Registrasi wajah ${user.name} berhasil dihapus`);
            fetchUsers();
        } catch (err) {
            setError(err.message || 'Gagal menghapus registrasi wajah');
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔐 Registrasi Wajah Karyawan</h1>
                <p className="page-subtitle">Daftarkan wajah karyawan untuk verifikasi absensi</p>
            </div>

            {modelsLoading && (
                <div className="alert alert-info mb-3">
                    <span className="alert-icon">⏳</span>
                    Memuat model face recognition... Mohon tunggu.
                </div>
            )}

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

            {/* Camera Modal */}
            {showCamera && selectedUser && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary-500)' }}>
                    <div className="card-header">
                        <h2 className="card-title">📸 Daftarkan Wajah: {selectedUser.name}</h2>
                        <button className="btn btn-outline" onClick={handleCloseCamera}>✕</button>
                    </div>

                    <div style={{ position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                borderRadius: 'var(--radius-lg)',
                                transform: 'scaleX(-1)'
                            }}
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Face guide overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 200,
                            height: 260,
                            border: '3px dashed rgba(255,255,255,0.5)',
                            borderRadius: '50%',
                            pointerEvents: 'none'
                        }} />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleCapture}
                            disabled={processing || !modelsLoaded}
                        >
                            {processing ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                    Memproses...
                                </>
                            ) : (
                                '📸 Ambil Foto & Daftarkan'
                            )}
                        </button>
                    </div>

                    <p className="text-muted text-center mt-2" style={{ fontSize: '0.85rem' }}>
                        Posisikan wajah karyawan di dalam lingkaran, pastikan pencahayaan cukup
                    </p>
                </div>
            )}

            {/* Users List */}
            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">👥 Daftar Karyawan</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Cari karyawan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: 200 }}
                        />
                        <select
                            className="form-input form-select"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            style={{ maxWidth: 170 }}
                        >
                            <option value="all">Semua Status</option>
                            <option value="registered">✅ Terdaftar</option>
                            <option value="unregistered">❌ Belum Terdaftar</option>
                        </select>
                        <span className="badge badge-primary">
                            {users.filter(u => u.has_face).length}/{users.length} Terdaftar
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <p className="empty-state-text">
                            {search || filterStatus !== 'all' ? 'Tidak ada karyawan yang cocok' : 'Belum ada karyawan terdaftar'}
                        </p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('employee_id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Employee ID <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'employee_id' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('employee_id')}</span>
                                    </th>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Nama <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'name' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('name')}</span>
                                    </th>
                                    <th onClick={() => handleSort('has_face')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Status Wajah <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'has_face' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('has_face')}</span>
                                    </th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.employee_id}</td>
                                        <td>{user.name}</td>
                                        <td>
                                            {user.has_face ? (
                                                <span className="badge badge-success">✅ Terdaftar</span>
                                            ) : (
                                                <span className="badge badge-danger">❌ Belum</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                                                    onClick={() => handleOpenCamera(user)}
                                                    disabled={showCamera || modelsLoading}
                                                >
                                                    {modelsLoading ? '⌛' : '📸'} {user.has_face ? 'Perbarui' : 'Daftarkan'}
                                                </button>
                                                {user.has_face && (
                                                    <button
                                                        className="btn btn-danger"
                                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                                                        onClick={() => handleDeleteFace(user)}
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
