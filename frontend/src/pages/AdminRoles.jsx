import { useState, useEffect } from 'react';
import { rolesAPI } from '../utils/api';

export default function AdminRoles() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        label: '',
        permissions: []
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            const [rolesData, permsData] = await Promise.all([
                rolesAPI.getAll(),
                rolesAPI.getPermissions()
            ]);
            setRoles(rolesData);
            setPermissions(permsData);
            setError('');
        } catch (err) {
            setError(err.message || 'Gagal memuat data role');
        } finally {
            setLoading(false);
        }
    }

    // Group permissions by category
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) {
            acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
    }, {});

    function handleOpenModal(role = null) {
        if (role) {
            setEditingRole(role);
            setFormData({
                name: role.name,
                label: role.label,
                permissions: role.permissions || []
            });
        } else {
            setEditingRole(null);
            setFormData({
                name: '',
                label: '',
                permissions: []
            });
        }
        setIsModalOpen(true);
        setError('');
        setSuccess('');
    }

    function handleCloseModal() {
        setIsModalOpen(false);
        setEditingRole(null);
    }

    function handleCheckboxChange(permissionKey) {
        setFormData(prev => {
            const newPerms = prev.permissions.includes(permissionKey)
                ? prev.permissions.filter(k => k !== permissionKey)
                : [...prev.permissions, permissionKey];
            return { ...prev, permissions: newPerms };
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            if (editingRole) {
                await rolesAPI.update(editingRole.id, formData);
                setSuccess('Role berhasil diperbarui');
            } else {
                await rolesAPI.create(formData);
                setSuccess('Role berhasil dibuat');
            }
            await fetchData();
            handleCloseModal();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan role');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id, name) {
        if (!confirm(`Hapus role ${name}? User dengan role ini tidak akan bisa login.`)) {
            return;
        }

        try {
            await rolesAPI.delete(id);
            setSuccess('Role berhasil dihapus');
            fetchData();
        } catch (err) {
            setError(err.message || 'Gagal menghapus role');
        }
    }

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Kelola Role</h1>
                    <p className="page-subtitle">Atur role dan hak akses menu pengguna</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    ➕ Tambah Role
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nama Role (ID)</th>
                                <th>Label / Tampilan</th>
                                <th>Jumlah Hak Akses</th>
                                <th>Jenis</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map((role) => (
                                <tr key={role.id}>
                                    <td><code style={{ background: 'var(--surface-300)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{role.name}</code></td>
                                    <td style={{ fontWeight: 600 }}>{role.label}</td>
                                    <td>
                                        {role.name === 'admin' ? (
                                            <span className="badge badge-primary">Akses Penuh</span>
                                        ) : (
                                            <span className="badge badge-info">{role.permissions?.length || 0} Menu</span>
                                        )}
                                    </td>
                                    <td>
                                        {role.is_system ? (
                                            <span className="badge" style={{ background: 'var(--surface-300)' }}>System</span>
                                        ) : (
                                            <span className="badge badge-success">Custom</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                                onClick={() => handleOpenModal(role)}
                                            >
                                                ✏️ Edit
                                            </button>
                                            {!role.is_system && (
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                    onClick={() => handleDelete(role.id, role.label)}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah/Edit */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingRole ? 'Edit Role' : 'Tambah Role Baru'}</h2>
                            <button className="modal-close" onClick={handleCloseModal}>&times;</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Nama Role (ID Unik)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        disabled={!!editingRole}
                                        required
                                        placeholder="misal: hrd, supervisor"
                                        style={{ textTransform: 'lowercase' }}
                                    />
                                    {!editingRole && <small style={{ color: 'var(--text-secondary)' }}>Tidak boleh ada spasi, hanya huruf kecil dan underscore</small>}
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Label Tampilan</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.label}
                                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                                        required
                                        placeholder="misal: Staff HRD, Supervisor Gudang"
                                    />
                                </div>
                            </div>

                            {editingRole?.name === 'admin' ? (
                                <div className="alert alert-info">
                                    Role <strong>Admin</strong> memiliki akses penuh ke semua fitur secara otomatis. Anda tidak perlu mengatur hak akses satu per satu.
                                </div>
                            ) : (
                                <>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                        Hak Akses Menu
                                    </h3>
                                    
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                                        gap: '1.5rem',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        padding: '0.5rem'
                                    }}>
                                        {Object.entries(groupedPermissions).map(([category, perms]) => (
                                            <div key={category} style={{ 
                                                background: 'var(--surface-200)', 
                                                padding: '1rem', 
                                                borderRadius: 'var(--radius-md)' 
                                            }}>
                                                <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem', color: 'var(--primary-500)' }}>
                                                    {category}
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {perms.map(perm => (
                                                        <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.permissions.includes(perm.key)}
                                                                onChange={() => handleCheckboxChange(perm.key)}
                                                                style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary-500)' }}
                                                            />
                                                            {perm.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : 'Simpan Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
