import { useRef, useState, useCallback, useEffect } from 'react';

export default function Camera({ onCapture, onReset }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [error, setError] = useState(null);
    const [facingMode, setFacingMode] = useState('user'); // 'user' for front camera
    const [useFallback, setUseFallback] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            setError(null);

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('getUserMedia is not supported, switching to fallback');
                setUseFallback(true);
                return;
            }

            // Stop existing stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });

            setStream(mediaStream);
            setUseFallback(false);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Camera error:', err);
            // Switch to fallback automatically
            setUseFallback(true);
        }
    }, [facingMode, stream]);

    useEffect(() => {
        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');

        // Mirror the image for front camera
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);

        // Convert to blob for upload
        canvas.toBlob((blob) => {
            if (onCapture) {
                onCapture(blob, dataUrl);
            }
        }, 'image/jpeg', 0.8);

        // Stop camera after capture
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }, [stream, onCapture]);

    const retakePhoto = useCallback(() => {
        setPhoto(null);
        if (onReset) onReset();
        startCamera();
    }, [onReset, startCamera]);

    const switchCamera = useCallback(() => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        startCamera();
    }, [startCamera]);

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
                        Koneksi tidak terenkripsi (Local IP). Tekan tombol di bawah untuk membuka kamera sistem.
                    </p>
                    <div style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
                        <button type="button" className="btn btn-primary" style={{ pointerEvents: 'none' }}>
                            📸 Buka Kamera
                        </button>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFallbackCapture} 
                            style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                        />
                    </div>                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="camera-container">
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p className="text-danger" style={{ marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-primary" onClick={startCamera}>
                        Coba Lagi
                    </button>
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
