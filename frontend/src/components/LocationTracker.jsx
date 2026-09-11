import { useState, useEffect, useCallback } from 'react';
import Icon from './Icon';

export default function LocationTracker({ onLocationUpdate, targetLocation }) {
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [distance, setDistance] = useState(null);

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

    const getLocation = useCallback(() => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung oleh browser ini');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                };

                setLocation(coords);
                setLoading(false);

                // Calculate distance if target location provided
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
            },
            (err) => {
                setLoading(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError('Izin lokasi ditolak. Mohon izinkan akses lokasi di browser.');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError('Informasi lokasi tidak tersedia.');
                        break;
                    case err.TIMEOUT:
                        setError('Waktu pencarian lokasi habis.');
                        break;
                    default:
                        setError('Gagal mendapatkan lokasi.');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, [onLocationUpdate, targetLocation, calculateDistance]);

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
                    <div className="location-info-value">Mencari lokasi...</div>
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
                    <button className="btn btn-outline" onClick={getLocation} style={{ marginTop:'0.5rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
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
                <button className="btn btn-outline" onClick={getLocation} style={{ padding:'0.5rem', fontSize: '1rem' }}
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
