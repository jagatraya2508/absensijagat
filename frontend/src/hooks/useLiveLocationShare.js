import { useEffect, useRef } from 'react';
import { driverTrackingAPI } from '../utils/api';

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useLiveLocationShare(user) {
    const lastSent = useRef({ t: 0, lat: null, lng: null });

    useEffect(() => {
        if (!user?.use_tracking) return;
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;

        let cancelled = false;
        lastSent.current = { t: 0, lat: null, lng: null };

        async function send(coords) {
            if (cancelled || document.hidden) return;
            const now = Date.now();
            const prev = lastSent.current;
            if (prev.lat != null) {
                const dist = haversineMeters(prev.lat, prev.lng, coords.latitude, coords.longitude);
                if (dist < 15 && now - prev.t < 20000) return;
            } else if (now - prev.t < 8000) {
                return;
            }

            lastSent.current = { t: now, lat: coords.latitude, lng: coords.longitude };
            try {
                await driverTrackingAPI.pingLive({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                    heading: coords.heading,
                });
            } catch (_) { /* ignore ping errors */ }
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => send(pos.coords),
            () => {},
            { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 }
        );

        const onVis = () => {
            if (!document.hidden) lastSent.current.t = 0;
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            cancelled = true;
            navigator.geolocation.clearWatch(watchId);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [user?.id, user?.use_tracking]);
}
