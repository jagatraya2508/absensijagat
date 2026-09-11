import { useState, useEffect } from 'react';
import { announcementsAPI } from '../utils/api';
import Icon from '../components/Icon';

export default function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        is_active: true
    });

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        try {
            const data = await announcementsAPI.getAll();
            setAnnouncements(data);
        } catch (err) {
            setError('Gagal memuat pengumuman');
        } finally {
            setLoading(false);
        }
    }

    function handleCreate() {
        setEditingItem(null);
        setFormData({ title: '', content: '', is_active: true });
        setShowModal(true);
        setError('');
        setSuccess('');
    }

    function handleEdit(item) {
        setEditingItem(item);
        setFormData({
            title: item.title,
            content: item.content,
            is_active: item.is_active
        });
        setShowModal(true);
        setError('');
        setSuccess('');
    }

    async function handleDelete(id) {
        if (!window.confirm('Yakin ingin menghapus pengumuman ini?')) return;

        try {
            await announcementsAPI.delete(id);
            setSuccess('Pengumuman berhasil dihapus');
            fetchAnnouncements();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Gagal menghapus pengumuman');
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingItem) {
                await announcementsAPI.update(editingItem.id, formData);
                setSuccess('Pengumuman berhasil diperbarui');
            } else {
                await announcementsAPI.create(formData);
                setSuccess('Pengumuman berhasil dibuat');
            }
            setShowModal(false);
            fetchAnnouncements();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header d-flex justify-content-between align-items-center">
                <div>
                    <h1 className="page-title"><Icon name="Megaphone" size={16} inline /> Kelola Pengumuman</h1>
                    <p className="page-subtitle">Buat informasi untuk karyawan</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    + Buat Pengumuman
                </button>
            </div>

            {error && <div className="alert alert-danger mb-3">{error}</div>}
            {success && <div className="alert alert-success mb-3">{success}</div>}

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Judul</th>
                                <th>Konten</th>
                                <th>Status</th>
                                <th>Dibuat Pada</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {announcements.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-4 text-muted">
                                        Belum ada pengumuman
                                    </td>
                                </tr>
                            ) : (
                                announcements.map(item => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 600 }}>{item.title}</td>
                                        <td>
                                            <div style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.content}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                                                {item.is_active ? 'Aktif' : 'Non-aktif'}
                                            </span>
                                        </td>
                                        <td>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className="btn-icon text-primary"
                                                    onClick={() => handleEdit(item)}
                                                    title="Edit"
                                                >
                                                    <Icon name="Pencil" size={16} inline />
                                                </button>
                                                <button
                                                    className="btn-icon text-danger"
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Hapus"
                                                >
                                                    <Icon name="Trash2" size={16} inline />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingItem ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
                            </h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><Icon name="X" size={16} inline /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Judul</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        placeholder="Contoh: Jadwal Libur Lebaran"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Isi Pengumuman</label>
                                    <textarea
                                        className="form-input"
                                        rows="5"
                                        value={formData.content}
                                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        required
                                        placeholder="Tulis detail pengumuman di sini..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                            style={{ width: 18, height: 18 }}
                                        />
                                        <span>Tampilkan ke Karyawan (Aktif)</span>
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                        Batal
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
