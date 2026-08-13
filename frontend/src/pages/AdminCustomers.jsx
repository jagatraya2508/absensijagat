import { useState, useEffect, useCallback } from 'react';
import { customersAPI } from '../utils/api';

export default function AdminCustomers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [searchQuery, setSearchQuery] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', address: '', phone: '', notes: '' });

    // Code settings modal
    const [showCodeSettings, setShowCodeSettings] = useState(false);
    const [codeSettings, setCodeSettings] = useState({ prefix: 'CUST', next_number: '1', digits: '4' });

    // Import Excel
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState('');
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await customersAPI.getAll();
            setCustomers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCodeSettings = useCallback(async () => {
        try {
            const data = await customersAPI.getCodeSettings();
            setCodeSettings({
                prefix: data.customer_code_prefix || 'CUST',
                next_number: data.customer_code_next || '1',
                digits: data.customer_code_digits || '4'
            });
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();
        fetchCodeSettings();
    }, [fetchCustomers, fetchCodeSettings]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    function openAdd() {
        setEditId(null);
        setForm({ name: '', address: '', phone: '', notes: '' });
        setShowModal(true);
    }

    function openEdit(cust) {
        setEditId(cust.id);
        setForm({ name: cust.name, address: cust.address || '', phone: cust.phone || '', notes: cust.notes || '' });
        setShowModal(true);
    }

    async function saveCustomer() {
        try {
            if (!form.name.trim()) {
                showMsg('danger', 'Nama customer harus diisi');
                return;
            }
            if (editId) {
                await customersAPI.update(editId, form);
                showMsg('success', 'Customer berhasil diperbarui');
            } else {
                await customersAPI.create(form);
                showMsg('success', 'Customer baru berhasil ditambahkan');
            }
            setShowModal(false);
            fetchCustomers();
            fetchCodeSettings(); // refresh next number
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    async function deleteCustomer(id, name) {
        if (!confirm(`Yakin ingin menghapus customer "${name}"?`)) return;
        try {
            await customersAPI.delete(id);
            showMsg('success', 'Customer berhasil dihapus');
            fetchCustomers();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    async function toggleActive(cust) {
        try {
            await customersAPI.update(cust.id, { ...cust, is_active: !cust.is_active });
            showMsg('success', `Customer ${cust.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
            fetchCustomers();
        } catch (e) {
            showMsg('danger', e.message);
        }
    }

    async function saveCodeSettings() {
        try {
            await customersAPI.updateCodeSettings(codeSettings);
            showMsg('success', 'Pengaturan kode customer berhasil disimpan');
            setShowCodeSettings(false);
            fetchCodeSettings();
        } catch (e) {
            showMsg('danger', e.message);
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
            await customersAPI.downloadTemplate();
        } catch (err) {
            alert(err.message || 'Gagal mengunduh template');
        } finally {
            setDownloadingTemplate(false);
        }
    }

    async function handleImportCustomers() {
        if (!importFile) {
            setImportError('Pilih file Excel terlebih dahulu');
            return;
        }

        setImporting(true);
        setImportError('');
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const result = await customersAPI.import(formData);
            setImportResult(result);
            if (result.imported > 0) {
                showMsg('success', `${result.imported} customer berhasil diimpor`);
                fetchCustomers();
                fetchCodeSettings();
            }
        } catch (err) {
            setImportError(err.message || 'Gagal mengimpor customer');
        } finally {
            setImporting(false);
        }
    }

    // Preview code format
    const previewCode = codeSettings.prefix + String(parseInt(codeSettings.next_number) || 1).padStart(parseInt(codeSettings.digits) || 4, '0');

    // Filter
    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customer_code && c.customer_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery)) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">🏪 Master Customer</h1>
                <p className="page-subtitle">Kelola data customer / pelanggan perusahaan</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type} mb-4`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* Actions Bar */}
            <div className="card mb-4">
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 200 }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Cari nama, kode, telepon, atau alamat..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ flex: 1 }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-outline" onClick={() => { fetchCodeSettings(); setShowCodeSettings(true); }}>
                            ⚙️ Pengaturan Kode
                        </button>
                        <button
                            className="btn"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            title="Unduh template Excel untuk import customer"
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
                            title="Upload customer dari Excel"
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
                        <button className="btn btn-primary" onClick={openAdd}>
                            + Tambah Customer
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--theme-primary)' }}>{customers.length}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Total Customer</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-500)' }}>{customers.filter(c => c.is_active).length}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Aktif</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--gray-400)' }}>{customers.filter(c => !c.is_active).length}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Nonaktif</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-500)', fontFamily: 'monospace' }}>{previewCode}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Kode Berikutnya</div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar Customer ({filtered.length})</h2>
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏪</div>
                        <p className="empty-state-text">{searchQuery ? 'Tidak ditemukan customer yang cocok' : 'Belum ada data customer'}</p>
                        {!searchQuery && <button className="btn btn-primary mt-3" onClick={openAdd}>+ Tambah Customer Pertama</button>}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Kode</th>
                                    <th>Nama</th>
                                    <th>Telepon</th>
                                    <th>Alamat</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(cust => (
                                    <tr key={cust.id} style={{ opacity: cust.is_active ? 1 : 0.5 }}>
                                        <td>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary-500)' }}>
                                                {cust.customer_code || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{cust.name}</div>
                                            {cust.notes && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{cust.notes}</div>}
                                        </td>
                                        <td>{cust.phone || '-'}</td>
                                        <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cust.address || '-'}
                                        </td>
                                        <td>
                                            <span className={`badge ${cust.is_active ? 'badge-success' : 'badge-danger'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => toggleActive(cust)}>
                                                {cust.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                                    onClick={() => openEdit(cust)}>✏️</button>
                                                <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger-500)' }}
                                                    onClick={() => deleteCustomer(cust.id, cust.name)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editId ? '✏️ Edit Customer' : '🏪 Tambah Customer Baru'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">Nama Customer *</label>
                                <input type="text" className="form-input" placeholder="Nama customer / toko / perusahaan..."
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Telepon</label>
                                    <input type="text" className="form-input" placeholder="08xx..."
                                        value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kode</label>
                                    <input type="text" className="form-input" value={editId ? (customers.find(c => c.id === editId)?.customer_code || '-') : previewCode}
                                        readOnly style={{ background: 'rgba(0,0,0,0.03)', fontFamily: 'monospace', fontWeight: 600 }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alamat</label>
                                <input type="text" className="form-input" placeholder="Alamat lengkap..."
                                    value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Catatan</label>
                                <textarea className="form-input" rows={2} placeholder="Catatan tambahan..."
                                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button className="btn btn-primary" onClick={saveCustomer} disabled={!form.name.trim()}>
                                    {editId ? 'Simpan Perubahan' : '+ Tambah Customer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Code Settings Modal */}
            {showCodeSettings && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">⚙️ Pengaturan Kode Customer</h2>
                            <button className="modal-close" onClick={() => setShowCodeSettings(false)}>×</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                Atur format kode customer otomatis. Kode akan di-generate saat customer baru ditambahkan.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Prefix (Awalan)</label>
                                <input type="text" className="form-input" placeholder="CUST"
                                    value={codeSettings.prefix}
                                    onChange={e => setCodeSettings(s => ({ ...s, prefix: e.target.value.toUpperCase() }))}
                                    style={{ fontFamily: 'monospace', fontWeight: 600 }} />
                                <small style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Contoh: CUST, PLG, CS, dll</small>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Digit Angka</label>
                                    <select className="form-input form-select" value={codeSettings.digits}
                                        onChange={e => setCodeSettings(s => ({ ...s, digits: e.target.value }))}>
                                        <option value="3">3 digit (001)</option>
                                        <option value="4">4 digit (0001)</option>
                                        <option value="5">5 digit (00001)</option>
                                        <option value="6">6 digit (000001)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nomor Urut Berikutnya</label>
                                    <input type="number" className="form-input" min="1"
                                        value={codeSettings.next_number}
                                        onChange={e => setCodeSettings(s => ({ ...s, next_number: e.target.value }))}
                                        style={{ fontFamily: 'monospace' }} />
                                </div>
                            </div>

                            {/* Preview */}
                            <div style={{
                                background: 'rgba(var(--theme-primary-rgb), 0.05)',
                                border: '1px solid rgba(var(--theme-primary-rgb), 0.15)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1rem', textAlign: 'center', marginTop: '0.5rem', marginBottom: '1rem'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Preview Kode Berikutnya</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--theme-primary)' }}>
                                    {codeSettings.prefix + String(parseInt(codeSettings.next_number) || 1).padStart(parseInt(codeSettings.digits) || 4, '0')}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" onClick={() => setShowCodeSettings(false)}>Batal</button>
                                <button className="btn btn-primary" onClick={saveCodeSettings}>💾 Simpan Pengaturan</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Excel Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Upload Customer dari Excel</h2>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {importError && (
                                <div className="alert alert-danger mb-3">
                                    ⚠️ {importError}
                                </div>
                            )}

                            <div className="alert alert-info mb-3">
                                ℹ️ Unduh template resmi, isi data customer, lalu unggah file .xlsx.
                                Kolom wajib: <strong>Nama</strong>. Kode dikosongkan akan dibuat otomatis.
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
                                    <div className={`alert mb-3 ${importResult.imported > 0 ? 'alert-success' : 'alert-warning'}`}>
                                        {importResult.imported > 0 ? '✅' : '⚠️'}{' '}
                                        Berhasil: <strong>{importResult.imported}</strong>
                                        {' · '}Gagal: <strong>{importResult.failed}</strong>
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
                                        onClick={handleImportCustomers}
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
        </div>
    );
}
