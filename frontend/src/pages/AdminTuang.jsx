import { useState, useEffect, useMemo } from 'react';
import { tuangAPI } from '../utils/api';
import Icon from '../components/Icon';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MONTHS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function formatCurrency(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function AdminTuang() {
    const now = new Date();
    const [view, setView] = useState('daily');
    const [date, setDate] = useState(todayISO());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [department, setDepartment] = useState('');
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [amounts, setAmounts] = useState({});
    const [notes, setNotes] = useState({});
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        tuangAPI.getDepartments().then(setDepartments).catch(() => setDepartments([]));
    }, []);

    useEffect(() => {
        if (view !== 'daily') return;
        loadDaily();
    }, [date, department, view]);

    useEffect(() => {
        if (view !== 'summary') return;
        loadSummary();
    }, [month, year, view]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }

    async function loadDaily() {
        setLoading(true);
        try {
            const [emps, rows] = await Promise.all([
                tuangAPI.getEmployees(department ? { department } : {}),
                tuangAPI.getAll({ date }),
            ]);
            setEmployees(emps);
            const nextAmounts = {};
            const nextNotes = {};
            rows.forEach((r) => {
                nextAmounts[r.user_id] = String(Math.round(parseFloat(r.amount) || 0));
                nextNotes[r.user_id] = r.notes || '';
            });
            setAmounts(nextAmounts);
            setNotes(nextNotes);
        } catch (e) {
            showMsg('danger', e.message || 'Gagal memuat data tuang');
        } finally {
            setLoading(false);
        }
    }

    async function loadSummary() {
        setLoading(true);
        try {
            const data = await tuangAPI.getSummary(month, year);
            setSummary(data);
        } catch (e) {
            showMsg('danger', e.message || 'Gagal memuat rekap tuang');
        } finally {
            setLoading(false);
        }
    }

    async function saveDaily() {
        setSaving(true);
        try {
            const entries = employees.map((emp) => ({
                user_id: emp.id,
                amount: parseFloat(amounts[emp.id]) || 0,
                notes: notes[emp.id] || '',
            }));
            await tuangAPI.bulkSave({ date, entries });
            showMsg('success', 'Tuang harian berhasil disimpan');
            loadDaily();
        } catch (e) {
            showMsg('danger', e.message || 'Gagal menyimpan tuang');
        } finally {
            setSaving(false);
        }
    }

    const dailyTotal = useMemo(
        () => employees.reduce((s, emp) => s + (parseFloat(amounts[emp.id]) || 0), 0),
        [employees, amounts]
    );
    const filledCount = useMemo(
        () => employees.filter((emp) => (parseFloat(amounts[emp.id]) || 0) > 0).length,
        [employees, amounts]
    );
    const summaryTotal = useMemo(
        () => summary.reduce((s, r) => s + (parseFloat(r.tuang_amount) || 0), 0),
        [summary]
    );

    function formatLongDate(iso) {
        return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function currentTitle() {
        if (view === 'daily') {
            const dept = department || 'Semua Departemen';
            return `Insentif Tuang Produksi — ${formatLongDate(date)} — ${dept}`;
        }
        return `Rekap Tuang Produksi — ${MONTHS[month]} ${year}`;
    }

    function currentRows() {
        if (view === 'daily') {
            return employees.map((emp, i) => ({
                no: i + 1,
                name: emp.name,
                employee_id: emp.employee_id,
                department: emp.department || '-',
                amount: parseFloat(amounts[emp.id]) || 0,
                notes: notes[emp.id] || '',
            }));
        }
        return summary.map((row, i) => ({
            no: i + 1,
            name: row.name,
            employee_id: row.employee_id,
            department: row.department || '-',
            days: row.tuang_days,
            amount: parseFloat(row.tuang_amount) || 0,
        }));
    }

    function handlePrint() {
        const rows = currentRows();
        if (rows.length === 0) {
            alert('Tidak ada data untuk dicetak');
            return;
        }
        const isDaily = view === 'daily';
        const body = rows.map((r) => isDaily
            ? `<tr>
                <td>${r.no}</td>
                <td>${escapeHtml(r.name)}<br><small>${escapeHtml(r.employee_id)}</small></td>
                <td>${escapeHtml(r.department)}</td>
                <td class="num">${formatCurrency(r.amount)}</td>
                <td>${escapeHtml(r.notes || '-')}</td>
              </tr>`
            : `<tr>
                <td>${r.no}</td>
                <td>${escapeHtml(r.name)}<br><small>${escapeHtml(r.employee_id)}</small></td>
                <td>${escapeHtml(r.department)}</td>
                <td class="num">${r.days}</td>
                <td class="num">${formatCurrency(r.amount)}</td>
              </tr>`
        ).join('');
        const head = isDaily
            ? '<tr><th>No</th><th>Karyawan</th><th>Departemen</th><th>Nilai Tuang</th><th>Catatan</th></tr>'
            : '<tr><th>No</th><th>Karyawan</th><th>Departemen</th><th>Hari Tuang</th><th>Total Tuang</th></tr>';
        const total = isDaily ? dailyTotal : summaryTotal;
        const colspan = isDaily ? 3 : 4;
        const win = window.open('', '_blank');
        if (!win) {
            alert('Izinkan pop-up untuk mencetak');
            return;
        }
        win.document.write(`
            <html>
            <head>
                <title>${currentTitle()}</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; }
                    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
                    p { font-size: 12px; margin: 0 0 16px; text-align: center; color: #555; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ccc; padding: 6px 8px; }
                    th { background: #7f1d1d; color: #fff; }
                    td.num { text-align: right; white-space: nowrap; }
                    tfoot td { font-weight: 700; }
                    small { color: #666; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(currentTitle())}</h1>
                <p>Dicetak: ${new Date().toLocaleString('id-ID')}</p>
                <table>
                    <thead>${head}</thead>
                    <tbody>${body}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="${colspan}">TOTAL</td>
                            <td class="num">${formatCurrency(total)}</td>
                            ${isDaily ? '<td></td>' : ''}
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    }

    function handleExportPDF() {
        const rows = currentRows();
        if (rows.length === 0) {
            alert('Tidak ada data untuk diekspor');
            return;
        }
        try {
            const isDaily = view === 'daily';
            const doc = new jsPDF(isDaily ? 'landscape' : 'portrait', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(currentTitle(), pageWidth / 2, 14, { align: 'center', maxWidth: pageWidth - 20 });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, 22, { align: 'center' });

            const head = isDaily
                ? [['No', 'ID', 'Nama', 'Departemen', 'Nilai Tuang', 'Catatan']]
                : [['No', 'ID', 'Nama', 'Departemen', 'Hari Tuang', 'Total Tuang']];
            const body = rows.map((r) => isDaily
                ? [r.no, r.employee_id, r.name, r.department, formatCurrency(r.amount), r.notes || '-']
                : [r.no, r.employee_id, r.name, r.department, r.days, formatCurrency(r.amount)]
            );
            const total = isDaily ? dailyTotal : summaryTotal;
            const foot = isDaily
                ? [['', '', '', 'TOTAL', formatCurrency(total), '']]
                : [['', '', '', 'TOTAL', '', formatCurrency(total)]];

            autoTable(doc, {
                startY: 28,
                head,
                body,
                foot,
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontStyle: 'bold' },
                footStyles: { fillColor: [254, 226, 226], textColor: [127, 29, 29], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [255, 247, 247] },
                columnStyles: isDaily
                    ? { 0: { halign: 'center', cellWidth: 12 }, 4: { halign: 'right' } }
                    : { 0: { halign: 'center', cellWidth: 12 }, 4: { halign: 'center' }, 5: { halign: 'right' } },
                didDrawPage: (data) => {
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Halaman ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 7, { align: 'center' });
                }
            });
            const filename = view === 'daily'
                ? `tuang-${date}.pdf`
                : `rekap-tuang-${year}-${String(month).padStart(2, '0')}.pdf`;
            doc.save(filename);
        } catch (err) {
            console.error('Export tuang PDF failed:', err);
            alert(err.message || 'Gagal membuat PDF');
        }
    }

    function handleExportExcel() {
        const rows = currentRows();
        if (rows.length === 0) {
            alert('Tidak ada data untuk diekspor');
            return;
        }
        const isDaily = view === 'daily';
        const data = isDaily
            ? rows.map((r) => ({
                No: r.no,
                ID: r.employee_id,
                Nama: r.name,
                Departemen: r.department,
                'Nilai Tuang': r.amount,
                Catatan: r.notes || '',
            }))
            : rows.map((r) => ({
                No: r.no,
                ID: r.employee_id,
                Nama: r.name,
                Departemen: r.department,
                'Hari Tuang': r.days,
                'Total Tuang': r.amount,
            }));
        data.push(isDaily
            ? { No: '', ID: '', Nama: '', Departemen: 'TOTAL', 'Nilai Tuang': dailyTotal, Catatan: '' }
            : { No: '', ID: '', Nama: '', Departemen: 'TOTAL', 'Hari Tuang': '', 'Total Tuang': summaryTotal }
        );
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = isDaily
            ? [{ wch: 5 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 28 }]
            : [{ wch: 5 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isDaily ? 'Tuang Harian' : 'Rekap Tuang');
        const filename = view === 'daily'
            ? `tuang-${date}.xlsx`
            : `rekap-tuang-${year}-${String(month).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    const exportButtons = (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={handlePrint} disabled={loading} title="Cetak">
                <Icon name="Printer" size={16} inline /> Print
            </button>
            <button type="button" className="btn btn-outline" onClick={handleExportPDF} disabled={loading} title="Export PDF">
                <Icon name="FileText" size={16} inline /> PDF
            </button>
            <button type="button" className="btn btn-outline" onClick={handleExportExcel} disabled={loading} title="Export Excel">
                <Icon name="BarChart3" size={16} inline /> Excel
            </button>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>
                        Insentif Tuang Produksi
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', margin: 0 }}>
                        Manager mengisi nilai tuang per karyawan sesuai pendapatan hari itu. Total bulan masuk ke payroll.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`btn ${view === 'daily' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('daily')}>
                        Input Harian
                    </button>
                    <button className={`btn ${view === 'summary' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('summary')}>
                        Rekap Bulanan
                    </button>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>{message.text}</div>
            )}

            {view === 'daily' && (
                <>
                    <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tanggal</label>
                                <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Departemen</label>
                                <select className="form-input form-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                                    <option value="">Semua Departemen</option>
                                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                                <strong>{filledCount}</strong> karyawan terisi
                                <div style={{ fontWeight: 700, color: 'var(--success-500)' }}>{formatCurrency(dailyTotal)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {exportButtons}
                                <button className="btn btn-primary" onClick={saveDaily} disabled={saving || loading}>
                                    <Icon name="Save" size={16} inline /> {saving ? 'Menyimpan...' : 'Simpan Tuang'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <p style={{ padding: '1.5rem', color: 'var(--gray-600)' }}>Memuat...</p>
                        ) : employees.length === 0 ? (
                            <p style={{ padding: '1.5rem', color: 'var(--gray-600)' }}>Tidak ada karyawan.</p>
                        ) : (
                            <table className="table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Karyawan</th>
                                        <th>Departemen</th>
                                        <th style={{ width: 180 }}>Nilai Tuang (Rp)</th>
                                        <th>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((emp) => (
                                        <tr key={emp.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{emp.employee_id}</div>
                                            </td>
                                            <td>{emp.department || '-'}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    className="form-input"
                                                    placeholder="0"
                                                    value={amounts[emp.id] ?? ''}
                                                    onChange={(e) => setAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="form-input"
                                                    placeholder="Opsional"
                                                    value={notes[emp.id] ?? ''}
                                                    onChange={(e) => setNotes((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {view === 'summary' && (
                <>
                    <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Bulan</label>
                                <select className="form-input form-select" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                                    {MONTHS.slice(1).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tahun</label>
                                <input type="number" className="form-input" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} />
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                                Total {MONTHS[month]} {year}
                                <div style={{ fontWeight: 700, color: 'var(--success-500)' }}>{formatCurrency(summaryTotal)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {exportButtons}
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <p style={{ padding: '1.5rem', color: 'var(--gray-600)' }}>Memuat...</p>
                        ) : summary.length === 0 ? (
                            <p style={{ padding: '1.5rem', color: 'var(--gray-600)' }}>Belum ada tuang di bulan ini.</p>
                        ) : (
                            <table className="table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Karyawan</th>
                                        <th>Departemen</th>
                                        <th style={{ textAlign: 'center' }}>Hari Tuang</th>
                                        <th style={{ textAlign: 'right' }}>Total Tuang</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.map((row) => (
                                        <tr key={row.user_id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{row.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{row.employee_id}</div>
                                            </td>
                                            <td>{row.department || '-'}</td>
                                            <td style={{ textAlign: 'center' }}>{row.tuang_days}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.tuang_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} style={{ fontWeight: 700 }}>TOTAL</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-500)' }}>{formatCurrency(summaryTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
