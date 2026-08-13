import { useState, useEffect, useMemo } from 'react';
import { authAPI, licenseAPI, rolesAPI } from '../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
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
    const [changingRole, setChangingRole] = useState(null); // track which user's role is being changed
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'employee_id', direction: 'asc' });
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    // License state
    const [licenseInfo, setLicenseInfo] = useState(null);

    useEffect(() => {
        fetchData();
        fetchLicenseInfo();
    }, []);

    async function fetchData() {
        try {
            const [usersData, rolesData] = await Promise.all([
                authAPI.getUsers(),
                rolesAPI.getAll()
            ]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    }

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
            fetchData();
            fetchLicenseInfo();
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
            fetchData();
            fetchLicenseInfo();
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

    async function handleRoleChange(user, newRole) {
        if (newRole === user.role) return;

        const roleLabels = { admin: 'Admin', manager: 'Pimpinan / Manager', employee: 'Karyawan' };
        const confirmed = confirm(
            `Ubah role ${user.name} dari "${roleLabels[user.role]}" menjadi "${roleLabels[newRole]}"?`
        );
        if (!confirmed) return;

        setChangingRole(user.id);
        try {
            await authAPI.updateUser(user.id, { role: newRole });
            const selectedRole = roles.find(r => r.name === newRole);
            setSuccess(`Role ${user.name} berhasil diubah menjadi ${selectedRole?.label || newRole}`);
            
            // Just update the user in the local state to avoid full refetch
            setUsers(users.map(u => {
                if (u.id === user.id) {
                    return { ...u, role: newRole, role_label: selectedRole?.label || newRole };
                }
                return u;
            }));
        } catch (err) {
            alert(err.message || 'Gagal mengubah role');
        } finally {
            setChangingRole(null);
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

    function openImportModal() {
        setImportFile(null);
        setImportResult(null);
        setShowImportModal(true);
        setError('');
    }

    async function handleDownloadTemplate() {
        setDownloadingTemplate(true);
        try {
            await authAPI.downloadUserTemplate();
        } catch (err) {
            alert(err.message || 'Gagal mengunduh template');
        } finally {
            setDownloadingTemplate(false);
        }
    }

    async function handleImportUsers() {
        if (!importFile) {
            setError('Pilih file Excel terlebih dahulu');
            return;
        }

        setImporting(true);
        setError('');
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const result = await authAPI.importUsers(formData);
            setImportResult(result);
            if (result.imported > 0) {
                setSuccess(`${result.imported} user berhasil diimpor`);
                fetchData();
                fetchLicenseInfo();
            }
        } catch (err) {
            setError(err.message || 'Gagal mengimpor user');
        } finally {
            setImporting(false);
        }
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
                            className="btn"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            title="Unduh template Excel untuk import user"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                transition: 'all 0.2s', cursor: downloadingTemplate ? 'wait' : 'pointer',
                                opacity: downloadingTemplate ? 0.7 : 1
                            }}
                        >
                            {downloadingTemplate ? 'Mengunduh...' : '📥 Template'}
                        </button>
                        <button
                            className="btn"
                            onClick={openImportModal}
                            disabled={licenseInfo && users.length >= licenseInfo.max_users}
                            title="Upload user dari Excel"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                transition: 'all 0.2s', cursor: 'pointer'
                            }}
                        >
                            📤 Upload Excel
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
                                            <select
                                                className="form-input form-select"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user, e.target.value)}
                                                disabled={changingRole === user.id}
                                                style={{
                                                    padding: '0.35rem 0.6rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    minWidth: 155,
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: changingRole === user.id ? 'wait' : 'pointer',
                                                    opacity: changingRole === user.id ? 0.6 : 1,
                                                    background: user.role === 'admin'
                                                        ? 'rgba(99, 102, 241, 0.1)'
                                                        : user.role === 'manager'
                                                            ? 'rgba(6, 182, 212, 0.1)'
                                                            : 'rgba(16, 185, 129, 0.1)',
                                                    borderColor: user.role === 'admin'
                                                        ? 'rgba(99, 102, 241, 0.3)'
                                                        : user.role === 'manager'
                                                            ? 'rgba(6, 182, 212, 0.3)'
                                                            : 'rgba(16, 185, 129, 0.3)',
                                                    color: user.role === 'admin'
                                                        ? 'var(--primary-400, #818cf8)'
                                                        : user.role === 'manager'
                                                            ? 'var(--info-500, #06b6d4)'
                                                            : 'var(--success-500, #10b981)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.name}>
                                                        {r.name === 'admin' ? '🛡️ ' : r.name === 'manager' ? '👔 ' : '👤 '}
                                                        {r.label}
                                                    </option>
                                                ))}
                                            </select>
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
                                    className="form-input"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    {roles.map(r => (
                                        <option key={r.id} value={r.name}>{r.label}</option>
                                    ))}
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

            {/* Import Excel Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Upload User dari Excel</h3>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            {error && (
                                <div className="alert alert-danger mb-3">
                                    <span className="alert-icon">⚠️</span>
                                    {error}
                                </div>
                            )}

                            <div className="alert alert-info mb-3">
                                <span className="alert-icon">ℹ️</span>
                                <div>
                                    Unduh template resmi, isi data user, lalu unggah file .xlsx.
                                    Kolom wajib: <strong>Employee ID</strong>, <strong>Nama</strong>, dan <strong>Password</strong> (minimal 6 karakter).
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">File Excel (.xlsx)</label>
                                <input
                                    type="file"
                                    className="form-input"
                                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={(e) => {
                                        setImportFile(e.target.files?.[0] || null);
                                        setImportResult(null);
                                        setError('');
                                    }}
                                />
                                {importFile && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                                        File dipilih: {importFile.name}
                                    </p>
                                )}
                            </div>

                            {importResult && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div className={`alert mb-3 ${importResult.imported > 0 ? 'alert-success' : 'alert-warning'}`}>
                                        <span className="alert-icon">{importResult.imported > 0 ? '✓' : '⚠️'}</span>
                                        <div>
                                            Berhasil: <strong>{importResult.imported}</strong>
                                            {' · '}Gagal: <strong>{importResult.failed}</strong>
                                            {importResult.skipped > 0 && (
                                                <> {' · '}Dilewati (lisensi): <strong>{importResult.skipped}</strong></>
                                            )}
                                        </div>
                                    </div>

                                    {importResult.results?.length > 0 && (
                                        <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                                            <table className="table" style={{ fontSize: '0.8rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Baris</th>
                                                        <th>Employee ID</th>
                                                        <th>Status</th>
                                                        <th>Keterangan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importResult.results.map((item) => (
                                                        <tr key={`${item.row}-${item.employee_id}`}>
                                                            <td>{item.row}</td>
                                                            <td>{item.employee_id}</td>
                                                            <td>
                                                                <span style={{
                                                                    fontWeight: 600,
                                                                    color: item.status === 'success'
                                                                        ? 'var(--success-500, #10b981)'
                                                                        : item.status === 'skipped'
                                                                            ? 'var(--warning-500, #f59e0b)'
                                                                            : 'var(--danger-500)'
                                                                }}>
                                                                    {item.status === 'success' ? 'Berhasil' : item.status === 'skipped' ? 'Dilewati' : 'Gagal'}
                                                                </span>
                                                            </td>
                                                            <td>{item.message}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleDownloadTemplate}
                                disabled={downloadingTemplate}
                            >
                                {downloadingTemplate ? 'Mengunduh...' : '📥 Unduh Template'}
                            </button>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowImportModal(false)}>
                                    Tutup
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleImportUsers}
                                    disabled={importing || !importFile}
                                >
                                    {importing ? 'Mengimpor...' : 'Unggah & Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
