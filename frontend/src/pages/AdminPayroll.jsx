import { useState, useEffect } from 'react';
import { payrollAPI } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function downloadFile(path, filename) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Gagal download: Anda harus login terlebih dahulu.');
        return;
    }
    const separator = path.includes('?') ? '&' : '?';
    const url = `${API_BASE}${path}${separator}token=${token}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export default function AdminPayroll() {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showSlipModal, setShowSlipModal] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [selectedRun, setSelectedRun] = useState(null);
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [genForm, setGenForm] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        notes: ''
    });

    useEffect(() => { fetchRuns(); }, []);

    async function fetchRuns() {
        try {
            setLoading(true);
            const data = await payrollAPI.getAll();
            setRuns(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function handleGenerate(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await payrollAPI.generate(genForm);
            setSuccess('Payroll berhasil di-generate!');
            setShowGenerateModal(false);
            fetchRuns();
        } catch (err) {
            setError(err.message || 'Gagal generate payroll');
        } finally { setSaving(false); }
    }

    async function openDetail(run) {
        try {
            const data = await payrollAPI.getById(run.id);
            setSelectedRun(data);
            setIsMaximized(false);
            setShowDetailModal(true);
        } catch (err) { 
            console.error('Error in openDetail:', err);
            alert('Gagal memuat detail: ' + (err.message || JSON.stringify(err))); 
        }
    }

    async function handleFinalize(id) {
        if (!confirm('Yakin ingin memfinalisasi payroll ini? Potongan pinjaman akan diproses.')) return;
        try {
            await payrollAPI.finalize(id);
            setSuccess('Payroll berhasil difinalisasi');
            setShowDetailModal(false);
            fetchRuns();
        } catch (err) { alert(err.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus payroll draft ini?')) return;
        try {
            await payrollAPI.delete(id);
            setSuccess('Payroll berhasil dihapus');
            fetchRuns();
        } catch (err) { alert(err.message); }
    }

    async function viewSlip(runId, userId) {
        try {
            const data = await payrollAPI.getSlip(runId, userId);
            setSelectedSlip(data);
            setShowSlipModal(true);
        } catch (err) { alert('Gagal memuat slip gaji'); }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">💵 Payroll</h1>
                <p className="page-subtitle">Kelola penggajian karyawan dengan kalkulasi BPJS & PPh 21</p>
            </div>

            {success && <div className="alert alert-success mb-3"><span className="alert-icon">✓</span> {success}</div>}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar Payroll</h2>
                    <button className="btn btn-primary" onClick={() => { setShowGenerateModal(true); setError(''); }}>
                        🔄 Generate Payroll
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : runs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💵</div>
                        <p className="empty-state-text">Belum ada data payroll</p>
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Klik "Generate Payroll" untuk memulai</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Periode</th>
                                    <th>Jumlah Karyawan</th>
                                    <th>Total Gaji Bersih</th>
                                    <th>Status</th>
                                    <th>Tanggal</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map(run => (
                                    <tr key={run.id}>
                                        <td style={{ fontWeight: 600 }}>{monthNames[run.period_month - 1]} {run.period_year}</td>
                                        <td>{run.employee_count} orang</td>
                                        <td style={{ fontWeight: 600 }}>{formatCurrency(run.total_net_salary)}</td>
                                        <td>
                                            <span className={`badge ${run.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>
                                                {run.status === 'finalized' ? '✅ Final' : '📝 Draft'}
                                            </span>
                                        </td>
                                        <td>{new Date(run.run_date).toLocaleDateString('id-ID')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => openDetail(run)}>📋 Detail</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => downloadFile(`/payroll/${run.id}/export/pdf`, `payroll-${run.period_year}-${run.period_month}.pdf`)}>📄 PDF</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => downloadFile(`/payroll/${run.id}/export/excel`, `payroll-${run.period_year}-${run.period_month}.xlsx`)}>📊 Excel</button>
                                                {run.status === 'draft' && (
                                                    <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger-500)' }} onClick={() => handleDelete(run.id)}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">🔄 Generate Payroll</h3>
                            <button className="modal-close" onClick={() => setShowGenerateModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleGenerate}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span> {error}</div>}
                                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                    ℹ️ Payroll akan dihitung otomatis berdasarkan: gaji pokok, tunjangan, lembur (approved), BPJS, PPh 21, dan potongan pinjaman aktif.
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Bulan *</label>
                                        <select className="form-input form-select" value={genForm.month} onChange={e => setGenForm({ ...genForm, month: parseInt(e.target.value) })}>
                                            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tahun *</label>
                                        <input className="form-input" type="number" value={genForm.year} onChange={e => setGenForm({ ...genForm, year: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Catatan</label>
                                    <input className="form-input" value={genForm.notes} onChange={e => setGenForm({ ...genForm, notes: e.target.value })} placeholder="Catatan opsional" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowGenerateModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Memproses...' : '🔄 Generate'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedRun && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={isMaximized ? { width: '100vw', height: '100vh', maxWidth: '100%', maxHeight: '100%', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' } : { maxWidth: 1200, width: '95%', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Payroll {monthNames[selectedRun.period_month - 1]} {selectedRun.period_year}
                                <span className={`badge ${selectedRun.status === 'finalized' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: '0.75rem' }}>
                                    {selectedRun.status === 'finalized' ? 'Final' : 'Draft'}
                                </span>
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="modal-close" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "Perkecil" : "Perbesar"}>
                                    {isMaximized ? '🗗' : '🗖'}
                                </button>
                                <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                            {selectedRun.items && selectedRun.items.length > 0 ? (
                                <table className="table" style={{ fontSize: '0.8rem', minWidth: 1100 }}>
                                    <thead>
                                        <tr>
                                            <th>Karyawan</th>
                                            <th style={{ textAlign: 'right' }}>Gaji Pokok</th>
                                            <th style={{ textAlign: 'right' }}>Tunjangan</th>
                                            <th style={{ textAlign: 'center' }}>Jam Lembur</th>
                                            <th style={{ textAlign: 'right' }}>Nilai Lembur</th>
                                            <th style={{ textAlign: 'right' }}>Gross</th>
                                            <th style={{ textAlign: 'right' }}>BPJS</th>
                                            <th style={{ textAlign: 'right' }}>PPh 21</th>
                                            <th style={{ textAlign: 'right' }}>Pot. Pinjaman</th>
                                            <th style={{ textAlign: 'right', fontWeight: 700 }}>Gaji Bersih</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRun.items.map(item => {
                                            const bpjsTotal = parseFloat(item.bpjs_kes_employee) + parseFloat(item.bpjs_jht_employee) + parseFloat(item.bpjs_jp_employee);
                                            const tunjangan = parseFloat(item.transport_allowance) + parseFloat(item.meal_allowance);
                                            return (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 500 }}>
                                                        {item.user_name}
                                                        <span className={`badge ${item.salary_type === 'daily' ? 'badge-info' : item.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>
                                                            {item.salary_type === 'daily' ? `Harian (${item.working_days}hr)` : item.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.basic_salary)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(tunjangan)}</td>
                                                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{parseFloat(item.overtime_hours)} jam</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.overtime_amount)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.gross_income)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(bpjsTotal)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(item.pph21_amount)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(item.loan_deduction)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-500)', whiteSpace: 'nowrap' }}>{formatCurrency(item.net_salary)}</td>
                                                    <td>
                                                        <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} onClick={() => viewSlip(selectedRun.id, item.user_id)}>📄 Slip</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                                            <td style={{ fontWeight: 700 }}>TOTAL</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.basic_salary), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.transport_allowance) + parseFloat(i.meal_allowance), 0))}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{selectedRun.items.reduce((s, i) => s + parseFloat(i.overtime_hours), 0)} jam</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.overtime_amount), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.gross_income), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.bpjs_kes_employee) + parseFloat(i.bpjs_jht_employee) + parseFloat(i.bpjs_jp_employee), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.pph21_amount), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.loan_deduction), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-500)', whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.net_salary), 0))}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            ) : (
                                <p style={{ color: 'var(--gray-500)', textAlign: 'center' }}>Tidak ada data</p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => downloadFile(`/payroll/${selectedRun.id}/export/pdf`, `payroll-${selectedRun.period_year}-${selectedRun.period_month}.pdf`)}>📄 Export PDF</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => downloadFile(`/payroll/${selectedRun.id}/export/excel`, `payroll-${selectedRun.period_year}-${selectedRun.period_month}.xlsx`)}>📊 Export Excel</button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                                <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Tutup</button>
                                {selectedRun.status === 'draft' && (
                                    <button className="btn btn-success" onClick={() => handleFinalize(selectedRun.id)}>✅ Finalisasi Payroll</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Slip Gaji Modal */}
            {showSlipModal && selectedSlip && (
                <div className="modal-overlay">
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📄 Slip Gaji</h3>
                            <button className="modal-close" onClick={() => setShowSlipModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Header */}
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <h3 style={{ marginBottom: '0.25rem' }}>SLIP GAJI</h3>
                                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Periode: {monthNames[selectedSlip.period_month - 1]} {selectedSlip.period_year}</p>
                            </div>

                            {/* Employee Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                <div><span style={{ color: 'var(--gray-400)' }}>Nama:</span> <strong>{selectedSlip.user_name}</strong></div>
                                <div><span style={{ color: 'var(--gray-400)' }}>ID:</span> {selectedSlip.employee_id}</div>
                                <div><span style={{ color: 'var(--gray-400)' }}>Departemen:</span> {selectedSlip.department || '-'}</div>
                                <div><span style={{ color: 'var(--gray-400)' }}>Jabatan:</span> {selectedSlip.position || '-'}</div>
                            </div>

                            {/* Pendapatan */}
                            <h4 style={{ color: 'var(--success-500)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>📈 Pendapatan</h4>
                            <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                {[
                                    ['Gaji Pokok', selectedSlip.basic_salary],
                                    ['Tunjangan Transport', selectedSlip.transport_allowance],
                                    ['Tunjangan Makan', selectedSlip.meal_allowance],
                                    ['Lembur (' + selectedSlip.overtime_hours + ' jam)', selectedSlip.overtime_amount],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span>{label}</span>
                                        <span style={{ fontWeight: 500 }}>{formatCurrency(val)}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.25rem' }}>
                                    <span>Total Pendapatan</span>
                                    <span style={{ color: 'var(--success-500)' }}>{formatCurrency(selectedSlip.gross_income)}</span>
                                </div>
                            </div>

                            {/* Potongan */}
                            <h4 style={{ color: 'var(--danger-500)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>📉 Potongan</h4>
                            <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                {[
                                    ['BPJS Kesehatan (1%)', selectedSlip.bpjs_kes_employee],
                                    ['BPJS JHT (2%)', selectedSlip.bpjs_jht_employee],
                                    ['BPJS JP (1%)', selectedSlip.bpjs_jp_employee],
                                    ['PPh 21', selectedSlip.pph21_amount],
                                    ['Potongan Pinjaman', selectedSlip.loan_deduction],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span>{label}</span>
                                        <span style={{ fontWeight: 500, color: 'var(--danger-500)' }}>-{formatCurrency(val)}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.25rem' }}>
                                    <span>Total Potongan</span>
                                    <span style={{ color: 'var(--danger-500)' }}>-{formatCurrency(selectedSlip.total_deductions)}</span>
                                </div>
                            </div>

                            {/* BPJS Company (info) */}
                            <h4 style={{ color: 'var(--primary-400)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>🏢 Kontribusi Perusahaan (Info)</h4>
                            <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                {[
                                    ['BPJS Kesehatan (4%)', selectedSlip.bpjs_kes_company],
                                    ['BPJS JHT (3.7%)', selectedSlip.bpjs_jht_company],
                                    ['BPJS JP (2%)', selectedSlip.bpjs_jp_company],
                                    ['BPJS JKK (0.24%)', selectedSlip.bpjs_jkk],
                                    ['BPJS JKM (0.3%)', selectedSlip.bpjs_jkm],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                                        <span>{label}</span>
                                        <span>{formatCurrency(val)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Net Salary */}
                            <div style={{ background: 'rgba(16,185,129,0.15)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>GAJI BERSIH (Take Home Pay)</p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-500)' }}>{formatCurrency(selectedSlip.net_salary)}</p>
                                {selectedSlip.bank_name && (
                                    <p style={{ color: 'var(--gray-400)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                        Transfer ke: {selectedSlip.bank_name} - {selectedSlip.bank_account}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => downloadFile(`/payroll/${selectedSlip.payroll_run_id}/slip/${selectedSlip.user_id}/pdf`, `slip-gaji-${selectedSlip.employee_id}.pdf`)}>📄 PDF</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => downloadFile(`/payroll/${selectedSlip.payroll_run_id}/slip/${selectedSlip.user_id}/excel`, `slip-gaji-${selectedSlip.employee_id}.xlsx`)}>📊 Excel</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => window.print()}>🖨️ Print</button>
                            </div>
                            <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setShowSlipModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
