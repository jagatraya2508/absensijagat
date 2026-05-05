import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API || '';

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function getGradeColor(grade) {
    switch (grade) {
        case 'A': return 'badge-success';
        case 'B': return 'badge-primary';
        case 'C': return 'badge-warning';
        case 'D': return 'badge-danger';
        default: return 'badge-danger';
    }
}

export default function AdminAssessments() {
    const { user } = useAuth();
    const [assessments, setAssessments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [calculating, setCalculating] = useState(false);

    const now = new Date();
    const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
    const [filterYear, setFilterYear] = useState(now.getFullYear());

    const [form, setForm] = useState({
        user_id: '',
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
        total_working_days: 0,
        present_days: 0,
        late_days: 0,
        absent_days: 0,
        leave_days: 0,
        overtime_days: 0,
        attendance_score: 0,
        attitude_score: 80,
        performance_score: 80,
        notes: ''
    });

    const [editId, setEditId] = useState(null);

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        fetchAssessments();
        fetchEmployees();
    }, [filterMonth, filterYear]);

    async function fetchAssessments() {
        try {
            setLoading(true);
            const res = await fetch(`${API}/api/assessments?month=${filterMonth}&year=${filterYear}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setAssessments(data);
            }
        } catch (err) {
            console.error('Fetch assessments error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchEmployees() {
        try {
            const res = await fetch(`${API}/api/assessments/employees`, { headers });
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            }
        } catch (err) {
            console.error('Fetch employees error:', err);
        }
    }

    async function calculateScore() {
        if (!form.user_id) return alert('Pilih karyawan terlebih dahulu');
        try {
            setCalculating(true);
            const res = await fetch(
                `${API}/api/assessments/calculate/${form.user_id}?month=${form.period_month}&year=${form.period_year}`,
                { headers }
            );
            if (res.ok) {
                const data = await res.json();
                setForm(prev => ({
                    ...prev,
                    total_working_days: data.stats.total_working_days,
                    present_days: data.stats.present_days,
                    late_days: data.stats.late_days,
                    absent_days: data.stats.absent_days,
                    leave_days: data.stats.leave_days,
                    overtime_days: data.stats.overtime_days,
                    attendance_score: data.stats.attendance_score
                }));
            }
        } catch (err) {
            console.error('Calculate error:', err);
        } finally {
            setCalculating(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const url = editId ? `${API}/api/assessments/${editId}` : `${API}/api/assessments`;
            const method = editId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setShowModal(false);
                resetForm();
                fetchAssessments();
            } else {
                const data = await res.json();
                alert(data.error || 'Gagal menyimpan');
            }
        } catch (err) {
            console.error('Submit error:', err);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Hapus penilaian ini?')) return;
        try {
            const res = await fetch(`${API}/api/assessments/${id}`, { method: 'DELETE', headers });
            if (res.ok) fetchAssessments();
        } catch (err) {
            console.error('Delete error:', err);
        }
    }

    function resetForm() {
        setForm({
            user_id: '',
            period_month: filterMonth,
            period_year: filterYear,
            total_working_days: 0,
            present_days: 0,
            late_days: 0,
            absent_days: 0,
            leave_days: 0,
            overtime_days: 0,
            attendance_score: 0,
            attitude_score: 80,
            performance_score: 80,
            notes: ''
        });
        setEditId(null);
    }

    function openEdit(a) {
        setForm({
            user_id: a.user_id,
            period_month: a.period_month,
            period_year: a.period_year,
            total_working_days: a.total_working_days,
            present_days: a.present_days,
            late_days: a.late_days,
            absent_days: a.absent_days,
            leave_days: a.leave_days,
            overtime_days: a.overtime_days,
            attendance_score: parseFloat(a.attendance_score),
            attitude_score: parseFloat(a.attitude_score),
            performance_score: parseFloat(a.performance_score),
            notes: a.notes || ''
        });
        setEditId(a.id);
        setShowModal(true);
    }

    function openNew() {
        resetForm();
        setShowModal(true);
    }

    // Calculate preview final score
    const previewFinalScore = (parseFloat(form.attendance_score) * 0.4) +
        (parseFloat(form.attitude_score) * 0.3) +
        (parseFloat(form.performance_score) * 0.3);
    let previewGrade = 'E';
    if (previewFinalScore >= 90) previewGrade = 'A';
    else if (previewFinalScore >= 80) previewGrade = 'B';
    else if (previewFinalScore >= 70) previewGrade = 'C';
    else if (previewFinalScore >= 60) previewGrade = 'D';

    // Summary stats
    const avgScore = assessments.length > 0
        ? (assessments.reduce((s, a) => s + parseFloat(a.final_score), 0) / assessments.length).toFixed(1)
        : 0;
    const gradeA = assessments.filter(a => a.grade === 'A').length;
    const gradeB = assessments.filter(a => a.grade === 'B').length;
    const gradeLow = assessments.filter(a => a.grade === 'D' || a.grade === 'E').length;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="page-title">📋 Penilaian Kedisiplinan</h1>
                    <p className="page-subtitle">Evaluasi kedisiplinan pegawai berdasarkan kehadiran</p>
                </div>
                <button className="btn btn-primary" onClick={openNew} style={{ marginTop: '0.25rem' }}>+ Buat Penilaian</button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card status-card">
                    <div className="status-card-icon primary">📊</div>
                    <div className="status-card-content">
                        <h3>Total Penilaian</h3>
                        <p>{assessments.length}</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon success">⭐</div>
                    <div className="status-card-content">
                        <h3>Rata-rata Skor</h3>
                        <p>{avgScore}</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon success">🏆</div>
                    <div className="status-card-content">
                        <h3>Grade A & B</h3>
                        <p>{gradeA + gradeB}</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon danger">⚠️</div>
                    <div className="status-card-content">
                        <h3>Grade D & E</h3>
                        <p>{gradeLow}</p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Bulan</label>
                        <select className="form-input form-select" value={filterMonth}
                            onChange={e => setFilterMonth(parseInt(e.target.value))}
                            style={{ width: '160px' }}>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tahun</label>
                        <select className="form-input form-select" value={filterYear}
                            onChange={e => setFilterYear(parseInt(e.target.value))}
                            style={{ width: '120px' }}>
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Assessments Table */}
            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" />
                    </div>
                ) : assessments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</p>
                        <p>Belum ada penilaian untuk periode ini</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openNew}>
                            + Buat Penilaian Pertama
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Karyawan</th>
                                    <th>Departemen</th>
                                    <th>Hadir</th>
                                    <th>Telat</th>
                                    <th>Absen</th>
                                    <th>Skor Kehadiran</th>
                                    <th>Skor Sikap</th>
                                    <th>Skor Kinerja</th>
                                    <th>Skor Akhir</th>
                                    <th>Grade</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assessments.map(a => (
                                    <tr key={a.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{a.employee_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{a.emp_id}</div>
                                        </td>
                                        <td>{a.department || '-'}</td>
                                        <td>{a.present_days}/{a.total_working_days}</td>
                                        <td style={{ color: a.late_days > 0 ? 'var(--warning-500)' : 'inherit' }}>
                                            {a.late_days}
                                        </td>
                                        <td style={{ color: a.absent_days > 0 ? 'var(--danger-500)' : 'inherit' }}>
                                            {a.absent_days}
                                        </td>
                                        <td>{parseFloat(a.attendance_score).toFixed(1)}</td>
                                        <td>{parseFloat(a.attitude_score).toFixed(1)}</td>
                                        <td>{parseFloat(a.performance_score).toFixed(1)}</td>
                                        <td style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                            {parseFloat(a.final_score).toFixed(1)}
                                        </td>
                                        <td>
                                            <span className={`badge ${getGradeColor(a.grade)}`} style={{ fontSize: '1rem', padding: '0.4rem 1rem' }}>
                                                {a.grade}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                    onClick={() => openEdit(a)}>✏️</button>
                                                <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                    onClick={() => handleDelete(a.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editId ? '✏️ Edit Penilaian' : '➕ Buat Penilaian Baru'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Karyawan *</label>
                                    <select className="form-input form-select" value={form.user_id}
                                        onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                                        disabled={!!editId} required>
                                        <option value="">Pilih Karyawan</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.employee_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Bulan *</label>
                                        <select className="form-input form-select" value={form.period_month}
                                            onChange={e => setForm(f => ({ ...f, period_month: parseInt(e.target.value) }))}
                                            disabled={!!editId}>
                                            {MONTHS.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Tahun *</label>
                                        <select className="form-input form-select" value={form.period_year}
                                            onChange={e => setForm(f => ({ ...f, period_year: parseInt(e.target.value) }))}
                                            disabled={!!editId}>
                                            {[2024, 2025, 2026, 2027].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Auto-calculate button */}
                            <div style={{ marginBottom: '1rem' }}>
                                <button type="button" className="btn btn-success" onClick={calculateScore}
                                    disabled={calculating || !form.user_id} style={{ width: '100%' }}>
                                    {calculating ? '⏳ Menghitung...' : '🔄 Hitung Otomatis dari Data Kehadiran'}
                                </button>
                            </div>

                            {/* Attendance Stats */}
                            <div className="card" style={{ marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--primary-400)' }}>📊 Data Kehadiran</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Hari Kerja</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem' }}>{form.total_working_days}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Hadir</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--success-500)' }}>{form.present_days}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Terlambat</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--warning-500)' }}>{form.late_days}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Tidak Hadir</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--danger-500)' }}>{form.absent_days}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Cuti/Izin</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem' }}>{form.leave_days}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Lembur</span>
                                        <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary-400)' }}>{form.overtime_days}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Scores */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Skor Kehadiran (40%)</label>
                                    <input type="number" className="form-input" min="0" max="100" step="0.1"
                                        value={form.attendance_score}
                                        onChange={e => setForm(f => ({ ...f, attendance_score: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Skor Sikap (30%)</label>
                                    <input type="number" className="form-input" min="0" max="100" step="0.1"
                                        value={form.attitude_score}
                                        onChange={e => setForm(f => ({ ...f, attitude_score: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Skor Kinerja (30%)</label>
                                    <input type="number" className="form-input" min="0" max="100" step="0.1"
                                        value={form.performance_score}
                                        onChange={e => setForm(f => ({ ...f, performance_score: e.target.value }))} />
                                </div>
                            </div>

                            {/* Preview Score */}
                            <div className="card" style={{
                                marginBottom: '1rem',
                                background: previewGrade === 'A' ? 'rgba(16, 185, 129, 0.1)' :
                                    previewGrade === 'B' ? 'rgba(59, 130, 246, 0.1)' :
                                        previewGrade === 'C' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                textAlign: 'center',
                                padding: '1rem'
                            }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '0.25rem' }}>Skor Akhir</div>
                                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{previewFinalScore.toFixed(1)}</div>
                                <span className={`badge ${getGradeColor(previewGrade)}`} style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem', marginTop: '0.5rem' }}>
                                    Grade {previewGrade}
                                </span>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Catatan</label>
                                <textarea className="form-input" rows="2" value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Catatan tambahan..." />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">
                                    {editId ? '💾 Perbarui' : '💾 Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
