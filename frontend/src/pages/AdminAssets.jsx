import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

export default function AdminAssets() {
    const { user } = useAuth();
    const token = localStorage.getItem('token');
    
    // UI State
    const [activeTab, setActiveTab] = useState('assets'); // 'assets', 'categories'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // Data State
    const [assets, setAssets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [assignments, setAssignments] = useState([]); // from specific asset
    
    // Modal State
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [showCatModal, setShowCatModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Form states
    const [assetForm, setAssetForm] = useState({
        id: null, asset_code: '', name: '', category_id: '', brand: '', price: '', purchase_date: '', description: '', status: 'available'
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    const [catForm, setCatForm] = useState({ id: null, name: '', description: '' });
    const [assignForm, setAssignForm] = useState({ asset_id: null, user_id: '', notes: '' });
    const [returnForm, setReturnForm] = useState({ asset_id: null, condition: 'available', notes: '' });
    
    const [selectedQR, setSelectedQR] = useState(null);
    const [selectedAssetInfo, setSelectedAssetInfo] = useState(null);

    // ================== DATA FETCHING ==================
    const fetchAssets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/assets`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setAssets(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch(`${API}/assets/categories`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setCategories(await res.json());
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await fetch(`${API}/employees`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setEmployees(await res.json());
        } catch (e) { console.error(e); }
    }, [token]);

    useEffect(() => {
        fetchAssets();
        fetchCategories();
        fetchEmployees();
    }, [fetchAssets, fetchCategories, fetchEmployees]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    // ================== ASSET CRUD ==================
    function openNewAsset() {
        setAssetForm({ id: null, asset_code: '', name: '', category_id: '', brand: '', price: '', purchase_date: '', description: '', status: 'available' });
        setPhotoFile(null);
        setPreviewPhoto(null);
        setShowAssetModal(true);
    }

    function openEditAsset(a) {
        setAssetForm({
            id: a.id,
            asset_code: a.asset_code,
            name: a.name,
            category_id: a.category_id || '',
            brand: a.brand || '',
            price: a.price || '',
            purchase_date: a.purchase_date ? new Date(a.purchase_date).toISOString().split('T')[0] : '',
            description: a.description || '',
            status: a.status
        });
        setPhotoFile(null);
        setPreviewPhoto(a.photo_path ? `${API_URL}${a.photo_path}` : null);
        setShowAssetModal(true);
    }

    function handlePhotoChange(e) {
        if (e.target.files && e.target.files[0]) {
            setPhotoFile(e.target.files[0]);
            setPreviewPhoto(URL.createObjectURL(e.target.files[0]));
        }
    }

    async function handleSaveAsset(e) {
        e.preventDefault();
        try {
            setLoading(true);
            const formData = new FormData();
            Object.keys(assetForm).forEach(k => {
                if(k !== 'id' && assetForm[k]) formData.append(k, assetForm[k]);
            });
            if (photoFile) formData.append('photo', photoFile);

            const method = assetForm.id ? 'PUT' : 'POST';
            const url = assetForm.id ? `${API}/assets/${assetForm.id}` : `${API}/assets`;
            
            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Gagal menyimpan');
            
            showMsg('success', 'Aset berhasil disimpan');
            setShowAssetModal(false);
            fetchAssets();
        } catch (err) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteAsset(id) {
        if(!window.confirm('Yakin ingin menghapus aset ini?')) return;
        try {
            setLoading(true);
            const res = await fetch(`${API}/assets/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if(!res.ok) throw new Error('Gagal menghapus');
            showMsg('success', 'Aset dihapus');
            fetchAssets();
        } catch (err) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    }

    // ================== CATEGORY CRUD ==================
    function openEditCategory(c) {
        setCatForm({ id: c.id, name: c.name, description: c.description || '' });
        setShowCatModal(true);
    }

    async function handleDeleteCategory(id) {
        if (!window.confirm('Yakin ingin menghapus kategori ini?')) return;
        try {
            setLoading(true);
            const res = await fetch(`${API}/assets/categories/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal menghapus kategori');
            showMsg('success', 'Kategori dihapus');
            fetchCategories();
        } catch (err) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveCategory(e) {
        e.preventDefault();
        try {
            const method = catForm.id ? 'PUT' : 'POST';
            const url = catForm.id ? `${API}/assets/categories/${catForm.id}` : `${API}/assets/categories`;
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(catForm)
            });
            
            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error('Server mengembalikan respons tidak valid: ' + text.substring(0, 50));
            }

            if(!res.ok) throw new Error(data.error || 'Gagal menyimpan kategori');
            
            showMsg('success', catForm.id ? 'Kategori diperbarui' : 'Kategori ditambahkan');
            setCatForm({ id: null, name: '', description: '' });
            setShowCatModal(false);
            fetchCategories();
        } catch (err) {
            console.error('Error saving category:', err);
            showMsg('error', err.message);
        }
    }

    // ================== ASSIGNMENT & RETURNS ==================
    function openAssign(a) {
        setAssignForm({ asset_id: a.id, user_id: '', notes: '' });
        setShowAssignModal(true);
    }
    
    function openReturn(a) {
        setReturnForm({ asset_id: a.id, condition: 'available', notes: '' });
        setShowReturnModal(true);
    }

    async function handleAssign(e) {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await fetch(`${API}/assets/${assignForm.asset_id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(assignForm)
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error);
            showMsg('success', 'Aset berhasil dipinjamkan');
            setShowAssignModal(false);
            fetchAssets();
        } catch (err) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleReturn(e) {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await fetch(`${API}/assets/${returnForm.asset_id}/return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(returnForm)
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error);
            showMsg('success', 'Pengembalian aset dicatat');
            setShowReturnModal(false);
            fetchAssets();
        } catch (err) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleHistory(id) {
        try {
            const res = await fetch(`${API}/assets/${id}/history`, { headers: { Authorization: `Bearer ${token}` } });
            if(res.ok) {
                setAssignments(await res.json());
                const asset = assets.find(a => a.id === id);
                setSelectedAssetInfo(asset);
                setShowHistoryModal(true);
            }
        } catch(e) { console.error(e); }
    }

    const printQR = () => {
        window.print();
    };

    return (
        <div className="admin-page">
            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(0,0,0,0.1)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                <button 
                    onClick={() => setActiveTab('assets')}
                    style={{ background: 'none', border: 'none', fontWeight: 600, fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'assets' ? '3px solid var(--primary-500)' : '3px solid transparent', color: activeTab === 'assets' ? 'var(--primary-600)' : 'var(--gray-500)' }}
                >
                    📦 Daftar Aset
                </button>
                <button 
                    onClick={() => setActiveTab('categories')}
                    style={{ background: 'none', border: 'none', fontWeight: 600, fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'categories' ? '3px solid var(--primary-500)' : '3px solid transparent', color: activeTab === 'categories' ? 'var(--primary-600)' : 'var(--gray-500)' }}
                >
                    🏷️ Kategori
                </button>
            </div>

            {/* TAB ASSETS */}
            {activeTab === 'assets' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-900)' }}>Manajemen Aset</h2>
                            <p style={{ color: 'var(--gray-600)' }}>Kelola data barang inventaris kantor</p>
                        </div>
                        <button className="btn btn-primary" onClick={openNewAsset}>+ Tambah Aset</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {assets.map(a => (
                            <div key={a.id} className="card" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', background: 'var(--gray-100)', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
                                        {a.photo_path ? (
                                            <img src={`${API_URL}${a.photo_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="aset" />
                                        ) : (
                                            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', opacity:0.5 }}>📦</div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</h3>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{a.asset_code}</div>
                                        <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            <span className="badge badge-secondary">{a.category_name || 'Uncategorized'}</span>
                                            {a.status === 'available' && <span className="badge badge-success">Tersedia</span>}
                                            {a.status === 'assigned' && <span className="badge badge-warning">Dipinjam</span>}
                                            {a.status === 'maintenance' && <span className="badge badge-danger">Perbaikan</span>}
                                            {a.status === 'retired' && <span className="badge badge-secondary" style={{ opacity: 0.7 }}>Pensiun</span>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: '1rem', background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '4px' }}>
                                    <div><strong>Merek:</strong> {a.brand || '-'}</div>
                                    {a.status === 'assigned' && (
                                        <div style={{ color: 'var(--warning-600)', fontWeight: 600, marginTop: '0.25rem' }}>
                                            Dipinjam oleh: {a.assignee_name}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    <button className="btn btn-outline" style={{ padding: '0.5rem 0' }} onClick={() => { setSelectedQR(a.asset_code); setSelectedAssetInfo(a); setShowQRModal(true); }} title="QR Code">
                                        <svg style={{ width: '16px', height: '16px', margin: 'auto' }} fill="currentColor" viewBox="0 0 16 16"><path d="M2 2h4v4H2V2Z"/><path d="M2 10h4v4H2v-4Z"/><path d="M10 2h4v4h-4V2Z"/><path d="M10 10h2v2h-2v-2Z"/><path d="M12 12h2v2h-2v-2Z"/><path d="M10 14h2v2h-2v-2Z"/></svg>
                                    </button>
                                    <button className="btn btn-outline" style={{ padding: '0.5rem 0' }} onClick={() => handleHistory(a.id)} title="Riwayat">
                                        🕒
                                    </button>
                                    <button className="btn btn-outline" style={{ padding: '0.5rem 0' }} onClick={() => openEditAsset(a)} title="Edit">
                                        ✏️
                                    </button>
                                    {a.status === 'available' ? (
                                        <button className="btn btn-warning" style={{ padding: '0.5rem 0' }} onClick={() => openAssign(a)} title="Pinjamkan">
                                            ↗️
                                        </button>
                                    ) : a.status === 'assigned' ? (
                                        <button className="btn btn-success" style={{ padding: '0.5rem 0' }} onClick={() => openReturn(a)} title="Kembalikan">
                                            ↙️
                                        </button>
                                    ) : (
                                         <button className="btn btn-outline" style={{ padding: '0.5rem 0' }} onClick={() => handleDeleteAsset(a.id)} title="Hapus">
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CATEGORIES */}
            {activeTab === 'categories' && (
                <div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-900)' }}>Kategori Aset</h2>
                        </div>
                        <button className="btn btn-primary" onClick={() => { setCatForm({ id: null, name: '', description: '' }); setShowCatModal(true); }}>+ Kategori</button>
                    </div>
                    <div className="card" style={{ padding: '1rem' }}>
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--gray-700)' }}>Nama</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--gray-700)' }}>Deskripsi</th>
                                    <th style={{ padding: '1rem', width: '120px', textAlign: 'center', color: 'var(--gray-700)' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                        <td style={{ fontWeight: 600, padding: '1rem' }}>{c.name}</td>
                                        <td style={{ padding: '1rem' }}>{c.description || '-'}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button className="btn btn-outline" style={{ padding: '0.35rem 0.6rem' }} onClick={() => openEditCategory(c)} title="Edit">✏️</button>
                                                <button className="btn btn-outline" style={{ padding: '0.35rem 0.6rem' }} onClick={() => handleDeleteCategory(c.id)} title="Hapus">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {categories.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', padding: '1.5rem'}}>Belum ada kategori</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: ADD/EDIT ASSET */}
            {showAssetModal && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '600px', background: 'var(--bg-card)' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '1rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', color: '#ffffff', fontWeight: 700 }}>{assetForm.id ? 'Edit' : 'Tambah'} Aset</h2>
                            <button className="modal-close" onClick={() => setShowAssetModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveAsset} style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {/* Left side - Photo */}
                                <div style={{ width: '150px' }}>
                                    <div style={{ width: '150px', height: '150px', background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                        {previewPhoto ? (
                                            <img src={previewPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="P" />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>Foto</div>
                                        )}
                                    </div>
                                    <input type="file" accept="image/*" id="photoFile" style={{ display: 'none' }} onChange={handlePhotoChange} />
                                    <label htmlFor="photoFile" className="btn btn-outline" style={{ display: 'block', textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', width: '100%' }}>Browse Foto</label>
                                </div>
                                
                                {/* Right side - Fields */}
                                <div style={{ flex: 1, display: 'grid', gap: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ color: 'var(--gray-800)' }}>Nama Aset *</label>
                                        <input className="form-input" required value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ color: 'var(--gray-800)' }}>Kode Aset / SKU</label>
                                            <input className="form-input" placeholder="Otomatis jika kosong" value={assetForm.asset_code} onChange={e => setAssetForm(f => ({ ...f, asset_code: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ color: 'var(--gray-800)' }}>Kategori</label>
                                            <select className="form-input" value={assetForm.category_id} onChange={e => setAssetForm(f => ({ ...f, category_id: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }}>
                                                <option value="">Pilih Kategori...</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ color: 'var(--gray-800)' }}>Merek / Brand</label>
                                    <input className="form-input" value={assetForm.brand} onChange={e => setAssetForm(f => ({ ...f, brand: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ color: 'var(--gray-800)' }}>Tanggal Beli</label>
                                    <input type="date" className="form-input" value={assetForm.purchase_date} onChange={e => setAssetForm(f => ({ ...f, purchase_date: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ color: 'var(--gray-800)' }}>Harga (Rp)</label>
                                    <input type="number" className="form-input" value={assetForm.price} onChange={e => setAssetForm(f => ({ ...f, price: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Deskripsi Spesifikasi</label>
                                <textarea className="form-input" rows="3" value={assetForm.description} onChange={e => setAssetForm(f => ({ ...f, description: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)', resize: 'vertical' }} />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Status</label>
                                <select className="form-input" value={assetForm.status} onChange={e => setAssetForm(f => ({ ...f, status: e.target.value }))} disabled={assetForm.status === 'assigned'} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }}>
                                    <option value="available">Tersedia</option>
                                    <option value="assigned" disabled>Dipinjam</option>
                                    <option value="maintenance">Perbaikan (Maintenance)</option>
                                    <option value="retired">Pensiun (Rusak/Dijual)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowAssetModal(false)} style={{ color: 'var(--gray-700)', border: '1px solid var(--gray-300)' }}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Aset'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CATEGORY */}
            {showCatModal && (
                <div className="modal">
                     <div className="modal-content" style={{ maxWidth: '400px', background: 'var(--bg-card)' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '1rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 700 }}>{catForm.id ? 'Edit' : 'Tambah'} Kategori</h2>
                            <button className="modal-close" onClick={() => setShowCatModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveCategory} style={{ padding: '1.5rem' }}>
                             <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Nama Kategori *</label>
                                <input className="form-input" required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Deskripsi</label>
                                <textarea className="form-input" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowCatModal(false)} style={{ color: 'var(--gray-700)', border: '1px solid var(--gray-300)' }}>Batal</button>
                                <button type="submit" className="btn btn-primary">Simpan</button>
                            </div>
                        </form>
                     </div>
                </div>
            )}

            {/* MODAL: ASSIGN */}
            {showAssignModal && (
                <div className="modal">
                     <div className="modal-content" style={{ maxWidth: '450px', background: 'var(--bg-card)' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '1rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 700 }}>Berikan Pinjaman Aset</h2>
                            <button className="modal-close" onClick={() => setShowAssignModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <form onSubmit={handleAssign} style={{ padding: '1.5rem' }}>
                             <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Pilih Karyawan *</label>
                                <select className="form-input form-select" required value={assignForm.user_id} onChange={e => setAssignForm(f => ({ ...f, user_id: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }}>
                                    <option value="">-- Pilih --</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Catatan Keperluan</label>
                                <textarea className="form-input" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowAssignModal(false)} style={{ color: 'var(--gray-700)', border: '1px solid var(--gray-300)' }}>Batal</button>
                                <button type="submit" className="btn btn-warning" disabled={loading}>{loading ? 'Menyimpan...' : 'Pinjamkan'}</button>
                            </div>
                        </form>
                     </div>
                </div>
            )}

            {/* MODAL: RETURN */}
            {showReturnModal && (
                <div className="modal">
                     <div className="modal-content" style={{ maxWidth: '450px', background: 'var(--bg-card)' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '1rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 700 }}>Pengembalian Aset</h2>
                            <button className="modal-close" onClick={() => setShowReturnModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <form onSubmit={handleReturn} style={{ padding: '1.5rem' }}>
                             <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Kondisi Setelah Dikembalikan *</label>
                                <select className="form-input form-select" value={returnForm.condition} onChange={e => setReturnForm(f => ({ ...f, condition: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }}>
                                    <option value="available">Bagus / Tersedia</option>
                                    <option value="maintenance">Perlu Perbaikan / Maintenance</option>
                                    <option value="retired">Rusak Parah / Pensiun</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--gray-800)' }}>Catatan Pengembalian</label>
                                <textarea className="form-input" value={returnForm.notes} onChange={e => setReturnForm(f => ({ ...f, notes: e.target.value }))} style={{ background: 'white', color: 'var(--gray-900)', border: '1px solid var(--gray-300)' }} placeholder="Cacat goresan, kabel hilang, dll" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowReturnModal(false)} style={{ color: 'var(--gray-700)', border: '1px solid var(--gray-300)' }}>Batal</button>
                                <button type="submit" className="btn btn-success" disabled={loading}>{loading ? 'Menyimpan...' : 'Kembalikan Aset'}</button>
                            </div>
                        </form>
                     </div>
                </div>
            )}

            {/* MODAL: QR CODE */}
            {showQRModal && (
                <div className="modal">
                     <div className="modal-content" style={{ maxWidth: '350px', background: 'white' }}>
                        <div className="modal-header" style={{ padding: '1rem', borderBottom: 'none' }}>
                            <button className="modal-close" onClick={() => setShowQRModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <div style={{ padding: '0 2rem 2rem 2rem', textAlign: 'center' }}>
                            <div id="print-qr-area">
                                <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1.2rem', fontWeight: 800 }}>{selectedAssetInfo?.name}</h3>
                                <div style={{ background: '#fff', padding: '1rem', display: 'inline-block', borderRadius: '8px', border: '2px solid #000' }}>
                                    <QRCodeSVG value={selectedQR} size={200} />
                                </div>
                                <p style={{ marginTop: '1rem', fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700, color: '#000', letterSpacing: '1px' }}>{selectedQR}</p>
                            </div>
                            <button className="btn btn-primary" onClick={printQR} style={{ marginTop: '1.5rem', width: '100%' }}>🖨️ Cetak Label</button>
                            <style>{`
                                @media print {
                                    body * { visibility: hidden; }
                                    #print-qr-area, #print-qr-area * { visibility: visible; }
                                    #print-qr-area { position: absolute; left: 0; top: 0; padding: 2cm; text-align: center; width: 100%; }
                                }
                            `}</style>
                        </div>
                     </div>
                </div>
            )}

            {/* MODAL: HISTORY */}
            {showHistoryModal && (
                <div className="modal">
                     <div className="modal-content" style={{ maxWidth: '600px', background: 'var(--bg-card)' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '1rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 700 }}>Riwayat {selectedAssetInfo?.name}</h2>
                            <button className="modal-close" onClick={() => setShowHistoryModal(false)} style={{ color: '#ffffff' }}>&times;</button>
                        </div>
                        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            {assignments.length === 0 ? (
                                <p style={{ color: 'var(--gray-500)', textAlign: 'center' }}>Belum ada riwayat peminjaman.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {assignments.map(h => (
                                        <div key={h.id} style={{ padding: '1rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', background: 'white' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <strong style={{ color: 'var(--gray-900)' }}>{h.user_name}</strong>
                                                <span className={`badge badge-${h.returned_date ? 'secondary' : 'warning'}`}>
                                                    {h.returned_date ? 'Selesai' : 'Aktif dipinjam'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)', display: 'grid', gap: '0.25rem' }}>
                                                <div><strong>Tgl Pinjam:</strong> {new Date(h.assigned_date).toLocaleDateString('id-ID')}</div>
                                                {h.returned_date && <div><strong>Tgl Kembali:</strong> {new Date(h.returned_date).toLocaleDateString('id-ID')}</div>}
                                                {h.notes && <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--gray-50)', borderRadius: '4px' }}>📝 {h.notes}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
}
