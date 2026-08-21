function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trailStats(trail) {
    if (!trail || trail.length < 2) {
        return { avgKmh: null, maxKmh: null };
    }
    const pts = trail.slice(-12);
    let dist = 0;
    let time = 0;
    let maxKmh = 0;
    for (let i = 1; i < pts.length; i++) {
        const d = haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        const dt = (new Date(pts[i].at) - new Date(pts[i - 1].at)) / 1000;
        if (dt <= 0 || dt > 90 || d > 1500) continue;
        dist += d;
        time += dt;
        const kmh = (d / dt) * 3.6;
        if (kmh > maxKmh && kmh < 160) maxKmh = kmh;
    }
    return {
        avgKmh: time >= 8 ? (dist / time) * 3.6 : null,
        maxKmh: maxKmh > 0 ? maxKmh : null,
    };
}

function registeredVehicleKind(name) {
    const n = String(name || '').toLowerCase();
    if (!n.trim()) return null;
    if (/(motor|matic|beat|vario|nmax|n-max|scoopy|vespa|yamaha|honda beat|sepeda motor|motorcycle)/i.test(n)) {
        return 'motorcycle';
    }
    if (/(mobil|pickup|pick up|truck|truk|tronton|colt|grandmax|avanza|innova|van|box|car|cde|cdd|fuso|hino)/i.test(n)) {
        return 'car';
    }
    return null;
}

function classifyMotion({ speedMs, trail, vehicleTypeName }) {
    const gpsKmh = speedMs != null && Number.isFinite(speedMs) && speedMs >= 0
        ? speedMs * 3.6
        : null;
    const { avgKmh, maxKmh } = trailStats(trail);
    const samples = [gpsKmh, avgKmh].filter((v) => v != null && Number.isFinite(v));
    const kmh = samples.length
        ? samples.reduce((a, b) => a + b, 0) / samples.length
        : 0;
    const peak = Math.max(kmh, maxKmh || 0, gpsKmh || 0);

    if (peak < 1.5) {
        return {
            mode: 'still',
            label: 'Diam / berhenti',
            icon: '🛑',
            speed_kmh: Math.round(kmh * 10) / 10,
            guessed: false,
        };
    }
    if (peak < 8) {
        return {
            mode: 'walk',
            label: 'Jalan kaki',
            icon: '🚶',
            speed_kmh: Math.round(kmh * 10) / 10,
            guessed: false,
        };
    }

    const registered = registeredVehicleKind(vehicleTypeName);
    if (registered === 'motorcycle') {
        return {
            mode: 'motorcycle',
            label: 'Naik motor',
            icon: '🏍️',
            speed_kmh: Math.round(kmh * 10) / 10,
            guessed: false,
            vehicle_type: vehicleTypeName,
        };
    }
    if (registered === 'car') {
        return {
            mode: 'car',
            label: 'Naik mobil',
            icon: '🚗',
            speed_kmh: Math.round(kmh * 10) / 10,
            guessed: false,
            vehicle_type: vehicleTypeName,
        };
    }

    if (peak >= 70) {
        return {
            mode: 'car',
            label: 'Naik mobil',
            icon: '🚗',
            speed_kmh: Math.round(kmh * 10) / 10,
            guessed: true,
        };
    }
    return {
        mode: 'motorcycle',
        label: 'Naik motor',
        icon: '🏍️',
        speed_kmh: Math.round(kmh * 10) / 10,
        guessed: true,
    };
}

module.exports = { classifyMotion, trailStats, haversineMeters };
