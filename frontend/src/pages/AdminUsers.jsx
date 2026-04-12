import { useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        employee_id: '',
        name: '',
        email: '',
        password: '',
        role: 'employee'
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const data = await authAPI.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    }

    function openAddModal() {
        setEditingUser(null);
        setFormData({
            employee_id: '',
            name: '',
            email: '',
            password: '',
            role: 'employee'
        });
        setShowModal(true);
        setError('');
        setSuccess('');
    }

    function openEditModal(user) {
        setEditingUser(user);
        setFormData({
            employee_id: user.employee_id,
            name: user.name,
            email: user.email || '',
            password: '', // Don't pre-fill password
            role: user.role
        });
        setShowModal(true);
        setError('');
        setSuccess('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (editingUser) {
                // Update existing user
                const updateData = { ...formData };
                if (!updateData.password) {
                    delete updateData.password; // Don't update password if empty
                }
                await authAPI.updateUser(editingUser.id, updateData);
                setSuccess('User berhasil diupdate');
            } else {
                // Create new user
                await authAPI.register(formData);
                setSuccess('User berhasil ditambahkan');
            }
            setShowModal(false);
            fetchUsers();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan user');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus user ini?')) return;

        try {
            await authAPI.deleteUser(id);
            fetchUsers();
        } catch (error) {
            alert(error.message || 'Gagal menghapus user');
        }
    }

    async function handleResetPassword(user) {
        const newPassword = prompt(`Reset password untuk ${user.name}?\nMasukkan password baru (minimal 6 karakter):`);

        if (!newPassword) return;

        if (newPassword.length < 6) {
            alert('Password minimal 6 karakter');
            return;
        }

        try {
            const result = await authAPI.resetPassword(user.id, newPassword);
            setSuccess(result.message || 'Password berhasil direset');
        } catch (error) {
            alert(error.message || 'Gagal mereset password');
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">👥 Kelola User</h1>
                <p className="page-subtitle">Atur akun karyawan dan admin</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span>
                    {success}
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar User</h2>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        + Tambah User
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : users.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <p className="empty-state-text">Belum ada user terdaftar</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Employee ID</th>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Tanggal Daftar</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.employee_id}</td>
                                        <td>{user.name}</td>
                                        <td>{user.email || '-'}</td>
                                        <td>
                                            <span className={`badge ${user.role === 'admin' ? 'badge-primary' : user.role === 'manager' ? 'badge-info' : 'badge-success'}`}>
                                                {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Pimpinan / Manager' : 'Karyawan'}
                                            </span>
                                        </td>
                                        <td>{new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => openEditModal(user)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => handleResetPassword(user)}
                                                >
                                                    🔑 Reset Password
                                                </button>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(user.id)}
                                                >
                                                    🗑️ Hapus
                                                </button>
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
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingUser ? 'Edit User' : 'Tambah User Baru'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger mb-3">
                                        <span className="alert-icon">⚠️</span>
                                        {error}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Employee ID *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Contoh: EMP001"
                                        value={formData.employee_id}
                                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Nama Lengkap *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Nama lengkap karyawan"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="email@company.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Password {editingUser ? '(kosongkan jika tidak ingin mengubah)' : '*'}
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder={editingUser ? 'Biarkan kosong jika tidak ingin mengubah' : 'Minimal 6 karakter'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                        minLength={formData.password ? 6 : undefined}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Role</label>
                                    <select
                                        className="form-input form-select"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="employee">Karyawan</option>
                                        <option value="manager">Pimpinan / Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
