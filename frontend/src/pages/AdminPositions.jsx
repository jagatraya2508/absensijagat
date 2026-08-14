import { useState, useEffect } from 'react';
import { positionsAPI } from '../utils/api';

export default function AdminPositions() {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    
    const [formData, setFormData] = useState({ id: null, name: '', description: '' });

    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState('');
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    useEffect(() => {
        fetchPositions();
    }, []);

    async function fetchPositions() {
        try {
            const data = await positionsAPI.getAll();
            setPositions(data);
        } catch (err) {
            console.error('Failed to fetch positions:', err);
            setError('Gagal memuat data jabatan');
        } finally {
            setLoading(false);
        }
    }

    function openModal(pos = null) {
        if (pos) {
            setFormData({ id: pos.id, name: pos.name, description: pos.description || '' });
        } else {
            setFormData({ id: null, name: '', description: '' });
        }
        setError('');
        setSuccess('');
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!formData.name) {
            setError('Nama jabatan harus diisi');
            return;
        }

        setSaving(true);
        setError('');
        
        try {
            if (formData.id) {
                await positionsAPI.update(formData.id, { name: formData.name, description: formData.description });
                setSuccess('Berhasil memperbarui jabatan');
            } else {
                await positionsAPI.create({ name: formData.name, description: formData.description });
                setSuccess('Berhasil menambahkan jabatan baru');
            }
            setShowModal(false);
            fetchPositions();
        } catch (err) {
            setError(err.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    }

    function openImportModal() {
        setImportFile(null);
        setImportResult(null);
        setImportError('');
        setShowImportModal(true);
    }

    async function handleDownloadTemplate() {
        setDownloadingTemplate(true);
        try {
            await positionsAPI.downloadTemplate();
        } catch (err) {
            alert(err.message || 'Gagal mengunduh template');
        } finally {
            setDownloadingTemplate(false);
        }
    }

    async function handleImportPositions() {
        if (!importFile) {
            setImportError('Pilih file Excel terlebih dahulu');
            return;
        }

        setImporting(true);
        setImportError('');
        setImportResult(null);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', importFile);
            const result = await positionsAPI.import(formDataUpload);
            setImportResult(result);
            const saved = (result.imported || 0) + (result.updated || 0);
            if (saved > 0) {
                setSuccess(`${result.imported || 0} jabatan ditambahkan, ${result.updated || 0} jabatan diperbarui`);
                fetchPositions();
            }
        } catch (err) {
            setImportError(err.message || 'Gagal mengimpor jabatan');
        } finally {
            setImporting(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Apakah Anda yakin ingin menghapus jabatan ini?')) return;
        
        try {
            await positionsAPI.delete(id);
            setSuccess('Jabatan berhasil dihapus');
            fetchPositions();
        } catch (err) {
            setError(err.message || 'Gagal menghapus jabatan');
        }
    }

    const filteredData = positions.filter(d => 
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🏅 Master Jabatan</h1>
                <p className="page-subtitle">Kelola daftar jabatan perusahaan</p>
            </div>

            {success && (
                <div className="alert alert-success mb-3">
                    <span className="alert-icon">✓</span> {success}
                </div>
            )}
            {error && !showModal && (
                <div className="alert alert-danger mb-3">
                    <span className="alert-icon">⚠️</span> {error}
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>Daftar Jabatan</h2>
                        <button
                            className="btn"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            title="Unduh template Excel untuk import jabatan"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                cursor: downloadingTemplate ? 'wait' : 'pointer',
                                opacity: downloadingTemplate ? 0.7 : 1
                            }}
                        >
                            {downloadingTemplate ? 'Mengunduh...' : '📥 Template'}
                        </button>
                        <button
                            className="btn"
                            onClick={openImportModal}
                            title="Upload jabatan dari Excel"
                            style={{
                                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                cursor: 'pointer'
                            }}
                        >
                            📤 Upload Excel
                        </button>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            ➕ Tambah Jabatan
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cari jabatan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ maxWidth: 300, margin: 0 }}
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏅</div>
                        <p className="empty-state-text">Belum ada data jabatan</p>
                        <button className="btn btn-outline" onClick={() => openModal()}>
                            Tambah Jabatan Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Nama Jabatan</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(pos => (
                                    <tr key={pos.id}>
                                        <td style={{ color: 'var(--gray-400)' }}>#{pos.id}</td>
                                        <td style={{ fontWeight: 500 }}>{pos.name}</td>
                                        <td style={{ color: 'var(--gray-300)' }}>{pos.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => openModal(pos)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(pos.id)}
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

            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Upload Jabatan dari Excel</h2>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>&times;</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {importError && (
                                <div className="alert alert-danger mb-3">
                                    ⚠️ {importError}
                                </div>
                            )}

                            <div className="alert alert-info mb-3">
                                ℹ️ Unduh template resmi, isi <strong>Nama</strong> jabatan, lalu unggah file .xlsx.
                                Keterangan opsional. Nama yang sudah ada akan diperbarui.
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
                                        setImportError('');
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
                                    <div className={`alert mb-3 ${(importResult.imported || 0) + (importResult.updated || 0) > 0 ? 'alert-success' : 'alert-warning'}`}>
                                        {(importResult.imported || 0) + (importResult.updated || 0) > 0 ? '✅' : '⚠️'}{' '}
                                        Ditambah: <strong>{importResult.imported || 0}</strong>
                                        {' · '}Diperbarui: <strong>{importResult.updated || 0}</strong>
                                        {' · '}Gagal: <strong>{importResult.failed || 0}</strong>
                                    </div>

                                    {importResult.results?.length > 0 && (
                                        <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                                            <table className="table" style={{ fontSize: '0.8rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Baris</th>
                                                        <th>Nama</th>
                                                        <th>Status</th>
                                                        <th>Keterangan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importResult.results.map((item) => (
                                                        <tr key={`${item.row}-${item.name}`}>
                                                            <td>{item.row}</td>
                                                            <td>{item.name}</td>
                                                            <td>
                                                                <span style={{
                                                                    fontWeight: 600,
                                                                    color: item.status === 'success'
                                                                        ? 'var(--success-500, #10b981)'
                                                                        : 'var(--danger-500)'
                                                                }}>
                                                                    {item.status === 'success' ? 'Berhasil' : 'Gagal'}
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

                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
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
                                        onClick={handleImportPositions}
                                        disabled={importing || !importFile}
                                    >
                                        {importing ? 'Mengimpor...' : 'Unggah & Import'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{formData.id ? 'Edit Jabatan' : 'Tambah Jabatan'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger mb-3">
                                        <span className="alert-icon">⚠️</span> {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Nama Jabatan</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="Contoh: Manager, Supervisor, Staff"
                                        required 
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Keterangan (Opsional)</label>
                                    <textarea 
                                        className="form-input" 
                                        value={formData.description} 
                                        onChange={e => setFormData({...formData, description: e.target.value})} 
                                        rows="3"
                                        placeholder="Penjelasan singkat mengenai jabatan..."
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : '💾 Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
