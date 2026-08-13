import { useRef, useState, useCallback, useEffect } from 'react';

const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function cameraErrorMessage(err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return 'Akses kamera ditolak. Klik ikon gembok di address bar, izinkan Kamera, lalu tekan Coba Lagi.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return 'Webcam tidak ditemukan. Pastikan kamera PC terpasang, driver aktif, dan tidak dimatikan di pengaturan Windows.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'Kamera sedang dipakai aplikasi lain (Zoom, Teams, Skype, dll). Tutup aplikasi tersebut, lalu coba lagi.';
    }
    if (name === 'SecurityError' || name === 'NotSupportedError') {
        return 'Browser memblokir kamera. Gunakan HTTPS dan izinkan akses kamera.';
    }
    if (name === 'OverconstrainedError') {
        return 'Webcam PC tidak mendukung pengaturan kamera ini. Coba lagi untuk memakai kamera default.';
    }
    return err?.message ? `Gagal membuka kamera: ${err.message}` : 'Gagal membuka kamera. Periksa izin browser dan webcam PC.';
}

async function getCameraStream(preferredFacing = 'user') {
    if (!window.isSecureContext) {
        const err = new Error('Kamera hanya bisa digunakan di HTTPS atau localhost.');
        err.name = 'SecurityError';
        throw err;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        const err = new Error('Browser ini tidak mendukung kamera.');
        err.name = 'NotSupportedError';
        throw err;
    }

    const attempts = [
        { video: { facingMode: { ideal: preferredFacing }, width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: { facingMode: { ideal: preferredFacing } } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: true }
    ];

    let lastError;
    for (const constraints of attempts) {
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            lastError = err;
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                throw err;
            }
        }
    }
    throw lastError;
}

export default function Camera({ onCapture, onReset }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [error, setError] = useState(null);
    const [facingMode, setFacingMode] = useState('user');
    const [useFallback, setUseFallback] = useState(false);
    const [starting, setStarting] = useState(false);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setStream(null);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setError(null);
            setUseFallback(false);
            setStarting(true);
            stopStream();

            const mediaStream = await getCameraStream(facingMode);
            streamRef.current = mediaStream;
            setStream(mediaStream);
        } catch (err) {
            console.error('Camera error:', err);
            setError(cameraErrorMessage(err));
        } finally {
            setStarting(false);
        }
    }, [facingMode, stopStream]);

    useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;
        video.srcObject = stream;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((err) => {
                console.warn('Video play failed:', err);
            });
        }
    }, [stream]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video.videoWidth || !video.videoHeight) {
            setError('Kamera belum siap. Tunggu preview muncul, lalu ambil foto.');
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);

        canvas.toBlob((blob) => {
            if (onCapture) {
                onCapture(blob, dataUrl);
            }
        }, 'image/jpeg', 0.8);

        stopStream();
    }, [onCapture, stopStream]);

    const retakePhoto = useCallback(() => {
        setPhoto(null);
        if (onReset) onReset();
        startCamera();
    }, [onReset, startCamera]);

    const switchCamera = useCallback(async () => {
        const next = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(next);
        try {
            setError(null);
            setUseFallback(false);
            setStarting(true);
            stopStream();
            const mediaStream = await getCameraStream(next);
            streamRef.current = mediaStream;
            setStream(mediaStream);
        } catch (err) {
            console.error('Camera switch error:', err);
            setError(cameraErrorMessage(err));
        } finally {
            setStarting(false);
        }
    }, [facingMode, stopStream]);

    const handleFallbackCapture = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (window.createImageBitmap) {
                const bmp = await createImageBitmap(file);
                const canvas = document.createElement('canvas');
                let width = bmp.width;
                let height = bmp.height;
                const MAX_WIDTH = 640;
                const MAX_HEIGHT = 640;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round(width * (MAX_HEIGHT / height));
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bmp, 0, 0, width, height);

                const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPhoto(resizedDataUrl);

                canvas.toBlob((blob) => {
                    if (onCapture) onCapture(blob, resizedDataUrl);
                }, 'image/jpeg', 0.8);
                return;
            }
        } catch (error) {
            console.warn('ImageBitmap API failed or not supported, using standard fallback');
        }

        // Fallback for older browsers
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 640;
                const MAX_HEIGHT = 640;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round(width * (MAX_HEIGHT / height));
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPhoto(resizedDataUrl);

                canvas.toBlob((blob) => {
                    if (onCapture) {
                        onCapture(blob, resizedDataUrl);
                    }
                }, 'image/jpeg', 0.8);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }, [onCapture]);

    const filePicker = (
        <div style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
            <button type="button" className="btn btn-outline" style={{ pointerEvents: 'none' }}>
                {IS_MOBILE ? '📸 Ambil dari Kamera HP' : '📁 Pilih Foto dari Komputer'}
            </button>
            <input
                type="file"
                accept="image/*"
                {...(IS_MOBILE ? { capture: 'user' } : {})}
                onChange={handleFallbackCapture}
                style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
            />
        </div>
    );

    if (useFallback && !photo) {
        return (
            <div className="camera-container">
                <div style={{
                    width: '100%',
                    minHeight: 250,
                    background: 'var(--gray-800)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--gray-600)',
                    padding: '1.5rem 1rem',
                    color: 'white',
                    textAlign: 'center',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        Webcam live tidak tersedia. {IS_MOBILE ? 'Ambil foto selfie dari kamera HP.' : 'Pilih foto dari komputer, atau izinkan kamera di browser lalu coba lagi.'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <button type="button" className="btn btn-primary" onClick={startCamera}>
                            🔄 Coba Buka Webcam
                        </button>
                        {filePicker}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="camera-container">
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p className="text-danger" style={{ marginBottom: '1rem' }}>{error}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        <button className="btn btn-primary" onClick={startCamera} disabled={starting}>
                            {starting ? 'Membuka kamera...' : 'Coba Lagi'}
                        </button>
                        {filePicker}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="camera-container">
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!photo ? (
                <>
                    <div className="camera-view-wrapper">
                        {starting && !stream && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                zIndex: 2,
                                background: 'rgba(0,0,0,0.45)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                Membuka kamera...
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="camera-video"
                        />
                        <div className="camera-overlay" />
                    </div>

                    <div className="camera-controls">
                        <button
                            className="btn btn-outline"
                            onClick={switchCamera}
                            title="Ganti Kamera"
                        >
                            🔄
                        </button>
                        <button className="camera-btn" onClick={capturePhoto}>
                            <div className="camera-btn-inner" />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <img src={photo} alt="Captured" className="camera-preview" />
                    <div className="camera-controls">
                        <button
                            className="btn btn-outline"
                            onClick={retakePhoto}
                        >
                            🔄 Ambil Ulang
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
