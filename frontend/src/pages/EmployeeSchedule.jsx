import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import CompanyCalendar from '../components/CompanyCalendar';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function EmployeeSchedule() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    const [calendarEvents, setCalendarEvents] = useState([]);
    const [calendarFilter, setCalendarFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), user_id: user?.id || '' });

    const fetchCalendarEvents = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (calendarFilter.month) params.append('month', calendarFilter.month);
            if (calendarFilter.year) params.append('year', calendarFilter.year);
            // By default, employees might only want to see their own.
            // But if they want to see all, they can clear this if we allowed it. 
            // We'll pass the user_id filter if it exists.
            if (calendarFilter.user_id) params.append('user_id', calendarFilter.user_id);
            
            const res = await fetch(`${API}/calendar?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setCalendarEvents(data);
        } catch (e) { console.error(e); }
    }, [token, calendarFilter]);

    useEffect(() => {
        fetchCalendarEvents();
    }, [fetchCalendarEvents]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🗓️ Jadwal Kerja & Kalender</h1>
                <p className="page-subtitle">Lihat jadwal shift, hari libur, dan cuti Anda bulan ini</p>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Bulan</label>
                        <select className="form-input form-select" value={calendarFilter.month}
                            onChange={e => setCalendarFilter(f => ({ ...f, month: e.target.value }))}>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tahun</label>
                        <input type="number" className="form-input" value={calendarFilter.year}
                            onChange={e => setCalendarFilter(f => ({ ...f, year: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tampilan</label>
                        <select className="form-input form-select" value={calendarFilter.user_id}
                            onChange={e => setCalendarFilter(f => ({ ...f, user_id: e.target.value }))}>
                            <option value={user?.id}>Hanya Jadwal Saya</option>
                            <option value="">Seluruh Perusahaan</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" style={{ height: '44px' }} onClick={fetchCalendarEvents}>🔍 Filter</button>
                </div>
            </div>

            <CompanyCalendar 
                events={calendarEvents} 
                date={new Date(calendarFilter.year, calendarFilter.month - 1, 1)}
                onSelectEvent={(event) => alert(`${event.title}\n${event.start.toLocaleString()} - ${event.end.toLocaleString()}`)}
                onNavigate={(date) => {
                    setCalendarFilter(f => ({ ...f, month: date.getMonth() + 1, year: date.getFullYear() }));
                }}
            />
        </div>
    );
}
