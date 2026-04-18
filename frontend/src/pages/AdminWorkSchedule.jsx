import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SHIFT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const TAB_ITEMS = [
    { key: 'schedules', icon: '🕐', label: 'Jadwal Kerja' },
    { key: 'assignments', icon: '📅', label: 'Penugasan Shift' },
];

function formatTime(t) {
    if (!t) return '-';
    return t.substring(0, 5);
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================
// TIMELINE COMPONENT — visual 24h shift preview
// ============================================
function ShiftTimeline({ shifts }) {
    if (!shifts || shifts.length === 0) return null;

    function timeToPercent(time) {
        const [h, m] = time.split(':').map(Number);
        return ((h * 60 + m) / 1440) * 100;
    }

    return (
        <div className="shift-timeline-container">
            <div className="shift-timeline-labels">
                {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                    <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                        {String(h).padStart(2, '0')}
                    </span>
                ))}
            </div>
            <div className="shift-timeline-bar">
                {shifts.map((shift, i) => {
                    const start = timeToPercent(shift.start_time);
                    let end = timeToPercent(shift.end_time);
                    const isOvernight = shift.is_overnight || end <= start;

                    if (isOvernight) {
                        return (
                            <div key={i}>
                                <div
                                    className="shift-timeline-block"
                                    style={{
                                        left: `${start}%`,
                                        width: `${100 - start}%`,
                                        background: shift.color || SHIFT_COLORS[i],
                                    }}
                                    title={`${shift.name}: ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`}
                                >
                                    <span>{shift.name}</span>
                                </div>
                                <div
                                    className="shift-timeline-block"
                                    style={{
                                        left: '0%',
                                        width: `${end}%`,
                                        background: shift.color || SHIFT_COLORS[i],
                                        opacity: 0.7,
                                    }}
                                    title={`${shift.name} (lanjutan)`}
                                />
                            </div>
                        );
                    }

                    return (
                        <div
                            key={i}
                            className="shift-timeline-block"
                            style={{
                                left: `${start}%`,
                                width: `${end - start}%`,
                                background: shift.color || SHIFT_COLORS[i],
                            }}
                            title={`${shift.name}: ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`}
                        >
                            <span>{shift.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


// ============================================
// MAIN COMPONENT
// ============================================
export default function AdminWorkSchedule() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    const [activeTab, setActiveTab] = useState('schedules');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Schedule data
    const [schedules, setSchedules] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [positions, setPositions] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [allShifts, setAllShifts] = useState([]);

    // Modals
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEditAssignModal, setShowEditAssignModal] = useState(false);
    const [showOvertimeModal, setShowOvertimeModal] = useState(false);
    const [showSplDetail, setShowSplDetail] = useState(null);

    // Schedule form
    const [scheduleForm, setScheduleForm] = useState({
        id: null, name: '', type: 'normal', shift_count: 1, department: '', position: '', is_default: false,
        shifts: [{ name: 'Normal', shift_order: 1, start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_overnight: false, color: '#3b82f6' }],
        overtime_rule: { overtime_type: 'immediate', grace_period_minutes: 0, min_overtime_minutes: 30, max_overtime_hours: 4, rate_multiplier: 1.5 }
    });

    // Assignment data
    const [assignments, setAssignments] = useState([]);
    const [assignFilter, setAssignFilter] = useState({ start_date: '', end_date: '', department: '', user_id: '' });
    const [assignForm, setAssignForm] = useState({ user_ids: [], shift_id: '', dates: [], assign_mode: 'daily', start_date: '', end_date: '' });
    const [editAssignForm, setEditAssignForm] = useState({ id: '', user_id: '', shift_id: '', assignment_date: '', user_name: '' });

    // Overtime requests
    const [overtimeRequests, setOvertimeRequests] = useState([]);
    const [otFilter, setOtFilter] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), department: '', status: '' });
    const [otForm, setOtForm] = useState({ date: '', shift_id: '', department: '', overtime_start: '', overtime_end: '', estimated_hours: '', reason: '', employee_ids: [] });

    // ============================================
    // FETCHERS
    // ============================================
    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch(`${API}/work-schedules`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setSchedules(data);
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchPositions = useCallback(async () => {
        try {
            const res = await fetch(`${API}/positions`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setPositions(data.map(p => p.name));
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setDepartments(data.map(d => d.name));
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchEmployees = useCallback(async (dept) => {
        try {
            let url = `${API}/work-schedules/helpers/employees`;
            if (dept) url += `?department=${encodeURIComponent(dept)}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setEmployees(data);
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchAllShifts = useCallback(async () => {
        try {
            const res = await fetch(`${API}/work-schedules/shifts/all`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setAllShifts(data);
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchAssignments = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (assignFilter.start_date) params.append('start_date', assignFilter.start_date);
            if (assignFilter.end_date) params.append('end_date', assignFilter.end_date);
            if (assignFilter.department) params.append('department', assignFilter.department);
            if (assignFilter.user_id) params.append('user_id', assignFilter.user_id);
            const res = await fetch(`${API}/work-schedules/assignments/list?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setAssignments(data);
        } catch (e) { console.error(e); }
    }, [token, assignFilter]);

    const fetchOvertimeRequests = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (otFilter.month) params.append('month', otFilter.month);
            if (otFilter.year) params.append('year', otFilter.year);
            if (otFilter.department) params.append('department', otFilter.department);
            if (otFilter.status) params.append('status', otFilter.status);
            const res = await fetch(`${API}/work-schedules/overtime-requests/list?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setOvertimeRequests(data);
        } catch (e) { console.error(e); }
    }, [token, otFilter]);

    useEffect(() => {
        fetchSchedules();
        fetchDepartments();
        fetchPositions();
        fetchEmployees();
        fetchAllShifts();
    }, [fetchSchedules, fetchDepartments, fetchPositions, fetchEmployees, fetchAllShifts]);

    useEffect(() => {
        if (activeTab === 'assignments') fetchAssignments();
        if (activeTab === 'overtime') fetchOvertimeRequests();
    }, [activeTab, fetchAssignments, fetchOvertimeRequests]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    // ============================================
    // SCHEDULE CRUD
    // ============================================
    function openNewSchedule() {
        setScheduleForm({
            id: null, name: '', type: 'normal', shift_count: 1, department: '', position: '', is_default: false,
            shifts: [{ name: 'Normal', shift_order: 1, start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_overnight: false, color: '#3b82f6' }],
            overtime_rule: { overtime_type: 'immediate', grace_period_minutes: 0, min_overtime_minutes: 30, max_overtime_hours: 4, rate_multiplier: 1.5 }
        });
        setShowScheduleModal(true);
    }

    function openEditSchedule(sched) {
        setScheduleForm({
            id: sched.id,
            name: sched.name,
            type: sched.type,
            shift_count: sched.shift_count,
            department: sched.department || '',
            position: sched.position || '',
            is_default: sched.is_default,
            shifts: sched.shifts && sched.shifts.length > 0 ? sched.shifts : [{ name: 'Normal', shift_order: 1, start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_overnight: false, color: '#3b82f6' }],
            overtime_rule: sched.overtime_rule && sched.overtime_rule.id ? sched.overtime_rule : { overtime_type: 'immediate', grace_period_minutes: 0, min_overtime_minutes: 30, max_overtime_hours: 4, rate_multiplier: 1.5 }
        });
        setShowScheduleModal(true);
    }

    function handleTypeChange(type) {
        const count = type === 'normal' ? 1 : 2;
        const newShifts = [];
        const shiftNames = ['Shift Pagi', 'Shift Siang', 'Shift Malam', 'Shift 4'];
        const defaultTimes = [
            { start: '06:00', end: '14:00' },
            { start: '14:00', end: '22:00' },
            { start: '22:00', end: '06:00' },
            { start: '06:00', end: '12:00' },
        ];

        if (type === 'normal') {
            newShifts.push({ name: 'Normal', shift_order: 1, start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_overnight: false, color: SHIFT_COLORS[0] });
        } else {
            for (let i = 0; i < count; i++) {
                newShifts.push({
                    name: shiftNames[i], shift_order: i + 1,
                    start_time: defaultTimes[i].start, end_time: defaultTimes[i].end,
                    break_start: '', break_end: '',
                    is_overnight: i === count - 1 && count >= 3,
                    color: SHIFT_COLORS[i]
                });
            }
        }
        setScheduleForm(f => ({ ...f, type, shift_count: count, shifts: newShifts }));
    }

    function handleShiftCountChange(count) {
        const c = parseInt(count);
        const shiftNames = ['Shift Pagi', 'Shift Siang', 'Shift Malam', 'Shift 4'];
        const defaultTimes = [
            { start: '06:00', end: '14:00' },
            { start: '14:00', end: '22:00' },
            { start: '22:00', end: '06:00' },
            { start: '06:00', end: '12:00' },
        ];
        const newShifts = [];
        for (let i = 0; i < c; i++) {
            const existing = scheduleForm.shifts[i];
            newShifts.push(existing || {
                name: shiftNames[i] || `Shift ${i + 1}`, shift_order: i + 1,
                start_time: defaultTimes[i]?.start || '06:00', end_time: defaultTimes[i]?.end || '14:00',
                break_start: '', break_end: '',
                is_overnight: false, color: SHIFT_COLORS[i]
            });
        }
        setScheduleForm(f => ({ ...f, shift_count: c, shifts: newShifts }));
    }

    function updateShift(idx, field, value) {
        setScheduleForm(f => {
            const s = [...f.shifts];
            s[idx] = { ...s[idx], [field]: value };
            return { ...f, shifts: s };
        });
    }

    async function saveSchedule() {
        setLoading(true);
        try {
            const method = scheduleForm.id ? 'PUT' : 'POST';
            const url = scheduleForm.id ? `${API}/work-schedules/${scheduleForm.id}` : `${API}/work-schedules`;
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(scheduleForm)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            showMsg('success', `Jadwal kerja berhasil ${scheduleForm.id ? 'diperbarui' : 'dibuat'}`);
            setShowScheduleModal(false);
            fetchSchedules();
            fetchAllShifts();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteSchedule(id) {
        if (!confirm('Yakin ingin menghapus jadwal kerja ini?')) return;
        try {
            await fetch(`${API}/work-schedules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            showMsg('success', 'Jadwal kerja berhasil dihapus');
            fetchSchedules();
            fetchAllShifts();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    // ============================================
    // ASSIGNMENT
    // ============================================
    function generateDates(mode, startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end < start) {
            throw new Error('Tanggal akhir tidak boleh lebih awal dari tanggal mulai');
        }

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 366) {
            throw new Error('Rentang tanggal penugasan maksimal 1 tahun (365 hari) dalam sekali simpan.');
        }

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // For weekly mode, only include same day of week as start
            if (mode === 'weekly') {
                if (d.getDay() === start.getDay()) {
                    dates.push(d.toISOString().split('T')[0]);
                }
            } else {
                dates.push(d.toISOString().split('T')[0]);
            }
        }
        return dates;
    }

    async function saveAssignment() {
        setLoading(true);
        try {
            let dates = assignForm.dates;
            if (assignForm.assign_mode !== 'daily' && assignForm.start_date && assignForm.end_date) {
                dates = generateDates(assignForm.assign_mode, assignForm.start_date, assignForm.end_date);
            }
            if (!assignForm.user_ids.length || !assignForm.shift_id || !dates.length) {
                throw new Error('Pilih karyawan, shift, dan tanggal');
            }
            const res = await fetch(`${API}/work-schedules/assignments/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ user_ids: assignForm.user_ids, shift_id: assignForm.shift_id, dates })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            const data = await res.json();
            showMsg('success', data.message);
            setShowAssignModal(false);
            fetchAssignments();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function saveEditAssignment() {
        setLoading(true);
        try {
            if (!editAssignForm.shift_id || !editAssignForm.assignment_date) {
                throw new Error('Shift dan tanggal harus diisi');
            }
            const res = await fetch(`${API}/work-schedules/assignments/${editAssignForm.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    shift_id: editAssignForm.shift_id,
                    assignment_date: editAssignForm.assignment_date,
                    user_id: editAssignForm.user_id
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal memperbarui penugasan');
            }
            showMsg('success', 'Penugasan berhasil diperbarui');
            setShowEditAssignModal(false);
            fetchAssignments();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteAssignment(id) {
        try {
            await fetch(`${API}/work-schedules/assignments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            fetchAssignments();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    // ============================================
    // OVERTIME REQUESTS
    // ============================================
    function calcEstimatedHours() {
        if (!otForm.overtime_start || !otForm.overtime_end) return 0;
        const [sh, sm] = otForm.overtime_start.split(':').map(Number);
        const [eh, em] = otForm.overtime_end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 1440;
        return Math.round((diff / 60) * 10) / 10;
    }

    async function saveOvertimeRequest() {
        setLoading(true);
        try {
            const estimated = calcEstimatedHours();
            const body = { ...otForm, estimated_hours: estimated };
            const res = await fetch(`${API}/work-schedules/overtime-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            showMsg('success', 'Pengajuan lembur berhasil dibuat');
            setShowOvertimeModal(false);
            setOtForm({ date: '', shift_id: '', department: '', overtime_start: '', overtime_end: '', estimated_hours: '', reason: '', employee_ids: [] });
            fetchOvertimeRequests();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function updateOtStatus(id, status, notes) {
        try {
            const res = await fetch(`${API}/work-schedules/overtime-requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status, admin_notes: notes })
            });
            if (!res.ok) throw new Error('Gagal update status');
            showMsg('success', `Status berhasil diubah ke ${status}`);
            fetchOvertimeRequests();
            setShowSplDetail(null);
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    async function deleteOtRequest(id) {
        if (!confirm('Yakin ingin menghapus pengajuan lembur ini?')) return;
        try {
            await fetch(`${API}/work-schedules/overtime-requests/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            showMsg('success', 'Pengajuan lembur berhasil dihapus');
            fetchOvertimeRequests();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    function toggleEmployeeSelection(id, list, setter, field) {
        setter(f => {
            const current = [...f[field]];
            const idx = current.indexOf(id);
            if (idx >= 0) current.splice(idx, 1);
            else current.push(id);
            return { ...f, [field]: current };
        });
    }

    // ============================================
    // RENDER: TAB CONTENT
    // ============================================

    // --- TAB 1: SCHEDULES ---
    function renderSchedulesTab() {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)' }}>Master Jadwal Kerja</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Kelola tipe jadwal (Normal/Shift) beserta aturan lembur</p>
                    </div>
                    <button className="btn btn-primary" onClick={openNewSchedule}>+ Tambah Jadwal</button>
                </div>

                {schedules.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕐</div>
                        <p style={{ color: 'var(--gray-600)' }}>Belum ada jadwal kerja. Klik "Tambah Jadwal" untuk membuat.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
                        {schedules.map(sched => (
                            <div key={sched.id} className="card" style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)' }}>{sched.name}</h3>
                                            <span className={`badge badge-${sched.type === 'normal' ? 'primary' : 'warning'}`}>
                                                {sched.type === 'normal' ? 'Normal' : `${sched.shift_count} Shift`}
                                            </span>
                                            {sched.is_default && <span className="badge badge-success">Default</span>}
                                        </div>
                                        {sched.department && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>🏢 {sched.department}</span>
                                        )}
                                        {sched.position && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginLeft: '0.5rem' }}>👔 {sched.position}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => openEditSchedule(sched)}>✏️</button>
                                        <button className="btn btn-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => deleteSchedule(sched.id)}>🗑️</button>
                                    </div>
                                </div>

                                {/* Shifts list */}
                                <div style={{ marginBottom: '1rem' }}>
                                    {sched.shifts && sched.shifts.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color || SHIFT_COLORS[i], flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.9rem' }}>{s.name}</span>
                                            </div>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)', fontFamily: 'monospace' }}>
                                                {formatTime(s.start_time)} - {formatTime(s.end_time)}
                                            </span>
                                            {s.is_overnight && <span style={{ fontSize: '0.7rem', color: 'var(--warning-500)' }}>🌙</span>}
                                        </div>
                                    ))}
                                </div>

                                {/* Timeline */}
                                <ShiftTimeline shifts={sched.shifts} />

                                {/* Overtime rule summary */}
                                {sched.overtime_rule && sched.overtime_rule.id && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--warning-500)' }}>
                                        ⏱️ Lembur: {sched.overtime_rule.overtime_type === 'immediate' ? 'Langsung setelah jam kerja' : `Setelah ${sched.overtime_rule.grace_period_minutes} menit`}
                                        {' • '}Min {sched.overtime_rule.min_overtime_minutes} menit
                                        {' • '}Maks {sched.overtime_rule.max_overtime_hours} jam
                                        {' • '}{sched.overtime_rule.rate_multiplier}x rate
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- TAB 2: ASSIGNMENTS ---
    function renderAssignmentsTab() {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)' }}>Penugasan Shift Karyawan</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Atur shift per karyawan per hari, mingguan, atau bulanan</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => {
                        setAssignForm({ user_ids: [], shift_id: '', dates: [], assign_mode: 'daily', start_date: '', end_date: '' });
                        setShowAssignModal(true);
                    }}>+ Assign Shift</button>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tanggal Mulai</label>
                            <input type="date" className="form-input" value={assignFilter.start_date}
                                onChange={e => setAssignFilter(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tanggal Akhir</label>
                            <input type="date" className="form-input" value={assignFilter.end_date}
                                onChange={e => setAssignFilter(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Departemen</label>
                            <select className="form-input form-select" value={assignFilter.department}
                                onChange={e => setAssignFilter(f => ({ ...f, department: e.target.value }))}>
                                <option value="">Semua</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary" style={{ height: '44px' }} onClick={fetchAssignments}>🔍 Filter</button>
                    </div>
                </div>

                {/* Assignments table */}
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Karyawan</th>
                                    <th>Departemen</th>
                                    <th>Shift</th>
                                    <th>Jam Kerja</th>
                                    <th style={{ width: '60px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignments.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-600)', padding: '2rem' }}>Tidak ada data. Gunakan filter atau assign shift baru.</td></tr>
                                ) : assignments.map(a => (
                                    <tr key={a.id}>
                                        <td>{formatDate(a.assignment_date)}</td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{a.user_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>{a.employee_id}</div>
                                        </td>
                                        <td>{a.department || '-'}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.color || '#3b82f6' }} />
                                                {a.shift_name}
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace' }}>{formatTime(a.start_time)} - {formatTime(a.end_time)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button className="btn btn-outline" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }} onClick={() => {
                                                    const d = a.assignment_date ? new Date(a.assignment_date) : new Date();
                                                    const localStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                                    setEditAssignForm({ id: a.id, user_id: a.user_id, shift_id: a.shift_id, assignment_date: localStr, user_name: a.user_name });
                                                    setShowEditAssignModal(true);
                                                }}>✏️</button>
                                                <button className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteAssignment(a.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- TAB 3: OVERTIME REQUESTS ---
    function renderOvertimeTab() {
        const statusColors = { pending: 'warning', approved: 'success', rejected: 'danger', completed: 'primary' };
        const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', completed: 'Selesai' };

        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)' }}>Surat Perintah Lembur (SPL)</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Kelola pengajuan lembur beserta approval</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => {
                        setOtForm({ date: '', shift_id: '', department: '', overtime_start: '', overtime_end: '', estimated_hours: '', reason: '', employee_ids: [] });
                        setShowOvertimeModal(true);
                    }}>+ Ajukan Lembur</button>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Bulan</label>
                            <select className="form-input form-select" value={otFilter.month}
                                onChange={e => setOtFilter(f => ({ ...f, month: e.target.value }))}>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tahun</label>
                            <input type="number" className="form-input" value={otFilter.year}
                                onChange={e => setOtFilter(f => ({ ...f, year: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Status</label>
                            <select className="form-input form-select" value={otFilter.status}
                                onChange={e => setOtFilter(f => ({ ...f, status: e.target.value }))}>
                                <option value="">Semua</option>
                                <option value="pending">Menunggu</option>
                                <option value="approved">Disetujui</option>
                                <option value="rejected">Ditolak</option>
                                <option value="completed">Selesai</option>
                            </select>
                        </div>
                        <button className="btn btn-primary" style={{ height: '44px' }} onClick={fetchOvertimeRequests}>🔍 Filter</button>
                    </div>
                </div>

                {/* SPL Cards */}
                {overtimeRequests.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                        <p style={{ color: 'var(--gray-600)' }}>Belum ada pengajuan lembur untuk periode ini.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {overtimeRequests.map(ot => (
                            <div key={ot.id} className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                onClick={() => setShowSplDetail(ot)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-400)', fontSize: '0.9rem' }}>{ot.spl_number}</span>
                                            <span className={`badge badge-${statusColors[ot.status]}`}>{statusLabels[ot.status]}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--gray-700)', flexWrap: 'wrap' }}>
                                            <span>📅 {formatDate(ot.date)}</span>
                                            <span>⏰ {formatTime(ot.overtime_start)} - {formatTime(ot.overtime_end)}</span>
                                            <span>⏱️ {ot.estimated_hours} jam</span>
                                            {ot.department && <span>🏢 {ot.department}</span>}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Karyawan</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-800)' }}>{ot.employees?.length || 0}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                                    📝 {ot.reason?.substring(0, 100)}{ot.reason?.length > 100 ? '...' : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ============================================
    // MODALS
    // ============================================

    // --- SCHEDULE MODAL ---
    function renderScheduleModal() {
        if (!showScheduleModal) return null;
        return (
            <div className="modal-overlay">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">{scheduleForm.id ? 'Edit' : 'Tambah'} Jadwal Kerja</h2>
                        <button className="modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Nama Jadwal *</label>
                                <input className="form-input" value={scheduleForm.name}
                                    onChange={e => setScheduleForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Jadwal Normal Kantor, 3 Shift Pabrik" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Departemen</label>
                                <select className="form-input form-select" value={scheduleForm.department}
                                    onChange={e => setScheduleForm(f => ({ ...f, department: e.target.value }))}>
                                    <option value="">Semua Departemen</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jabatan (Opsional)</label>
                                <select className="form-input form-select" value={scheduleForm.position}
                                    onChange={e => setScheduleForm(f => ({ ...f, position: e.target.value }))}>
                                    <option value="">Semua Jabatan</option>
                                    {positions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Tipe *</label>
                                <select className="form-input form-select" value={scheduleForm.type}
                                    onChange={e => handleTypeChange(e.target.value)}>
                                    <option value="normal">Normal (1 Shift)</option>
                                    <option value="shift">Shift</option>
                                </select>
                            </div>
                            {scheduleForm.type === 'shift' && (
                                <div className="form-group">
                                    <label className="form-label">Jumlah Shift</label>
                                    <select className="form-input form-select" value={scheduleForm.shift_count}
                                        onChange={e => handleShiftCountChange(e.target.value)}>
                                        <option value="2">2 Shift</option>
                                        <option value="3">3 Shift</option>
                                        <option value="4">4 Shift</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--gray-700)', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={scheduleForm.is_default}
                                        onChange={e => setScheduleForm(f => ({ ...f, is_default: e.target.checked }))} />
                                    Jadikan Default
                                </label>
                            </div>
                        </div>

                        {/* Shifts detail */}
                        <div style={{ margin: '1.5rem 0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>
                                📋 Detail {scheduleForm.type === 'normal' ? 'Jam Kerja' : 'Shift'}
                            </h3>
                            {scheduleForm.shifts.map((shift, idx) => (
                                <div key={idx} style={{
                                    padding: '1rem', marginBottom: '0.75rem',
                                    background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)',
                                    borderLeft: `4px solid ${shift.color || SHIFT_COLORS[idx]}`
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Nama Shift</label>
                                            <input className="form-input" value={shift.name}
                                                onChange={e => updateShift(idx, 'name', e.target.value)} style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Jam Mulai</label>
                                            <input type="time" className="form-input" value={shift.start_time}
                                                onChange={e => updateShift(idx, 'start_time', e.target.value)} style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Jam Selesai</label>
                                            <input type="time" className="form-input" value={shift.end_time}
                                                onChange={e => updateShift(idx, 'end_time', e.target.value)} style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Istirahat Mulai</label>
                                            <input type="time" className="form-input" value={shift.break_start || ''}
                                                onChange={e => updateShift(idx, 'break_start', e.target.value)} style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Istirahat Selesai</label>
                                            <input type="time" className="form-input" value={shift.break_end || ''}
                                                onChange={e => updateShift(idx, 'break_end', e.target.value)} style={{ fontSize: '0.85rem' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Warna</label>
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {SHIFT_COLORS.map(c => (
                                                    <div key={c} onClick={() => updateShift(idx, 'color', c)}
                                                        style={{
                                                            width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer',
                                                            border: shift.color === c ? '3px solid white' : '2px solid transparent',
                                                            transition: 'all 0.15s'
                                                        }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer', color: 'var(--gray-700)', fontSize: '0.8rem' }}>
                                        <input type="checkbox" checked={shift.is_overnight || false}
                                            onChange={e => updateShift(idx, 'is_overnight', e.target.checked)} />
                                        🌙 Shift melewati tengah malam (overnight)
                                    </label>
                                </div>
                            ))}

                            {/* Timeline Preview */}
                            <div style={{ marginTop: '1rem' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Preview Timeline 24 Jam</label>
                                <ShiftTimeline shifts={scheduleForm.shifts} />
                            </div>
                        </div>

                        {/* Overtime Rule */}
                        <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(245,158,11,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.15)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--warning-500)', marginBottom: '1rem' }}>⏱️ Aturan Lembur</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipe Lembur</label>
                                    <select className="form-input form-select" value={scheduleForm.overtime_rule.overtime_type}
                                        onChange={e => setScheduleForm(f => ({ ...f, overtime_rule: { ...f.overtime_rule, overtime_type: e.target.value } }))}>
                                        <option value="immediate">Langsung setelah jam kerja</option>
                                        <option value="after_grace">Setelah toleransi waktu</option>
                                    </select>
                                </div>
                                {scheduleForm.overtime_rule.overtime_type === 'after_grace' && (
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Toleransi (menit)</label>
                                        <input type="number" className="form-input" value={scheduleForm.overtime_rule.grace_period_minutes}
                                            onChange={e => setScheduleForm(f => ({ ...f, overtime_rule: { ...f.overtime_rule, grace_period_minutes: parseInt(e.target.value) || 0 } }))} />
                                    </div>
                                )}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Min. Lembur (menit)</label>
                                    <input type="number" className="form-input" value={scheduleForm.overtime_rule.min_overtime_minutes}
                                        onChange={e => setScheduleForm(f => ({ ...f, overtime_rule: { ...f.overtime_rule, min_overtime_minutes: parseInt(e.target.value) || 0 } }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Maks Lembur (jam)</label>
                                    <input type="number" step="0.5" className="form-input" value={scheduleForm.overtime_rule.max_overtime_hours}
                                        onChange={e => setScheduleForm(f => ({ ...f, overtime_rule: { ...f.overtime_rule, max_overtime_hours: parseFloat(e.target.value) || 0 } }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Pengali Rate</label>
                                    <input type="number" step="0.1" className="form-input" value={scheduleForm.overtime_rule.rate_multiplier}
                                        onChange={e => setScheduleForm(f => ({ ...f, overtime_rule: { ...f.overtime_rule, rate_multiplier: parseFloat(e.target.value) || 1 } }))} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => setShowScheduleModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={saveSchedule} disabled={loading || !scheduleForm.name}>
                                {loading ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- ASSIGNMENT MODAL ---
    function renderAssignModal() {
        if (!showAssignModal) return null;

        const groupedShifts = {};
        allShifts.forEach(s => {
            const key = s.schedule_name + (s.department ? ` (${s.department})` : '');
            if (!groupedShifts[key]) groupedShifts[key] = [];
            groupedShifts[key].push(s);
        });

        return (
            <div className="modal-overlay">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">Assign Shift Karyawan</h2>
                        <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        {/* Mode */}
                        <div className="form-group">
                            <label className="form-label">Mode Penugasan</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[{ k: 'daily', l: '📅 Harian' }, { k: 'range', l: '📆 Rentang Tanggal' }, { k: 'weekly', l: '🗓️ Mingguan' }].map(m => (
                                    <button key={m.k} className={`btn ${assignForm.assign_mode === m.k ? 'btn-primary' : 'btn-outline'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                                        onClick={() => setAssignForm(f => ({ ...f, assign_mode: m.k, dates: [], start_date: '', end_date: '' }))}>
                                        {m.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date inputs */}
                        {assignForm.assign_mode === 'daily' ? (
                            <div className="form-group">
                                <label className="form-label">Pilih Tanggal (bisa lebih dari satu)</label>
                                <input type="date" className="form-input"
                                    onChange={e => {
                                        const d = e.target.value;
                                        if (d && !assignForm.dates.includes(d)) {
                                            setAssignForm(f => ({ ...f, dates: [...f.dates, d].sort() }));
                                        }
                                    }} />
                                {assignForm.dates.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                                        {assignForm.dates.map(d => (
                                            <span key={d} className="badge badge-primary" style={{ cursor: 'pointer', padding: '0.3rem 0.6rem' }}
                                                onClick={() => setAssignForm(f => ({ ...f, dates: f.dates.filter(x => x !== d) }))}>
                                                {formatDate(d)} ✕
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Mulai</label>
                                    <input type="date" className="form-input" value={assignForm.start_date}
                                        onChange={e => setAssignForm(f => ({ ...f, start_date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Akhir</label>
                                    <input type="date" className="form-input" value={assignForm.end_date}
                                        onChange={e => setAssignForm(f => ({ ...f, end_date: e.target.value }))} />
                                </div>
                            </div>
                        )}

                        {/* Shift selection */}
                        <div className="form-group">
                            <label className="form-label">Pilih Shift *</label>
                            <select className="form-input form-select" value={assignForm.shift_id}
                                onChange={e => setAssignForm(f => ({ ...f, shift_id: e.target.value }))}>
                                <option value="">-- Pilih Shift --</option>
                                {Object.entries(groupedShifts).map(([group, shifts]) => (
                                    <optgroup key={group} label={group}>
                                        {shifts.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        {/* Employee multiselect */}
                        <div className="form-group">
                            <label className="form-label">Pilih Karyawan * ({assignForm.user_ids.length} dipilih)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                    onClick={() => setAssignForm(f => ({ ...f, user_ids: employees.map(e => e.id) }))}>Pilih Semua</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                    onClick={() => setAssignForm(f => ({ ...f, user_ids: [] }))}>Hapus Semua</button>
                            </div>
                            <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                                {employees.map(emp => (
                                    <label key={emp.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem',
                                        cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--gray-200)', fontSize: '0.85rem',
                                        background: assignForm.user_ids.includes(emp.id) ? 'rgba(59,130,246,0.15)' : 'transparent',
                                        transition: 'background 0.15s'
                                    }}>
                                        <input type="checkbox" checked={assignForm.user_ids.includes(emp.id)}
                                            onChange={() => toggleEmployeeSelection(emp.id, assignForm.user_ids, setAssignForm, 'user_ids')} />
                                        <span style={{ fontWeight: 600 }}>{emp.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>{emp.employee_id}</span>
                                        {emp.department && <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginLeft: 'auto' }}>{emp.department}</span>}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => setShowAssignModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={saveAssignment} disabled={loading}>
                                {loading ? 'Menyimpan...' : 'Simpan Penugasan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- OVERTIME REQUEST MODAL ---
    function renderOvertimeModal() {
        if (!showOvertimeModal) return null;

        const groupedShifts = {};
        allShifts.forEach(s => {
            const key = s.schedule_name + (s.department ? ` (${s.department})` : '');
            if (!groupedShifts[key]) groupedShifts[key] = [];
            groupedShifts[key].push(s);
        });

        return (
            <div className="modal-overlay">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">📋 Pengajuan Lembur (SPL)</h2>
                        <button className="modal-close" onClick={() => setShowOvertimeModal(false)}>×</button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Tanggal Lembur *</label>
                                <input type="date" className="form-input" value={otForm.date}
                                    onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Departemen</label>
                                <select className="form-input form-select" value={otForm.department}
                                    onChange={e => {
                                        setOtForm(f => ({ ...f, department: e.target.value }));
                                        fetchEmployees(e.target.value);
                                    }}>
                                    <option value="">Semua</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Jam Mulai *</label>
                                <input type="time" className="form-input" value={otForm.overtime_start}
                                    onChange={e => setOtForm(f => ({ ...f, overtime_start: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jam Selesai *</label>
                                <input type="time" className="form-input" value={otForm.overtime_end}
                                    onChange={e => setOtForm(f => ({ ...f, overtime_end: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Estimasi (jam)</label>
                                <input type="text" className="form-input" readOnly value={calcEstimatedHours()} style={{ background: 'rgba(255,255,255,0.02)' }} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Shift Terkait</label>
                            <select className="form-input form-select" value={otForm.shift_id}
                                onChange={e => setOtForm(f => ({ ...f, shift_id: e.target.value }))}>
                                <option value="">-- Opsional --</option>
                                {Object.entries(groupedShifts).map(([group, shifts]) => (
                                    <optgroup key={group} label={group}>
                                        {shifts.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Alasan Lembur *</label>
                            <textarea className="form-input" rows={3} value={otForm.reason}
                                onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))}
                                placeholder="Jelaskan alasan dan pekerjaan lembur..." />
                        </div>

                        {/* Employee multiselect */}
                        <div className="form-group">
                            <label className="form-label">Karyawan Lembur * ({otForm.employee_ids.length} dipilih)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                    onClick={() => setOtForm(f => ({ ...f, employee_ids: employees.map(e => e.id) }))}>Pilih Semua</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                    onClick={() => setOtForm(f => ({ ...f, employee_ids: [] }))}>Hapus Semua</button>
                            </div>
                            <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                                {employees.map(emp => (
                                    <label key={emp.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem',
                                        cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--gray-200)', fontSize: '0.85rem',
                                        background: otForm.employee_ids.includes(emp.id) ? 'rgba(59,130,246,0.15)' : 'transparent',
                                    }}>
                                        <input type="checkbox" checked={otForm.employee_ids.includes(emp.id)}
                                            onChange={() => toggleEmployeeSelection(emp.id, otForm.employee_ids, setOtForm, 'employee_ids')} />
                                        <span style={{ fontWeight: 600 }}>{emp.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>{emp.employee_id}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => setShowOvertimeModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={saveOvertimeRequest}
                                disabled={loading || !otForm.date || !otForm.overtime_start || !otForm.overtime_end || !otForm.reason || !otForm.employee_ids.length}>
                                {loading ? 'Menyimpan...' : 'Ajukan Lembur'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- SPL DETAIL MODAL ---
    function renderSplDetailModal() {
        if (!showSplDetail) return null;
        const ot = showSplDetail;
        const statusColors = { pending: 'warning', approved: 'success', rejected: 'danger', completed: 'primary' };
        const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', completed: 'Selesai' };

        return (
            <div className="modal-overlay">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">Detail SPL</h2>
                        <button className="modal-close" onClick={() => setShowSplDetail(null)}>×</button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        {/* SPL Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>SURAT PERINTAH LEMBUR</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-400)', fontFamily: 'monospace' }}>{ot.spl_number}</div>
                            <span className={`badge badge-${statusColors[ot.status]}`} style={{ marginTop: '0.5rem' }}>
                                {statusLabels[ot.status]}
                            </span>
                        </div>

                        {/* Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Tanggal</span>
                                <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{formatDate(ot.date)}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Jam Lembur</span>
                                <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontFamily: 'monospace' }}>
                                    {formatTime(ot.overtime_start)} - {formatTime(ot.overtime_end)} ({ot.estimated_hours} jam)
                                </div>
                            </div>
                            {ot.department && (
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Departemen</span>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{ot.department}</div>
                                </div>
                            )}
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Diajukan Oleh</span>
                                <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{ot.requested_by_name || '-'}</div>
                            </div>
                            {ot.approved_by_name && (
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Disetujui Oleh</span>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{ot.approved_by_name}</div>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Alasan</span>
                            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', color: 'var(--gray-200)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                {ot.reason}
                            </div>
                        </div>

                        {/* Employees */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.75rem' }}>
                                👥 Karyawan ({ot.employees?.length || 0})
                            </h3>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Nama</th>
                                            <th>ID</th>
                                            <th>Jam Aktual</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ot.employees?.map((emp, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{emp.user_name}</td>
                                                <td>{emp.employee_id}</td>
                                                <td>{emp.actual_hours ? `${emp.actual_hours} jam` : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Admin notes */}
                        {ot.admin_notes && (
                            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--primary-400)' }}>Catatan Admin:</span> {ot.admin_notes}
                            </div>
                        )}

                        {/* Action buttons */}
                        {ot.status === 'pending' && user?.role === 'admin' && (
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                <button className="btn btn-danger" onClick={() => {
                                    const notes = prompt('Catatan penolakan (opsional):');
                                    updateOtStatus(ot.id, 'rejected', notes);
                                }}>❌ Tolak</button>
                                <button className="btn btn-success" onClick={() => {
                                    const notes = prompt('Catatan approval (opsional):');
                                    updateOtStatus(ot.id, 'approved', notes);
                                }}>✅ Setujui</button>
                            </div>
                        )}
                        {ot.status === 'approved' && user?.role === 'admin' && (
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                <button className="btn btn-primary" onClick={() => updateOtStatus(ot.id, 'completed')}>
                                    ✔️ Tandai Selesai
                                </button>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button className="btn btn-danger" style={{ fontSize: '0.8rem' }} onClick={() => { deleteOtRequest(ot.id); setShowSplDetail(null); }}>🗑️ Hapus SPL</button>
                            <button className="btn btn-outline" onClick={() => setShowSplDetail(null)}>Tutup</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- EDIT ASSIGNMENT MODAL ---
    function renderEditAssignModal() {
        if (!showEditAssignModal) return null;

        const groupedShifts = {};
        allShifts.forEach(s => {
            const key = s.schedule_name + (s.department ? ` (${s.department})` : '');
            if (!groupedShifts[key]) groupedShifts[key] = [];
            groupedShifts[key].push(s);
        });

        return (
            <div className="modal-overlay">
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">Edit Penugasan Shift</h2>
                        <button className="modal-close" onClick={() => setShowEditAssignModal(false)}>×</button>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Karyawan</label>
                            <input className="form-input" disabled value={editAssignForm.user_name} style={{ background: 'rgba(255,255,255,0.02)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tanggal Penugasan</label>
                            <input type="date" className="form-input" value={editAssignForm.assignment_date}
                                onChange={e => setEditAssignForm(f => ({ ...f, assignment_date: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Shift</label>
                            <select className="form-input form-select" value={editAssignForm.shift_id}
                                onChange={e => setEditAssignForm(f => ({ ...f, shift_id: e.target.value }))}>
                                <option value="">-- Pilih Shift --</option>
                                {Object.entries(groupedShifts).map(([group, shifts]) => (
                                    <optgroup key={group} label={group}>
                                        {shifts.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowEditAssignModal(false)}>Batal</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEditAssignment} disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🕐 Jadwal Kerja & Lembur</h1>
                <p className="page-subtitle">Kelola jadwal kerja, penugasan shift, dan pengajuan lembur (SPL)</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
                    <span className="alert-icon">{message.type === 'success' ? '✅' : '⚠️'}</span>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
                background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-lg)',
                padding: '0.35rem'
            }}>
                {TAB_ITEMS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            padding: '0.75rem 1rem', border: 'none', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                            transition: 'all 0.2s',
                            background: activeTab === tab.key ? 'var(--gradient-primary)' : 'transparent',
                            color: activeTab === tab.key ? 'white' : 'var(--gray-400)',
                            boxShadow: activeTab === tab.key ? 'var(--shadow-glow)' : 'none',
                            fontFamily: 'inherit'
                        }}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'schedules' && renderSchedulesTab()}
            {activeTab === 'assignments' && renderAssignmentsTab()}
            {activeTab === 'overtime' && renderOvertimeTab()}

            {/* Modals */}
            {renderScheduleModal()}
            {renderAssignModal()}
            {renderEditAssignModal()}
            {renderOvertimeModal()}
            {renderSplDetailModal()}
        </div>
    );
}
