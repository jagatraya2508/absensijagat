import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './Icon';

// Laptop dan kiosk tidak punya GPS. Lokasi jaringan (Wi-Fi) biasanya cukup
// untuk radius kantor dan jauh lebih cepat daripada menunggu satelit.
const NETWORK_FIX = {
    enableHighAccuracy: false,
    timeout: 12000,
    maximumAge: 60 * 1000,
};

const NETWORK_RETRY = {
    enableHighAccuracy: false,
    timeout: 20000,
    maximumAge: 5 * 60 * 1000,
};

function requestPosition(options) {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

function locationErrorMessage(err) {
    switch (err?.code) {
        case 1:
            return 'Izin lokasi ditolak. Izinkan lokasi di browser, lalu tekan Coba Lagi.';
        case 2:
            return 'Lokasi tidak tersedia. Nyalakan Wi-Fi dan layanan lokasi Windows, lalu coba lagi.';
        case 3:
            return 'Lokasi belum terbaca. Laptop memakai jaringan, bukan GPS. Nyalakan Wi-Fi dan layanan lokasi, lalu coba lagi.';
        default:
            return 'Gagal mendapatkan lokasi.';
    }
}

export default function LocationTracker({ onLocationUpdate, targetLocation }) {
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchLabel, setSearchLabel] = useState('Mencari lokasi...');
    const [distance, setDistance] = useState(null);
    const requestId = useRef(0);

    const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }, []);

    const applyPosition = useCallback((position) => {
        const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
        };

        setLocation(coords);
        setError(null);
        setLoading(false);

        if (targetLocation) {
            const dist = calculateDistance(
                coords.latitude,
                coords.longitude,
                parseFloat(targetLocation.latitude),
                parseFloat(targetLocation.longitude)
            );
            setDistance(dist);
        }

        if (onLocationUpdate) {
            onLocationUpdate(coords);
        }
    }, [onLocationUpdate, targetLocation, calculateDistance]);

    const getLocation = useCallback(async (fresh = false) => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);
        setSearchLabel('Mencari lokasi...');

        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung oleh browser ini');
            setLoading(false);
            return;
        }

        const stillCurrent = () => id === requestId.current;
        const firstOptions = fresh
            ? { ...NETWORK_FIX, maximumAge: 0, timeout: 20000 }
            : NETWORK_FIX;

        try {
            let position;
            try {
                position = await requestPosition(firstOptions);
            } catch (err) {
                // Izin ditolak atau layanan lokasi mati: jangan buat pengguna menunggu percobaan kedua.
                if (!stillCurrent() || err.code === 1 || err.code === 2) throw err;
                setSearchLabel('Masih mencari lewat jaringan...');
                position = await requestPosition(NETWORK_RETRY);
            }
            if (!stillCurrent()) return;
            applyPosition(position);
        } catch (err) {
            if (!stillCurrent()) return;
            setLoading(false);
            setError(locationErrorMessage(err));
        }
    }, [applyPosition]);

    useEffect(() => {
        getLocation();
    }, []);

    // Refresh location when target changes
    useEffect(() => {
        if (location && targetLocation) {
            const dist = calculateDistance(
                location.latitude,
                location.longitude,
                parseFloat(targetLocation.latitude),
                parseFloat(targetLocation.longitude)
            );
            setDistance(dist);
        }
    }, [targetLocation, location, calculateDistance]);

    if (loading) {
        return (
            <div className="location-info">
                <span className="location-info-icon"><Icon name="LoaderCircle" size={20} /></span>
                <div className="location-info-content">
                    <div className="location-info-label">Lokasi</div>
                    <div className="location-info-value">{searchLabel}</div>
                </div>
                <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            </div>
        );
    }
    if (error) {
        return (
            <div className="alert alert-danger">
                <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span>
                <div style={{ flex: 1 }}>
                    <p>{error}</p>
                    <button className="btn btn-outline" onClick={() => getLocation(true)} style={{ marginTop:'0.5rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    const isWithinRadius = targetLocation && distance !== null
        ? distance <= (targetLocation.radius_meters || 100)
        : null;

    return (
        <div>
            <div className="location-info">
                <span className="location-info-icon"><Icon name="MapPin" size={20} /></span>
                <div className="location-info-content">
                    <div className="location-info-label">Koordinat Anda</div>
                    <div className="location-info-value"> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} </div>
                </div>
                <button className="btn btn-outline" onClick={() => getLocation(true)} style={{ padding:'0.5rem', fontSize: '1rem' }}
                    title="Refresh lokasi"
                >
                    <Icon name="RefreshCw" size={16} />
                </button>
            </div>
            {targetLocation && distance !== null && (
                <div className="location-info" style={{ marginTop:'0.5rem' }}>
                    <span className="location-info-icon"><Icon name="Building2" size={20} /></span>
                    <div className="location-info-content">
                        <div className="location-info-label">{targetLocation.name}</div>
                        <div className="location-info-value"> Jarak: {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(2)}km`} </div>
                    </div>
                    <span className={`location-distance ${isWithinRadius ? 'valid' : 'invalid'}`}>
                        {isWithinRadius ? <><Icon name="Check" size={16} inline /> Dalam Area</> : <><Icon name="AlertTriangle" size={16} inline /> Diluar Area</>}
                    </span>
                </div>
            )}

            {location.accuracy && (
                <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Akurasi: ±{Math.round(location.accuracy)}m
                </div>
            )}
        </div>
    );
}
