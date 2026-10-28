import Icon from '../components/Icon';
import PayslipFieldSettings from '../components/PayslipFieldSettings';
import { useState, useEffect } from 'react';
import { payrollAPI, settingsAPI } from '../utils/api';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { parsePayslipFields, payslipShows } from '../utils/payslipFields';

function calendarDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(value);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function localIsoDate(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export default function AdminPayroll() {
    const { settings, updatePayslipFields } = useSettings();
    const { hasPermission } = useAuth();
    const canEditPayslipLayout = hasPermission('admin.payslip_layout');
    const showPayslipLogo = settings.payslip_show_logo !== 'false' && !!settings.app_logo;
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
        period_type: 'monthly',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        week_date: localIsoDate(),
        notes: ''
    });
    const [detailSort, setDetailSort] = useState({ key: null, direction: 'ascending' });
    const [slipEditor, setSlipEditor] = useState(false);
    const [slipDraft, setSlipDraft] = useState(null);
    const [slipScope, setSlipScope] = useState('global');
    const [slipChoices, setSlipChoices] = useState(null);
    const [slipSaving, setSlipSaving] = useState(false);
    const [slipSaveError, setSlipSaveError] = useState('');

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
            setDetailSort({ key: null, direction: 'ascending' });
            setIsMaximized(true);
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

    async function handleDelete(run) {
        const period = periodLabel(run);
        const isFinal = run.status === 'finalized';
        const message = isFinal
            ? `Payroll ${period} sudah Final. Menghapusnya juga membatalkan potongan pinjaman dari payroll ini. Lanjutkan?`
            : `Yakin ingin menghapus payroll ${period}?`;
        if (!confirm(message)) return;
        try {
            await payrollAPI.delete(run.id);
            setSuccess(`Payroll ${period} berhasil dihapus`);
            if (selectedRun?.id === run.id) {
                setShowDetailModal(false);
                setSelectedRun(null);
            }
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

    async function exportPayroll(run, type) {
        try {
            if (type === 'pdf') {
                await payrollAPI.exportPdf(run.id, run.period_year, run.period_month);
            } else {
                await payrollAPI.exportExcel(run.id, run.period_year, run.period_month);
            }
        } catch (err) {
            alert(err.message || 'Gagal mengunduh file payroll');
        }
    }

    async function exportSlip(type) {
        if (!selectedSlip) return;
        try {
            if (type === 'pdf') {
                await payrollAPI.exportSlipPdf(selectedSlip.payroll_run_id, selectedSlip.user_id, selectedSlip.employee_id);
            } else {
                await payrollAPI.exportSlipExcel(selectedSlip.payroll_run_id, selectedSlip.user_id, selectedSlip.employee_id);
            }
        } catch (err) {
            alert(err.message || 'Gagal mengunduh slip gaji');
        }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    }

    function requestDetailSort(key) {
        setDetailSort((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    }

    function detailSortValue(item, key) {
        if (key === 'user_name') return (item.user_name || '').toLocaleLowerCase('id');
        if (key === 'bank_name') return (item.bank_name || '').toLocaleLowerCase('id');
        if (key === 'bank_account') return (item.bank_account || '').toLocaleLowerCase('id');
        if (key === 'tunjangan') {
            return parseFloat(item.transport_allowance || 0) + parseFloat(item.meal_allowance || 0) + parseFloat(item.appreciation_allowance || 0);
        }
        if (key === 'bpjs') {
            return parseFloat(item.bpjs_kes_employee || 0) + parseFloat(item.bpjs_jht_employee || 0) + parseFloat(item.bpjs_jp_employee || 0);
        }
        return parseFloat(item[key] || 0);
    }

    const detailItems = [...(selectedRun?.items || [])].sort((a, b) => {
        if (!detailSort.key) return 0;
        const av = detailSortValue(a, detailSort.key);
        const bv = detailSortValue(b, detailSort.key);
        const cmp = typeof av === 'string' ? av.localeCompare(bv, 'id') : av - bv;
        return detailSort.direction === 'ascending' ? cmp : -cmp;
    });

    function sortMark(key) {
        if (detailSort.key !== key) return <Icon name="ArrowUpDown" size={12} />;
        return detailSort.direction === 'ascending'
            ? <Icon name="ChevronUp" size={12} />
            : <Icon name="ChevronDown" size={12} />;
    }

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    function periodLabel(run) {
        if (run?.period_type === 'weekly' && run.week_start) {
            const start = calendarDate(run.week_start);
            const end = calendarDate(run.week_end);
            const fmt = (date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${fmt(start)} – ${fmt(end)}`;
        }
        return `${monthNames[(run?.period_month || 1) - 1]} ${run?.period_year || ''}`;
    }

    function weekRangeLabel(isoDate) {
        if (!isoDate) return '';
        const date = new Date(`${isoDate}T00:00:00`);
        const diffToMonday = date.getDay() === 0 ? -6 : 1 - date.getDay();
        const start = new Date(date);
        start.setDate(date.getDate() + diffToMonday);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fmt = (value) => value.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        return `${fmt(start)} – ${fmt(end)}`;
    }
    const savedSlipConfig = parsePayslipFields(selectedSlip?.payslip_layout || settings.payslip_fields);
    const slipConfig = slipDraft || savedSlipConfig;

    function configForScope(choices, scope) {
        if (!choices) return savedSlipConfig;
        if (scope === 'employee') return parsePayslipFields(choices.employee_rule || choices.department_rule || choices.global);
        if (scope === 'department') return parsePayslipFields(choices.department_rule || choices.global);
        return parsePayslipFields(choices.global);
    }

    async function openSlipEditor() {
        setSlipSaveError('');
        try {
            const choices = await settingsAPI.getPayslipLayoutOptions(selectedSlip.user_id);
            const scope = choices.source || 'global';
            setSlipChoices(choices);
            setSlipScope(scope);
            setSlipDraft(configForScope(choices, scope));
            setSlipEditor(true);
        } catch (err) {
            setSlipSaveError(err.message || 'Gagal memuat pengaturan tampilan');
            setSlipEditor(true);
        }
    }

    function changeSlipScope(scope) {
        setSlipScope(scope);
        setSlipDraft(configForScope(slipChoices, scope));
    }

    function closeSlipEditor() {
        setSlipDraft(null);
        setSlipChoices(null);
        setSlipSaveError('');
        setSlipEditor(false);
    }

    async function saveSlipFields() {
        setSlipSaving(true);
        setSlipSaveError('');
        try {
            const data = await updatePayslipFields({
                ...(slipDraft || savedSlipConfig),
                scope: slipScope,
                userId: selectedSlip.user_id,
            });
            if (data.layout) {
                setSelectedSlip((prev) => prev ? { ...prev, payslip_layout: data.layout } : prev);
            }
            setSlipDraft(null);
            setSlipChoices(null);
            setSlipEditor(false);
        } catch (err) {
            setSlipSaveError(err.message || 'Gagal menyimpan tampilan slip');
        } finally {
            setSlipSaving(false);
        }
    }

    async function removeSlipRule() {
        if (!selectedSlip || slipScope === 'global') return;
        setSlipSaving(true);
        setSlipSaveError('');
        try {
            const data = await settingsAPI.deletePayslipLayout(slipScope, selectedSlip.user_id);
            if (data.layout) {
                setSelectedSlip((prev) => prev ? { ...prev, payslip_layout: data.layout } : prev);
            }
            setSlipDraft(null);
            setSlipChoices(null);
            setSlipEditor(false);
        } catch (err) {
            setSlipSaveError(err.message || 'Gagal menghapus aturan tampilan');
        } finally {
            setSlipSaving(false);
        }
    }

    function slipLines(slip) {
        if (!slip) return { identity: [], income: [], deductions: [], company: [] };
        const income = [
            ['basic_salary', 'Gaji Pokok', slip.basic_salary],
            ['transport_allowance', 'Tunjangan Transport', slip.transport_allowance],
            ['meal_allowance', 'Tunjangan Makan', slip.meal_allowance],
            ['appreciation_allowance', 'Tunjangan Apresiasi', slip.appreciation_allowance],
            ['overtime', `Lembur (${slip.overtime_hours} jam)`, slip.overtime_amount],
            ['driver_subuh', `Uang Jalan Subuh (${slip.driver_subuh_days || 0} hari)`, slip.driver_subuh_amount],
            ['driver_rit', `Uang Mel/RIT (${slip.driver_rit_total || 0} trip)`, slip.driver_rit_amount],
            ['driver_overnight', `Uang Menginap (${slip.driver_overnight_days || 0} hari)`, slip.driver_overnight_amount],
            ['driver_ritase_dekat', `Uang Ritase Dekat (${slip.driver_extra_rit_dekat || 0} trip)`, slip.driver_ritase_dekat_amount],
            ['driver_ritase_jauh', `Uang Ritase Jauh (${slip.driver_extra_rit_jauh || 0} trip)`, slip.driver_ritase_jauh_amount],
            ['tuang', `Insentif Tuang (${slip.tuang_days || 0} hari)`, slip.tuang_amount],
        ].filter(([key, , amount]) => payslipShows(slipConfig, key, amount));
        const base = parseFloat(slip.basic_salary) || 1;
        const fmtPct = (val) => {
            const pct = (parseFloat(val) || 0) / base * 100;
            return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2);
        };
        const deductions = [
            ['bpjs_kes_employee', `BPJS Kesehatan (${fmtPct(slip.bpjs_kes_employee)}%)`, slip.bpjs_kes_employee],
            ['bpjs_jht_employee', `BPJS JHT (${fmtPct(slip.bpjs_jht_employee)}%)`, slip.bpjs_jht_employee],
            ['bpjs_jp_employee', `BPJS JP (${fmtPct(slip.bpjs_jp_employee)}%)`, slip.bpjs_jp_employee],
            ['pph21', 'PPh 21', slip.pph21_amount],
            ['late_deduction', `Potongan Terlambat (${slip.late_minutes || 0} mnt)`, slip.late_deduction],
            ['loan', 'Potongan Pinjaman', slip.loan_deduction],
        ].filter(([key, , amount]) => payslipShows(slipConfig, key, amount));
        const company = [
            ['bpjs_kes_company', `BPJS Kesehatan (${fmtPct(slip.bpjs_kes_company)}%)`, slip.bpjs_kes_company],
            ['bpjs_jht_company', `BPJS JHT (${fmtPct(slip.bpjs_jht_company)}%)`, slip.bpjs_jht_company],
            ['bpjs_jp_company', `BPJS JP (${fmtPct(slip.bpjs_jp_company)}%)`, slip.bpjs_jp_company],
            ['bpjs_jkk', `BPJS JKK (${fmtPct(slip.bpjs_jkk)}%)`, slip.bpjs_jkk],
            ['bpjs_jkm', `BPJS JKM (${fmtPct(slip.bpjs_jkm)}%)`, slip.bpjs_jkm],
        ].filter(([key, , amount]) => payslipShows(slipConfig, key, amount));
        const identity = [
            payslipShows(slipConfig, 'name') ? ['Nama', slip.user_name] : null,
            payslipShows(slipConfig, 'employee_id') ? ['ID', slip.employee_id] : null,
            payslipShows(slipConfig, 'department') ? ['Departemen', slip.department || '-'] : null,
            payslipShows(slipConfig, 'position') ? ['Jabatan', slip.position || '-'] : null,
            payslipShows(slipConfig, 'npwp') && slip.npwp ? ['NPWP', slip.npwp] : null,
            payslipShows(slipConfig, 'bank_name') ? ['Bank', slip.bank_name || '-'] : null,
            payslipShows(slipConfig, 'bank_account') ? ['No. Rekening', slip.bank_account || '-'] : null,
        ].filter(Boolean);
        return { identity, income, deductions, company };
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Banknote" size={16} inline /> Payroll</h1>
                <p className="page-subtitle">Kelola penggajian karyawan dengan kalkulasi BPJS & PPh 21</p>
            </div>

            {success && <div className="alert alert-success mb-3"><span className="alert-icon"><Icon name="Check" size={16} inline /></span> {success}</div>}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Daftar Payroll</h2>
                    <button className="btn btn-primary" onClick={() => { setShowGenerateModal(true); setError(''); }}>
                        <Icon name="RefreshCw" size={16} inline /> Generate Payroll
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : runs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="Banknote" size={16} inline /></div>
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
                                        <td style={{ fontWeight: 600 }}>{periodLabel(run)}</td>
                                        <td>{run.employee_count} orang</td>
                                        <td style={{ fontWeight: 600 }}>{formatCurrency(run.total_net_salary)}</td>
                                        <td>
                                            <span className={`badge ${run.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>
                                                {run.status === 'finalized' ? 'Final' : 'Draft'}
                                            </span>
                                        </td>
                                        <td>{new Date(run.run_date).toLocaleDateString('id-ID')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => openDetail(run)}><Icon name="ClipboardList" size={16} inline /> Detail</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => exportPayroll(run, 'pdf')}><Icon name="FileText" size={16} inline /> PDF</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => exportPayroll(run, 'excel')}><Icon name="BarChart3" size={16} inline /> Excel</button>
                                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger-500)' }} onClick={() => handleDelete(run)}><Icon name="Trash2" size={16} inline /> Hapus</button>
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
                            <h3 className="modal-title"><Icon name="RefreshCw" size={16} inline /> Generate Payroll</h3>
                            <button className="modal-close" onClick={() => setShowGenerateModal(false)}><Icon name="X" size={16} /></button>
                        </div>
                        <form onSubmit={handleGenerate}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger mb-3"><span className="alert-icon"><Icon name="AlertTriangle" size={16} inline /></span> {error}</div>}
                                <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--gray-300)' }}>
                                    <Icon name="Info" size={16} inline /> {genForm.period_type === 'weekly'
                                        ? 'Payroll mingguan hanya untuk karyawan gaji mingguan. Gaji pokok dihitung satu minggu, tunjangan bulanan dibagi 4, dan cicilan mingguan dipotong satu kali.'
                                        : 'Payroll bulanan menghitung gaji pokok, tunjangan, lembur, BPJS, PPh 21, dan potongan pinjaman. Karyawan gaji mingguan tidak ikut di sini.'}
                                </div>
                                <div className="payslip-scope-options" style={{ marginBottom: '1rem' }}>
                                    <label className="payslip-field-check">
                                        <input type="radio" name="payroll-period" checked={genForm.period_type !== 'weekly'} onChange={() => setGenForm({ ...genForm, period_type: 'monthly' })} />
                                        Bulanan
                                    </label>
                                    <label className="payslip-field-check">
                                        <input type="radio" name="payroll-period" checked={genForm.period_type === 'weekly'} onChange={() => setGenForm({ ...genForm, period_type: 'weekly' })} />
                                        Mingguan
                                    </label>
                                </div>
                                {genForm.period_type === 'weekly' ? (
                                    <div className="form-group">
                                        <label className="form-label">Tanggal dalam minggu *</label>
                                        <input className="form-input" type="date" value={genForm.week_date} onChange={e => setGenForm({ ...genForm, week_date: e.target.value })} required />
                                        <p className="payslip-field-note" style={{ marginTop: '0.45rem' }}>{weekRangeLabel(genForm.week_date)}</p>
                                    </div>
                                ) : (
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
                                )}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Catatan</label>
                                    <input className="form-input" value={genForm.notes} onChange={e => setGenForm({ ...genForm, notes: e.target.value })} placeholder="Catatan opsional" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowGenerateModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Memproses...' : 'Generate'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedRun && (
                <div className={`modal-overlay payroll-detail-overlay${isMaximized ? ' is-full' : ''}`}>
                    <div className={`modal payroll-detail-modal${isMaximized ? ' is-full' : ''}`} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Payroll {periodLabel(selectedRun)}
                                <span className={`badge ${selectedRun.status === 'finalized' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: '0.75rem' }}>
                                    {selectedRun.status === 'finalized' ? 'Final' : 'Draft'}
                                </span>
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="modal-close" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "Perkecil" : "Perbesar"}>
                                    <Icon name={isMaximized ? 'Minimize2' : 'Maximize2'} size={16} />
                                </button>
                                <button className="modal-close" onClick={() => setShowDetailModal(false)}><Icon name="X" size={16} /></button>
                            </div>
                        </div>
                        <div className="modal-body">
                            {selectedRun.items && selectedRun.items.length > 0 ? (
                                <div className="table-container">
                                <table className="table payroll-detail-table">
                                    <thead>
                                        <tr>
                                            <th className="sortable" onClick={() => requestDetailSort('user_name')}>Karyawan {sortMark('user_name')}</th>
                                            <th className="sortable" onClick={() => requestDetailSort('bank_name')}>Bank {sortMark('bank_name')}</th>
                                            <th className="sortable" onClick={() => requestDetailSort('bank_account')}>No. Rekening {sortMark('bank_account')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('basic_salary')}>Gaji Pokok {sortMark('basic_salary')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('tunjangan')}>Tunjangan {sortMark('tunjangan')}</th>
                                            <th className="sortable" style={{ textAlign: 'center' }} onClick={() => requestDetailSort('overtime_hours')}>Jam Lembur {sortMark('overtime_hours')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('overtime_amount')}>Nilai Lembur {sortMark('overtime_amount')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('tuang_amount')}>Tuang {sortMark('tuang_amount')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('gross_income')}>Gross {sortMark('gross_income')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('bpjs')}>BPJS {sortMark('bpjs')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('pph21_amount')}>PPh 21 {sortMark('pph21_amount')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('late_deduction')}>Pot. Telat {sortMark('late_deduction')}</th>
                                            <th className="sortable" style={{ textAlign: 'right' }} onClick={() => requestDetailSort('loan_deduction')}>Pot. Pinjaman {sortMark('loan_deduction')}</th>
                                            <th className="sortable" style={{ textAlign: 'right', fontWeight: 700 }} onClick={() => requestDetailSort('net_salary')}>Gaji Bersih {sortMark('net_salary')}</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailItems.map(item => {
                                            const bpjsTotal = parseFloat(item.bpjs_kes_employee) + parseFloat(item.bpjs_jht_employee) + parseFloat(item.bpjs_jp_employee);
                                            const tunjangan = parseFloat(item.transport_allowance) + parseFloat(item.meal_allowance) + parseFloat(item.appreciation_allowance || 0);
                                            return (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 500 }}>
                                                        {item.user_name}
                                                        <span className={`badge ${item.salary_type === 'daily' ? 'badge-info' : item.salary_type === 'weekly' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>
                                                            {item.salary_type === 'daily' ? `Harian (${item.working_days}hr)` : item.salary_type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                                                        </span>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{item.bank_name || '-'}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{item.bank_account || '-'}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.basic_salary)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(tunjangan)}</td>
                                                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{parseFloat(item.overtime_hours)} jam</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.overtime_amount)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.tuang_amount || 0)}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(item.gross_income)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(bpjsTotal)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(item.pph21_amount)}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>
                                                        {parseFloat(item.late_deduction) > 0 ? `-${formatCurrency(item.late_deduction)}` : '-'}
                                                        {parseFloat(item.late_minutes) > 0 && <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--gray-400)' }}>{item.late_minutes} mnt</span>}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(item.loan_deduction)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-500)', whiteSpace: 'nowrap' }}>{formatCurrency(item.net_salary)}</td>
                                                    <td>
                                                        <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} onClick={() => viewSlip(selectedRun.id, item.user_id)}><Icon name="FileText" size={16} inline /> Slip</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                                            <td style={{ fontWeight: 700 }}>TOTAL</td>
                                            <td></td>
                                            <td></td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.basic_salary), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.transport_allowance) + parseFloat(i.meal_allowance) + parseFloat(i.appreciation_allowance || 0), 0))}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{selectedRun.items.reduce((s, i) => s + parseFloat(i.overtime_hours), 0)} jam</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.overtime_amount), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.tuang_amount || 0), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.gross_income), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.bpjs_kes_employee) + parseFloat(i.bpjs_jht_employee) + parseFloat(i.bpjs_jp_employee), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.pph21_amount), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.late_deduction || 0), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-500)', whiteSpace: 'nowrap' }}>-{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.loan_deduction), 0))}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-500)', whiteSpace: 'nowrap' }}>{formatCurrency(selectedRun.items.reduce((s, i) => s + parseFloat(i.net_salary), 0))}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--gray-500)', textAlign: 'center' }}>Tidak ada data</p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => exportPayroll(selectedRun, 'pdf')}><Icon name="FileText" size={16} inline /> Export PDF</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => exportPayroll(selectedRun, 'excel')}><Icon name="BarChart3" size={16} inline /> Export Excel</button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                                <button className="btn btn-outline" style={{ color: 'var(--danger-500)' }} onClick={() => handleDelete(selectedRun)}><Icon name="Trash2" size={16} inline /> Hapus</button>
                                <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Tutup</button>
                                {selectedRun.status === 'draft' && (
                                    <button className="btn btn-success" onClick={() => handleFinalize(selectedRun.id)}><Icon name="CheckCircle2" size={16} inline /> Finalisasi Payroll</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Slip Gaji Modal */}
            {showSlipModal && selectedSlip && (
                <div className="modal-overlay payroll-slip-overlay">
                    <div className="modal payroll-slip-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Icon name="FileText" size={16} inline /> Slip Gaji</h3>
                            <button className="modal-close" onClick={() => { setShowSlipModal(false); closeSlipEditor(); }}><Icon name="X" size={16} /></button>
                        </div>
                        <div className="modal-body">
                            {slipEditor && canEditPayslipLayout && (
                                <div className="payslip-layout-scope">
                                    <p className="payslip-field-note">
                                        Aturan satu karyawan dipakai lebih dulu. Jika tidak ada, slip mengikuti departemen. Jika departemen juga tidak diatur, slip mengikuti aturan semua karyawan.
                                    </p>
                                    <div className="payslip-scope-options">
                                        <label className="payslip-field-check">
                                            <input type="radio" name="payslip-scope" checked={slipScope === 'global'} onChange={() => changeSlipScope('global')} />
                                            Semua karyawan
                                        </label>
                                        <label className="payslip-field-check">
                                            <input type="radio" name="payslip-scope" checked={slipScope === 'department'} disabled={!slipChoices?.department} onChange={() => changeSlipScope('department')} />
                                            Departemen {slipChoices?.department || 'belum diisi'}
                                        </label>
                                        <label className="payslip-field-check">
                                            <input type="radio" name="payslip-scope" checked={slipScope === 'employee'} onChange={() => changeSlipScope('employee')} />
                                            Karyawan ini ({selectedSlip.user_name})
                                        </label>
                                    </div>
                                    <PayslipFieldSettings value={slipConfig} onChange={setSlipDraft} />
                                    {slipSaveError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{slipSaveError}</div>}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                        <button className="btn btn-primary" type="button" disabled={slipSaving} onClick={saveSlipFields}>
                                            {slipSaving ? 'Menyimpan...' : 'Simpan tampilan'}
                                        </button>
                                        {slipScope !== 'global' && ((slipScope === 'department' && slipChoices?.department_rule) || (slipScope === 'employee' && slipChoices?.employee_rule)) && (
                                            <button className="btn btn-outline" type="button" disabled={slipSaving} onClick={removeSlipRule}>Hapus aturan ini</button>
                                        )}
                                        <button className="btn btn-outline" type="button" onClick={closeSlipEditor}>Batal</button>
                                    </div>
                                </div>
                            )}
                            {/* Header */}
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {showPayslipLogo && (
                                    <img
                                        src={settings.app_logo}
                                        alt="Logo perusahaan"
                                        style={{ height: 64, maxWidth: 220, objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                )}
                                <h3 style={{ marginBottom: '0.25rem' }}>SLIP GAJI</h3>
                                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Periode: {periodLabel(selectedSlip)}</p>
                            </div>

                            {(() => {
                                const lines = slipLines(selectedSlip);
                                const companyEnabled = ['bpjs_kes_company', 'bpjs_jht_company', 'bpjs_jp_company', 'bpjs_jkk', 'bpjs_jkm']
                                    .some((key) => slipConfig.fields[key] !== false);
                                return (
                                    <>
                                        {lines.identity.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                                {lines.identity.map(([label, text]) => (
                                                    <div key={label}><span style={{ color: 'var(--gray-400)' }}>{label}:</span> {label === 'Nama' ? <strong>{text}</strong> : text}</div>
                                                ))}
                                            </div>
                                        )}

                                        {(lines.income.length > 0 || payslipShows(slipConfig, 'gross_income')) && (
                                            <>
                                                <h4 style={{ color: 'var(--success-500)', marginBottom: '0.75rem', fontSize: '0.9rem' }}><Icon name="TrendingUp" size={16} inline /> Pendapatan</h4>
                                                <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                                    {lines.income.map(([key, label, val]) => (
                                                        <div key={key} className="payslip-slip-line">
                                                            <span>{label}</span>
                                                            <span style={{ fontWeight: 500 }}>{formatCurrency(val)}</span>
                                                        </div>
                                                    ))}
                                                    {payslipShows(slipConfig, 'gross_income') && (
                                                        <div className="payslip-slip-line" style={{ fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.25rem' }}>
                                                            <span>Total Pendapatan</span>
                                                            <span style={{ color: 'var(--success-500)' }}>{formatCurrency(selectedSlip.gross_income)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {(lines.deductions.length > 0 || payslipShows(slipConfig, 'total_deductions')) && (
                                            <>
                                                <h4 style={{ color: 'var(--danger-500)', marginBottom: '0.75rem', fontSize: '0.9rem' }}><Icon name="TrendingDown" size={16} inline /> Potongan</h4>
                                                <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                                    {lines.deductions.map(([key, label, val]) => (
                                                        <div key={key} className="payslip-slip-line">
                                                            <span>{label}</span>
                                                            <span style={{ fontWeight: 500, color: 'var(--danger-500)' }}>-{formatCurrency(val)}</span>
                                                        </div>
                                                    ))}
                                                    {payslipShows(slipConfig, 'total_deductions') && (
                                                        <div className="payslip-slip-line" style={{ fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.25rem' }}>
                                                            <span>Total Potongan</span>
                                                            <span style={{ color: 'var(--danger-500)' }}>-{formatCurrency(selectedSlip.total_deductions)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {companyEnabled && (
                                            <>
                                                <h4 style={{ color: 'var(--primary-400)', marginBottom: '0.75rem', fontSize: '0.9rem' }}><Icon name="Building2" size={16} inline /> Kontribusi Perusahaan (Info)</h4>
                                                <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                                    {lines.company.length > 0 ? lines.company.map(([key, label, val]) => (
                                                        <div key={key} className="payslip-slip-line">
                                                            <span>{label}</span>
                                                            <span>{formatCurrency(val)}</span>
                                                        </div>
                                                    )) : (
                                                        <div style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Tidak ada kontribusi BPJS</div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {payslipShows(slipConfig, 'net_salary') && (
                                            <div style={{ background: 'rgba(16,185,129,0.15)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>GAJI BERSIH (Take Home Pay)</p>
                                                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-500)' }}>{formatCurrency(selectedSlip.net_salary)}</p>
                                                {payslipShows(slipConfig, 'bank') && (
                                                    <p style={{ color: 'var(--gray-400)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                                        Transfer ke: {selectedSlip.bank_name || '-'} - {selectedSlip.bank_account || '-'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => exportSlip('pdf')}><Icon name="FileText" size={16} inline /> PDF</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => exportSlip('excel')}><Icon name="BarChart3" size={16} inline /> Excel</button>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => window.print()}><Icon name="Printer" size={16} inline /> Print</button>
                                {canEditPayslipLayout && (
                                    <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={slipEditor ? closeSlipEditor : openSlipEditor}>
                                        <Icon name="Settings" size={16} inline /> Atur tampilan
                                    </button>
                                )}
                            </div>
                            <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={() => { setShowSlipModal(false); closeSlipEditor(); }}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
