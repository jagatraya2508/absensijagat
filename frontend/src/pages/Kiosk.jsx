import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { faceAPI, attendanceAPI, leavesAPI } from '../utils/api';
import useFaceApi from '../hooks/useFaceApi';
import Icon from '../components/Icon';

const LEAVE_TYPES = {
    late: { label: 'Izin Terlambat', icon: 'Clock' },
    sick: { label: 'Izin Sakit', icon: 'HeartPulse' },
    permission: { label: 'Izin Tidak Masuk', icon: 'FileText' },
    leave: { label: 'Cuti', icon: 'Palmtree' },
    change_off: { label: 'Tukar Libur', icon: 'RefreshCw' },
};

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Kiosk() {
    const { companyName } = useSettings();
    const { logout, isKioskOnly } = useAuth();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const requestRef = useRef(null);
    const timeoutRef = useRef(null);
    const idleRef = useRef(null);

    const [status, setStatus] = useState('Memuat model AI...');
    const [message, setMessage] = useState('Sedang memuat data wajah...');
    const [allDescriptors, setAllDescriptors] = useState([]);
    const [matchedUser, setMatchedUser] = useState(null);
    const [photoBlob, setPhotoBlob] = useState(null);
    const [leaveType, setLeaveType] = useState(null);
    const [startDate, setStartDate] = useState(todayStr());
    const [endDate, setEndDate] = useState(todayStr());
    const [replacementDate, setReplacementDate] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [quota, setQuota] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const isProcessingRef = useRef(false);
    const scanLoopRef = useRef(null);

    const { modelsLoaded, detectFaceFromVideo, compareFaces } = useFaceApi();

    const clearTimers = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (idleRef.current) clearTimeout(idleRef.current);
    };

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
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            clearTimers();
        };
    }, []);

    const resumeScan = useCallback(() => {
        clearTimers();
        isProcessingRef.current = false;
        setMatchedUser(null);
        setPhotoBlob(null);
        setLeaveType(null);
        setReason('');
        setAttachment(null);
        setReplacementDate('');
        setQuota(null);
        setSubmitting(false);
        setStartDate(todayStr());
        setEndDate(todayStr());
        setStatus('ready');
        setMessage('Silakan arahkan wajah Anda ke kamera');
        if (scanLoopRef.current) {
            requestRef.current = requestAnimationFrame(scanLoopRef.current);
        }
    }, []);

    const startIdleTimeout = useCallback((ms = 45000) => {
        if (idleRef.current) clearTimeout(idleRef.current);
        idleRef.current = setTimeout(() => resumeScan(), ms);
    }, [resumeScan]);

    const scanLoop = useCallback(async () => {
        if (isProcessingRef.current) {
            return;
        }

        if (!modelsLoaded || allDescriptors.length === 0) {
            requestRef.current = requestAnimationFrame(scanLoop);
            return;
        }

        if (videoRef.current && videoRef.current.readyState === 4) {
            try {
                const detection = await detectFaceFromVideo(videoRef.current);
                if (detection) {
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
                        isProcessingRef.current = true;
                        handleMatch(bestMatch, videoRef.current);
                        return;
                    }
                }
            } catch (err) {
                console.error('Detection error:', err);
            }
        }

        timeoutRef.current = setTimeout(() => {
            if (!isProcessingRef.current) {
                requestRef.current = requestAnimationFrame(scanLoop);
            }
        }, 500);
    }, [modelsLoaded, allDescriptors, compareFaces, detectFaceFromVideo]);

    scanLoopRef.current = scanLoop;

    useEffect(() => {
        requestRef.current = requestAnimationFrame(scanLoop);
        return () => {
            cancelAnimationFrame(requestRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [scanLoop]);

    async function capturePhoto(videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    }

    async function handleMatch(user, videoElement) {
        playBeep();
        const blob = await capturePhoto(videoElement);
        setPhotoBlob(blob);
        setMatchedUser(user);
        setStatus('menu');
        setMessage(`Halo, ${user.name}`);
        startIdleTimeout(45000);
    }

    async function handleAttend() {
        if (!matchedUser || !photoBlob || submitting) return;
        setSubmitting(true);
        setStatus('matching');
        setMessage(`Memproses absensi untuk ${matchedUser.name}...`);
        try {
            const formData = new FormData();
            formData.append('user_id', matchedUser.id);
            formData.append('photo', photoBlob, 'kiosk.jpg');
            const result = await attendanceAPI.kioskAttend(formData);
            setStatus('success');
            setMessage(result.message);
        } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Gagal melakukan absensi');
        } finally {
            setSubmitting(false);
            timeoutRef.current = setTimeout(() => resumeScan(), 8000);
        }
    }

    async function openLeaveForm(type) {
        setLeaveType(type);
        setStartDate(todayStr());
        setEndDate(todayStr());
        setReplacementDate('');
        setReason('');
        setAttachment(null);
        setStatus('form');
        startIdleTimeout(90000);
        if (matchedUser) {
            try {
                const data = await leavesAPI.kioskQuota(matchedUser.id);
                setQuota(data);
            } catch (_) {
                setQuota(null);
            }
        }
    }

    async function handleLeaveSubmit(e) {
        e.preventDefault();
        if (!matchedUser || submitting) return;
        if (reason.trim().length < 10) {
            setStatus('error');
            setMessage('Alasan minimal 10 karakter');
            setTimeout(() => setStatus('form'), 2000);
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('user_id', matchedUser.id);
            formData.append('type', leaveType);
            formData.append('start_date', startDate);
            formData.append('end_date', leaveType === 'late' ? startDate : endDate);
            if (leaveType === 'change_off' && replacementDate) {
                formData.append('replacement_date', replacementDate);
            }
            formData.append('reason', reason);
            if (attachment) {
                formData.append('attachment', attachment);
            }
            const result = await leavesAPI.kioskCreate(formData);
            setStatus('success');
            setMessage(result.message || `Pengajuan ${LEAVE_TYPES[leaveType].label} berhasil`);
            timeoutRef.current = setTimeout(() => resumeScan(), 8000);
        } catch (error) {
            setStatus('error');
            setMessage(error.message || 'Gagal membuat pengajuan');
            timeoutRef.current = setTimeout(() => {
                setStatus('form');
                startIdleTimeout(90000);
            }, 3000);
        } finally {
            setSubmitting(false);
        }
    }

    function playBeep() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (e) {
            console.error('Audio error', e);
        }
    }

    const showOverlay = status === 'menu' || status === 'form';

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
            <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{companyName || 'Absensi'} Kiosk</h1>
                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Absen wajah, atau ajukan izin / cuti tanpa HP</p>
                </div>
                <button
                    onClick={() => {
                        if (isKioskOnly()) {
                            logout();
                            navigate('/login');
                            return;
                        }
                        navigate('/');
                    }}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {isKioskOnly() ? 'Keluar' : 'Tutup Kiosk (Admin)'}
                </button>
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ height: '100%', width: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />

                {!showOverlay && (
                    <>
                        <div style={{
                            position: 'absolute',
                            width: 'min(72vw, 560px)',
                            height: 'min(78vh, 720px)',
                            maxWidth: '90vw',
                            border: status === 'success' ? '4px solid #10b981' : (status === 'error' ? '4px solid #ef4444' : '4px dashed rgba(255,255,255,0.5)'),
                            borderRadius: '50%',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
                            transition: 'border-color 0.3s ease'
                        }} />

                        <div style={{
                            position: 'absolute',
                            bottom: '10%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: status === 'success' ? '#10b981' : (status === 'error' && !leaveType ? '#ef4444' : 'rgba(0,0,0,0.8)'),
                            padding: '1rem 2rem',
                            borderRadius: '999px',
                            fontSize: '1.25rem',
                            fontWeight: 500,
                            textAlign: 'center',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            minWidth: '300px',
                            zIndex: 5
                        }}>
                            {status === 'Memuat model AI...' && <span style={{ display: 'inline-block', marginRight: '10px', animation: 'spin 1s linear infinite' }}><Icon name="Hourglass" size={16} inline /></span>}
                            {status === 'success' && 'CheckCircle2'}
                            {status === 'error' && 'AlertTriangle'}
                            {message}
                        </div>
                    </>
                )}

                {showOverlay && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.82)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '5rem 1.25rem 1.5rem',
                        zIndex: 8,
                        overflow: 'auto'
                    }}>
                        {status === 'menu' && matchedUser && (
                            <div style={{ width: 'min(920px, 100%)' }}>
                                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.75rem', textAlign: 'center' }}>Halo, {matchedUser.name}</h2>
                                <p style={{ margin: '0 0 1.5rem', textAlign: 'center', opacity: 0.75 }}>Pilih absen atau pengajuan izin</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                                    <button type="button" onClick={handleAttend} disabled={submitting} style={kioskBtn('#10b981')}>
                                        <Icon name="CheckCircle2" size={16} inline /> Absen Masuk / Pulang
                                    </button>
                                    {Object.entries(LEAVE_TYPES).map(([key, meta]) => (
                                        <button key={key} type="button" onClick={() => openLeaveForm(key)} style={kioskBtn('#334155')}>
                                            <Icon name={meta.icon} size={16} inline /> {meta.label}
                                        </button>
                                    ))}
                                </div>
                                <button type="button" onClick={resumeScan} style={{ ...kioskBtn('transparent'), marginTop: '1rem', border: '1px solid rgba(255,255,255,0.25)' }}>
                                    Batal
                                </button>
                            </div>
                        )}

                        {status === 'form' && matchedUser && leaveType && (
                            <form onSubmit={handleLeaveSubmit} style={{ width: 'min(640px, 100%)', background: '#111827', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.12)' }}>
                                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem' }}>
                                    <Icon name={LEAVE_TYPES[leaveType].icon} size={18} inline /> {LEAVE_TYPES[leaveType].label}
                                </h2>
                                <p style={{ margin: '0 0 1rem', opacity: 0.7 }}>Untuk {matchedUser.name}</p>
                                {leaveType === 'leave' && quota && (
                                    <p style={{ margin: '0 0 1rem', color: '#93c5fd' }}>
                                        Sisa cuti: <strong>{quota.remaining}</strong> dari {quota.quota} hari
                                    </p>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: leaveType === 'late' ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                                    <label style={labelStyle}>
                                        Tanggal {leaveType === 'late' ? '' : 'Mulai'}
                                        <input type="date" required value={startDate} onChange={(e) => { setStartDate(e.target.value); startIdleTimeout(90000); }} style={inputStyle} />
                                    </label>
                                    {leaveType !== 'late' && (
                                        <label style={labelStyle}>
                                            Tanggal Selesai
                                            <input type="date" required min={startDate} value={endDate} onChange={(e) => { setEndDate(e.target.value); startIdleTimeout(90000); }} style={inputStyle} />
                                        </label>
                                    )}
                                </div>
                                {leaveType === 'change_off' && (
                                    <label style={{ ...labelStyle, marginTop: '0.75rem' }}>
                                        Tanggal Pengganti (masuk kerja)
                                        <input type="date" required value={replacementDate} onChange={(e) => { setReplacementDate(e.target.value); startIdleTimeout(90000); }} style={inputStyle} />
                                    </label>
                                )}
                                <label style={{ ...labelStyle, marginTop: '0.75rem' }}>
                                    Alasan
                                    <textarea
                                        required
                                        minLength={10}
                                        rows={3}
                                        value={reason}
                                        placeholder="Minimal 10 karakter"
                                        onChange={(e) => { setReason(e.target.value); startIdleTimeout(90000); }}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </label>
                                <label style={{ ...labelStyle, marginTop: '0.75rem' }}>
                                    Lampiran (opsional, foto surat/PDF)
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => { setAttachment(e.target.files?.[0] || null); startIdleTimeout(90000); }}
                                        style={{ ...inputStyle, padding: '0.55rem' }}
                                    />
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                    <button type="button" onClick={() => { setStatus('menu'); setLeaveType(null); startIdleTimeout(45000); }} style={{ ...kioskBtn('#374151'), flex: 1 }}>
                                        Kembali
                                    </button>
                                    <button type="submit" disabled={submitting} style={{ ...kioskBtn('#2563eb'), flex: 2 }}>
                                        {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function kioskBtn(bg) {
    return {
        background: bg,
        color: '#fff',
        border: 'none',
        borderRadius: '14px',
        padding: '1.1rem 1rem',
        fontSize: '1.05rem',
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        minHeight: '64px',
    };
}

const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.85)',
};

const inputStyle = {
    background: '#0b1220',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '10px',
    padding: '0.7rem 0.8rem',
    fontSize: '1rem',
};
