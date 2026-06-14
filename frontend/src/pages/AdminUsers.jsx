import { useState, useEffect, useMemo } from 'react';
import { authAPI, licenseAPI } from '../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'employee_id', direction: 'asc' });

    // License state
    const [licenseInfo, setLicenseInfo] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchLicenseInfo();
    }, []);

    async function fetchLicenseInfo() {
        try {
            const data = await licenseAPI.getInfo();
            if (data.active) {
                setLicenseInfo(data);
            }
        } catch (error) {
            console.error('Failed to fetch license info:', error);
        }
    }

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
        if (licenseInfo && users.length >= licenseInfo.max_users) {
            alert(`Tidak dapat menambah pengguna. Batas lisensi (${licenseInfo.max_users} pengguna) telah tercapai.`);
            return;
        }

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

    // Sort handler
    function handleSort(key) {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }

    function getSortIcon(key) {
        if (sortConfig.key !== key) return '⇅';
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    }

    function getRoleLabel(role) {
        if (role === 'admin') return 'Admin';
        if (role === 'manager') return 'Pimpinan / Manager';
        return 'Karyawan';
    }

    // Filtered & sorted users
    const filteredUsers = useMemo(() => {
        let result = users.filter(u =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.employee_id.toLowerCase().includes(search.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.role || '').toLowerCase().includes(search.toLowerCase())
        );

        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aVal, bVal;

                if (sortConfig.key === 'created_at') {
                    aVal = new Date(a.created_at).getTime();
                    bVal = new Date(b.created_at).getTime();
                } else if (sortConfig.key === 'role') {
                    aVal = getRoleLabel(a.role).toLowerCase();
                    bVal = getRoleLabel(b.role).toLowerCase();
                } else {
                    aVal = (a[sortConfig.key] || '').toString().toLowerCase();
                    bVal = (b[sortConfig.key] || '').toString().toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [users, search, sortConfig]);

    // Export to Excel
    function handleExportExcel() {
        const data = filteredUsers.map((user, i) => ({
            'No': i + 1,
            'Employee ID': user.employee_id,
            'Nama': user.name,
            'Email': user.email || '-',
            'Role': getRoleLabel(user.role),
            'Tanggal Daftar': new Date(user.created_at).toLocaleDateString('id-ID')
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // No
            { wch: 16 }, // Employee ID
            { wch: 28 }, // Nama
            { wch: 28 }, // Email
            { wch: 22 }, // Role
            { wch: 16 }, // Tanggal Daftar
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data User');
        XLSX.writeFile(wb, `Data_User_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // Export to PDF
    function handleExportPDF() {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Data User', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}  |  Total: ${filteredUsers.length} user`, pageWidth / 2, 22, { align: 'center' });

        const tableData = filteredUsers.map((user, i) => [
            i + 1,
            user.employee_id,
            user.name,
            user.email || '-',
            getRoleLabel(user.role),
            new Date(user.created_at).toLocaleDateString('id-ID')
        ]);

        doc.autoTable({
            startY: 28,
            head: [['No', 'Employee ID', 'Nama', 'Email', 'Role', 'Tanggal Daftar']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [30, 41, 82], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            alternateRowStyles: { fillColor: [240, 243, 255] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 30 },
                2: { cellWidth: 50 },
                3: { cellWidth: 55 },
                4: { halign: 'center', cellWidth: 35 },
                5: { halign: 'center', cellWidth: 30 }
            },
            didDrawPage: (data) => {
                // Footer
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(`Halaman ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 7, { align: 'center' });
            }
        });

        doc.save(`Data_User_${new Date().toISOString().slice(0, 10)}.pdf`);
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

            {licenseInfo && (
                <div className={`alert mb-3 ${users.length >= licenseInfo.max_users ? 'alert-danger' : users.length >= licenseInfo.max_users * 0.9 ? 'alert-warning' : 'alert-info'}`}>
                    <span className="alert-icon">ℹ️</span>
                    <div>
                        <strong>Info Lisensi: </strong>
                        Pengguna terdaftar: {users.length} / {licenseInfo.max_users} 
                        {users.length >= licenseInfo.max_users ? ' (Batas Tercapai)' : ''}
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">Daftar User</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Cari user..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ maxWidth: 220 }}
                        />
                        <button
                            className="btn"
                            onClick={handleExportPDF}
                            title="Ekspor ke PDF"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #ef4444, #f87171)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                transition: 'all 0.2s', cursor: 'pointer'
                            }}
                        >
                            📄 PDF
                        </button>
                        <button
                            className="btn"
                            onClick={handleExportExcel}
                            title="Ekspor ke Excel"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #22c55e, #4ade80)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                transition: 'all 0.2s', cursor: 'pointer'
                            }}
                        >
                            📊 Excel
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={openAddModal}
                            disabled={licenseInfo && users.length >= licenseInfo.max_users}
                        >
                            + Tambah User
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <p className="empty-state-text">Belum ada user terdaftar</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('employee_id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Employee ID <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'employee_id' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('employee_id')}</span>
                                    </th>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Nama <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'name' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('name')}</span>
                                    </th>
                                    <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Email <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'email' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('email')}</span>
                                    </th>
                                    <th onClick={() => handleSort('role')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Role <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'role' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('role')}</span>
                                    </th>
                                    <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                        Tanggal Daftar <span style={{ fontSize: '0.7rem', opacity: sortConfig.key === 'created_at' ? 1 : 0.35, marginLeft: 4 }}>{getSortIcon('created_at')}</span>
                                    </th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.employee_id}</td>
                                        <td>{user.name}</td>
                                        <td>{user.email || '-'}</td>
                                        <td>
                                            <span className={`badge ${user.role === 'admin' ? 'badge-primary' : user.role === 'manager' ? 'badge-info' : 'badge-success'}`}>
                                                {getRoleLabel(user.role)}
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
