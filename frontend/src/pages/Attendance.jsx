import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Camera from '../components/Camera';
import LocationTracker from '../components/LocationTracker';
import { attendanceAPI, locationsAPI, faceAPI } from '../utils/api';
import useFaceApi from '../hooks/useFaceApi';

export default function Attendance() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const type = searchParams.get('type') || 'check-in';
    const isCheckIn = type === 'check-in';

    const [step, setStep] = useState(1); // 1: Camera, 2: Verifying, 3: Confirm & Submit
    const [photo, setPhoto] = useState(null);
    const [photoBlob, setPhotoBlob] = useState(null);
    const [location, setLocation] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userManuallySelected, setUserManuallySelected] = useState(false);
    const [currentDistance, setCurrentDistance] = useState(null);
    const hasAttemptedAutoSubmit = useRef(false);

    // Face verification states
    const [hasFaceRegistered, setHasFaceRegistered] = useState(null);
    const [faceVerified, setFaceVerified] = useState(false);
    const [faceVerifying, setFaceVerifying] = useState(false);
    const [faceSimilarity, setFaceSimilarity] = useState(null);
    const [storedDescriptor, setStoredDescriptor] = useState(null);

    const { modelsLoaded, loading: modelsLoading, detectFaceFromImage, compareFaces } = useFaceApi();

    useEffect(() => {
        fetchLocations();
        checkFaceStatus();
    }, []);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        if (location && locations.length > 1 && !userManuallySelected) {
            let closestLoc = locations[0];
            let minDist = calculateDistance(location.latitude, location.longitude, parseFloat(locations[0].latitude), parseFloat(locations[0].longitude));
            
            for (let i = 1; i < locations.length; i++) {
                const dist = calculateDistance(location.latitude, location.longitude, parseFloat(locations[i].latitude), parseFloat(locations[i].longitude));
                if (dist < minDist) {
                    minDist = dist;
                    closestLoc = locations[i];
                }
            }
            
            if (!selectedLocation || selectedLocation.id !== closestLoc.id) {
                setSelectedLocation(closestLoc);
            }
        }
    }, [location, locations, userManuallySelected, selectedLocation]);

    useEffect(() => {
        if (location && selectedLocation) {
            const dist = calculateDistance(location.latitude, location.longitude, parseFloat(selectedLocation.latitude), parseFloat(selectedLocation.longitude));
            setCurrentDistance(dist);
            // Reset auto-submit when location changes significantly to allow retry if they move into area
            hasAttemptedAutoSubmit.current = false;
        }
    }, [location, selectedLocation]);

    useEffect(() => {
        if (step === 3 && photoBlob && location && selectedLocation && currentDistance !== null && !loading && !success && !error) {
            const isWithinRadius = currentDistance <= (selectedLocation.radius_meters || 100);
            if (isWithinRadius && !hasAttemptedAutoSubmit.current) {
                hasAttemptedAutoSubmit.current = true;
                handleSubmit();
            }
        }
    }, [step, photoBlob, location, selectedLocation, currentDistance, loading, success, error]);

    async function checkFaceStatus() {
        try {
            const status = await faceAPI.getStatus();
            setHasFaceRegistered(status.has_face);

            if (status.has_face) {
                const descriptorData = await faceAPI.getMyDescriptor();
                setStoredDescriptor(descriptorData.face_descriptor);
            }
        } catch (err) {
            console.error('Failed to check face status:', err);
            setHasFaceRegistered(false);
        }
    }

    async function fetchLocations() {
        try {
            const data = await locationsAPI.getActive();
            setLocations(data);
            if (data.length > 0) {
                setSelectedLocation(data[0]);
            }
        } catch (err) {
            console.error('Failed to fetch locations:', err);
        }
    }

    async function handlePhotoCapture(blob, dataUrl) {
        setPhotoBlob(blob);
        setPhoto(dataUrl);

        // If face is registered, verify it
        if (hasFaceRegistered && storedDescriptor) {
            setStep(2);
            setFaceVerifying(true);
            setError('');

            try {
                // Wait for models to load if not ready
                if (!modelsLoaded) {
                    setError('Model face recognition sedang dimuat. Mohon tunggu...');
                    return;
                }

                // Detect face in captured photo
                const detection = await detectFaceFromImage(dataUrl);

                if (!detection) {
                    setError('Wajah tidak terdeteksi. Pastikan wajah Anda terlihat jelas.');
                    setFaceVerified(false);
                    setStep(1);
                    return;
                }

                // Compare with stored descriptor
                const comparison = compareFaces(detection.descriptor, storedDescriptor);
                setFaceSimilarity(comparison.similarity);

                if (comparison.match) {
                    setFaceVerified(true);
                    setStep(3);
                    setError('');
                } else {
                    setError(`Wajah tidak cocok. Kemiripan: ${comparison.similarity}%. Minimal 60% untuk diterima.`);
                    setFaceVerified(false);
                    setStep(1);
                }
            } catch (err) {
                console.error('Face verification error:', err);
                setError('Gagal memverifikasi wajah: ' + err.message);
                setStep(1);
            } finally {
                setFaceVerifying(false);
            }
        } else {
            // No face registered, skip verification
            setStep(3);
        }
    }

    function handlePhotoReset() {
        setPhoto(null);
        setPhotoBlob(null);
        setFaceVerified(false);
        setFaceSimilarity(null);
        setStep(1);
        setError('');
    }

    function handleLocationUpdate(coords) {
        setLocation(coords);
    }

    async function handleSubmit() {
        if (!photoBlob || !location) {
            setError('Foto dan lokasi harus tersedia');
            return;
        }

        // Check face verification if registered
        if (hasFaceRegistered && !faceVerified) {
            setError('Verifikasi wajah diperlukan. Silakan ambil foto ulang.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('photo', photoBlob, 'selfie.jpg');
            formData.append('latitude', location.latitude.toString());
            formData.append('longitude', location.longitude.toString());
            if (selectedLocation) {
                formData.append('location_id', selectedLocation.id.toString());
            }
            if (notes.trim()) {
                formData.append('notes', notes.trim());
            }

            const result = isCheckIn
                ? await attendanceAPI.checkIn(formData)
                : await attendanceAPI.checkOut(formData);

            setSuccess(result.message || `${isCheckIn ? 'Check-in' : 'Check-out'} berhasil!`);

            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err) {
            setError(err.message || 'Gagal melakukan absensi');
        } finally {
            setLoading(false);
        }
    }

    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationDescriptor, setRegistrationDescriptor] = useState(null);

    // Show face registration required message
    if (hasFaceRegistered === false && !isRegistering) {
        return (
            <div className="attendance-container">
                <div className="page-header">
                    <h1 className="page-title">🔐 Registrasi Wajah Diperlukan</h1>
                </div>
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📸</div>
                        <p className="empty-state-text">
                            Wajah Anda belum terdaftar di sistem. Anda perlu mendaftarkan wajah terlebih dahulu untuk dapat melakukan absensi.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" onClick={() => setIsRegistering(true)}>
                                📸 Daftarkan Wajah Sekarang
                            </button>
                            <button className="btn btn-outline" onClick={() => navigate('/')}>
                                Kembali ke Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    async function handleRegistrationCapture(blob, dataUrl) {
        setPhotoBlob(blob);
        setPhoto(dataUrl);
        setError('');

        try {
            if (!modelsLoaded) {
                setError('Model face recognition sedang dimuat...');
                return;
            }

            const detection = await detectFaceFromImage(dataUrl);
            if (!detection) {
                setError('Wajah tidak teerdeteksi. Pastikan wajah terlihat jelas.');
                return;
            }

            setRegistrationDescriptor(detection.descriptor);
        } catch (err) {
            console.error(err);
            setError('Gagal memproses foto: ' + err.message);
        }
    }

    async function handleRegisterFace() {
        if (!registrationDescriptor) {
            setError('Data wajah belum siap via foto.');
            return;
        }

        setLoading(true);
        try {
            await faceAPI.registerSelf(registrationDescriptor);
            setSuccess('Wajah berhasil didaftarkan! Anda sekarang dapat melakukan absensi.');
            setHasFaceRegistered(true);
            setIsRegistering(false);
            setStep(1);
            setPhoto(null);
            setPhotoBlob(null);
            setRegistrationDescriptor(null);

            // Re-fetch descriptor just to be sure
            const descriptorData = await faceAPI.getMyDescriptor();
            setStoredDescriptor(descriptorData.face_descriptor);

        } catch (err) {
            setError(err.message || 'Gagal mendaftarkan wajah');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="attendance-container">
            <div className="page-header">
                <h1 className="page-title">
                    {isRegistering ? '📝 Registrasi Wajah' : (isCheckIn ? '📥 Check-in' : '📤 Check-out')}
                </h1>
                <p className="page-subtitle">
                    {isRegistering ? 'Ambil foto selfie untuk pendaftaran sistem' : (isCheckIn ? 'Absen masuk kerja' : 'Absen pulang kerja')}
                    {hasFaceRegistered && !isRegistering && <span style={{ marginLeft: '0.5rem', color: 'var(--success-500)' }}>🔐 Verifikasi Wajah Aktif</span>}
                </p>
            </div>

            {modelsLoading && (
                <div className="alert alert-info mb-3">
                    <span className="alert-icon">⏳</span>
                    Memuat model face recognition... Mohon tunggu sebentar.
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

            {/* Progress Steps */}
            {!isRegistering && (
                <div className="card mb-4" style={{ padding: '1rem 0.5rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: step >= 1 ? 'var(--gradient-primary)' : 'var(--gray-700)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600
                            }}>
                                1
                            </div>
                            <span style={{ color: step >= 1 ? 'white' : 'var(--gray-500)' }}>Foto</span>
                        </div>
                        <div style={{
                            width: 20,
                            height: 2,
                            background: step >= 2 ? 'var(--primary-500)' : 'var(--gray-700)',
                            alignSelf: 'center'
                        }} />
                        {hasFaceRegistered && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: step >= 2 ? (faceVerified ? 'var(--success-500)' : 'var(--warning-500)') : 'var(--gray-700)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 600
                                    }}>
                                        {faceVerifying ? '⏳' : (faceVerified ? '✓' : '2')}
                                    </div>
                                    <span style={{ color: step >= 2 ? 'white' : 'var(--gray-500)' }}>Verifikasi</span>
                                </div>
                                <div style={{
                                    width: 20,
                                    height: 2,
                                    background: step >= 3 ? 'var(--primary-500)' : 'var(--gray-700)',
                                    alignSelf: 'center'
                                }} />
                            </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: step >= 3 ? 'var(--gradient-primary)' : 'var(--gray-700)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600
                            }}>
                                {hasFaceRegistered ? '3' : '2'}
                            </div>
                            <span style={{ color: step >= 3 ? 'white' : 'var(--gray-500)' }}>Konfirmasi</span>
                        </div>
                    </div>
                </div>
            )}

            {isRegistering && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h2 className="card-title">📝 Pendaftaran Wajah</h2>
                    </div>
                    {!photo ? (
                        <>
                            <Camera onCapture={handleRegistrationCapture} onReset={handlePhotoReset} />
                            <p className="text-muted text-center mt-2">
                                Posisikan wajah Anda di dalam kotak dan pastikan pencahayaan cukup.
                            </p>
                            <button className="btn btn-outline btn-block mt-3" onClick={() => {
                                setIsRegistering(false);
                                setPhoto(null);
                                setError('');
                            }}>
                                Batal
                            </button>
                        </>
                    ) : (
                        <div className="p-3">
                            <img src={photo} alt="Result" style={{ width: '100%', borderRadius: 'var(--radius-lg)' }} />
                            <div className="mt-3">
                                <button className="btn btn-primary btn-block mb-2" onClick={handleRegisterFace} disabled={loading}>
                                    {loading ? 'Menyimpan...' : '💾 Simpan Wajah Ini'}
                                </button>
                                <button className="btn btn-outline btn-block" onClick={handlePhotoReset} disabled={loading}>
                                    🔄 Ambil Ulang
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!isRegistering && step === 1 && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">📸 Ambil Foto Selfie</h2>
                    </div>
                    <Camera onCapture={handlePhotoCapture} onReset={handlePhotoReset} />
                    <p className="text-muted text-center mt-2" style={{ fontSize: '0.85rem' }}>
                        {hasFaceRegistered
                            ? '🔐 Foto akan diverifikasi dengan wajah terdaftar'
                            : 'Posisikan wajah Anda di dalam kotak'}
                    </p>
                </div>
            )}

            {!isRegistering && step === 2 && faceVerifying && (
                <div className="card">
                    <div className="empty-state" style={{ padding: '3rem' }}>
                        <div className="loading-spinner" style={{ width: 48, height: 48, margin: '0 auto 1rem' }} />
                        <p className="empty-state-text">Memverifikasi wajah...</p>
                    </div>
                </div>
            )}

            {!isRegistering && step === 3 && (
                <div className="grid grid-2">
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">📸 Foto Selfie</h2>
                            {faceVerified && (
                                <span className="badge badge-success">✅ Terverifikasi {faceSimilarity}%</span>
                            )}
                        </div>
                        {photo && (
                            <img src={photo} alt="Captured" style={{ width: '100%', borderRadius: 'var(--radius-lg)' }} />
                        )}
                        <button
                            className="btn btn-outline btn-block mt-2"
                            onClick={handlePhotoReset}
                        >
                            🔄 Ambil Ulang
                        </button>
                    </div>

                    <div>
                        <div className="card mb-3">
                            <div className="card-header">
                                <h2 className="card-title">📍 Lokasi</h2>
                            </div>
                            <LocationTracker
                                onLocationUpdate={handleLocationUpdate}
                                targetLocation={selectedLocation}
                            />

                            {/* Dropdown lokasi disembunyikan karena sudah otomatis memilih yang terdekat */}
                        </div>

                        <div className="card mb-3">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Catatan (Opsional)</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder="Tambahkan catatan jika diperlukan..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {currentDistance !== null && selectedLocation && currentDistance > (selectedLocation.radius_meters || 100) ? (
                            <button
                                className="btn btn-warning btn-block btn-lg"
                                onClick={handlePhotoReset}
                            >
                                🔄 Di Luar Area - Absen Ulang
                            </button>
                        ) : (
                            <button
                                className={`btn ${isCheckIn ? 'btn-success' : 'btn-danger'} btn-block btn-lg`}
                                onClick={handleSubmit}
                                disabled={loading || !photo || !location}
                            >
                                {loading ? (
                                    <>
                                        <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                        Memproses Otomatis...
                                    </>
                                ) : (
                                    <>
                                        {isCheckIn ? '📥 Konfirmasi Check-in' : '📤 Konfirmasi Check-out'}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
