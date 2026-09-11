export const TRACKING_TYPES = {
    delivery: {
        key: 'delivery',
        label: 'Pengiriman',
        icon: 'Truck',
        title: 'Tracking Pengiriman',
        subtitle: 'Check-in & check-out di lokasi customer (pengiriman)',
        badgeClass: 'badge-outline',
        checkoutLabel: 'Foto & Check-out',
        checkoutIcon: 'Camera',
    },
    collection: {
        key: 'collection',
        label: 'Penagihan',
        icon: 'Wallet',
        title: 'Tracking Penagihan',
        subtitle: 'Check-in & check-out di lokasi customer (penagihan)',
        badgeClass: 'badge-warning',
        checkoutLabel: 'Lapor Tagihan & Out',
        checkoutIcon: 'FileText',
    },
    sales: {
        key: 'sales',
        label: 'Sales',
        icon: 'Handshake',
        title: 'Tracking Sales',
        subtitle: 'Check-in & check-out kunjungan sales ke customer',
        badgeClass: 'badge-success',
        checkoutLabel: 'Foto & Check-out',
        checkoutIcon: 'Camera',
    },
    visit: {
        key: 'visit',
        label: 'Kunjungan',
        icon: 'MapPin',
        title: 'Tracking Kunjungan',
        subtitle: 'Check-in & check-out di lokasi customer',
        badgeClass: 'badge-outline',
        checkoutLabel: 'Foto & Check-out',
        checkoutIcon: 'Camera',
    },
};

export function getTrackingTypeMeta(type) {
    return TRACKING_TYPES[type] || TRACKING_TYPES.visit;
}

export function getAllowedTrackingTypes(user) {
    if (!user) return ['visit'];
    if (user.role === 'admin') return ['delivery', 'collection', 'sales', 'visit'];

    const types = [];
    if (user.is_driver) types.push('delivery');
    if (user.is_collector) types.push('collection');
    if (user.is_sales) types.push('sales');
    if (types.length === 0 && user.use_tracking) types.push('visit');
    return types.length ? types : ['visit'];
}

export function getDefaultTrackingType(user) {
    return getAllowedTrackingTypes(user)[0];
}

export function getTrackingPageCopy(user) {
    const allowed = getAllowedTrackingTypes(user);
    if (allowed.length === 1) return getTrackingTypeMeta(allowed[0]);
    return {
        title: 'Tracking Kunjungan',
        subtitle: 'Check-in & check-out sesuai tugas Anda di lokasi customer',
        label: 'Kunjungan',
        icon: 'MapPin',
    };
}
