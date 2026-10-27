import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import CompanyCalendar from '../components/CompanyCalendar';
import Icon from '../components/Icon';
import { shiftChangeRequestsAPI } from '../utils/api';

const API = import.meta.env.VITE_API_URL || '/api';

export default function EmployeeSchedule() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'requests'

    // Calendar state
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [calendarFilter, setCalendarFilter] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        user_id: user?.id || ''
    });
    const [employees, setEmployees] = useState([]);
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
    const [tablePage, setTablePage] = useState(1);
    const TABLE_PAGE_SIZE = 15;

    // Shift Change Requests state
    const [myRequests, setMyRequests] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [reqFilterStatus, setReqFilterStatus] = useState('');
    const [reqPage, setReqPage] = useState(1);
    const REQ_PAGE_SIZE = 10;
    const [allShifts, setAllShifts] = useState([]);
    const [colleagues, setColleagues] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [formData, setFormData] = useState({
        request_type: 'change', // 'change' | 'swap'
        request_date: new Date().toISOString().slice(0, 10),
        target_shift_id: '',
        target_user_id: '',
        reason: ''
    });

    const [myCurrentShift, setMyCurrentShift] = useState(null);
    const [targetUserShift, setTargetUserShift] = useState(null);
    const [checkingShift, setCheckingShift] = useState(false);

    // Fetch Calendar
    const fetchCalendarEvents = useCallback(async (customFilter) => {
        try {
            const f = customFilter || calendarFilter;
            const params = new URLSearchParams();
            if (f.month) params.append('month', f.month);
            if (f.year) params.append('year', f.year);
            if (f.user_id) params.append('user_id', f.user_id);

            const res = await fetch(`${API}/calendar?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setCalendarEvents(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Fetch calendar error:', e);
        }
    }, [token, calendarFilter]);

    // Sorted events for Table View
    const sortedEvents = useMemo(() => {
        return [...calendarEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [calendarEvents]);

    // Pagination for Table View
    const totalTablePages = Math.max(1, Math.ceil(sortedEvents.length / TABLE_PAGE_SIZE));
    const safeTablePage = Math.min(tablePage, totalTablePages);
    const pagedEvents = sortedEvents.slice((safeTablePage - 1) * TABLE_PAGE_SIZE, safeTablePage * TABLE_PAGE_SIZE);

    // Pagination for Shift Requests
    const totalReqPages = Math.max(1, Math.ceil(myRequests.length / REQ_PAGE_SIZE));
    const safeReqPage = Math.min(reqPage, totalReqPages);
    const pagedRequests = myRequests.slice((safeReqPage - 1) * REQ_PAGE_SIZE, safeReqPage * REQ_PAGE_SIZE);

    // Fetch My Shift Change Requests
    const fetchMyRequests = useCallback(async () => {
        setReqLoading(true);
        try {
            const params = {};
            if (reqFilterStatus) params.status = reqFilterStatus;
            const data = await shiftChangeRequestsAPI.getMy(params);
            setMyRequests(data || []);
        } catch (e) {
            console.error('Fetch shift requests error:', e);
        } finally {
            setReqLoading(false);
        }
    }, [reqFilterStatus]);

    // Fetch master shifts, colleagues, and employees
    const fetchMasters = async () => {
        try {
            const [shiftRes, collRes, empRes] = await Promise.all([
                fetch(`${API}/work-schedules/shifts/all`, { headers: { Authorization: `Bearer ${token}` } }),
                shiftChangeRequestsAPI.getColleagues(),
                fetch(`${API}/work-schedules/helpers/employees`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (shiftRes.ok) {
                const sData = await shiftRes.json();
                setAllShifts(sData || []);
            }
            if (collRes) {
                setColleagues(collRes || []);
            }
            if (empRes.ok) {
                const eData = await empRes.json();
                setEmployees(eData || []);
            }
        } catch (e) {
            console.error('Fetch masters error:', e);
        }
    };

    useEffect(() => {
        fetchCalendarEvents();
        fetchMyRequests();
        fetchMasters();
    }, []);

    useEffect(() => {
        if (activeTab === 'requests') {
            fetchMyRequests();
        }
    }, [activeTab, fetchMyRequests]);

    // Detect user's current shift when date changes
    useEffect(() => {
        if (!showModal) return;
        let isMounted = true;
        setCheckingShift(true);

        shiftChangeRequestsAPI.getUserShift(user?.id, formData.request_date)
            .then(res => {
                if (isMounted) {
                    setMyCurrentShift(res.shift || null);
                }
            })
            .catch(() => {
                if (isMounted) setMyCurrentShift(null);
            })
            .finally(() => {
                if (isMounted) setCheckingShift(false);
            });

        return () => { isMounted = false; };
    }, [formData.request_date, showModal, user?.id]);

    // Detect target user's shift when target user changes
    useEffect(() => {
        if (!showModal || formData.request_type !== 'swap' || !formData.target_user_id) {
            setTargetUserShift(null);
            return;
        }

        let isMounted = true;
        shiftChangeRequestsAPI.getUserShift(formData.target_user_id, formData.request_date)
            .then(res => {
                if (isMounted) {
                    setTargetUserShift(res.shift || null);
                }
            })
            .catch(() => {
                if (isMounted) setTargetUserShift(null);
            });

        return () => { isMounted = false; };
    }, [formData.target_user_id, formData.request_date, formData.request_type, showModal]);

    const handleOpenModal = () => {
        setErrorMsg('');
        setSuccessMsg('');
        setFormData({
            request_type: 'change',
            request_date: new Date().toISOString().slice(0, 10),
            target_shift_id: '',
            target_user_id: '',
            reason: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!formData.reason || !formData.reason.trim()) {
            setErrorMsg('Alasan permohonan wajib diisi');
            return;
        }

        if (formData.request_type === 'change' && !formData.target_shift_id) {
            setErrorMsg('Shift tujuan wajib dipilih');
            return;
        }

        if (formData.request_type === 'swap') {
            if (!formData.target_user_id) {
                setErrorMsg('Rekan kerja untuk tukar shift wajib dipilih');
                return;
            }
            if (!targetUserShift) {
                setErrorMsg('Rekan kerja yang dipilih belum memiliki jadwal shift di tanggal tersebut');
                return;
            }
        }

        setSubmitting(true);
        try {
            await shiftChangeRequestsAPI.create(formData);
            setSuccessMsg('Pengajuan perubahan shift berhasil dikirim! Menunggu persetujuan atasan/HR.');
            setShowModal(false);
            fetchMyRequests();
            fetchCalendarEvents();
        } catch (err) {
            setErrorMsg(err.message || 'Gagal mengirim pengajuan shift');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelRequest = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin membatalkan pengajuan ini?')) return;
        try {
            await shiftChangeRequestsAPI.delete(id);
            fetchMyRequests();
        } catch (err) {
            alert(err.message || 'Gagal membatalkan pengajuan');
        }
    };

    const formatTime = (t) => {
        if (!t) return '-';
        return String(t).substring(0, 5);
    };

    const formatDateIndo = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const pendingCount = myRequests.filter(r => r.status === 'pending').length;

    const renderPaginationControls = (currentPage, totalPages, onPageChange) => {
        if (totalPages <= 1) return null;

        const pages = [];
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }
        for (let p = start; p <= end; p++) {
            pages.push(p);
        }

        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem 0' }}>
                <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                >
                    &larr; Sebelumnya
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {start > 1 && (
                        <>
                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', minWidth: '32px' }}
                                onClick={() => onPageChange(1)}
                            >
                                1
                            </button>
                            {start > 2 && <span style={{ padding: '0 0.25rem', color: 'var(--gray-400)' }}>...</span>}
                        </>
                    )}
                    {pages.map(p => (
                        <button
                            key={p}
                            type="button"
                            className={`btn ${p === currentPage ? 'btn-primary' : 'btn-outline'}`}
                            style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', minWidth: '32px' }}
                            onClick={() => onPageChange(p)}
                        >
                            {p}
                        </button>
                    ))}
                    {end < totalPages && (
                        <>
                            {end < totalPages - 1 && <span style={{ padding: '0 0.25rem', color: 'var(--gray-400)' }}>...</span>}
                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', minWidth: '32px' }}
                                onClick={() => onPageChange(totalPages)}
                            >
                                {totalPages}
                            </button>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                >
                    Selanjutnya &rarr;
                </button>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="page-title"><Icon name="CalendarClock" size={20} inline /> Jadwal Kerja & Shift</h1>
                    <p className="page-subtitle">Lihat jadwal kerja, kalender libur, serta kelola pengajuan tukar / pindah shift</p>
                </div>
                {activeTab === 'requests' && (
                    <button className="btn btn-primary" onClick={handleOpenModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name="Plus" size={16} /> Ajukan Perubahan Shift
                    </button>
                )}
            </div>

            {/* TAB NAVIGATION */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>
                <button
                    className={`btn ${activeTab === 'calendar' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('calendar')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-lg)' }}
                >
                    <Icon name="Calendar" size={16} /> Kalender Jadwal
                </button>
                <button
                    className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('requests')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-lg)' }}
                >
                    <Icon name="Repeat" size={16} /> Pengajuan Tukar / Pindah Shift
                    {pendingCount > 0 && (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '10px' }}>
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {successMsg && (
                <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                    <span className="alert-icon"><Icon name="CheckCircle" size={16} inline /></span>
                    {successMsg}
                </div>
            )}

            {/* TAB 1: CALENDAR VIEW */}
            {activeTab === 'calendar' && (
                <div>
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Bulan</label>
                                <select
                                    className="form-input form-select"
                                    value={calendarFilter.month}
                                    onChange={e => {
                                        setCalendarFilter(f => ({ ...f, month: e.target.value }));
                                        setTablePage(1);
                                    }}
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tahun</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={calendarFilter.year}
                                    onChange={e => {
                                        setCalendarFilter(f => ({ ...f, year: e.target.value }));
                                        setTablePage(1);
                                    }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tampilan</label>
                                <select
                                    className="form-input form-select"
                                    value={calendarFilter.user_id}
                                    onChange={e => {
                                        setCalendarFilter(f => ({ ...f, user_id: e.target.value }));
                                        setTablePage(1);
                                    }}
                                >
                                    <option value={user?.id}>Hanya Jadwal Saya</option>
                                    <option value="">Seluruh Perusahaan</option>
                                    {employees.length > 0 && (
                                        <optgroup label="Pilih Karyawan Spesifik">
                                            {employees.map(emp => (
                                                emp.id !== user?.id && (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}
                                                    </option>
                                                )
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ height: '42px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                    onClick={() => {
                                        setTablePage(1);
                                        fetchCalendarEvents();
                                    }}
                                >
                                    <Icon name="Filter" size={15} /> Filter
                                </button>
                                {calendarFilter.user_id !== (user?.id || '') && (
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ height: '42px', padding: '0 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                        onClick={() => {
                                            const resetF = { ...calendarFilter, user_id: user?.id || '' };
                                            setCalendarFilter(resetF);
                                            setTablePage(1);
                                            fetchCalendarEvents(resetF);
                                        }}
                                        title="Kembalikan ke Jadwal Saya"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* VIEW SWITCHER: KALENDER VS TABEL */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                            Menemukan <strong>{sortedEvents.length}</strong> jadwal kegiatan di periode ini
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--gray-100)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                            <button
                                type="button"
                                onClick={() => setViewMode('calendar')}
                                className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <Icon name="Calendar" size={14} /> Kalender
                            </button>
                            <button
                                type="button"
                                onClick={() => { setViewMode('table'); setTablePage(1); }}
                                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <Icon name="List" size={14} /> Tabel ({sortedEvents.length})
                            </button>
                        </div>
                    </div>

                    {viewMode === 'calendar' ? (
                        <CompanyCalendar
                            events={calendarEvents}
                            date={new Date(calendarFilter.year, calendarFilter.month - 1, 1)}
                            onSelectEvent={(event) => alert(`${event.title}\n${event.start.toLocaleString()} - ${event.end.toLocaleString()}`)}
                            onNavigate={(date) => {
                                setCalendarFilter(f => ({ ...f, month: date.getMonth() + 1, year: date.getFullYear() }));
                            }}
                        />
                    ) : (
                        <div className="card">
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px' }}>No</th>
                                            <th>Tanggal</th>
                                            <th>Nama Karyawan</th>
                                            <th>Tipe Kegiatan</th>
                                            <th>Keterangan / Shift</th>
                                            <th>Jam Kerja</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedEvents.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--gray-500)' }}>
                                                    Tidak ada jadwal ditemukan untuk filter ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            pagedEvents.map((ev, idx) => {
                                                const globalIndex = (safeTablePage - 1) * TABLE_PAGE_SIZE + idx + 1;
                                                const evDate = new Date(ev.start);
                                                const isToday = new Date().toDateString() === evDate.toDateString();

                                                let typeBadge = <span className="badge badge-primary">Shift Kerja</span>;
                                                if (ev.type === 'leave') {
                                                    typeBadge = <span className="badge badge-warning">Cuti / Izin</span>;
                                                } else if (ev.type === 'off_day') {
                                                    typeBadge = <span className="badge badge-danger">Libur / Off</span>;
                                                } else if (ev.type === 'overtime') {
                                                    typeBadge = <span className="badge badge-info" style={{ background: '#8b5cf6', color: '#fff' }}>Lembur</span>;
                                                } else if (ev.type === 'national_holiday') {
                                                    typeBadge = <span className="badge badge-danger">Libur Nasional</span>;
                                                }

                                                let detailText = ev.shift_name || ev.title;
                                                if (ev.type === 'leave' && ev.leave_type) {
                                                    detailText = `Cuti (${ev.leave_type.toUpperCase()})`;
                                                }

                                                let hoursText = '-';
                                                if (ev.start_time && ev.end_time) {
                                                    hoursText = `${ev.start_time.substring(0, 5)} - ${ev.end_time.substring(0, 5)}`;
                                                } else if (ev.start && ev.end && !ev.allDay) {
                                                    const sStr = new Date(ev.start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                                    const eStr = new Date(ev.end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                                    hoursText = `${sStr} - ${eStr}`;
                                                }

                                                return (
                                                    <tr key={ev.id || idx} style={isToday ? { background: 'rgba(59,130,246,0.06)' } : {}}>
                                                        <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>{globalIndex}</td>
                                                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                            {formatDateIndo(ev.start)}
                                                            {isToday && <span className="badge badge-primary" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>Hari Ini</span>}
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{ev.user_name || '-'}</td>
                                                        <td>{typeBadge}</td>
                                                        <td><span style={{ fontWeight: 600 }}>{detailText}</span></td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{hoursText}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {sortedEvents.length > 0 && (
                                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                                    <span>
                                        Menampilkan {(safeTablePage - 1) * TABLE_PAGE_SIZE + 1} - {Math.min(safeTablePage * TABLE_PAGE_SIZE, sortedEvents.length)} dari {sortedEvents.length} data
                                    </span>
                                    <span>Halaman {safeTablePage} dari {totalTablePages}</span>
                                </div>
                            )}
                            {renderPaginationControls(safeTablePage, totalTablePages, setTablePage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: SHIFT CHANGE REQUESTS */}
            {activeTab === 'requests' && (
                <div>
                    <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)' }}>Filter Status:</span>
                                {['', 'pending', 'approved', 'rejected'].map(st => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => { setReqFilterStatus(st); setReqPage(1); }}
                                        className={`btn ${reqFilterStatus === st ? 'btn-primary' : 'btn-outline'}`}
                                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)' }}
                                    >
                                        {st === '' ? 'Semua' : st === 'pending' ? 'Menunggu' : st === 'approved' ? 'Disetujui' : 'Ditolak'}
                                    </button>
                                ))}
                            </div>
                            <button className="btn btn-primary" onClick={handleOpenModal} style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
                                <Icon name="Plus" size={14} inline /> Ajukan Perubahan Shift
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        {reqLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 0.75rem' }} />
                                <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Memuat data pengajuan...</span>
                            </div>
                        ) : myRequests.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <Icon name="CalendarCheck" size={42} style={{ color: 'var(--gray-400)', marginBottom: '0.75rem' }} />
                                <h3 style={{ fontSize: '1.05rem', color: 'var(--gray-700)', margin: '0 0 0.5rem' }}>Belum Ada Pengajuan Shift</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: '0 0 1rem' }}>
                                    Anda belum pernah mengajukan pindah shift atau tukar shift dengan rekan kerja.
                                </p>
                                <button className="btn btn-primary" onClick={handleOpenModal}>
                                    <Icon name="Plus" size={14} inline /> Ajukan Sekarang
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Tipe</th>
                                            <th>Perubahan Shift</th>
                                            <th>Rekan Kerja</th>
                                            <th>Alasan</th>
                                            <th>Status</th>
                                            <th>Catatan Atasan</th>
                                            <th style={{ textAlign: 'center' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRequests.map(r => {
                                            const isRequester = r.user_id === user?.id;
                                            return (
                                                <tr key={r.id}>
                                                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        {formatDateIndo(r.request_date)}
                                                    </td>
                                                    <td>
                                                        {r.request_type === 'swap' ? (
                                                            <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon name="Repeat" size={11} inline /> Tukar Shift
                                                            </span>
                                                        ) : (
                                                            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon name="ArrowRightLeft" size={11} inline /> Pindah Shift
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                                                            <span style={{
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: 'var(--radius-sm)',
                                                                background: r.current_shift_color ? `${r.current_shift_color}25` : 'var(--gray-100)',
                                                                color: r.current_shift_color || 'var(--gray-800)',
                                                                fontWeight: 600
                                                            }}>
                                                                {r.current_shift_name ? `${r.current_shift_name} (${formatTime(r.current_shift_start)})` : 'Shift Reguler'}
                                                            </span>
                                                            <Icon name="ArrowRight" size={13} style={{ color: 'var(--gray-400)' }} />
                                                            <span style={{
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: 'var(--radius-sm)',
                                                                background: r.target_shift_color ? `${r.target_shift_color}25` : 'rgba(16,185,129,0.15)',
                                                                color: r.target_shift_color || '#059669',
                                                                fontWeight: 700
                                                            }}>
                                                                {r.target_shift_name} ({formatTime(r.target_shift_start)}-{formatTime(r.target_shift_end)})
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {r.request_type === 'swap' ? (
                                                            <div>
                                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                                    {isRequester ? r.target_user_name : r.user_name}
                                                                </span>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                                                                    {isRequester ? `(${r.target_employee_id})` : `(Pemohon: ${r.user_employee_id})`}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ maxWidth: '200px', fontSize: '0.82rem' }}>
                                                        {r.reason}
                                                    </td>
                                                    <td>
                                                        {r.status === 'pending' && (
                                                            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon name="Clock" size={11} inline /> Menunggu
                                                            </span>
                                                        )}
                                                        {r.status === 'approved' && (
                                                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon name="CheckCircle2" size={11} inline /> Disetujui
                                                            </span>
                                                        )}
                                                        {r.status === 'rejected' && (
                                                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Icon name="XCircle" size={11} inline /> Ditolak
                                                            </span>
                                                        )}
                                                        {r.status === 'cancelled' && (
                                                            <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                Dibatalkan
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                                                        {r.approval_notes ? (
                                                            <span>{r.approval_notes} {r.approved_by_name && <small style={{ color: 'var(--gray-400)' }}>(oleh {r.approved_by_name})</small>}</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--gray-400)' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {r.status === 'pending' && isRequester ? (
                                                            <button
                                                                className="btn btn-outline"
                                                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger-500)', borderColor: 'var(--danger-200)' }}
                                                                onClick={() => handleCancelRequest(r.id)}
                                                                title="Batalkan permohonan ini"
                                                            >
                                                                Batalkan
                                                            </button>
                                                        ) : (
                                                            <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {myRequests.length > 0 && (
                                <div style={{ padding: '0.75rem 1rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--gray-600)', borderTop: '1px solid var(--gray-100)' }}>
                                    <span>
                                        Menampilkan {(safeReqPage - 1) * REQ_PAGE_SIZE + 1} - {Math.min(safeReqPage * REQ_PAGE_SIZE, myRequests.length)} dari {myRequests.length} pengajuan
                                    </span>
                                    <span>Halaman {safeReqPage} dari {totalReqPages}</span>
                                </div>
                            )}
                            {renderPaginationControls(safeReqPage, totalReqPages, setReqPage)}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL PENGAJUAN PERUBAHAN SHIFT */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Icon name="Repeat" size={18} inline /> Form Pengajuan Perubahan Shift
                            </h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <Icon name="X" size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
                            {errorMsg && (
                                <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                                    <span className="alert-icon"><Icon name="AlertTriangle" size={15} inline /></span>
                                    {errorMsg}
                                </div>
                            )}

                            {/* PILIHAN TIPE */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Tipe Permohonan</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div
                                        onClick={() => setFormData(f => ({ ...f, request_type: 'change' }))}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: `2px solid ${formData.request_type === 'change' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: formData.request_type === 'change' ? 'rgba(59,130,246,0.08)' : 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                            <input
                                                type="radio"
                                                name="req_type"
                                                checked={formData.request_type === 'change'}
                                                onChange={() => {}}
                                                style={{ accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: formData.request_type === 'change' ? 'var(--primary-600)' : 'var(--gray-800)' }}>
                                                Pindah Shift Sendiri
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)', paddingLeft: '1.4rem' }}>
                                            Pindah ke jam shift lain di tanggal yang sama
                                        </p>
                                    </div>

                                    <div
                                        onClick={() => setFormData(f => ({ ...f, request_type: 'swap' }))}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: `2px solid ${formData.request_type === 'swap' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: formData.request_type === 'swap' ? 'rgba(59,130,246,0.08)' : 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                            <input
                                                type="radio"
                                                name="req_type"
                                                checked={formData.request_type === 'swap'}
                                                onChange={() => {}}
                                                style={{ accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: formData.request_type === 'swap' ? 'var(--primary-600)' : 'var(--gray-800)' }}>
                                                Tukar dengan Rekan
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)', paddingLeft: '1.4rem' }}>
                                            Saling bertukar shift dengan rekan kerja
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* TANGGAL SHIFT */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Tanggal Shift yang Ingin Diubah <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.request_date}
                                    onChange={e => setFormData(f => ({ ...f, request_date: e.target.value }))}
                                    required
                                />
                            </div>

                            {/* DETEKSI SHIFT SAYA SAAT INI */}
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(59,130,246,0.06)',
                                border: '1px solid rgba(59,130,246,0.2)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1.25rem'
                            }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'block', marginBottom: '0.25rem' }}>
                                    Jadwal Shift Anda Saat Ini pada {formatDateIndo(formData.request_date)}:
                                </span>
                                {checkingShift ? (
                                    <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>Mengecek jadwal...</span>
                                ) : myCurrentShift ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: '0.92rem',
                                            color: myCurrentShift.color || 'var(--primary-600)'
                                        }}>
                                            {myCurrentShift.name}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                                            ({formatTime(myCurrentShift.start_time)} - {formatTime(myCurrentShift.end_time)})
                                        </span>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '0.85rem', color: 'var(--warning-600)', fontWeight: 500 }}>
                                        ⚠️ Anda belum memiliki jadwal shift resmi di tanggal ini (akan memakai jadwal default).
                                    </span>
                                )}
                            </div>

                            {/* JIKA TIPE: PINDAH SHIFT SENDIRI */}
                            {formData.request_type === 'change' && (
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Shift Baru yang Diinginkan <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        className="form-input form-select"
                                        value={formData.target_shift_id}
                                        onChange={e => setFormData(f => ({ ...f, target_shift_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Pilih Shift Baru...</option>
                                        {allShifts
                                            .filter(s => !myCurrentShift || s.id !== myCurrentShift.id)
                                            .map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)}) - {s.schedule_name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {/* JIKA TIPE: TUKAR SHIFT DENGAN REKAN */}
                            {formData.request_type === 'swap' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>Pilih Rekan Kerja untuk Tukar Shift <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            className="form-input form-select"
                                            value={formData.target_user_id}
                                            onChange={e => setFormData(f => ({ ...f, target_user_id: e.target.value }))}
                                            required
                                        >
                                            <option value="">Pilih Rekan Kerja...</option>
                                            {colleagues.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} {c.department ? `(${c.department})` : ''} - {c.employee_id}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {formData.target_user_id && (
                                        <div style={{
                                            padding: '0.75rem 1rem',
                                            background: targetUserShift ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                                            border: `1px solid ${targetUserShift ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'block', marginBottom: '0.25rem' }}>
                                                Jadwal Shift Rekan Kerja pada {formatDateIndo(formData.request_date)}:
                                            </span>
                                            {targetUserShift ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: targetUserShift.color || '#059669' }}>
                                                        {targetUserShift.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                                                        ({formatTime(targetUserShift.start_time)} - {formatTime(targetUserShift.end_time)})
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.82rem', color: 'var(--danger-600)', fontWeight: 500 }}>
                                                    ⚠️ Rekan kerja ini belum memiliki jadwal shift di tanggal tersebut.
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ALASAN */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Alasan Permohonan <span style={{ color: 'red' }}>*</span></label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    placeholder="Contoh: Ada keperluan keluarga mendadak di pagi hari, sudah sepakat bertukar dengan rekan..."
                                    value={formData.reason}
                                    onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={submitting}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}