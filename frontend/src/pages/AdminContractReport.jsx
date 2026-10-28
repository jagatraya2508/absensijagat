import { useState, useEffect, useMemo } from 'react';
import { reportsAPI, departmentsAPI, divisionsAPI } from '../utils/api';
import Icon from '../components/Icon';
import ListPagination, { slicePage } from '../components/ListPagination';

const PARAMETER_OPTIONS = [
    { value: '1_month', label: '≤ 1 Bulan', shortLabel: '≤ 1 Bln', icon: '🔴' },
    { value: '2_months', label: '≤ 2 Bulan', shortLabel: '≤ 2 Bln', icon: '🟡' },
    { value: '3_months', label: '≤ 3 Bulan', shortLabel: '≤ 3 Bln', icon: '🔵' },
    { value: 'expired', label: 'Sudah Habis', shortLabel: 'Habis', icon: '⛔' },
    { value: 'all_expiring', label: 'Semua ≤ 3 Bulan', shortLabel: 'Semua ≤ 3', icon: '⚠️' },
    { value: 'all', label: 'Semua Kontrak', shortLabel: 'Semua', icon: '📋' },
    { value: 'no_date', label: 'Belum Ada Tanggal', shortLabel: 'No Date', icon: '❓' },
];

function formatDateID(iso) {
    if (!iso) return '-';
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export default function AdminContractReport() {
    const [parameter, setParameter] = useState('3_months');
    const [department, setDepartment] = useState('');
    const [division, setDivision] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [page, setPage] = useState(1);

    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]);

    // Load department/division options
    useEffect(() => {
        departmentsAPI.getAll().then((rows) => {
            setDepartmentOptions((rows || []).map((r) => r.name).filter(Boolean));
        }).catch(() => {});
        divisionsAPI.getAll().then((rows) => {
            setDivisionOptions((rows || []).map((r) => r.name).filter(Boolean));
        }).catch(() => {});
    }, []);

    // Debounce search
    useEffect(() => {
        const timeout = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timeout);
    }, [searchInput]);

    // Fetch report
    useEffect(() => {
        fetchReport();
    }, [parameter, department, division, search]);

    async function fetchReport() {
        setLoading(true);
        setError('');
        try {
            const data = await reportsAPI.getContractExpiry(
                parameter,
                department || undefined,
                division || undefined,
                search || undefined
            );
            setReport(data);
        } catch (err) {
            console.error('Failed to fetch contract report:', err);
            setReport(null);
            setError(err.message || 'Gagal memuat laporan kontrak');
        } finally {
            setLoading(false);
        }
    }

    // Sort
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    function sortMark(key) {
        if (sortConfig.key !== key) return <Icon name="ArrowUpDown" size={12} />;
        return sortConfig.direction === 'ascending'
            ? <Icon name="ChevronUp" size={12} />
            : <Icon name="ChevronDown" size={12} />;
    }

    const sortedRecords = useMemo(() => {
        const rows = [...(report?.records || [])];
        if (!sortConfig.key) return rows;
        rows.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'days_left') {
                aValue = aValue === null ? 99999 : aValue;
                bValue = bValue === null ? 99999 : bValue;
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }

            const strA = String(aValue ?? '');
            const strB = String(bValue ?? '');
            const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
            return sortConfig.direction === 'ascending' ? cmp : -cmp;
        });
        return rows;
    }, [report, sortConfig]);

    useEffect(() => {
        setPage(1);
    }, [parameter, department, division, search, sortConfig.key, sortConfig.direction]);

    const pagedRecords = slicePage(sortedRecords, page);

    // Export handlers
    async function handleExportPDF() {
        setExporting(true);
        try {
            await reportsAPI.exportContractPDF(parameter, department || undefined, division || undefined, search || undefined);
        } catch (err) {
            console.error('Export Contract PDF failed:', err);
            alert('Gagal mengunduh PDF');
        } finally {
            setExporting(false);
        }
    }

    async function handleExportExcel() {
        setExporting(true);
        try {
            await reportsAPI.exportContractExcel(parameter, department || undefined, division || undefined, search || undefined);
        } catch (err) {
            console.error('Export Contract Excel failed:', err);
            alert('Gagal mengunduh Excel');
        } finally {
            setExporting(false);
        }
    }

    function handlePrint() {
        const records = report?.records || [];
        if (records.length === 0) {
            alert('Tidak ada data untuk dicetak');
            return;
        }
        const summary = report?.summary || {};
        const title = `LAPORAN DATA KARYAWAN AKAN HABIS KONTRAK`;
        const subtitle = report?.parameter_label || '';
        const head = '<tr><th>No</th><th>ID</th><th>Nama</th><th>Dept</th><th>Divisi</th><th>Jabatan</th><th>Status</th><th>Mulai Kontrak</th><th>Habis Kontrak</th><th>Sisa Hari</th><th>Keterangan</th></tr>';
        const body = records.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td>${r.employee_id || '-'}</td>
            <td>${r.name || '-'}</td>
            <td>${r.department || '-'}</td>
            <td>${r.division || '-'}</td>
            <td>${r.position || '-'}</td>
            <td>${r.employment_status || '-'}</td>
            <td>${r.contract_start_date ? formatDateID(r.contract_start_date) : '-'}</td>
            <td>${r.contract_end_date ? formatDateID(r.contract_end_date) : 'Belum Diatur'}</td>
            <td style="color:${r.color || '#888'};font-weight:600">${r.days_left !== null ? r.days_left : '-'}</td>
            <td>${r.remaining_label || '-'}</td>
        </tr>`).join('');
        const counts = `<p>Total: ${summary.total_contracts || 0} · ≤1 Bulan: ${summary.within_1_month || 0} · ≤2 Bulan: ${summary.within_2_months || 0} · ≤3 Bulan: ${summary.within_3_months || 0} · Sudah Habis: ${summary.expired || 0} · Belum Ada Tgl: ${summary.unset || 0}</p>`;
        const win = window.open('', '_blank');
        if (!win) {
            alert('Izinkan pop-up untuk mencetak');
            return;
        }
        win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; color: #1a1a2e; }
                h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
                h2 { font-size: 12px; text-align: center; margin: 0 0 6px; font-weight: normal; color: #555; }
                p { font-size: 11px; text-align: center; }
                table { width: 100%; border-collapse: collapse; font-size: 10px; }
                th, td { border: 1px solid #ccc; padding: 3px 5px; }
                th { background: #1e3a8a; color: #fff; }
            </style></head><body>
            <h1>${title}</h1>
            <h2>${subtitle}</h2>
            ${counts}
            <table><thead>${head}</thead><tbody>${body}</tbody></table>
            </body></html>`);
        win.document.close();
        win.focus();
        win.print();
    }

    const summary = report?.summary || {};

    function badgeClass(statusCode) {
        switch (statusCode) {
            case 'expired': case 'today': return 'badge-danger';
            case 'urgent': return 'badge-danger';
            case 'warning': return 'badge-warning';
            case 'monitoring': return 'badge-info';
            case 'safe': return 'badge-success';
            case 'unset': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="FileWarning" size={16} inline /> Laporan Habis Kontrak</h1>
                <p className="page-subtitle">Monitoring karyawan yang kontraknya akan segera habis</p>
            </div>

            {/* Filter Card */}
            <div className="card report-filter-card mb-4">
                <div className="report-filters">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Parameter Kontrak</label>
                        <select
                            className="form-input form-select"
                            value={parameter}
                            onChange={(e) => setParameter(e.target.value)}
                            style={{ minWidth: 200 }}
                        >
                            {PARAMETER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Departemen</label>
                        <select className="form-input form-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                            <option value="">Semua Departemen</option>
                            {departmentOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Divisi</label>
                        <select className="form-input form-select" value={division} onChange={(e) => setDivision(e.target.value)}>
                            <option value="">Semua Divisi</option>
                            {divisionOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cari Karyawan</label>
                        <input
                            type="search"
                            className="form-input"
                            placeholder="Nama / ID / NIK..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            style={{ minWidth: 180 }}
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {report && (
                <div className="report-stat-grid">
                    <div className="card status-card" onClick={() => setParameter('all')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon primary"><Icon name="Users" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Total Kontrak</h3>
                            <p>{summary.total_contracts || 0}</p>
                        </div>
                    </div>
                    <div className="card status-card" onClick={() => setParameter('1_month')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Icon name="AlertTriangle" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>≤ 1 Bulan</h3>
                            <p style={{ color: '#ef4444' }}>{summary.within_1_month || 0}</p>
                        </div>
                    </div>
                    <div className="card status-card" onClick={() => setParameter('2_months')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Icon name="Clock" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>≤ 2 Bulan</h3>
                            <p style={{ color: '#f59e0b' }}>{summary.within_2_months || 0}</p>
                        </div>
                    </div>
                    <div className="card status-card" onClick={() => setParameter('3_months')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}><Icon name="CalendarClock" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>≤ 3 Bulan</h3>
                            <p style={{ color: '#3b82f6' }}>{summary.within_3_months || 0}</p>
                        </div>
                    </div>
                    <div className="card status-card" onClick={() => setParameter('expired')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon danger"><Icon name="XCircle" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Sudah Habis</h3>
                            <p style={{ color: '#dc2626' }}>{summary.expired || 0}</p>
                        </div>
                    </div>
                    <div className="card status-card" onClick={() => setParameter('no_date')} style={{ cursor: 'pointer' }}>
                        <div className="status-card-icon secondary"><Icon name="HelpCircle" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Belum Ada Tgl</h3>
                            <p>{summary.unset || 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="card">
                <div className="card-header report-card-header">
                    <h2 className="card-title">
                        {report?.parameter_label || 'Laporan Kontrak Karyawan'}
                        {report && <small style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>({sortedRecords.length} data)</small>}
                    </h2>
                    <div className="report-export-actions">
                        <button
                            className="btn btn-outline"
                            onClick={handlePrint}
                            disabled={!report || sortedRecords.length === 0}
                        >
                            <Icon name="Printer" size={16} inline /> Print
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={handleExportPDF}
                            disabled={exporting || !report || sortedRecords.length === 0}
                        >
                            {exporting ? <Icon name="Hourglass" size={16} inline /> : <Icon name="FileText" size={16} inline />} PDF
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={handleExportExcel}
                            disabled={exporting || !report || sortedRecords.length === 0}
                        >
                            {exporting ? <Icon name="Hourglass" size={16} inline /> : <Icon name="BarChart3" size={16} inline />} Excel
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : error ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="AlertTriangle" size={16} inline /></div>
                        <p className="empty-state-text">{error}</p>
                    </div>
                ) : !report || sortedRecords.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="FileWarning" size={16} inline /></div>
                        <p className="empty-state-text">Tidak ada karyawan kontrak yang sesuai dengan kriteria filter</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="table stack-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>No</th>
                                        <th className={`sortable${sortConfig.key === 'employee_id' ? ' active' : ''}`} onClick={() => requestSort('employee_id')}>ID {sortMark('employee_id')}</th>
                                        <th className={`sortable${sortConfig.key === 'name' ? ' active' : ''}`} onClick={() => requestSort('name')}>Nama {sortMark('name')}</th>
                                        <th className={`sortable${sortConfig.key === 'department' ? ' active' : ''}`} onClick={() => requestSort('department')}>Dept {sortMark('department')}</th>
                                        <th className={`sortable${sortConfig.key === 'division' ? ' active' : ''}`} onClick={() => requestSort('division')}>Divisi {sortMark('division')}</th>
                                        <th className={`sortable${sortConfig.key === 'position' ? ' active' : ''}`} onClick={() => requestSort('position')}>Jabatan {sortMark('position')}</th>
                                        <th className={`sortable${sortConfig.key === 'employment_status' ? ' active' : ''}`} onClick={() => requestSort('employment_status')}>Status {sortMark('employment_status')}</th>
                                        <th className={`sortable${sortConfig.key === 'contract_start_date' ? ' active' : ''}`} onClick={() => requestSort('contract_start_date')}>Mulai {sortMark('contract_start_date')}</th>
                                        <th className={`sortable${sortConfig.key === 'contract_end_date' ? ' active' : ''}`} onClick={() => requestSort('contract_end_date')}>Habis Kontrak {sortMark('contract_end_date')}</th>
                                        <th className={`sortable${sortConfig.key === 'days_left' ? ' active' : ''}`} onClick={() => requestSort('days_left')}>Sisa Hari {sortMark('days_left')}</th>
                                        <th>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRecords.items.map((record, index) => (
                                        <tr key={record.id || `${record.employee_id}-${index}`}>
                                            <td data-label="No">{(pagedRecords.pageSafe - 1) * 10 + index + 1}</td>
                                            <td data-label="ID" style={{ fontWeight: 500 }}>{record.employee_id || '-'}</td>
                                            <td data-label="Nama">{record.name || '-'}</td>
                                            <td data-label="Dept">{record.department || '-'}</td>
                                            <td data-label="Divisi">{record.division || '-'}</td>
                                            <td data-label="Jabatan">{record.position || '-'}</td>
                                            <td data-label="Status">
                                                <span className="badge badge-secondary">{record.employment_status || '-'}</span>
                                            </td>
                                            <td data-label="Mulai">{record.contract_start_date ? formatDateID(record.contract_start_date) : '-'}</td>
                                            <td data-label="Habis Kontrak">
                                                {record.contract_end_date ? (
                                                    <span style={{ fontWeight: 600 }}>{formatDateID(record.contract_end_date)}</span>
                                                ) : (
                                                    <span className="text-muted" style={{ fontStyle: 'italic' }}>Belum Diatur</span>
                                                )}
                                            </td>
                                            <td data-label="Sisa Hari">
                                                {record.days_left !== null && record.days_left !== undefined ? (
                                                    <span
                                                        className={`badge ${badgeClass(record.status_code)}`}
                                                        style={{ fontWeight: 700, fontSize: '0.85rem' }}
                                                    >
                                                        {record.days_left >= 0 ? record.days_left : record.days_left} hari
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td data-label="Keterangan">
                                                <span style={{ color: record.color || '#888', fontWeight: 500, fontSize: '0.85rem' }}>
                                                    {record.remaining_label || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ListPagination
                            page={pagedRecords.pageSafe}
                            total={sortedRecords.length}
                            onPageChange={setPage}
                            itemLabel="karyawan"
                        />
                    </>
                )}
            </div>
        </div>
    );
}
