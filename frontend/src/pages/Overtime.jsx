import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Overtime() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');
    const isAdmin = user?.role === 'admin';

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [printData, setPrintData] = useState(null);

    const [otForm, setOtForm] = useState({
        date: '',
        shift_id: '',
        department: '',
        overtime_start: '',
        overtime_end: '',
        estimated_hours: '',
        reason: '',
        employee_ids: []
    });

    const [allShifts, setAllShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const EMP_PAGE_SIZE = 8;
    const [empPage, setEmpPage] = useState(1);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const selfParam = isAdmin ? '' : '?self=true';
            const res = await fetch(`${API}/work-schedules/overtime-requests/list${selfParam}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token, isAdmin]);

    const fetchAllShifts = useCallback(async () => {
        try {
            const res = await fetch(`${API}/work-schedules/shifts/all`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setAllShifts(data);
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchDepartments = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const res = await fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setDepartments(data.map(d => d.name));
        } catch (e) { console.error(e); }
    }, [token, isAdmin]);

    const fetchEmployees = useCallback(async (dept) => {
        if (!isAdmin) {
            setEmployees([{ id: user.id, name: user.name, employee_id: user.employee_id }]);
            return;
        }
        try {
            let url = `${API}/work-schedules/helpers/employees`;
            if (dept) url += `?department=${encodeURIComponent(dept)}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) {
                setEmployees(data);
                setEmpPage(1);
            }
        } catch (e) { console.error(e); }
    }, [token, user, isAdmin]);

    useEffect(() => {
        fetchRequests();
        fetchAllShifts();
        fetchDepartments();
        fetchEmployees();

        const afterPrint = () => setPrintData(null);
        window.addEventListener('afterprint', afterPrint);
        return () => window.removeEventListener('afterprint', afterPrint);
    }, [fetchRequests, fetchAllShifts, fetchDepartments, fetchEmployees]);

    function openModal() {
        setEditingId(null);
        setOtForm({
            date: '', shift_id: '', department: '', overtime_start: '', overtime_end: '', estimated_hours: '', reason: '',
            employee_ids: isAdmin ? [] : [user.id]
        });
        setEmpPage(1);
        setShowModal(true);
    }

    function openEditModal(req) {
        setEditingId(req.id);
        setOtForm({
            date: req.date ? new Date(req.date).toISOString().split('T')[0] : '',
            shift_id: req.shift_id || '',
            department: req.department || '',
            overtime_start: req.overtime_start ? req.overtime_start.substring(0, 5) : '',
            overtime_end: req.overtime_end ? req.overtime_end.substring(0, 5) : '',
            estimated_hours: req.estimated_hours || '',
            reason: req.reason || '',
            employee_ids: req.employees ? req.employees.map(e => e.user_id) : []
        });
        setEmpPage(1);
        if (req.department) fetchEmployees(req.department);
        setShowModal(true);
    }

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

            if (!isAdmin) {
                body.employee_ids = [user.id];
            }

            let url, method;
            if (editingId) {
                url = `${API}/work-schedules/overtime-requests/${editingId}`;
                method = 'PUT';
            } else {
                url = `${API}/work-schedules/overtime-requests`;
                method = 'POST';
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            showMsg('success', editingId ? 'Pengajuan lembur berhasil diperbarui' : 'Pengajuan lembur berhasil dibuat');
            setShowModal(false);
            setEditingId(null);
            fetchRequests();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteRequest(id) {
        if (!confirm('Yakin ingin menghapus pengajuan lembur ini?')) return;
        try {
            const res = await fetch(`${API}/work-schedules/overtime-requests/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal menghapus');
            }
            showMsg('success', 'Pengajuan lembur berhasil dihapus');
            fetchRequests();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    async function cancelRequest(id) {
        if (!confirm('Yakin ingin membatalkan pengajuan lembur ini?')) return;
        try {
            const res = await fetch(`${API}/work-schedules/overtime-requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: 'rejected', admin_notes: 'Dibatalkan oleh admin' })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Gagal membatalkan');
            }
            showMsg('success', 'Pengajuan lembur berhasil dibatalkan');
            fetchRequests();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    function handlePrint(req) {
        setPrintData(req);
        setTimeout(() => window.print(), 100);
    }

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    function formatTime(t) {
        if (!t) return '-';
        return t.substring(0, 5);
    }

    function adjustTime(timeStr, hourOffset) {
        if (!timeStr) return '';
        const [h, m] = timeStr.substring(0, 5).split(':').map(Number);
        let totalMins = h * 60 + m + Math.round(hourOffset * 60);
        totalMins = ((totalMins % 1440) + 1440) % 1440;
        const resH = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const resM = String(totalMins % 60).padStart(2, '0');
        return `${resH}:${resM}`;
    }

    function checkShiftOvertimeOverlap(otStartStr, otEndStr, shiftStartStr, shiftEndStr) {
        if (!otStartStr || !otEndStr || !shiftStartStr || !shiftEndStr) return false;
        const toM = (t) => {
            const parts = String(t).substring(0, 5).split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };
        const otStart = toM(otStartStr);
        const otEnd = toM(otEndStr);
        const sStart = toM(shiftStartStr);
        const sEnd = toM(shiftEndStr);

        const otRanges = otStart < otEnd ? [[otStart, otEnd]] : [[otStart, 1440], [0, otEnd]];
        const shiftRanges = sStart < sEnd ? [[sStart, sEnd]] : [[sStart, 1440], [0, sEnd]];

        for (const [oa, ob] of otRanges) {
            for (const [sa, sb] of shiftRanges) {
                if (Math.max(oa, sa) < Math.min(ob, sb)) {
                    return true;
                }
            }
        }
        return false;
    }

    function getOvertimeCategory(otStartStr, otEndStr, shiftStartStr, shiftEndStr) {
        if (!otStartStr || !otEndStr) return null;
        if (!shiftStartStr || !shiftEndStr) return 'Lembur Bebas';
        const toM = (t) => {
            const parts = String(t).substring(0, 5).split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };
        const otStart = toM(otStartStr);
        const otEnd = toM(otEndStr);
        const sStart = toM(shiftStartStr);
        const sEnd = toM(shiftEndStr);

        if (sStart < sEnd) {
            if (otEnd <= sStart || (otStart < sStart && otEnd <= sStart + 60)) {
                return 'Lembur Awal';
            }
            if (otStart >= sEnd || (otStart >= sEnd - 60 && otEnd > sEnd)) {
                return 'Lembur Akhir';
            }
            if (otStart < sStart) return 'Lembur Awal';
            if (otStart >= sEnd) return 'Lembur Akhir';
            return 'Lembur';
        } else {
            const midpoint = (sEnd + sStart) / 2;
            if (otStart >= midpoint && otStart < sStart) {
                return 'Lembur Awal';
            }
            if (otStart >= sEnd && otStart < midpoint) {
                return 'Lembur Akhir';
            }
            return 'Lembur';
        }
    }

    const toggleEmployeeSelection = (empId) => {
        setOtForm(f => {
            const current = f.employee_ids;
            return {
                ...f,
                employee_ids: current.includes(empId) ? current.filter(id => id !== empId) : [...current, empId]
            };
        });
    };

    const groupedShifts = {};
    allShifts.forEach(s => {
        const key = s.schedule_name + (s.department ? ` (${s.department})` : '');
        if (!groupedShifts[key]) groupedShifts[key] = [];
        groupedShifts[key].push(s);
    });

    const statusColors = { pending: 'warning', approved: 'success', rejected: 'danger', completed: 'primary' };
    const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', completed: 'Selesai' };

    const selectedShift = allShifts.find(s => String(s.id) === String(otForm.shift_id));
    const isOverlap = selectedShift ? checkShiftOvertimeOverlap(otForm.overtime_start, otForm.overtime_end, selectedShift.start_time, selectedShift.end_time) : false;
    const currentCategory = selectedShift ? getOvertimeCategory(otForm.overtime_start, otForm.overtime_end, selectedShift.start_time, selectedShift.end_time) : (otForm.overtime_start && otForm.overtime_end ? 'Lembur Bebas' : '');

    function applyBeforeShift(hours) {
        if (!selectedShift) return;
        const end = selectedShift.start_time.substring(0, 5);
        const start = adjustTime(end, -hours);
        setOtForm(f => ({ ...f, overtime_start: start, overtime_end: end }));
    }

    function applyAfterShift(hours) {
        if (!selectedShift) return;
        const start = selectedShift.end_time.substring(0, 5);
        const end = adjustTime(start, hours);
        setOtForm(f => ({ ...f, overtime_start: start, overtime_end: end }));
    }

    return (
        <>
        <div className={`fade-in ${printData ? 'hide-when-printing-spl' : ''}`}>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Clock" size={16} inline /> Pengajuan Lembur (SPL)</h1>
                <p className="page-subtitle">Ajukan dan pantau status surat perintah lembur Anda</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type} mb-4`}>
                    {message.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'} {message.text}
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Riwayat Pengajuan Lembur</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={fetchRequests} disabled={loading}><Icon name="RefreshCw" size={16} inline /> Refresh</button>
                        <button className="btn btn-primary" onClick={openModal}>+ Ajukan Lembur</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="FileText" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada riwayat pengajuan lembur</p>
                        <button className="btn btn-primary mt-3" onClick={openModal}>Buat Pengajuan</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>No. SPL</th>
                                    <th>Tanggal</th>
                                    <th>Waktu</th>
                                    <th>Shift / Dept</th>
                                    {isAdmin && <th>Diajukan Oleh</th>}
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(req => (
                                    <tr key={req.id}>
                                        <td style={{ fontFamily: 'monospace' }}>{req.spl_number}</td>
                                        <td>{new Date(req.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span style={{ fontWeight: 600 }}>{formatTime(req.overtime_start)} - {formatTime(req.overtime_end)}</span>
                                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{req.estimated_hours}h</span>
                                                </div>
                                                {req.overtime_category && (
                                                    <span className={`badge ${req.overtime_category === 'Lembur Awal' ? 'badge-info' : req.overtime_category === 'Lembur Akhir' ? 'badge-warning' : 'badge-secondary'}`}
                                                        style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', width: 'fit-content' }}>
                                                        {req.overtime_category === 'Lembur Awal' ? '🌅 Lembur Awal' : req.overtime_category === 'Lembur Akhir' ? '🌆 Lembur Akhir' : req.overtime_category}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem' }}>{req.shift_name || '-'}</div>
                                            {req.department && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{req.department}</div>}
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                <span style={{ fontSize: '0.85rem' }}>{req.requested_by_name || '-'}</span>
                                            </td>
                                        )}
                                        <td>
                                            <span className={`badge badge-${statusColors[req.status]}`}>
                                                {statusLabels[req.status]}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {/* Admin actions: edit, cancel, delete — on any status */}
                                                {isAdmin && (
                                                    <>
                                                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                                            onClick={() => openEditModal(req)} title="Edit">
                                                            <Icon name="Pencil" size={16} inline /> Edit
                                                        </button>
                                                        {req.status === 'pending' && (
                                                            <button className="btn btn-outline" style={{ color: 'var(--warning-500)', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                                                onClick={() => cancelRequest(req.id)} title="Batalkan">
                                                                <Icon name="Ban" size={16} inline /> Batal
                                                            </button>
                                                        )}
                                                        <button className="btn btn-outline" style={{ color: 'var(--danger-500)', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                                            onClick={() => deleteRequest(req.id)} title="Hapus">
                                                            <Icon name="Trash2" size={16} inline />
                                                        </button>
                                                    </>
                                                )}
                                                {/* Non-admin: only cancel own pending */}
                                                {!isAdmin && req.status === 'pending' && (
                                                    <button className="btn btn-outline" style={{ color: 'var(--danger-500)', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                                        onClick={() => deleteRequest(req.id)}>Batalkan</button>
                                                )}
                                                <button className="btn btn-outline" style={{ color: 'var(--primary-color)', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                                    onClick={() => handlePrint(req)}>Cetak</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL - Create / Edit */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingId ? 'Edit Pengajuan Lembur' : 'Ajukan Lembur Baru'}</h2>
                            <button className="modal-close" onClick={() => { setShowModal(false); setEditingId(null); }}><Icon name="X" size={16} /></button>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Lembur *</label>
                                    <input type="date" className="form-input" value={otForm.date}
                                        onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                {isAdmin && (
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
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Shift Terkait (Opsional)</label>
                                <select className="form-input form-select" value={otForm.shift_id}
                                    onChange={e => setOtForm(f => ({ ...f, shift_id: e.target.value }))}>
                                    <option value="">-- Bebas / Tidak Terkait Shift --</option>
                                    {Object.entries(groupedShifts).map(([group, shifts]) => (
                                        <optgroup key={group} label={group}>
                                            {shifts.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Shortcut buttons if shift selected */}
                            {selectedShift && (
                                <div style={{
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    border: '1px dashed rgba(59, 130, 246, 0.4)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '0.75rem',
                                    marginBottom: '0.85rem'
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-400)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <Icon name="Zap" size={14} inline /> Shortcut Pengisian Jam Lembur ({selectedShift.name}: {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 600 }}>🌅 Sebelum Shift:</span>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: '#06b6d4', color: '#06b6d4' }}
                                                onClick={() => applyBeforeShift(1)}>
                                                1 Jam ({adjustTime(selectedShift.start_time, -1)} - {formatTime(selectedShift.start_time)})
                                            </button>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: '#06b6d4', color: '#06b6d4' }}
                                                onClick={() => applyBeforeShift(2)}>
                                                2 Jam ({adjustTime(selectedShift.start_time, -2)} - {formatTime(selectedShift.start_time)})
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>🌆 Sesudah Shift:</span>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                                                onClick={() => applyAfterShift(1)}>
                                                1 Jam ({formatTime(selectedShift.end_time)} - {adjustTime(selectedShift.end_time, 1)})
                                            </button>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                                                onClick={() => applyAfterShift(2)}>
                                                2 Jam ({formatTime(selectedShift.end_time)} - {adjustTime(selectedShift.end_time, 2)})
                                            </button>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                                                onClick={() => applyAfterShift(3)}>
                                                3 Jam ({formatTime(selectedShift.end_time)} - {adjustTime(selectedShift.end_time, 3)})
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

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

                            {/* Overlap Error Warning Alert */}
                            {isOverlap && (
                                <div className="alert alert-danger mb-3" style={{ fontSize: '0.82rem', padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Icon name="AlertTriangle" size={16} inline />
                                    <span><strong>Peringatan Jam Lembur:</strong> Jam lembur bertabrakan dengan jam kerja reguler shift <strong>{selectedShift.name}</strong> ({formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)}). Lembur harus dilakukan sebelum shift dimulai atau setelah shift selesai.</span>
                                </div>
                            )}

                            {/* Category detection badge preview */}
                            {!isOverlap && otForm.overtime_start && otForm.overtime_end && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--gray-400)' }}>Kategori Lembur:</span>
                                    <span className={`badge ${currentCategory === 'Lembur Awal' ? 'badge-info' : currentCategory === 'Lembur Akhir' ? 'badge-warning' : 'badge-secondary'}`}>
                                        {currentCategory === 'Lembur Awal' ? '🌅 Lembur Awal (Sebelum Masuk Shift)' : currentCategory === 'Lembur Akhir' ? '🌆 Lembur Akhir (Setelah Pulang Shift)' : 'Lembur Bebas'}
                                    </span>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Alasan & Detail Pekerjaan Lembur *</label>
                                <textarea className="form-input" rows={3} value={otForm.reason}
                                    onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="Jelaskan alasan dan pekerjaan yang akan dilakukan..." />
                            </div>

                            {/* Employee pagination only for Admin */}
                            {isAdmin && (() => {
                                const empTotalPages = Math.max(1, Math.ceil(employees.length / EMP_PAGE_SIZE));
                                const empPageSafe = Math.min(empPage, empTotalPages);
                                const pagedEmployees = employees.slice((empPageSafe - 1) * EMP_PAGE_SIZE, empPageSafe * EMP_PAGE_SIZE);
                                return (
                                <div className="form-group">
                                    <label className="form-label">Karyawan Lembur * ({otForm.employee_ids.length} dipilih)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <button type="button" className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                            onClick={() => setOtForm(f => ({ ...f, employee_ids: employees.map(e => e.id) }))}>Pilih Semua</button>
                                        <button type="button" className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                            onClick={() => setOtForm(f => ({ ...f, employee_ids: [] }))}>Hapus Semua</button>
                                    </div>
                                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                                        {pagedEmployees.map(emp => (
                                            <label key={emp.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem',
                                                cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--gray-900)', fontSize: '0.85rem',
                                                background: otForm.employee_ids.includes(emp.id) ? 'rgba(59,130,246,0.15)' : 'transparent',
                                            }}>
                                                <input type="checkbox" checked={otForm.employee_ids.includes(emp.id)}
                                                    onChange={() => toggleEmployeeSelection(emp.id)} />
                                                <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                                                    {emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}
                                                </span>
                                            </label>
                                        ))}
                                        {employees.length === 0 && (
                                            <p style={{ margin: 0, padding: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>Tidak ada karyawan.</p>
                                        )}
                                    </div>
                                    {employees.length > EMP_PAGE_SIZE && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem', gap: '0.5rem' }}>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                                                disabled={empPageSafe <= 1}
                                                onClick={() => setEmpPage(p => Math.max(1, p - 1))}>
                                                Sebelumnya
                                            </button>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-700)', fontWeight: 600 }}>
                                                Halaman {empPageSafe} dari {empTotalPages}
                                            </span>
                                            <button type="button" className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                                                disabled={empPageSafe >= empTotalPages}
                                                onClick={() => setEmpPage(p => Math.min(empTotalPages, p + 1))}>
                                                Selanjutnya
                                            </button>
                                        </div>
                                    )}
                                </div>
                                );
                            })()}

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button className="btn btn-outline" onClick={() => { setShowModal(false); setEditingId(null); }}>Batal</button>
                                <button className="btn btn-primary" onClick={saveOvertimeRequest}
                                    disabled={loading || isOverlap || !otForm.date || !otForm.overtime_start || !otForm.overtime_end || !otForm.reason || !otForm.employee_ids.length}>
                                    {loading ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Ajukan Lembur'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

            {/* PRINT LAYOUT */}
            {printData && (
                <div className="print-spl-only" style={{ padding: '2rem', fontFamily: 'serif', color: 'black' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0' }}>SURAT PERINTAH LEMBUR (SPL)</h1>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>No: {printData.spl_number}</p>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <p>Yang bertanda tangan di bawah ini menugaskan kepada karyawan berikut:</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left' }}>No</th>
                                <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left' }}>Nama Karyawan</th>
                                <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left' }}>ID Karyawan</th>
                                <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left' }}>Keterangan / Tugas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printData.employees?.map((emp, idx) => (
                                <tr key={emp.id}>
                                    <td style={{ border: '1px solid black', padding: '0.5rem' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid black', padding: '0.5rem' }}>{emp.user_name}</td>
                                    <td style={{ border: '1px solid black', padding: '0.5rem' }}>{emp.employee_id}</td>
                                    <td style={{ border: '1px solid black', padding: '0.5rem' }}>{printData.reason}</td>
                                </tr>
                            ))}
                            {(!printData.employees || printData.employees.length === 0) && (
                                <tr>
                                    <td colSpan={4} style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'center' }}>
                                        {printData.requested_by_name}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                        <table style={{ width: '100%' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '120px', padding: '0.25rem 0' }}><strong>Hari / Tanggal</strong></td>
                                    <td style={{ padding: '0.25rem 0' }}>: {new Date(printData.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.25rem 0' }}><strong>Waktu Lembur</strong></td>
                                    <td style={{ padding: '0.25rem 0' }}>: {formatTime(printData.overtime_start)} s/d {formatTime(printData.overtime_end)} ({printData.estimated_hours} jam)
                                        {printData.overtime_category && (
                                            <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>
                                                [{printData.overtime_category === 'Lembur Awal' ? 'Lembur Awal (Sebelum Shift)' : printData.overtime_category === 'Lembur Akhir' ? 'Lembur Akhir (Sesudah Shift)' : printData.overtime_category}]
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.25rem 0' }}><strong>Departemen</strong></td>
                                    <td style={{ padding: '0.25rem 0' }}>: {printData.department || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div style={{ width: '200px' }}>
                            <p style={{ marginBottom: '5rem' }}>Pemohon,</p>
                            <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{printData.requested_by_name}</p>
                        </div>
                        <div style={{ width: '200px' }}>
                            <p style={{ marginBottom: '5rem' }}>Menyetujui,</p>
                            <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{printData.approved_by_name || '( ................................... )'}</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
