import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { driverTrackingAPI, customersAPI } from '../utils/api';
import Camera from '../components/Camera';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    getAllowedTrackingTypes,
    getDefaultTrackingType,
    getTrackingPageCopy,
    getTrackingTypeMeta,
} from '../utils/tracking';

// Fix default marker icons for leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const checkinIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const checkoutIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

export default function DriverTracking() {
    const [todayRecords, setTodayRecords] = useState([]);
    const [historyRecords, setHistoryRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('today');
    const [gpsLocation, setGpsLocation] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState('');

    // Check-in form
    const [customerName, setCustomerName] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    
    // Role / task type
    const { user } = useAuth();
    const allowedTypes = getAllowedTrackingTypes(user);
    const pageCopy = getTrackingPageCopy(user);
    const [selectedType, setSelectedType] = useState(() => getDefaultTrackingType(user));
    const isCollection = selectedType === 'collection';
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [amountBilled, setAmountBilled] = useState('');
    const [amountCollected, setAmountCollected] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [collectionStatus, setCollectionStatus] = useState('');

    // Camera / Photo state
    const [showCamera, setShowCamera] = useState(false);
    const [photoBlob, setPhotoBlob] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [cameraMode, setCameraMode] = useState(null); // 'checkin' | 'checkout'
    const [checkoutTargetId, setCheckoutTargetId] = useState(null);

    // History filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Map modal
    const [mapModal, setMapModal] = useState({ open: false, records: [], center: [-6.2, 106.8] });

    // Image modal
    const [imageModal, setImageModal] = useState({ open: false, src: '', caption: '' });

    // Customer autocomplete
    const [customers, setCustomers] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const dropdownRef = useRef(null);
    const [customerMode, setCustomerMode] = useState('existing'); // 'existing' | 'new'
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [pickerCustomers, setPickerCustomers] = useState([]);
    const [pickerPage, setPickerPage] = useState(1);
    const [pickerTotalPages, setPickerTotalPages] = useState(1);
    const [pickerTotal, setPickerTotal] = useState(0);
    const [pickerQuery, setPickerQuery] = useState('');
    const [pickerLoading, setPickerLoading] = useState(false);
    const pickerSearchTimeout = useRef(null);
    const PICKER_PAGE_SIZE = 8;

    useEffect(() => {
        fetchToday();
        // Load all customers on mount
        customersAPI.search('').then(data => setCustomers(data)).catch(() => {});
    }, []);

    useEffect(() => {
        const next = getDefaultTrackingType(user);
        setSelectedType((prev) => (allowedTypes.includes(prev) ? prev : next));
    }, [user, allowedTypes.join(',')]);

    async function fetchToday() {
        try {
            setLoading(true);
            const data = await driverTrackingAPI.getMyToday();
            setTodayRecords(data);
        } catch (e) {
            console.error('Fetch today error:', e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchHistory() {
        try {
            setLoading(true);
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            const data = await driverTrackingAPI.getMyHistory(params);
            setHistoryRecords(data);
        } catch (e) {
            console.error('Fetch history error:', e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'history') fetchHistory();
    }, [activeTab]);

    const getGPS = useCallback(() => {
        return new Promise((resolve, reject) => {
            setGpsLoading(true);
            setGpsError('');
            if (!navigator.geolocation) {
                setGpsError('Geolocation tidak didukung browser ini');
                setGpsLoading(false);
                reject('No geolocation');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
                    setGpsLocation(coords);
                    setGpsLoading(false);
                    resolve(coords);
                },
                (err) => {
                    let msg = 'Gagal mendapatkan lokasi';
                    if (err.code === 1) msg = 'Izin lokasi ditolak. Silakan aktifkan GPS.';
                    if (err.code === 2) msg = 'Lokasi tidak tersedia.';
                    if (err.code === 3) msg = 'Waktu pencarian lokasi habis.';
                    setGpsError(msg);
                    setGpsLoading(false);
                    reject(msg);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }, []);

    // Auto-get GPS on mount
    useEffect(() => { getGPS().catch(() => {}); }, []);

    function handlePhotoCapture(blob, dataUrl) {
        setPhotoBlob(blob);
        setPhotoPreview(dataUrl);
    }

    function resetPhoto() {
        setPhotoBlob(null);
        setPhotoPreview(null);
    }
    
    // Quick number formatter for currency
    function parseNumericString(val) {
        return val.replace(/\D/g, '');
    }
    function formatCurrencyHelper(val) {
        if (!val) return '';
        return parseInt(val, 10).toLocaleString('id-ID');
    }

    // Customer search
    function handleCustomerSearch(value) {
        setCustomerName(value);
        if (searchTimeout) clearTimeout(searchTimeout);
        if (value.length >= 1) {
            const timeout = setTimeout(async () => {
                try {
                    const data = await customersAPI.search(value);
                    setCustomers(data);
                    setShowDropdown(true);
                } catch (e) {
                    console.error('Search error:', e);
                }
            }, 300);
            setSearchTimeout(timeout);
        } else {
            setShowDropdown(false);
        }
    }

    function selectCustomer(customer) {
        setCustomerName(customer.name);
        setAddress(customer.address || '');
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
        setShowDropdown(false);
        setShowCustomerPicker(false);
    }

    async function fetchCustomerDirectory(page = 1, q = pickerQuery) {
        setPickerLoading(true);
        try {
            const result = await customersAPI.getDirectory({ page, limit: PICKER_PAGE_SIZE, q });
            setPickerCustomers(result.data || []);
            setPickerPage(result.page || 1);
            setPickerTotalPages(result.totalPages || 1);
            setPickerTotal(result.total || 0);
        } catch (e) {
            console.error('Directory error:', e);
            setPickerCustomers([]);
        } finally {
            setPickerLoading(false);
        }
    }

    function openCustomerPicker() {
        setPickerQuery('');
        setPickerPage(1);
        setShowCustomerPicker(true);
        fetchCustomerDirectory(1, '');
    }

    function handlePickerSearch(value) {
        setPickerQuery(value);
        if (pickerSearchTimeout.current) clearTimeout(pickerSearchTimeout.current);
        pickerSearchTimeout.current = setTimeout(() => {
            fetchCustomerDirectory(1, value);
        }, 300);
    }

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Open camera for check-in
    function openCameraForCheckin() {
        if (!customerName.trim()) {
            setError('Nama customer harus diisi terlebih dahulu');
            return;
        }
        setCameraMode('checkin');
        setShowCamera(true);
        resetPhoto();
    }

    // Open camera for check-out
    function openCameraForCheckout(record) {
        if (record.tracking_type === 'collection' && (!collectionStatus || (!amountCollected && collectionStatus === 'Lunas'))) {
             // Let user fill in details first
             setCameraMode('checkout');
             setCheckoutTargetId(record.id);
             setAmountCollected('');
             setPaymentMethod('Transfer');
             setCollectionStatus('Lunas');
             // Do not show camera immediately for collections; they need to fill the form in checkout phase
        } else {
             setCameraMode('checkout');
             setCheckoutTargetId(record.id);
             setShowCamera(true);
             resetPhoto();
        }
    }

    // Submit check-in after photo taken
    async function handleCheckinSubmit() {
        setSubmitting(true);
        setError('');
        setSuccess('');
        try {
            let coords = gpsLocation;
            if (!coords) coords = await getGPS();

            const formData = new FormData();
            formData.append('customer_name', customerName.trim());
            if (address.trim()) formData.append('address', address.trim());
            formData.append('latitude', coords.latitude.toString());
            formData.append('longitude', coords.longitude.toString());
            if (notes.trim()) formData.append('notes', notes.trim());
            if (photoBlob) formData.append('photo', photoBlob, 'checkin-selfie.jpg');

            formData.append('tracking_type', selectedType);
            if (isCollection) {
                if (invoiceNumber) formData.append('invoice_number', invoiceNumber.trim());
                if (amountBilled) formData.append('amount_billed', parseNumericString(amountBilled));
            }

            await driverTrackingAPI.checkin(formData);

            setSuccess('✅ Check-in berhasil!');
            setCustomerName('');
            setAddress('');
            setNotes('');
            setInvoiceNumber('');
            setAmountBilled('');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setShowCamera(false);
            resetPhoto();
            fetchToday();
            // Refresh customer list for autocomplete
            customersAPI.search('').then(data => setCustomers(data)).catch(() => {});
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message || 'Gagal check-in');
        } finally {
            setSubmitting(false);
        }
    }

    // Submit check-out after photo taken
    async function handleCheckoutSubmit() {
        setSubmitting(true);
        setError('');
        setSuccess('');
        try {
            let coords = gpsLocation;
            if (!coords) coords = await getGPS();

            const formData = new FormData();
            formData.append('latitude', coords.latitude.toString());
            formData.append('longitude', coords.longitude.toString());
            if (photoBlob) formData.append('photo', photoBlob, 'checkout-selfie.jpg');
            if (notes.trim()) formData.append('notes', notes.trim());

            const targetRecord = activeRecords.find(r => r.id === checkoutTargetId);
            if (targetRecord && targetRecord.tracking_type === 'collection') {
                formData.append('amount_collected', parseNumericString(amountCollected));
                formData.append('payment_method', paymentMethod);
                formData.append('collection_status', collectionStatus);
            }

            await driverTrackingAPI.checkout(checkoutTargetId, formData);

            setSuccess('✅ Check-out berhasil!');
            setShowCamera(false);
            resetPhoto();
            setCameraMode(null);
            setCheckoutTargetId(null);
            setAmountCollected('');
            setNotes('');
            fetchToday();
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e.message || 'Gagal check-out');
        } finally {
            setSubmitting(false);
        }
    }

    function formatTime(ts) {
        if (!ts) return '-';
        return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateTime(ts) {
        if (!ts) return '-';
        return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(d) {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    }

    function calcDuration(checkin, checkout) {
        if (!checkin || !checkout) return '-';
        const diff = new Date(checkout) - new Date(checkin);
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return hours > 0 ? `${hours}j ${remMins}m` : `${remMins}m`;
    }

    function openMapForRecords(records) {
        const validRecords = records.filter(r => r.checkin_latitude);
        if (validRecords.length === 0) return;
        const center = [parseFloat(validRecords[0].checkin_latitude), parseFloat(validRecords[0].checkin_longitude)];
        setMapModal({ open: true, records: validRecords, center });
    }

    const activeRecords = todayRecords.filter(r => r.status === 'checked_in');
    const completedRecords = todayRecords.filter(r => r.status === 'completed');

    // Display checkout form if doing collection checkout
    const checkoutTarget = checkoutTargetId ? activeRecords.find(r => r.id === checkoutTargetId) : null;
    if (cameraMode === 'checkout' && checkoutTarget && checkoutTarget.tracking_type === 'collection' && !showCamera) {
        return (
            <div>
                 <div className="page-header">
                    <h1 className="page-title">💰 Detail Penagihan</h1>
                    <p className="page-subtitle">Isi rincian pembayaran untuk {checkoutTarget.customer_name}</p>
                </div>
                {error && (
                    <div className="alert alert-danger mb-3">
                        <span className="alert-icon">⚠️</span>{error}
                    </div>
                )}
                
                <div className="card mb-4">
                    <div style={{ padding: '1.25rem' }}>
                        <div className="form-group">
                            <label className="form-label">Status Penagihan</label>
                            <select className="form-input form-select" value={collectionStatus} onChange={e => setCollectionStatus(e.target.value)}>
                                <option value="Lunas">Lunas</option>
                                <option value="Sebagian">Bayar Sebagian</option>
                                <option value="Gagal">Gagal Tagih</option>
                            </select>
                        </div>
                        
                        {(collectionStatus === 'Lunas' || collectionStatus === 'Sebagian') && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Dibayar (Rp)</label>
                                    <input type="text" className="form-input" 
                                        value={formatCurrencyHelper(amountCollected)}
                                        onChange={e => setAmountCollected(e.target.value)}
                                        placeholder="Contoh: 1.500.000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Metode Pembayaran</label>
                                    <select className="form-input form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option value="Transfer">Transfer Bank</option>
                                        <option value="Tunai">Tunai / Cash</option>
                                        <option value="Cek/Giro">Cek / Giro</option>
                                    </select>
                                </div>
                            </>
                        )}
                        
                        <div className="form-group">
                            <label className="form-label">Catatan Tambahan (Opsional)</label>
                            <textarea className="form-input" rows={2} placeholder="Keterangan..."
                                value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-outline" onClick={() => { setCameraMode(null); setCheckoutTargetId(null); }} style={{ flex: 1 }}>Batal</button>
                            <button className="btn btn-success" onClick={() => setShowCamera(true)} style={{ flex: 2 }}>Lanjut Foto Selfie 📸</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading && todayRecords.length === 0) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '50vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    // ==========================================
    // CAMERA VIEW (fullscreen-like)
    // ==========================================
    if (showCamera) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">
                        📸 {cameraMode === 'checkin' ? 'Foto Selfie Check-in' : 'Foto Selfie Check-out'}
                    </h1>
                    <p className="page-subtitle">
                        {cameraMode === 'checkin' ? `Customer: ${customerName}` : 'Ambil foto selfie untuk check-out'}
                    </p>
                </div>

                {error && (
                    <div className="alert alert-danger mb-3">
                        <span className="alert-icon">⚠️</span>{error}
                    </div>
                )}

                {/* GPS Info */}
                <div className="card mb-3" style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <span>{gpsLocation ? '🟢' : '🔴'}</span>
                        <span style={{ color: 'var(--gray-400)' }}>
                            {gpsLocation
                                ? `GPS: ${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)}`
                                : 'GPS tidak tersedia'}
                        </span>
                    </div>
                </div>

                <div className="card mb-4">
                    <Camera
                        onCapture={handlePhotoCapture}
                        onReset={resetPhoto}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-outline" onClick={() => { setShowCamera(false); resetPhoto(); }}
                        style={{ flex: 1 }} disabled={submitting}>
                        ← Kembali
                    </button>
                    {photoBlob && (
                        <button className="btn btn-success" style={{ flex: 2 }}
                            onClick={cameraMode === 'checkin' ? handleCheckinSubmit : handleCheckoutSubmit}
                            disabled={submitting || !gpsLocation}>
                            {submitting ? '⏳ Memproses...' : cameraMode === 'checkin' ? '📥 Kirim Check-in' : '📤 Kirim Check-out'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // MAIN VIEW
    // ==========================================
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📍 {pageCopy.title}</h1>
                <p className="page-subtitle">{pageCopy.subtitle}</p>
            </div>

            {error && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span>{error}
                </div>
            )}
            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span>{success}
                </div>
            )}

            {/* GPS Status */}
            <div className="card mb-4" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem' }}>{gpsLocation ? '🟢' : gpsError ? '🔴' : '🟡'}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {gpsLoading ? 'Mencari lokasi GPS...' : gpsLocation ? 'GPS Aktif' : 'GPS Tidak Tersedia'}
                        </div>
                        {gpsLocation && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                                {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                                {gpsLocation.accuracy && <span> (±{Math.round(gpsLocation.accuracy)}m)</span>}
                            </div>
                        )}
                        {gpsError && <div style={{ fontSize: '0.8rem', color: 'var(--danger-400)' }}>{gpsError}</div>}
                        {user?.use_tracking && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--success-400)', marginTop: 4 }}>
                                📡 Posisi Anda dibagikan ke peta live admin selama aplikasi terbuka
                            </div>
                        )}
                    </div>
                    <button className="btn btn-outline" onClick={() => getGPS().catch(() => {})}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                        🔄 Refresh GPS
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button className={`btn ${activeTab === 'today' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('today')}>
                    📍 Hari Ini ({todayRecords.length})
                </button>
                <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('history')}>
                    📋 Riwayat
                </button>
            </div>

            {activeTab === 'today' && (
                <>
                    {/* Check-in Form */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <h2 className="card-title">📥 Check-in Customer</h2>
                        </div>
                        <div style={{ padding: '1.25rem' }}>
                            {allowedTypes.length > 1 && (
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Jenis Tugas *</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {allowedTypes.map((type) => {
                                            const meta = getTrackingTypeMeta(type);
                                            return (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    className={`btn ${selectedType === type ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ fontSize: '0.85rem' }}
                                                    onClick={() => setSelectedType(type)}
                                                >
                                                    {meta.icon} {meta.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Mode Toggle */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    className={`btn ${customerMode === 'existing' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                    onClick={() => {
                                        setCustomerMode('existing');
                                        setCustomerName('');
                                        setAddress('');
                                        setSelectedCustomer(null);
                                        setCustomerSearch('');
                                    }}
                                >
                                    📋 Pilih Customer Lama
                                </button>
                                <button
                                    className={`btn ${customerMode === 'new' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                    onClick={() => {
                                        setCustomerMode('new');
                                        setCustomerName('');
                                        setAddress('');
                                        setSelectedCustomer(null);
                                        setCustomerSearch('');
                                    }}
                                >
                                    ✏️ Customer Baru
                                </button>
                            </div>

                            {/* MODE: Pilih Customer Lama */}
                            {customerMode === 'existing' && (
                                <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                                    <label className="form-label">Cari & Pilih Customer *</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                                        <input type="text" className="form-input"
                                            placeholder="🔍 Ketik nama atau kode customer..."
                                            value={customerSearch}
                                            onChange={e => {
                                                setCustomerSearch(e.target.value);
                                                setSelectedCustomer(null);
                                                setCustomerName('');
                                                handleCustomerSearch(e.target.value);
                                            }}
                                            onFocus={() => { if (customerSearch.length >= 1) setShowDropdown(true); }}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={openCustomerPicker}
                                            title="Pilih dari Master Customer"
                                            style={{
                                                whiteSpace: 'nowrap',
                                                padding: '0.55rem 0.75rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            📋 Daftar
                                        </button>
                                    </div>
                                    {showDropdown && customers.length > 0 && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                            background: 'white', border: '1px solid rgba(0,0,0,0.1)',
                                            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                                            maxHeight: 220, overflowY: 'auto',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                                        }}>
                                            {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.customer_code && c.customer_code.toLowerCase().includes(customerSearch.toLowerCase()))).map(c => (
                                                <div key={c.id}
                                                    onClick={() => selectCustomer(c)}
                                                    style={{
                                                        padding: '0.7rem 1rem', cursor: 'pointer',
                                                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                                                        transition: 'background 0.15s',
                                                        display: 'flex', alignItems: 'center', gap: '0.75rem'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--theme-primary-rgb), 0.05)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: '50%',
                                                        background: 'rgba(var(--theme-primary-rgb), 0.1)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '1rem', flexShrink: 0
                                                    }}>🏪</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>
                                                            {c.name}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.1rem' }}>
                                                            {c.customer_code && <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--primary-500)', fontWeight: 600 }}>{c.customer_code}</span>}
                                                            {c.address && <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {c.address}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected customer badge */}
                                    {selectedCustomer && (
                                        <div style={{
                                            marginTop: '0.5rem', padding: '0.6rem 0.75rem',
                                            background: 'rgba(16, 185, 129, 0.08)',
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                                        }}>
                                            <span>✅</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedCustomer.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                    {selectedCustomer.customer_code && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{selectedCustomer.customer_code}</span>}
                                                    {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                                                </div>
                                            </div>
                                            <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={() => { setSelectedCustomer(null); setCustomerName(''); setCustomerSearch(''); setAddress(''); }}>
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* MODE: Customer Baru */}
                            {customerMode === 'new' && (
                                <div className="form-group">
                                    <label className="form-label">Nama Customer Baru *</label>
                                    <input type="text" className="form-input"
                                        placeholder="Ketik nama customer / toko / tujuan baru..."
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                    />
                                    <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>
                                        💡 Customer baru akan otomatis tersimpan di Master Customer dengan kode otomatis
                                    </small>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Alamat (Opsional)</label>
                                <input type="text" className="form-input" placeholder="Alamat lokasi customer..."
                                    value={address} onChange={e => setAddress(e.target.value)} />
                            </div>
                            
                            {isCollection && (
                                <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label className="form-label">Nomor Invoice (Opsional)</label>
                                        <input type="text" className="form-input" placeholder="Ketik no invoice..."
                                            value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="form-label">Nilai Tagihan (Opsional)</label>
                                        <input type="text" className="form-input" placeholder="Rp..."
                                            value={formatCurrencyHelper(amountBilled)} onChange={e => setAmountBilled(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Catatan (Opsional)</label>
                                <textarea className="form-input" rows={2} placeholder="Catatan tambahan..."
                                    value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                            <button className="btn btn-success btn-block" onClick={openCameraForCheckin}
                                disabled={!customerName.trim() || !gpsLocation || gpsLoading}>
                                📸 Ambil Foto & Check-in
                            </button>
                        </div>
                    </div>

                    {/* Active Check-ins */}
                    {activeRecords.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-header">
                                <h2 className="card-title">🟢 Sedang di Lokasi ({activeRecords.length})</h2>
                            </div>
                            <div style={{ padding: '0.5rem' }}>
                                {activeRecords.map(rec => (
                                    <div key={rec.id} style={{
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '1rem 1.25rem',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--success-400)' }}>
                                                    🏪 {rec.customer_name} 
                                                    {rec.tracking_type === 'collection' && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Tagihan</span>}
                                                    {rec.tracking_type === 'sales' && <span className="badge badge-success" style={{ marginLeft: 6 }}>Sales</span>}
                                                    {rec.tracking_type === 'visit' && <span className="badge badge-outline" style={{ marginLeft: 6 }}>Kunjungan</span>}
                                                    {rec.tracking_type === 'delivery' && allowedTypes.length > 1 && <span className="badge badge-outline" style={{ marginLeft: 6 }}>Pengiriman</span>}
                                                </div>
                                                {rec.address && <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>{rec.address}</div>}
                                                {rec.tracking_type === 'collection' && rec.invoice_number && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-300)', marginTop: '0.2rem' }}>
                                                        📄 INV: {rec.invoice_number} {rec.amount_billed ? `(Rp ${formatCurrencyHelper(rec.amount_billed)})` : ''}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>
                                                    📥 Check-in: <strong>{formatTime(rec.checkin_time)}</strong>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                                    📍 {parseFloat(rec.checkin_latitude).toFixed(6)}, {parseFloat(rec.checkin_longitude).toFixed(6)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                                                <span className="badge badge-success" style={{ animation: 'pulse 2s infinite' }}>🟢 Aktif</span>
                                                {rec.checkin_photo_path && (
                                                    <img src={rec.checkin_photo_path} alt="Check-in"
                                                        className="photo-thumb-lg"
                                                        style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--success-500)' }}
                                                        onClick={() => setImageModal({ open: true, src: rec.checkin_photo_path, caption: `Check-in - ${rec.customer_name}` })}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        {rec.notes && <div style={{ fontSize: '0.85rem', color: 'var(--gray-300)', marginTop: '0.5rem', fontStyle: 'italic' }}>💬 {rec.notes}</div>}

                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                            <button className="btn btn-danger" onClick={() => openCameraForCheckout(rec)}
                                                disabled={submitting} style={{ flex: 1 }}>
                                                {getTrackingTypeMeta(rec.tracking_type).checkoutLabel}
                                            </button>
                                            <button className="btn btn-outline" onClick={() => openMapForRecords([rec])}
                                                style={{ padding: '0.5rem 0.75rem' }} title="Lihat di peta">
                                                🗺️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Today */}
                    {completedRecords.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 className="card-title">✅ Selesai Hari Ini ({completedRecords.length})</h2>
                                <button className="btn btn-outline" onClick={() => openMapForRecords(completedRecords)}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                    🗺️ Lihat Semua di Peta
                                </button>
                            </div>
                            <div style={{ padding: '0.5rem' }}>
                                {completedRecords.map(rec => (
                                    <div key={rec.id} style={{
                                        background: 'rgba(99, 102, 241, 0.06)',
                                        border: '1px solid rgba(99, 102, 241, 0.15)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '1rem 1.25rem',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                                                    🏪 {rec.customer_name}
                                                    {rec.tracking_type === 'collection' && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Tagihan</span>}
                                                    {rec.tracking_type === 'sales' && <span className="badge badge-success" style={{ marginLeft: 6 }}>Sales</span>}
                                                    {rec.tracking_type === 'visit' && <span className="badge badge-outline" style={{ marginLeft: 6 }}>Kunjungan</span>}
                                                    {rec.tracking_type === 'delivery' && allowedTypes.length > 1 && <span className="badge badge-outline" style={{ marginLeft: 6 }}>Pengiriman</span>}
                                                </div>
                                                {rec.address && <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>{rec.address}</div>}
                                                
                                                {rec.tracking_type === 'collection' && rec.collection_status && (
                                                    <div style={{ marginTop: '0.35rem', background: 'var(--gray-800)', padding: '0.4rem 0.6rem', borderRadius: 4, display: 'inline-block' }}>
                                                        <span style={{ fontSize: '0.8rem', color: rec.collection_status === 'Lunas' ? 'var(--success-400)' : rec.collection_status === 'Gagal' ? 'var(--danger-400)' : 'var(--warning-400)' }}>
                                                            {rec.collection_status === 'Lunas' ? '✅' : rec.collection_status === 'Gagal' ? '❌' : '⚠️'} <strong>{rec.collection_status}</strong>
                                                        </span>
                                                        {parseFloat(rec.amount_collected) > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--gray-300)', marginLeft: 8 }}>Rp {formatCurrencyHelper(rec.amount_collected)} ({rec.payment_method})</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {/* Photos */}
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    {rec.checkin_photo_path && (
                                                        <img src={rec.checkin_photo_path} alt="In"
                                                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--success-500)' }}
                                                            onClick={() => setImageModal({ open: true, src: rec.checkin_photo_path, caption: `Check-in - ${rec.customer_name}` })}
                                                        />
                                                    )}
                                                    {rec.checkout_photo_path && (
                                                        <img src={rec.checkout_photo_path} alt="Out"
                                                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--danger-500)' }}
                                                            onClick={() => setImageModal({ open: true, src: rec.checkout_photo_path, caption: `Check-out - ${rec.customer_name}` })}
                                                        />
                                                    )}
                                                </div>
                                                <span className="badge badge-primary">{calcDuration(rec.checkin_time, rec.checkout_time)}</span>
                                                <button className="btn btn-outline" onClick={() => openMapForRecords([rec])}
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>🗺️</button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                                                📥 In: <strong style={{ color: 'var(--success-400)' }}>{formatTime(rec.checkin_time)}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                                                📤 Out: <strong style={{ color: 'var(--danger-400)' }}>{formatTime(rec.checkout_time)}</strong>
                                            </div>
                                        </div>
                                        {rec.notes && <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginTop: '0.4rem', fontStyle: 'italic' }}>💬 {rec.notes}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {todayRecords.length === 0 && !loading && (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-icon">📍</div>
                                <p className="empty-state-text">Belum ada tracking hari ini. Silakan check-in di lokasi customer pertama Anda.</p>
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'history' && (
                <>
                    {/* Filter */}
                    <div className="card mb-4" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Dari Tanggal</label>
                                <input type="date" className="form-input" value={startDate}
                                    onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Sampai Tanggal</label>
                                <input type="date" className="form-input" value={endDate}
                                    onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button className="btn btn-primary" onClick={fetchHistory} style={{ height: 42 }}>🔍 Cari</button>
                        </div>
                    </div>

                    {historyRecords.length > 0 ? (
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 className="card-title">📋 Riwayat Tracking ({historyRecords.length})</h2>
                                <button className="btn btn-outline" onClick={() => openMapForRecords(historyRecords)}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                    🗺️ Peta Semua
                                </button>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Customer</th>
                                            <th>Check-in</th>
                                            <th>Check-out</th>
                                            <th>Durasi</th>
                                            <th>Foto</th>
                                            <th>Peta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRecords.map(rec => (
                                            <tr key={rec.id}>
                                                <td>{formatDate(rec.tracking_date)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{rec.customer_name}</div>
                                                    {rec.address && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{rec.address}</div>}
                                                </td>
                                                <td><span style={{ color: 'var(--success-400)' }}>{formatTime(rec.checkin_time)}</span></td>
                                                <td>
                                                    {rec.checkout_time
                                                        ? <span style={{ color: 'var(--danger-400)' }}>{formatTime(rec.checkout_time)}</span>
                                                        : <span className="badge badge-warning">Belum</span>
                                                    }
                                                </td>
                                                <td>{calcDuration(rec.checkin_time, rec.checkout_time)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                                                        {rec.checkin_photo_path && (
                                                            <img src={rec.checkin_photo_path} alt="In"
                                                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--success-500)' }}
                                                                onClick={() => setImageModal({ open: true, src: rec.checkin_photo_path, caption: 'Foto Check-in' })}
                                                            />
                                                        )}
                                                        {rec.checkout_photo_path && (
                                                            <img src={rec.checkout_photo_path} alt="Out"
                                                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--danger-500)' }}
                                                                onClick={() => setImageModal({ open: true, src: rec.checkout_photo_path, caption: 'Foto Check-out' })}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button className="btn btn-outline" onClick={() => openMapForRecords([rec])}
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>🗺️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <p className="empty-state-text">Belum ada riwayat tracking. Pilih rentang tanggal untuk mencari.</p>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Master Customer Picker */}
            {showCustomerPicker && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'var(--bg, #f8fafc)',
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{
                        padding: '0.9rem 1rem',
                        background: 'linear-gradient(135deg, var(--theme-primary, #b91c1c), #dc2626)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setShowCustomerPicker(false)}
                            style={{
                                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                width: 36, height: 36, borderRadius: 8, fontSize: '1.1rem', cursor: 'pointer'
                            }}
                        >
                            ←
                        </button>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Master Customer</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{pickerTotal} customer aktif</div>
                        </div>
                    </div>

                    <div style={{ padding: '0.85rem 1rem 0.5rem' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Cari nama, kode, alamat, atau telepon..."
                            value={pickerQuery}
                            onChange={(e) => handlePickerSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 1rem 1rem' }}>
                        {pickerLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto' }} />
                            </div>
                        ) : pickerCustomers.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                <div className="empty-state-icon">🏪</div>
                                <p className="empty-state-text">Customer tidak ditemukan</p>
                            </div>
                        ) : (
                            pickerCustomers.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => selectCustomer(c)}
                                    style={{
                                        width: '100%', textAlign: 'left',
                                        background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '0.6rem',
                                        display: 'flex', gap: '0.75rem', alignItems: 'center', cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                        background: 'rgba(185, 28, 28, 0.08)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>🏪</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                            {c.customer_code && <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: 8 }}>{c.customer_code}</span>}
                                            {c.phone && <span>{c.phone}</span>}
                                        </div>
                                        {c.address && (
                                            <div style={{
                                                fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}>
                                                📍 {c.address}
                                            </div>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--gray-400)', fontSize: '1.1rem' }}>›</span>
                                </button>
                            ))
                        )}
                    </div>

                    <div style={{
                        padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))',
                        borderTop: '1px solid rgba(0,0,0,0.08)',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem'
                    }}>
                        <button
                            type="button"
                            className="btn btn-outline"
                            disabled={pickerLoading || pickerPage <= 1}
                            onClick={() => fetchCustomerDirectory(pickerPage - 1, pickerQuery)}
                            style={{ minWidth: 88 }}
                        >
                            ← Kiri
                        </button>
                        <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                            Halaman {pickerPage} / {pickerTotalPages}
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline"
                            disabled={pickerLoading || pickerPage >= pickerTotalPages}
                            onClick={() => fetchCustomerDirectory(pickerPage + 1, pickerQuery)}
                            style={{ minWidth: 88 }}
                        >
                            Kanan →
                        </button>
                    </div>
                </div>
            )}

            {/* Map Modal */}
            {mapModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setMapModal({ ...mapModal, open: false })}>
                    <div style={{
                        background: 'var(--gray-900)', borderRadius: 'var(--radius-xl)',
                        width: '100%', maxWidth: 800, maxHeight: '85vh',
                        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-700)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🗺️ Peta Lokasi Tracking</h3>
                            <button onClick={() => setMapModal({ ...mapModal, open: false })}
                                style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ height: 450 }}>
                            <MapContainer center={mapModal.center} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {mapModal.records.map(rec => (
                                    <span key={rec.id}>
                                        {rec.checkin_latitude && (
                                            <Marker position={[parseFloat(rec.checkin_latitude), parseFloat(rec.checkin_longitude)]} icon={checkinIcon}>
                                                <Popup>
                                                    <div style={{ color: '#333' }}>
                                                        <strong>📥 Check-in</strong><br />
                                                        {rec.customer_name}<br />
                                                        {formatDateTime(rec.checkin_time)}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                        {rec.checkout_latitude && (
                                            <Marker position={[parseFloat(rec.checkout_latitude), parseFloat(rec.checkout_longitude)]} icon={checkoutIcon}>
                                                <Popup>
                                                    <div style={{ color: '#333' }}>
                                                        <strong>📤 Check-out</strong><br />
                                                        {rec.customer_name}<br />
                                                        {formatDateTime(rec.checkout_time)}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                    </span>
                                ))}
                            </MapContainer>
                        </div>
                        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--gray-400)', borderTop: '1px solid var(--gray-700)' }}>
                            <span>🟢 = Check-in</span>
                            <span>🔴 = Check-out</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {imageModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setImageModal({ ...imageModal, open: false })}>
                    <div style={{ textAlign: 'center', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <img src={imageModal.src} alt={imageModal.caption}
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-lg)', border: '2px solid var(--gray-600)' }} />
                        <p style={{ marginTop: '0.75rem', color: 'var(--gray-300)', fontSize: '0.9rem' }}>{imageModal.caption}</p>
                        <button className="btn btn-outline" onClick={() => setImageModal({ ...imageModal, open: false })}
                            style={{ marginTop: '0.5rem' }}>✕ Tutup</button>
                    </div>
                </div>
            )}
        </div>
    );
}
