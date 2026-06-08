import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { faceAPI, attendanceAPI } from '../utils/api';
import useFaceApi from '../hooks/useFaceApi';

export default function Kiosk() {
    const { companyName } = useSettings();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const requestRef = useRef(null);
    const timeoutRef = useRef(null);
    
    const [status, setStatus] = useState('Memuat model AI...'); // initializing, ready, matching, success, error
    const [message, setMessage] = useState('Sedang memuat data wajah...');
    const [allDescriptors, setAllDescriptors] = useState([]);
    const isProcessingRef = useRef(false);
    
    const { modelsLoaded, detectFaceFromVideo, compareFaces } = useFaceApi();

    // 1. Fetch descriptors
    useEffect(() => {
        async function fetchDescriptors() {
            try {
                const data = await faceAPI.getAllDescriptors();
                setAllDescriptors(data);
                if (modelsLoaded) {
                    setStatus('ready');
                    setMessage('Silakan arahkan wajah Anda ke kamera');
                }
            } catch (err) {
                console.error('Failed to load descriptors', err);
                setStatus('error');
                setMessage('Gagal memuat data wajah karyawan.');
            }
        }
        fetchDescriptors();
    }, [modelsLoaded]);

    // 2. Start Camera
    useEffect(() => {
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
                console.error('Camera error:', err);
                setStatus('error');
                setMessage('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
            }
        }
        startCamera();
        
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // 3. Main Scanning Loop
    const scanLoop = useCallback(async () => {
        if (isProcessingRef.current) {
            return; // stop completely, wait for handleMatch to resume
        }

        if (!modelsLoaded || allDescriptors.length === 0) {
            requestRef.current = requestAnimationFrame(scanLoop);
            return;
        }

        if (videoRef.current && videoRef.current.readyState === 4) {
            try {
                const detection = await detectFaceFromVideo(videoRef.current);
                if (detection) {
                    // Match against all descriptors
                    let bestMatch = null;
                    let lowestDistance = 1;

                    for (const user of allDescriptors) {
                        const comparison = compareFaces(detection.descriptor, user.descriptor);
                        if (comparison.match && comparison.distance < lowestDistance) {
                            lowestDistance = comparison.distance;
                            bestMatch = user;
                        }
                    }

                    if (bestMatch) {
                        // Found a match! Process attendance
                        isProcessingRef.current = true;
                        handleMatch(bestMatch, videoRef.current);
                        return; // Stop loop!
                    }
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }
        
        // Add a small delay between frames to reduce CPU load (e.g. 500ms)
        timeoutRef.current = setTimeout(() => {
            if (!isProcessingRef.current) {
                requestRef.current = requestAnimationFrame(scanLoop);
            }
        }, 500);
    }, [modelsLoaded, allDescriptors, compareFaces, detectFaceFromVideo]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(scanLoop);
        return () => {
            cancelAnimationFrame(requestRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [scanLoop]);

    async function handleMatch(user, videoElement) {
        setStatus('matching');
        setMessage(`Memproses absensi untuk ${user.name}...`);
        
        // play beep
        playBeep();

        try {
            // Capture photo for backend
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            // Mirror image back before saving
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoElement, 0, 0);
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            
            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('photo', blob, 'kiosk.jpg');

            const result = await attendanceAPI.kioskAttend(formData);
            
            setStatus('success');
            setMessage(result.message);

        } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Gagal melakukan absensi');
        }

        // Wait 10 seconds, then resume
        timeoutRef.current = setTimeout(() => {
            isProcessingRef.current = false;
            setStatus('ready');
            setMessage('Silakan arahkan wajah Anda ke kamera');
            requestRef.current = requestAnimationFrame(scanLoop);
        }, 10000);
    }

    // Simple beep sound generator
    function playBeep() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // volume
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15); // beep duration 150ms
        } catch(e) {
            console.error('Audio error', e);
        }
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
            {/* Header */}
            <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{companyName || 'Absensi'} Kiosk</h1>
                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Mode Absensi Bersama</p>
                </div>
                <button 
                    onClick={() => navigate('/')} 
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Tutup Kiosk (Admin)
                </button>
            </div>

            {/* Video Container */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ height: '100%', width: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                />
                
                {/* Overlay Guide */}
                <div style={{ 
                    position: 'absolute', 
                    width: '350px', 
                    height: '450px', 
                    border: status === 'success' ? '4px solid #10b981' : (status === 'error' ? '4px solid #ef4444' : '4px dashed rgba(255,255,255,0.5)'), 
                    borderRadius: '50%',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
                    transition: 'border-color 0.3s ease'
                }} />

                {/* Status Message */}
                <div style={{
                    position: 'absolute',
                    bottom: '10%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: status === 'success' ? '#10b981' : (status === 'error' ? '#ef4444' : 'rgba(0,0,0,0.8)'),
                    padding: '1rem 2rem',
                    borderRadius: '999px',
                    fontSize: '1.25rem',
                    fontWeight: 500,
                    textAlign: 'center',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s ease',
                    minWidth: '300px'
                }}>
                    {status === 'Memuat model AI...' && <span style={{ display: 'inline-block', marginRight: '10px', animation: 'spin 1s linear infinite' }}>⏳</span>}
                    {status === 'success' && '✅ '}
                    {status === 'error' && '⚠️ '}
                    {message}
                </div>
            </div>
            
            {/* Global style for spinner */}
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
