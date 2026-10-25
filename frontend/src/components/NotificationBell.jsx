import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../utils/api';
import Icon from './Icon';

function canReceiveNotifications(user, hasPermission) {
    if (!user) return false;
    return user.role === 'admin'
        || user.role === 'manager'
        || user.is_supervisor
        || hasPermission('manager.approvals')
        || hasPermission('manager.leave_approvals')
        || hasPermission('admin.leaves')
        || hasPermission('admin.manual_attendance');
}

function formatWhen(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function NotificationBell() {
    const { user, hasPermission } = useAuth();
    const navigate = useNavigate();
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);

    const visible = canReceiveNotifications(user, hasPermission);

    async function load() {
        try {
            const data = await notificationsAPI.list();
            setItems(data.items || []);
            setUnread(data.unread || 0);
        } catch (error) {
            console.error('Gagal memuat notifikasi', error);
        }
    }

    useEffect(() => {
        if (!visible) return undefined;
        load();
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
    }, [visible, user?.id]);

    useEffect(() => {
        if (!open) return undefined;
        function onPointerDown(event) {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    if (!visible) return null;

    async function openItem(item) {
        setOpen(false);
        if (!item.is_read) {
            try {
                await notificationsAPI.markRead(item.id);
            } catch (error) {
                console.error('Gagal menandai notifikasi', error);
            }
            setItems((current) => current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)));
            setUnread((current) => Math.max(0, current - 1));
        }
        if (item.link) navigate(item.link);
    }

    async function markAll() {
        try {
            await notificationsAPI.markAllRead();
            setItems((current) => current.map((row) => ({ ...row, is_read: true })));
            setUnread(0);
        } catch (error) {
            console.error('Gagal menandai semua notifikasi', error);
        }
    }

    return (
        <div className="notification-bell" ref={rootRef}>
            <button
                type="button"
                className="notification-bell-btn"
                aria-label={unread ? `${unread} notifikasi belum dibaca` : 'Notifikasi'}
                onClick={() => setOpen((current) => !current)}
            >
                <Icon name="Bell" size={18} />
                {unread > 0 && (
                    <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>
                )}
            </button>
            {open && (
                <div className="notification-panel">
                    <div className="notification-panel-head">
                        <strong>Notifikasi</strong>
                        {unread > 0 && (
                            <button type="button" className="notification-mark-all" onClick={markAll}>
                                Tandai dibaca
                            </button>
                        )}
                    </div>
                    {items.length === 0 ? (
                        <p className="notification-empty">Belum ada pengajuan baru.</p>
                    ) : (
                        <div className="notification-list">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`notification-item${item.is_read ? '' : ' is-unread'}`}
                                    onClick={() => openItem(item)}
                                >
                                    <span className="notification-item-title">{item.title}</span>
                                    <span className="notification-item-message">{item.message}</span>
                                    <span className="notification-item-time">{formatWhen(item.created_at)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
