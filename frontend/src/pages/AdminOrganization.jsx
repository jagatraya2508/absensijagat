import { useEffect, useMemo, useState } from 'react';
import { organizationAPI } from '../utils/api';
import Icon from '../components/Icon';

function resolveMediaUrl(path) {
    if (!path || path === 'manual') return '';
    const value = String(path).trim();
    if (!value) return '';
    if (/^(https?:|blob:|data:)/i.test(value)) return value;
    const normalized = value.startsWith('/') ? value : `/${value}`;
    const api = import.meta.env.VITE_API_URL;
    if (api && /^https?:/i.test(api)) {
        return `${api.replace(/\/api\/?$/, '')}${normalized}`;
    }
    return normalized;
}

function ProfileAvatar({ photo, fallbackPhoto, name, size = 32 }) {
    const sources = [resolveMediaUrl(photo), resolveMediaUrl(fallbackPhoto)].filter(Boolean);
    const [index, setIndex] = useState(0);
    const src = sources[index];

    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--gray-200)',
            color: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: size * 0.4,
            border: '1px solid var(--gray-300)'
        }}>
            {src ? (
                <img
                    src={src}
                    alt={name || ''}
                    onError={() => setIndex((i) => i + 1)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            ) : (name || '?').charAt(0)}
        </div>
    );
}

function OrgNode({ node, depth = 0 }) {
    const [open, setOpen] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div style={{ marginLeft: depth === 0 ? 0 : 18 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.55rem 0.75rem',
                marginBottom: '0.35rem',
                background: depth === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-md)',
                borderLeft: depth === 0 ? '3px solid var(--primary-500)' : '3px solid rgba(255,255,255,0.12)'
            }}>
                {hasChildren ? (
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setOpen((v) => !v)}
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', minWidth: 28 }}
                    >
                        {open ? <Icon name="ChevronDown" size={12} /> : <Icon name="ChevronRight" size={12} />}
                    </button>
                ) : (
                    <span style={{ width: 28, textAlign: 'center', color: '#111' }}>•</span>
                )}
                <ProfileAvatar photo={node.photo} fallbackPhoto={node.attendance_photo} name={node.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#111' }}>{node.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#111' }}>
                        {node.position || node.role} {node.department ? `• ${node.department}` : ''}
                    </div>
                </div>
                {hasChildren && (
                    <span className="badge badge-primary">{node.children.length} bawahan</span>
                )}
            </div>
            {hasChildren && open && node.children.map((child) => (
                <OrgNode key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
    );
}

export default function AdminOrganization() {
    const [data, setData] = useState({ members: [], tree: [], unassigned: [], stats: {} });
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchOrg();
    }, []);

    async function fetchOrg() {
        setLoading(true);
        try {
            const result = await organizationAPI.getTree();
            setData(result);
            setError('');
        } catch (err) {
            setError(err.message || 'Gagal memuat struktur organisasi');
        } finally {
            setLoading(false);
        }
    }

    async function assignSupervisor(userId, supervisorId) {
        setSavingId(userId);
        setError('');
        setSuccess('');
        try {
            await organizationAPI.setSupervisor(userId, supervisorId || null);
            setSuccess('Atasan berhasil diperbarui');
            await fetchOrg();
        } catch (err) {
            setError(err.message || 'Gagal menetapkan atasan');
        } finally {
            setSavingId(null);
        }
    }

    const filteredMembers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return data.members || [];
        return (data.members || []).filter((m) =>
            (m.name || '').toLowerCase().includes(q) ||
            (m.employee_id || '').toLowerCase().includes(q) ||
            (m.department || '').toLowerCase().includes(q) ||
            (m.position || '').toLowerCase().includes(q) ||
            (m.supervisor_name || '').toLowerCase().includes(q)
        );
    }, [data.members, search]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Building2" size={16} inline /> Struktur Organisasi</h1>
                <p className="page-subtitle" style={{ color: '#111' }}>Tentukan atasan tiap karyawan. Rantai ini dipakai untuk approval izin & cuti bertingkat.</p>
            </div>

            {error && <div className="alert alert-danger mb-4"><Icon name="AlertTriangle" size={16} inline /> {error}</div>}
            {success && <div className="alert alert-success mb-4"><Icon name="CheckCircle2" size={16} inline /> {success}</div>}

            <div className="grid grid-3 mb-4">
                <div className="card status-card">
                    <div className="status-card-icon primary"><Icon name="Users" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>{data.stats?.total || 0}</h3>
                        <p>Total orang</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon warning"><Icon name="Link" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>{data.stats?.with_supervisor || 0}</h3>
                        <p>Sudah punya atasan</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon danger"><Icon name="AlertTriangle" size={16} inline /></div>
                    <div className="status-card-content">
                        <h3>{data.stats?.unassigned || 0}</h3>
                        <p>Belum punya atasan</p>
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h2 className="card-title"><Icon name="TreePine" size={16} inline /> Bagan Organisasi</h2>
                    <button className="btn btn-outline" onClick={fetchOrg} disabled={loading}><Icon name="RefreshCw" size={16} inline /> Refresh</button>
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : (data.tree || []).length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="Building2" size={16} inline /></div>
                        <p className="empty-state-text">Belum ada data karyawan</p>
                    </div>
                ) : (
                    <div>
                        <p style={{ fontSize: '0.85rem', color: '#111', marginBottom: '1rem' }}>
                            Orang tanpa atasan tampil di tingkat teratas. Tetapkan atasan di tabel bawah agar rantai approval berjalan.
                        </p>
                        {data.tree.map((node) => (
                            <OrgNode key={node.id} node={node} />
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title"><Icon name="User" size={16} inline /> Tetapkan Atasan</h2>
                    <input
                        className="form-input"
                        placeholder="Cari nama / NIK / departemen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 260 }}
                    />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Karyawan</th>
                                <th>Departemen / Jabatan</th>
                                <th>Atasan langsung</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((member) => (
                                <tr key={member.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <ProfileAvatar photo={member.photo} fallbackPhoto={member.attendance_photo} name={member.name} />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{member.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#111' }}>{member.employee_id} • {member.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div>{member.department || '-'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#111' }}>{member.position || '-'}</div>
                                    </td>
                                    <td>
                                        <select
                                            className="form-input form-select"
                                            value={member.supervisor_id || ''}
                                            disabled={savingId === member.id}
                                            onChange={(e) => assignSupervisor(member.id, e.target.value)}
                                        >
                                            <option value="">— Tidak ada atasan —</option>
                                            {(data.members || [])
                                                .filter((m) => m.id !== member.id)
                                                .map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} {m.position ? `(${m.position})` : ''}
                                                    </option>
                                                ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center', color: '#111', padding: '1.5rem' }}>
                                        Tidak ada data
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
