import { useState, useEffect } from 'react';
import { loansAPI, authAPI } from '../utils/api';

export default function AdminLoans() {
    const [loans, setLoans] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [formData, setFormData] = useState({
        user_id: '', loan_date: new Date().toISOString().split('T')[0],
        amount: '', installment_amount: '', total_installments: '', description: ''
    });
    const [paymentForm, setPaymentForm] = useState({
        amount: '', payment_date: new Date().toISOString().split('T')[0], notes: ''
    });

    useEffect(() => { fetchUsers(); fetchLoans(); }, []);
    useEffect(() => { fetchLoans(); }, [filterStatus]);

    async function fetchUsers() {
        try {
            const data = await authAPI.getUsers();
            setUsers(data.filter(u => u.role === 'employee'));
        } catch (e) { console.error(e); }
    }

    async function fetchLoans() {
        try {
            setLoading(true);
            const params = {};
            if (filterStatus) params.status = filterStatus;
            const data = await loansAPI.getAll(params);
            setLoans(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    function openAddModal() {
        setFormData({
            user_id: '', loan_date: new Date().toISOString().split('T')[0],
            amount: '', installment_amount: '', total_installments: '', description: ''
        });
        setShowModal(true);
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await loansAPI.create(formData);
            setSuccess('Pinjaman berhasil dibuat');
            setShowModal(false);
            fetchLoans();
        } catch (err) {
            setError(err.message || 'Gagal membuat pinjaman');
        } finally { setSaving(false); }
    }

    async function openDetail(loan) {
        try {
            const data = await loansAPI.getById(loan.id);
            setSelectedLoan(data);
            setShowDetailModal(true);
        } catch (err) { alert('Gagal memuat detail'); }
    }

    function openPayment(loan) {
        setSelectedLoan(loan);
        setPaymentForm({
            amount: loan.installment_amount,
            payment_date: new Date().toISOString().split('T')[0], notes: ''
        });
        setShowPaymentModal(true);
        setError('');
    }

    async function handlePayment(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await loansAPI.recordPayment(selectedLoan.id, paymentForm);
            setSuccess('Pembayaran berhasil dicatat');
            setShowPaymentModal(false);
            fetchLoans();
        } catch (err) {
            setError(err.message || 'Gagal mencatat pembayaran');
        } finally { setSaving(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus pinjaman ini secara permanen? Data cicilan juga akan ikut terhapus.')) return;
        try {
            await loansAPI.delete(id);
            setSuccess('Data pinjaman berhasil dihapus secara permanen');
            fetchLoans();
        } catch (err) {
            alert(err.message || 'Gagal menghapus pinjaman');
        }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    // Auto-calculate installment
    function onAmountChange(amount) {
        const a = parseFloat(amount) || 0;
        const inst = parseInt(formData.total_installments) || 1;
        setFormData(prev => ({ ...prev, amount, installment_amount: Math.ceil(a / inst) }));
    }
    function onInstallmentsChange(total) {
        const a = parseFloat(formData.amount) || 0;
        const inst = parseInt(total) || 1;
        setFormData(prev => ({ ...prev, total_installments: total, installment_amount: Math.ceil(a / inst) }));
    }

    const totalActive = loans.filter(l => l.status === 'active').reduce((s, l) => s + parseFloat(l.remaining_balance), 0);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">💰 Pinjaman Karyawan</h1>
                <p className="page-subtitle">Kelola pinjaman dan cicilan karyawan</p>
            </div>

            {success && <div className="alert alert-success mb-3"><span className="alert-icon">✓</span> {success}</div>}

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card status-card">
                    <div className="status-card-icon warning">💰</div>
                    <div className="status-card-content">
                        <h3>Pinjaman Aktif</h3>
                        <p>{loans.filter(l => l.status === 'active').length}</p>
                    </div>
                </div>
                <div className="card status-card">
                    <div className="status-card-icon danger">📊</div>
                    <div className="status-card-content">
                        <h3>Total Sisa Pinjaman</h3>
                        <p style={{ fontSize: '1.1rem' }}>{formatCurrency(totalActive)}</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 className="card-title">Daftar Pinjaman</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select className="form-input form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
                            <option value="">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="paid_off">Lunas</option>
                            <option value="cancelled">Batal</option>
                        </select>
                        <button className="btn btn-primary" onClick={openAddModal}>+ Buat Pinjaman</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : loans.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💰</div>
                        <p className="empty-state-text">Tidak ada pinjaman</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Karyawan</th>
                                    <th>Tgl Pinjaman</th>
                                    <th>Jumlah</th>
                                    <th>Cicilan/Bln</th>
                                    <th>Progress</th>
                                    <th>Sisa</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loans.map(loan => (
                                    <tr key={loan.id}>
                                        <td style={{ fontWeight: 500 }}>{loan.user_name}</td>
                                        <td>{new Date(loan.loan_date).toLocaleDateString('id-ID')}</td>
                                        <td>{formatCurrency(loan.amount)}</td>
                                        <td>{formatCurrency(loan.installment_amount)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${(loan.paid_installments / loan.total_installments) * 100}%`, background: 'var(--success-500)', borderRadius: 3, transition: 'width 0.3s' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{loan.paid_installments}/{loan.total_installments}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{formatCurrency(loan.remaining_balance)}</td>
                                        <td>
                                            <span className={`badge ${loan.status === 'active' ? 'badge-warning' : loan.status === 'paid_off' ? 'badge-success' : 'badge-danger'}`}>
                                                {loan.status === 'active' ? 'Aktif' : loan.status === 'paid_off' ? 'Lunas' : 'Batal'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openDetail(loan)}>📋</button>
                                                {loan.status === 'active' && (
                                                    <button className="btn btn-success" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openPayment(loan)}>💵 Bayar</button>
                                                )}
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}
                                                    onClick={() => handleDelete(loan.id)}
                                                    title="Hapus Pinjaman"
                                                >
                                                    🗑️
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

            {/* Create Loan Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Buat Pinjaman Baru</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}
                                <div className="form-group">
                                    <label className="form-label">Karyawan *</label>
                                    <select className="form-input form-select" value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value })} required>
                                        <option value="">Pilih karyawan...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Pinjaman</label>
                                    <input className="form-input" type="date" value={formData.loan_date} onChange={e => setFormData({ ...formData, loan_date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Pinjaman (Rp) *</label>
                                    <input className="form-input" type="number" value={formData.amount} onChange={e => onAmountChange(e.target.value)} required placeholder="1000000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Cicilan (bulan) *</label>
                                    <input className="form-input" type="number" min="1" value={formData.total_installments} onChange={e => onInstallmentsChange(e.target.value)} required placeholder="12" />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label className="form-label">Cicilan per Bulan (Rp)</label>
                                    <input className="form-input" type="number" value={formData.installment_amount} onChange={e => setFormData({ ...formData, installment_amount: e.target.value })} readOnly style={{ opacity: 0.7 }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Keterangan</label>
                                    <textarea className="form-input" rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Keperluan pinjaman" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Buat Pinjaman'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedLoan && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Catat Pembayaran - {selectedLoan.user_name}</h3>
                            <button className="modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        <form onSubmit={handlePayment}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}
                                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                                    <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Sisa pinjaman: <strong style={{ color: 'white' }}>{formatCurrency(selectedLoan.remaining_balance)}</strong></p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Bayar (Rp) *</label>
                                    <input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tanggal Bayar</label>
                                    <input className="form-input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Catatan</label>
                                    <input className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Memproses...' : '💵 Bayar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedLoan && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Detail Pinjaman - {selectedLoan.user_name}</h3>
                            <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div><span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>Jumlah Pinjaman</span><p style={{ fontWeight: 600 }}>{formatCurrency(selectedLoan.amount)}</p></div>
                                <div><span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>Sisa</span><p style={{ fontWeight: 600, color: 'var(--warning-500)' }}>{formatCurrency(selectedLoan.remaining_balance)}</p></div>
                                <div><span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>Cicilan/Bulan</span><p>{formatCurrency(selectedLoan.installment_amount)}</p></div>
                                <div><span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>Progress</span><p>{selectedLoan.paid_installments}/{selectedLoan.total_installments} cicilan</p></div>
                            </div>

                            <h4 style={{ marginBottom: '0.75rem', color: 'var(--gray-300)' }}>Riwayat Pembayaran</h4>
                            {selectedLoan.payments && selectedLoan.payments.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tanggal</th>
                                                <th>Jumlah</th>
                                                <th>Metode</th>
                                                <th>Catatan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedLoan.payments.map(p => (
                                                <tr key={p.id}>
                                                    <td>{new Date(p.payment_date).toLocaleDateString('id-ID')}</td>
                                                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                                                    <td>
                                                        <span className={`badge ${p.payment_method === 'payroll_deduction' ? 'badge-primary' : 'badge-success'}`}>
                                                            {p.payment_method === 'payroll_deduction' ? 'Potong Gaji' : 'Manual'}
                                                        </span>
                                                    </td>
                                                    <td>{p.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '1rem' }}>Belum ada pembayaran</p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
