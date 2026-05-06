import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Overtime() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
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

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            // ?self=true ensures we only get our own requests (unless we remove it to get all? No, this page is for our own).
            // Wait, if an admin makes a request for an employee, it's their "requested_by" or the employee is involved.
            // ?self=true will map to what we just added in backend.
            const res = await fetch(`${API}/work-schedules/overtime-requests/list?self=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchAllShifts = useCallback(async () => {
        try {
            const res = await fetch(`${API}/work-schedules/shifts/all`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setAllShifts(data);
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchDepartments = useCallback(async () => {
        if (user.role !== 'admin') return;
        try {
            const res = await fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setDepartments(data.map(d => d.name));
        } catch (e) { console.error(e); }
    }, [token, user.role]);

    const fetchEmployees = useCallback(async (dept) => {
        if (user.role !== 'admin') {
            // Regular user implicitly only selects themselves
            setEmployees([{ id: user.id, name: user.name, employee_id: user.employee_id }]);
            return;
        }
        try {
            let url = `${API}/work-schedules/helpers/employees`;
            if (dept) url += `?department=${encodeURIComponent(dept)}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setEmployees(data);
        } catch (e) { console.error(e); }
    }, [token, user]);

    useEffect(() => {
        fetchRequests();
        fetchAllShifts();
        fetchDepartments();
        fetchEmployees();

        // Listen for afterprint event to reset print mode
        const afterPrint = () => setPrintData(null);
        window.addEventListener('afterprint', afterPrint);
        return () => window.removeEventListener('afterprint', afterPrint);
    }, [fetchRequests, fetchAllShifts, fetchDepartments, fetchEmployees]);

    function openModal() {
        setOtForm({
            date: '', shift_id: '', department: '', overtime_start: '', overtime_end: '', estimated_hours: '', reason: '',
            employee_ids: user.role === 'admin' ? [] : [user.id]
        });
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

            // If not admin, ensure they only submit for themselves
            if (user.role !== 'admin') {
                body.employee_ids = [user.id];
            }

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
            setShowModal(false);
            fetchRequests();
        } catch (e) {
            showMsg('danger', e.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteRequest(id) {
        if (!confirm('Yakin ingin membatalkan pengajuan lembur ini?')) return;
        try {
            await fetch(`${API}/work-schedules/overtime-requests/${id}`, { 
                method: 'DELETE', 
                headers: { Authorization: `Bearer ${token}` } 
            });
            showMsg('success', 'Pengajuan lembur berhasil dibatalkan');
            fetchRequests();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    function handlePrint(req) {
        setPrintData(req);
        setTimeout(() => {
            window.print();
        }, 100);
    }

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    function formatTime(t) {
        if (!t) return '-';
        return t.substring(0, 5);
    }

    // Modal helpers
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

    return (
        <>
        <div className={`fade-in ${printData ? 'hide-when-printing-spl' : ''}`}>
            <div className="page-header">
                <h1 className="page-title">⏰ Pengajuan Lembur (SPL)</h1>
                <p className="page-subtitle">Ajukan dan pantau status surat perintah lembur Anda</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type} mb-4`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Riwayat Pengajuan Lembur</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={fetchRequests} disabled={loading}>🔄 Refresh</button>
                        <button className="btn btn-primary" onClick={openModal}>+ Ajukan Lembur</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📝</div>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span>{formatTime(req.overtime_start)} - {formatTime(req.overtime_end)}</span>
                                                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{req.estimated_hours}h</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem' }}>{req.shift_name || '-'}</div>
                                            {req.department && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{req.department}</div>}
                                        </td>
                                        <td>
                                            <span className={`badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : req.status === 'completed' ? 'badge-primary' : 'badge-warning'}`}>
                                                {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : req.status === 'completed' ? 'Selesai' : 'Menunggu'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                {req.status === 'pending' && (
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

            {/* MODAL */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">📋 Ajukan Lembur Baru</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: user.role === 'admin' ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Lembur *</label>
                                    <input type="date" className="form-input" value={otForm.date}
                                        onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                {user.role === 'admin' && (
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

                            <div className="form-group">
                                <label className="form-label">Alasan & Detail Pekerjaan Lembur *</label>
                                <textarea className="form-input" rows={3} value={otForm.reason}
                                    onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="Jelaskan alasan dan pekerjaan yang akan dilakukan..." />
                            </div>

                            {/* Employee multiselect only for Admin */}
                            {user.role === 'admin' && (
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
                                                    onChange={() => toggleEmployeeSelection(emp.id)} />
                                                <span style={{ fontWeight: 600 }}>{emp.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{emp.employee_id}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button className="btn btn-primary" onClick={saveOvertimeRequest}
                                    disabled={loading || !otForm.date || !otForm.overtime_start || !otForm.overtime_end || !otForm.reason || !otForm.employee_ids.length}>
                                    {loading ? 'Menyimpan...' : 'Ajukan Lembur'}
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
                                    <td style={{ padding: '0.25rem 0' }}>: {formatTime(printData.overtime_start)} s/d {formatTime(printData.overtime_end)} ({printData.estimated_hours} jam)</td>
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
