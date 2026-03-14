import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API || '';

const STATUS_PIPELINE = ['applied', 'screening', 'interview', 'test', 'offering', 'hired'];
const STATUS_LABELS = {
    applied: 'Melamar',
    screening: 'Screening',
    interview: 'Interview',
    test: 'Tes',
    offering: 'Offering',
    hired: 'Diterima',
    rejected: 'Ditolak'
};
const STATUS_COLORS = {
    applied: 'badge-primary',
    screening: 'badge-warning',
    interview: 'badge-primary',
    test: 'badge-warning',
    offering: 'badge-success',
    hired: 'badge-success',
    rejected: 'badge-danger'
};
const POSITION_STATUS_COLORS = {
    open: 'badge-success',
    closed: 'badge-danger',
    'on-hold': 'badge-warning'
};

export default function AdminRecruitment() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [positions, setPositions] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showPositionModal, setShowPositionModal] = useState(false);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [showCandidateDetail, setShowCandidateDetail] = useState(null);

    // Forms
    const [positionForm, setPositionForm] = useState({
        title: '', department: '', description: '', requirements: '',
        salary_range_min: '', salary_range_max: '', employment_type: 'full-time', status: 'open'
    });
    const [candidateForm, setCandidateForm] = useState({
        full_name: '', email: '', phone: '', address: '', education: '',
        experience_years: 0, applied_position_id: '', source: 'website', notes: ''
    });
    const [interviewForm, setInterviewForm] = useState({
        candidate_id: '', interview_date: '', interview_time: '',
        location: '', type: 'onsite', meeting_link: '', notes: '', status: 'scheduled'
    });

    const [editPositionId, setEditPositionId] = useState(null);
    const [editInterviewId, setEditInterviewId] = useState(null);

    // Filters
    const [filterPositionId, setFilterPositionId] = useState('');
    const [filterCandidateStatus, setFilterCandidateStatus] = useState('');

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    useEffect(() => {
        fetchAll();
    }, []);

    useEffect(() => {
        if (activeTab === 'candidates') fetchCandidates();
        if (activeTab === 'interviews') fetchInterviews();
        if (activeTab === 'dashboard') fetchStats();
    }, [activeTab, filterPositionId, filterCandidateStatus]);

    async function fetchAll() {
        setLoading(true);
        await Promise.all([fetchPositions(), fetchCandidates(), fetchInterviews(), fetchStats()]);
        setLoading(false);
    }

    async function fetchPositions() {
        try {
            const res = await fetch(`${API}/api/recruitment/positions`, { headers: authHeaders });
            if (res.ok) setPositions(await res.json());
        } catch (err) { console.error(err); }
    }

    async function fetchCandidates() {
        try {
            let url = `${API}/api/recruitment/candidates?`;
            if (filterPositionId) url += `position_id=${filterPositionId}&`;
            if (filterCandidateStatus) url += `status=${filterCandidateStatus}`;
            const res = await fetch(url, { headers: authHeaders });
            if (res.ok) setCandidates(await res.json());
        } catch (err) { console.error(err); }
    }

    async function fetchInterviews() {
        try {
            const res = await fetch(`${API}/api/recruitment/interviews`, { headers: authHeaders });
            if (res.ok) setInterviews(await res.json());
        } catch (err) { console.error(err); }
    }

    async function fetchStats() {
        try {
            const res = await fetch(`${API}/api/recruitment/stats`, { headers: authHeaders });
            if (res.ok) setStats(await res.json());
        } catch (err) { console.error(err); }
    }

    // ==================== POSITION HANDLERS ====================
    async function handlePositionSubmit(e) {
        e.preventDefault();
        const url = editPositionId
            ? `${API}/api/recruitment/positions/${editPositionId}`
            : `${API}/api/recruitment/positions`;
        const method = editPositionId ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers, body: JSON.stringify(positionForm) });
            if (res.ok) {
                setShowPositionModal(false);
                resetPositionForm();
                fetchPositions();
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (err) { console.error(err); }
    }

    async function handleDeletePosition(id) {
        if (!confirm('Hapus posisi ini? Semua kandidat terkait akan terpengaruh.')) return;
        try {
            await fetch(`${API}/api/recruitment/positions/${id}`, { method: 'DELETE', headers });
            fetchPositions(); fetchStats();
        } catch (err) { console.error(err); }
    }

    function resetPositionForm() {
        setPositionForm({
            title: '', department: '', description: '', requirements: '',
            salary_range_min: '', salary_range_max: '', employment_type: 'full-time', status: 'open'
        });
        setEditPositionId(null);
    }

    function openEditPosition(p) {
        setPositionForm({
            title: p.title, department: p.department || '', description: p.description || '',
            requirements: p.requirements || '', salary_range_min: p.salary_range_min || '',
            salary_range_max: p.salary_range_max || '', employment_type: p.employment_type, status: p.status
        });
        setEditPositionId(p.id);
        setShowPositionModal(true);
    }

    // ==================== CANDIDATE HANDLERS ====================
    async function handleCandidateSubmit(e) {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.entries(candidateForm).forEach(([k, v]) => {
                if (v !== null && v !== undefined && k !== 'resume_file' && k !== 'photo_file') {
                    formData.append(k, v);
                }
            });
            if (candidateForm.resume_file) formData.append('resume', candidateForm.resume_file);
            if (candidateForm.photo_file) formData.append('photo', candidateForm.photo_file);

            const res = await fetch(`${API}/api/recruitment/candidates`, {
                method: 'POST',
                headers: authHeaders,
                body: formData
            });
            if (res.ok) {
                setShowCandidateModal(false);
                resetCandidateForm();
                fetchCandidates(); fetchStats();
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (err) { console.error(err); }
    }

    async function handleUpdateCandidateStatus(id, status) {
        try {
            await fetch(`${API}/api/recruitment/candidates/${id}/status`, {
                method: 'PATCH', headers, body: JSON.stringify({ status })
            });
            fetchCandidates(); fetchStats();
        } catch (err) { console.error(err); }
    }

    async function handleDeleteCandidate(id) {
        if (!confirm('Hapus kandidat ini?')) return;
        try {
            await fetch(`${API}/api/recruitment/candidates/${id}`, { method: 'DELETE', headers });
            fetchCandidates(); fetchStats();
        } catch (err) { console.error(err); }
    }

    function resetCandidateForm() {
        setCandidateForm({
            full_name: '', email: '', phone: '', address: '', education: '',
            experience_years: 0, applied_position_id: '', source: 'website', notes: ''
        });
    }

    // ==================== INTERVIEW HANDLERS ====================
    async function handleInterviewSubmit(e) {
        e.preventDefault();
        const url = editInterviewId
            ? `${API}/api/recruitment/interviews/${editInterviewId}`
            : `${API}/api/recruitment/interviews`;
        const method = editInterviewId ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers, body: JSON.stringify(interviewForm) });
            if (res.ok) {
                setShowInterviewModal(false);
                resetInterviewForm();
                fetchInterviews();
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (err) { console.error(err); }
    }

    async function handleDeleteInterview(id) {
        if (!confirm('Hapus jadwal interview ini?')) return;
        try {
            await fetch(`${API}/api/recruitment/interviews/${id}`, { method: 'DELETE', headers });
            fetchInterviews();
        } catch (err) { console.error(err); }
    }

    function resetInterviewForm() {
        setInterviewForm({
            candidate_id: '', interview_date: '', interview_time: '',
            location: '', type: 'onsite', meeting_link: '', notes: '', status: 'scheduled'
        });
        setEditInterviewId(null);
    }

    function openEditInterview(i) {
        setInterviewForm({
            candidate_id: i.candidate_id, interview_date: i.interview_date?.split('T')[0] || '',
            interview_time: i.interview_time || '', location: i.location || '',
            type: i.type, meeting_link: i.meeting_link || '', notes: i.notes || '', status: i.status,
            result: i.result || ''
        });
        setEditInterviewId(i.id);
        setShowInterviewModal(true);
    }

    // ==================== STATS HELPERS ====================
    function getStatCount(arr, key) {
        const found = arr?.find(a => a.status === key);
        return found ? parseInt(found.count) : 0;
    }

    const totalPositions = positions.length;
    const openPositions = positions.filter(p => p.status === 'open').length;
    const totalCandidates = candidates.length;
    const hiredCount = stats?.candidates ? getStatCount(stats.candidates, 'hired') : 0;

    // ==================== TABS ====================
    const tabs = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'positions', icon: '💼', label: 'Lowongan' },
        { id: 'candidates', icon: '👥', label: 'Kandidat' },
        { id: 'interviews', icon: '🗓️', label: 'Interview' },
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="card-title" style={{ fontSize: '1.5rem' }}>🧑‍💼 Recruitment</h1>
                    <p className="card-subtitle">Manajemen proses rekrutmen karyawan</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button key={tab.id}
                        className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={{ padding: '0.6rem 1.2rem' }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ==================== DASHBOARD TAB ==================== */}
            {activeTab === 'dashboard' && stats && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="card status-card">
                            <div className="status-card-icon primary">💼</div>
                            <div className="status-card-content">
                                <h3>Posisi Terbuka</h3>
                                <p>{openPositions}</p>
                            </div>
                        </div>
                        <div className="card status-card">
                            <div className="status-card-icon warning">👥</div>
                            <div className="status-card-content">
                                <h3>Total Kandidat</h3>
                                <p>{stats.candidates?.reduce((s, c) => s + parseInt(c.count), 0) || 0}</p>
                            </div>
                        </div>
                        <div className="card status-card">
                            <div className="status-card-icon success">✅</div>
                            <div className="status-card-content">
                                <h3>Diterima</h3>
                                <p>{hiredCount}</p>
                            </div>
                        </div>
                        <div className="card status-card">
                            <div className="status-card-icon primary">🗓️</div>
                            <div className="status-card-content">
                                <h3>Interview Mendatang</h3>
                                <p>{stats.upcoming_interviews?.reduce((s, i) => s + parseInt(i.count), 0) || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Pipeline Overview */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'white', fontWeight: 700 }}>📈 Pipeline Rekrutmen</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {STATUS_PIPELINE.map(s => {
                                const count = getStatCount(stats.candidates, s);
                                return (
                                    <div key={s} style={{
                                        flex: '1', minWidth: '100px', textAlign: 'center', padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{count}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>
                                            {STATUS_LABELS[s]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent Candidates */}
                    {stats.recent_candidates?.length > 0 && (
                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', color: 'white', fontWeight: 700 }}>🕐 Kandidat Terbaru</h3>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Nama</th>
                                            <th>Posisi</th>
                                            <th>Status</th>
                                            <th>Tanggal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recent_candidates.map(c => (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                                                <td>{c.position_title || '-'}</td>
                                                <td><span className={`badge ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                                                <td>{new Date(c.created_at).toLocaleDateString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== POSITIONS TAB ==================== */}
            {activeTab === 'positions' && (
                <div>
                    <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
                        <button className="btn btn-primary" onClick={() => { resetPositionForm(); setShowPositionModal(true); }}>
                            + Tambah Lowongan
                        </button>
                    </div>
                    <div className="card">
                        {positions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</p>
                                <p>Belum ada lowongan</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Posisi</th>
                                            <th>Departemen</th>
                                            <th>Tipe</th>
                                            <th>Gaji</th>
                                            <th>Pelamar</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.map(p => (
                                            <tr key={p.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                                                    {p.description && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                                                </td>
                                                <td>{p.department || '-'}</td>
                                                <td><span className="badge badge-primary">{p.employment_type}</span></td>
                                                <td>
                                                    {p.salary_range_min || p.salary_range_max ? (
                                                        <span style={{ fontSize: '0.85rem' }}>
                                                            {p.salary_range_min ? `Rp ${Number(p.salary_range_min).toLocaleString('id-ID')}` : ''}
                                                            {p.salary_range_min && p.salary_range_max ? ' - ' : ''}
                                                            {p.salary_range_max ? `Rp ${Number(p.salary_range_max).toLocaleString('id-ID')}` : ''}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ fontWeight: 700, fontSize: '1.1rem' }}>{p.total_applicants}</td>
                                                <td><span className={`badge ${POSITION_STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => openEditPosition(p)}>✏️</button>
                                                        <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => handleDeletePosition(p.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== CANDIDATES TAB ==================== */}
            {activeTab === 'candidates' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <select className="form-input form-select" style={{ width: '180px' }}
                                value={filterPositionId} onChange={e => setFilterPositionId(e.target.value)}>
                                <option value="">Semua Posisi</option>
                                {positions.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <select className="form-input form-select" style={{ width: '150px' }}
                                value={filterCandidateStatus} onChange={e => setFilterCandidateStatus(e.target.value)}>
                                <option value="">Semua Status</option>
                                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={() => { resetCandidateForm(); setShowCandidateModal(true); }}>
                            + Tambah Kandidat
                        </button>
                    </div>

                    <div className="card">
                        {candidates.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</p>
                                <p>Belum ada kandidat</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Kandidat</th>
                                            <th>Posisi</th>
                                            <th>Pendidikan</th>
                                            <th>Pengalaman</th>
                                            <th>Sumber</th>
                                            <th>Status</th>
                                            <th>Pipeline</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.map(c => (
                                            <tr key={c.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                                                        {c.email || c.phone || '-'}
                                                    </div>
                                                </td>
                                                <td>{c.position_title || '-'}</td>
                                                <td>{c.education || '-'}</td>
                                                <td>{c.experience_years} tahun</td>
                                                <td><span className="badge badge-primary">{c.source}</span></td>
                                                <td>
                                                    <span className={`badge ${STATUS_COLORS[c.status]}`}>
                                                        {STATUS_LABELS[c.status]}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                                        {STATUS_PIPELINE.map((s, idx) => (
                                                            <div key={s} style={{
                                                                width: '18px', height: '6px',
                                                                borderRadius: '3px',
                                                                background: STATUS_PIPELINE.indexOf(c.status) >= idx || c.status === 'hired'
                                                                    ? (c.status === 'rejected' ? 'var(--danger-500)' : 'var(--success-500)')
                                                                    : 'rgba(255,255,255,0.1)',
                                                                transition: 'all 0.3s'
                                                            }} title={STATUS_LABELS[s]} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                                        {c.status !== 'hired' && c.status !== 'rejected' && (
                                                            <select className="form-input form-select"
                                                                style={{ width: '110px', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                                value={c.status}
                                                                onChange={e => handleUpdateCandidateStatus(c.id, e.target.value)}>
                                                                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                                                    <option key={k} value={k}>{v}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                            onClick={() => handleDeleteCandidate(c.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== INTERVIEWS TAB ==================== */}
            {activeTab === 'interviews' && (
                <div>
                    <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
                        <button className="btn btn-primary" onClick={() => { resetInterviewForm(); setShowInterviewModal(true); }}>
                            + Jadwalkan Interview
                        </button>
                    </div>
                    <div className="card">
                        {interviews.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                                <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗓️</p>
                                <p>Belum ada jadwal interview</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Kandidat</th>
                                            <th>Posisi</th>
                                            <th>Tanggal</th>
                                            <th>Waktu</th>
                                            <th>Tipe</th>
                                            <th>Lokasi</th>
                                            <th>Pewawancara</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interviews.map(i => (
                                            <tr key={i.id}>
                                                <td style={{ fontWeight: 600 }}>{i.candidate_name}</td>
                                                <td>{i.position_title || '-'}</td>
                                                <td>{i.interview_date ? new Date(i.interview_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                                                <td>{i.interview_time ? i.interview_time.substring(0, 5) : '-'}</td>
                                                <td>
                                                    <span className={`badge ${i.type === 'online' ? 'badge-primary' : 'badge-warning'}`}>
                                                        {i.type === 'online' ? '🌐 Online' : '🏢 Onsite'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {i.type === 'online' && i.meeting_link ? (
                                                        <a href={i.meeting_link} target="_blank" rel="noreferrer"
                                                            style={{ color: 'var(--primary-400)', textDecoration: 'underline' }}>
                                                            Link Meeting
                                                        </a>
                                                    ) : (i.location || '-')}
                                                </td>
                                                <td>{i.interviewer_name || '-'}</td>
                                                <td>
                                                    <span className={`badge ${i.status === 'completed' ? 'badge-success' :
                                                            i.status === 'cancelled' ? 'badge-danger' :
                                                                i.status === 'no-show' ? 'badge-danger' : 'badge-warning'
                                                        }`}>
                                                        {i.status === 'scheduled' ? '📅 Dijadwalkan' :
                                                            i.status === 'completed' ? '✅ Selesai' :
                                                                i.status === 'cancelled' ? '❌ Dibatalkan' : '⚠️ No Show'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => openEditInterview(i)}>✏️</button>
                                                        <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => handleDeleteInterview(i.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== POSITION MODAL ==================== */}
            {showPositionModal && (
                <div className="modal-overlay" onClick={() => setShowPositionModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editPositionId ? '✏️ Edit Lowongan' : '➕ Tambah Lowongan'}</h2>
                            <button className="modal-close" onClick={() => setShowPositionModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handlePositionSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Judul Posisi *</label>
                                    <input className="form-input" value={positionForm.title} required
                                        onChange={e => setPositionForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="Contoh: Frontend Developer" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Departemen</label>
                                    <input className="form-input" value={positionForm.department}
                                        onChange={e => setPositionForm(f => ({ ...f, department: e.target.value }))}
                                        placeholder="Contoh: IT" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Deskripsi</label>
                                <textarea className="form-input" rows="3" value={positionForm.description}
                                    onChange={e => setPositionForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Deskripsi pekerjaan..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Persyaratan</label>
                                <textarea className="form-input" rows="3" value={positionForm.requirements}
                                    onChange={e => setPositionForm(f => ({ ...f, requirements: e.target.value }))}
                                    placeholder="Persyaratan kandidat..." />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Gaji Minimum</label>
                                    <input type="number" className="form-input" value={positionForm.salary_range_min}
                                        onChange={e => setPositionForm(f => ({ ...f, salary_range_min: e.target.value }))}
                                        placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gaji Maksimum</label>
                                    <input type="number" className="form-input" value={positionForm.salary_range_max}
                                        onChange={e => setPositionForm(f => ({ ...f, salary_range_max: e.target.value }))}
                                        placeholder="0" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tipe Pekerjaan</label>
                                    <select className="form-input form-select" value={positionForm.employment_type}
                                        onChange={e => setPositionForm(f => ({ ...f, employment_type: e.target.value }))}>
                                        <option value="full-time">Full-time</option>
                                        <option value="part-time">Part-time</option>
                                        <option value="contract">Kontrak</option>
                                        <option value="internship">Magang</option>
                                    </select>
                                </div>
                                {editPositionId && (
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-input form-select" value={positionForm.status}
                                            onChange={e => setPositionForm(f => ({ ...f, status: e.target.value }))}>
                                            <option value="open">Open</option>
                                            <option value="closed">Closed</option>
                                            <option value="on-hold">On Hold</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowPositionModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">💾 Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== CANDIDATE MODAL ==================== */}
            {showCandidateModal && (
                <div className="modal-overlay" onClick={() => setShowCandidateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">➕ Tambah Kandidat</h2>
                            <button className="modal-close" onClick={() => setShowCandidateModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCandidateSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Nama Lengkap *</label>
                                    <input className="form-input" value={candidateForm.full_name} required
                                        onChange={e => setCandidateForm(f => ({ ...f, full_name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input type="email" className="form-input" value={candidateForm.email}
                                        onChange={e => setCandidateForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Telepon</label>
                                    <input className="form-input" value={candidateForm.phone}
                                        onChange={e => setCandidateForm(f => ({ ...f, phone: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Posisi Dilamar</label>
                                    <select className="form-input form-select" value={candidateForm.applied_position_id}
                                        onChange={e => setCandidateForm(f => ({ ...f, applied_position_id: e.target.value }))}>
                                        <option value="">Pilih Posisi</option>
                                        {positions.filter(p => p.status === 'open').map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Pendidikan</label>
                                    <input className="form-input" value={candidateForm.education}
                                        onChange={e => setCandidateForm(f => ({ ...f, education: e.target.value }))}
                                        placeholder="Contoh: S1 Informatika" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pengalaman (tahun)</label>
                                    <input type="number" className="form-input" value={candidateForm.experience_years}
                                        onChange={e => setCandidateForm(f => ({ ...f, experience_years: parseInt(e.target.value) || 0 }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alamat</label>
                                <textarea className="form-input" rows="2" value={candidateForm.address}
                                    onChange={e => setCandidateForm(f => ({ ...f, address: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Sumber</label>
                                    <select className="form-input form-select" value={candidateForm.source}
                                        onChange={e => setCandidateForm(f => ({ ...f, source: e.target.value }))}>
                                        <option value="website">Website</option>
                                        <option value="referral">Referral</option>
                                        <option value="jobfair">Job Fair</option>
                                        <option value="linkedin">LinkedIn</option>
                                        <option value="other">Lainnya</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Upload Resume</label>
                                    <input type="file" className="form-input" accept=".pdf,.doc,.docx"
                                        onChange={e => setCandidateForm(f => ({ ...f, resume_file: e.target.files[0] }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Catatan</label>
                                <textarea className="form-input" rows="2" value={candidateForm.notes}
                                    onChange={e => setCandidateForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowCandidateModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">💾 Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== INTERVIEW MODAL ==================== */}
            {showInterviewModal && (
                <div className="modal-overlay" onClick={() => setShowInterviewModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editInterviewId ? '✏️ Edit Interview' : '➕ Jadwalkan Interview'}</h2>
                            <button className="modal-close" onClick={() => setShowInterviewModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleInterviewSubmit}>
                            <div className="form-group">
                                <label className="form-label">Kandidat *</label>
                                <select className="form-input form-select" value={interviewForm.candidate_id} required
                                    onChange={e => setInterviewForm(f => ({ ...f, candidate_id: e.target.value }))}
                                    disabled={!!editInterviewId}>
                                    <option value="">Pilih Kandidat</option>
                                    {candidates.filter(c => c.status !== 'hired' && c.status !== 'rejected').map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.full_name} - {c.position_title || 'No Position'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tanggal *</label>
                                    <input type="date" className="form-input" value={interviewForm.interview_date} required
                                        onChange={e => setInterviewForm(f => ({ ...f, interview_date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Waktu</label>
                                    <input type="time" className="form-input" value={interviewForm.interview_time}
                                        onChange={e => setInterviewForm(f => ({ ...f, interview_time: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tipe</label>
                                    <select className="form-input form-select" value={interviewForm.type}
                                        onChange={e => setInterviewForm(f => ({ ...f, type: e.target.value }))}>
                                        <option value="onsite">🏢 Onsite</option>
                                        <option value="online">🌐 Online</option>
                                    </select>
                                </div>
                                {editInterviewId && (
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-input form-select" value={interviewForm.status}
                                            onChange={e => setInterviewForm(f => ({ ...f, status: e.target.value }))}>
                                            <option value="scheduled">Dijadwalkan</option>
                                            <option value="completed">Selesai</option>
                                            <option value="cancelled">Dibatalkan</option>
                                            <option value="no-show">No Show</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">{interviewForm.type === 'online' ? 'Link Meeting' : 'Lokasi'}</label>
                                <input className="form-input"
                                    value={interviewForm.type === 'online' ? interviewForm.meeting_link : interviewForm.location}
                                    onChange={e => {
                                        if (interviewForm.type === 'online') {
                                            setInterviewForm(f => ({ ...f, meeting_link: e.target.value }));
                                        } else {
                                            setInterviewForm(f => ({ ...f, location: e.target.value }));
                                        }
                                    }}
                                    placeholder={interviewForm.type === 'online' ? 'https://meet.google.com/...' : 'Ruang meeting lt. 3'} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Catatan</label>
                                <textarea className="form-input" rows="2" value={interviewForm.notes}
                                    onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowInterviewModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">💾 Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
