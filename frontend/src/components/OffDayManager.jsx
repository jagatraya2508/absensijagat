import Icon from './Icon';
import { useState, useEffect } from 'react';
import { scheduleAPI } from '../utils/api';

export default function OffDayManager({ onClose, isPage = false }) {
    const [offDays, setOffDays] = useState([]);
    const [newOffDate, setNewOffDate] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOffDays();
    }, []);

    async function fetchOffDays() {
        try {
            setLoading(true);
            const data = await scheduleAPI.getOffDays();
            setOffDays(data || []);
        } catch (error) {
            console.error('Failed to fetch off days:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddOffDate() {
        if (!newOffDate) return;
        try {
            await scheduleAPI.addOffDays([newOffDate]);
            setNewOffDate('');
            fetchOffDays();
            alert('Tanggal libur berhasil ditambahkan');
        } catch (error) {
            console.error('Add off date error:', error);
            alert(`Gagal menambahkan tanggal libur: ${error.message}`);
        }
    }

    async function handleDeleteOffDate(date) {
        if (!confirm('Hapus tanggal libur ini?')) return;
        try {
            await scheduleAPI.deleteOffDay(date);
            fetchOffDays();
        } catch (error) {
            console.error('Delete off date error:', error);
            alert(`Gagal menghapus tanggal libur: ${error.message}`);
        }
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    const content = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Form Input */}
            <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Tambah Tanggal Libur
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                        type="date"
                        className="form-input"
                        style={{ fontSize: '1.05rem', padding: '0.85rem 1rem', flex: 1 }}
                        value={newOffDate}
                        onChange={(e) => setNewOffDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ fontSize: '1.3rem', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius)' }}
                        onClick={handleAddOffDate}
                    >
                        +
                    </button>
                </div>
            </div>

            {/* List */}
            <h4 style={{ margin: '1.25rem 0 0.75rem', color: 'var(--gray-300)', fontSize: '1rem' }}>
                Jadwal Libur Anda:
            </h4>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>Loading...</div>
                ) : offDays.length === 0 ? (
                    <p style={{ color: 'var(--gray-400)', fontSize: '1rem', textAlign: 'center', padding: '2rem 0' }}>
                        Belum ada jadwal libur.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '1rem' }}>
                        {offDays.map(day => (
                            <div key={day.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <span style={{ fontWeight: 500, fontSize: '1rem' }}>
                                    {formatDate(day.off_date)}
                                </span>
                                <button
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                                    onClick={() => {
                                        const dateObj = new Date(day.off_date);
                                        // Format manually to YYYY-MM-DD using local time
                                        const year = dateObj.getFullYear();
                                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                        const d = String(dateObj.getDate()).padStart(2, '0');
                                        handleDeleteOffDate(`${year}-${month}-${d}`);
                                    }}
                                >
                                    Hapus
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (isPage) {
        return (
            <div className="card" style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                    <h2 className="card-title"><Icon name="Calendar" size={16} inline /> Atur Tanggal Libur</h2>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', padding: '0 1.5rem 1.5rem' }}>
                    {content}
                </div>
            </div>
        );
    }

    return content;
}
