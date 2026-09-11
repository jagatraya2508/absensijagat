import Icon from '../components/Icon';
import { useState, useEffect } from 'react';
import { authAPI, offDaysAPI } from '../utils/api';

export default function OffDays() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [offDays, setOffDays] = useState([]);
    const [date, setDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (selectedUser) {
            fetchOffDays(selectedUser);
        } else {
            setOffDays([]);
        }
    }, [selectedUser]);

    async function fetchUsers() {
        try {
            const data = await authAPI.getUsers();
            // Filter only employees, or show all? usually for employees.
            // But getUsers returns all. Let's filter if needed, but role is in data.
            const employees = data.filter(u => u.role === 'employee');
            setUsers(employees);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setError('Gagal memuat data karyawan');
        }
    }

    async function fetchOffDays(userId) {
        setLoading(true);
        try {
            const data = await offDaysAPI.getByUser(userId);
            setOffDays(data);
        } catch (error) {
            console.error('Failed to fetch off days:', error);
            setError('Gagal memuat data libur');
        } finally {
            setLoading(false);
        }
    }

    async function handleAdd(e) {
        e.preventDefault();
        if (!selectedUser || !date) return;

        setLoading(true);
        try {
            await offDaysAPI.add(selectedUser, date);
            setSuccess('Jadwal libur berhasil ditambahkan');
            setDate('');
            fetchOffDays(selectedUser);
        } catch (error) {
            setError(error.message || 'Gagal menambahkan jadwal libur');
        } finally {
            setLoading(false);
            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus jadwal libur ini?')) return;

        try {
            await offDaysAPI.delete(id);
            fetchOffDays(selectedUser);
        } catch (error) {
            alert(error.message || 'Gagal menghapus jadwal libur');
        }
    }

    // Format date for display
    function formatDate(dateString) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header">
                <h1 className="page-title">Atur Jadwal Libur</h1>
                <p className="page-subtitle">Kelola hari libur / off day untuk setiap karyawan</p>
            </div>

            <div className="card">
                <div style={{ padding: '1.5rem' }}>

                    {error && (
                        <div className="alert alert-danger mb-3">
                            <span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><Icon name="X" size={16} /></button>
                        </div>
                    )}

                    {success && (
                        <div className="alert alert-success mb-3">
                            <span className="alert-icon"><Icon name="Check" size={16} inline /></span> {success} </div> )} <div className="form-group"> <label className="form-label">Pilih Karyawan</label> <select className="form-input form-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} > <option value="">-- Pilih Karyawan --</option> {users.map(user => ( <option key={user.id} value={user.id}> {user.name} ({user.employee_id}) </option> ))} </select> </div> {selectedUser && ( <> <div style={{ margin:'2rem 0', borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem' }}>
                                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Tambah Tanggal Libur</h3>
                                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label">Tanggal</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading || !date}
                                    >
                                        {loading ? 'Menyimpan...' : '+ Tambah'}
                                    </button>
                                </form>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Daftar Hari Libur</h3>

                                {offDays.length === 0 ? (
                                    <p style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Belum ada jadwal libur yang diatur.</p>
                                ) : (
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Tanggal</th>
                                                    <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {offDays.map(day => (
                                                    <tr key={day.id}>
                                                        <td>{formatDate(day.off_date)}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button
                                                                onClick={() => handleDelete(day.id)}
                                                                className="btn btn-outline"
                                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-200)' }}
                                                                title="Hapus"
                                                            >
                                                                Hapus </button> </td> </tr> ))} </tbody> </table> </div> )} </div> </> )} </div> </div> </div> ); }