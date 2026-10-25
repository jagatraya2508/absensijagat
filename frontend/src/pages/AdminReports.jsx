import { useState, useEffect, useMemo } from 'react';
import { reportsAPI, departmentsAPI, divisionsAPI } from '../utils/api';
import Icon from '../components/Icon';
import ListPagination, { slicePage } from '../components/ListPagination';

function localToday() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

function formatIsoDate(iso) {
    if (!iso) return '-';
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

export default function AdminReports() {
    const [reportType, setReportType] = useState('daily');
    const [dailyStart, setDailyStart] = useState(localToday());
    const [dailyEnd, setDailyEnd] = useState(localToday());
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    // History-specific state
    const [historyUsers, setHistoryUsers] = useState([]);
    const [historySelectedUser, setHistorySelectedUser] = useState('all');
    const [department, setDepartment] = useState('');
    const [division, setDivision] = useState('');
    const [nameQuery, setNameQuery] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [lookupOpen, setLookupOpen] = useState(false);
    const [lookupPage, setLookupPage] = useState(1);
    const [page, setPage] = useState(1);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [divisionOptions, setDivisionOptions] = useState([]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        departmentsAPI.getAll().then((rows) => {
            setDepartmentOptions((rows || []).map((row) => row.name).filter(Boolean));
        }).catch(() => {});
        divisionsAPI.getAll().then((rows) => {
            setDivisionOptions((rows || []).map((row) => row.name).filter(Boolean));
        }).catch(() => {});
        reportsAPI.getEmployees().then((rows) => {
            setHistoryUsers(rows || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        fetchReport();
    }, [reportType, dailyStart, dailyEnd, year, month, startDate, endDate, historySelectedUser]);

    async function fetchReport() {
        setLoading(true);
        setError('');
        try {
            if (reportType === 'daily') {
                const data = await reportsAPI.getDaily(dailyStart, dailyEnd);
                setReport(data);
            } else if (reportType === 'monthly') {
                const data = await reportsAPI.getMonthly(year, month);
                setReport(data);
            } else if (reportType === 'off') {
                const data = await reportsAPI.getOff(startDate, endDate);
                setReport(data);
            } else if (reportType === 'history') {
                const data = await reportsAPI.getHistory(startDate, endDate, historySelectedUser);
                setReport(data);
            }
        } catch (error) {
            console.error('Failed to fetch report:', error);
            setReport(null);
            setError(error.message || 'Gagal memuat laporan');
        } finally {
            setLoading(false);
        }
    }

    async function handleExportPDF() {
        setExporting(true);
        try {
            if (reportType === 'daily') {
                await reportsAPI.exportDailyPDF(dailyStart, dailyEnd);
            } else if (reportType === 'monthly') {
                await reportsAPI.exportMonthlyPDF(year, month);
            } else if (reportType === 'off') {
                await reportsAPI.exportOffPDF(startDate, endDate);
            } else if (reportType === 'history') {
                await reportsAPI.exportHistoryPDF(startDate, endDate, historySelectedUser);
            }
        } catch (error) {
            console.error('Export PDF failed:', error);
            alert('Gagal mengunduh PDF');
        } finally {
            setExporting(false);
        }
    }

    async function handleExportExcel() {
        setExporting(true);
        try {
            if (reportType === 'daily') {
                await reportsAPI.exportDailyExcel(dailyStart, dailyEnd);
            } else if (reportType === 'monthly') {
                await reportsAPI.exportMonthlyExcel(year, month);
            } else if (reportType === 'off') {
                await reportsAPI.exportOffExcel(startDate, endDate);
            } else if (reportType === 'history') {
                await reportsAPI.exportHistoryExcel(startDate, endDate, historySelectedUser);
            }
        } catch (error) {
            console.error('Export Excel failed:', error);
            alert('Gagal mengunduh Excel');
        } finally {
            setExporting(false);
        }
    }

    function formatTime(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDateShort(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const visibleRecords = useMemo(() => {
        const rows = report?.records || [];
        return rows.filter((record) => {
            if (department && (record.department || '') !== department) return false;
            if (division && (record.division || '') !== division) return false;
            if (selectedEmployeeId) {
                const employee = historyUsers.find((item) => String(item.id) === String(selectedEmployeeId));
                const sameUser = record.user_id && String(record.user_id) === String(selectedEmployeeId);
                const sameCode = employee && record.employee_id && String(record.employee_id) === String(employee.employee_id);
                if (!sameUser && !sameCode) return false;
            }
            return true;
        });
    }, [report, department, division, selectedEmployeeId]);

    const employeeMatches = useMemo(() => {
        const query = selectedEmployeeId ? '' : nameQuery.trim().toLowerCase();
        return historyUsers.filter((employee) => {
            if (department && (employee.department || '') !== department) return false;
            if (division && (employee.division || '') !== division) return false;
            if (!query) return true;
            return `${employee.name || ''} ${employee.employee_id || ''}`.toLowerCase().includes(query);
        });
    }, [historyUsers, department, division, nameQuery, selectedEmployeeId]);

    const pagedEmployees = slicePage(employeeMatches, lookupPage, 6);

    useEffect(() => {
        setLookupPage(1);
    }, [nameQuery, department, division]);

    const dailySummary = useMemo(() => {
        if (reportType !== 'daily') return null;
        return {
            total_employees: new Set(visibleRecords.map((row) => row.user_id)).size,
            present: visibleRecords.filter((row) => row.check_in_time).length,
            absent: visibleRecords.filter((row) => !row.check_in_time && !row.leave_type && !row.is_off_day && !row.manual_id).length,
            completed: visibleRecords.filter((row) => row.check_in_time && row.check_out_time).length,
            on_late: visibleRecords.filter((row) => row.leave_type === 'late').length,
            on_leave: visibleRecords.filter((row) => row.leave_type === 'leave').length,
            on_manual: visibleRecords.filter((row) => row.manual_id).length
        };
    }, [reportType, visibleRecords]);

    useEffect(() => {
        setPage(1);
    }, [reportType, dailyStart, dailyEnd, year, month, startDate, endDate, historySelectedUser, department, division, selectedEmployeeId, sortConfig.key, sortConfig.direction]);

    const sortedRecords = useMemo(() => {
        const rows = [...visibleRecords];
        if (!sortConfig.key) return rows;
        rows.sort((a, b) => {
            const aValue = a[sortConfig.key] ?? '';
            const bValue = b[sortConfig.key] ?? '';
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [visibleRecords, sortConfig]);

    const pagedRecords = slicePage(sortedRecords, page);

    function chooseEmployee(employee) {
        setSelectedEmployeeId(String(employee.id));
        setNameQuery(`${employee.name} (${employee.employee_id})`);
        setLookupOpen(false);
    }

    function clearEmployeeLookup() {
        setSelectedEmployeeId('');
        setNameQuery('');
        setLookupOpen(false);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function statusText(record) {
        if (record.is_off_day) return 'OFF';
        if (record.leave_type === 'late') return 'Izin Terlambat';
        if (record.leave_type === 'leave') return 'Cuti';
        if (record.leave_type === 'sick') return 'Sakit';
        if (record.leave_type === 'permission') return 'Izin Tidak Masuk';
        if (record.leave_type === 'change_off') return 'Tukar Libur';
        if (record.check_in_time && record.check_out_time) return 'Lengkap';
        if (record.check_in_time) return 'Belum Pulang';
        if (record.manual_id) return 'Pengajuan Absensi';
        return 'Tidak Hadir';
    }

    function handlePrint() {
        if (visibleRecords.length === 0) {
            alert('Tidak ada data untuk dicetak');
            return;
        }
        const title = reportType === 'daily'
            ? `Laporan Absensi ${formatIsoDate(dailyStart)} - ${formatIsoDate(dailyEnd)}`
            : 'Laporan Absensi';
        const head = '<tr><th>No</th><th>ID</th><th>Nama</th><th>Departemen</th><th>Divisi</th><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr>';
        const body = visibleRecords.map((record, index) => `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(record.employee_id)}</td>
            <td>${escapeHtml(record.name)}</td>
            <td>${escapeHtml(record.department || '-')}</td>
            <td>${escapeHtml(record.division || '-')}</td>
            <td>${escapeHtml(record.report_date || record.attendance_date || record.off_date || '-')}</td>
            <td>${escapeHtml(record.check_in_time ? formatTime(record.check_in_time) : '-')}</td>
            <td>${escapeHtml(record.check_out_time ? formatTime(record.check_out_time) : '-')}</td>
            <td>${escapeHtml(statusText(record))}</td>
        </tr>`).join('');
        const counts = dailySummary
            ? `<p>Karyawan ${dailySummary.total_employees} · Hadir ${dailySummary.present} · Tidak Hadir ${dailySummary.absent} · Lengkap ${dailySummary.completed} · Izin Terlambat ${dailySummary.on_late} · Cuti ${dailySummary.on_leave} · Pengajuan Absensi ${dailySummary.on_manual}</p>`
            : '';
        const win = window.open('', '_blank');
        if (!win) {
            alert('Izinkan pop-up untuk mencetak');
            return;
        }
        win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; color: #1a1a2e; }
                h1 { font-size: 16px; text-align: center; margin: 0 0 6px; }
                p { font-size: 11px; text-align: center; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th, td { border: 1px solid #ccc; padding: 4px 6px; }
                th { background: #7f1d1d; color: #fff; }
            </style></head><body>
            <h1>${escapeHtml(title)}</h1>
            ${counts}
            <table><thead>${head}</thead><tbody>${body}</tbody></table>
            </body></html>`);
        win.document.close();
        win.focus();
        win.print();
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="BarChart3" size={16} inline /> Laporan Absensi</h1>
                <p className="page-subtitle">Lihat rekapitulasi absensi karyawan</p>
            </div>

            {/* Filter */}
            <div className="card report-filter-card mb-4">
                <div className="report-filters">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Jenis Laporan</label>
                        <select
                            className="form-input form-select"
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            style={{ minWidth: 150 }}
                        >
                            <option value="daily">Harian</option>
                            <option value="monthly">Bulanan</option>
                            <option value="off">Laporan Off/Cuti</option>
                            <option value="history">Riwayat Absensi</option>
                        </select>
                    </div>

                    {reportType === 'daily' ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Dari Tanggal</label>
                                <input type="date" className="form-input" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Sampai Tanggal</label>
                                <input type="date" className="form-input" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} />
                            </div>
                        </>
                    ) : reportType === 'monthly' ? (
                        <>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Bulan</label>
                                <select
                                    className="form-input form-select"
                                    value={month}
                                    onChange={(e) => setMonth(parseInt(e.target.value))}
                                    style={{ minWidth: 150 }}
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Tahun</label>
                                <select
                                    className="form-input form-select"
                                    value={year}
                                    onChange={(e) => setYear(parseInt(e.target.value))}
                                >
                                    {[2024, 2025, 2026].map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            {reportType === 'history' && (
                                <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                                    <label className="form-label">Karyawan</label>
                                    <select
                                        className="form-input form-select"
                                        value={historySelectedUser}
                                        onChange={(e) => setHistorySelectedUser(e.target.value)}
                                    >
                                        <option value="all">Semua Karyawan</option>
                                        {historyUsers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.employee_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Dari Tanggal</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Sampai Tanggal</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <div className="form-group">
                        <label className="form-label">Departemen</label>
                        <select className="form-input form-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                            <option value="">Semua Departemen</option>
                            {departmentOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Divisi</label>
                        <select className="form-input form-select" value={division} onChange={(e) => setDivision(e.target.value)}>
                            <option value="">Semua Divisi</option>
                            {divisionOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="form-group report-lookup">
                        <label className="form-label">Nama Karyawan</label>
                        <input
                            type="search"
                            className="form-input"
                            placeholder="Cari nama karyawan"
                            value={nameQuery}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    clearEmployeeLookup();
                                    return;
                                }
                                setNameQuery(e.target.value);
                                setSelectedEmployeeId('');
                                setLookupOpen(true);
                            }}
                            onFocus={() => setLookupOpen(true)}
                            onBlur={() => setTimeout(() => setLookupOpen(false), 150)}
                        />
                        {lookupOpen && (
                            <div className="report-lookup-list" onMouseDown={(event) => event.preventDefault()}>
                                {employeeMatches.length === 0 ? (
                                    <div className="report-lookup-empty">Karyawan tidak ditemukan</div>
                                ) : pagedEmployees.items.map((employee) => (
                                    <button
                                        type="button"
                                        key={employee.id}
                                        className="report-lookup-item"
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            chooseEmployee(employee);
                                        }}
                                    >
                                        <span>{employee.name}</span>
                                        <small>{employee.employee_id}{employee.department ? ` · ${employee.department}` : ''}{employee.division ? ` · ${employee.division}` : ''}</small>
                                    </button>
                                ))}
                                <div className="report-lookup-pages">
                                    <ListPagination
                                        page={pagedEmployees.pageSafe}
                                        total={employeeMatches.length}
                                        pageSize={6}
                                        onPageChange={setLookupPage}
                                        itemLabel="karyawan"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {dailySummary && (
                <div className="report-stat-grid">
                    <div className="card status-card">
                        <div className="status-card-icon primary"><Icon name="Users" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Total Karyawan</h3>
                            <p>{dailySummary.total_employees}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon success"><Icon name="Check" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Hadir</h3>
                            <p>{dailySummary.present}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon danger"><Icon name="X" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Tidak Hadir</h3>
                            <p>{dailySummary.absent}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon warning"><Icon name="Check" size={16} inline /><Icon name="Check" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Lengkap</h3>
                            <p>{dailySummary.completed}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon warning"><Icon name="Clock" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Izin Terlambat</h3>
                            <p>{dailySummary.on_late}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon primary"><Icon name="Palmtree" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Cuti</h3>
                            <p>{dailySummary.on_leave}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon secondary"><Icon name="ClipboardList" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Pengajuan Absensi</h3>
                            <p>{dailySummary.on_manual}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* History Summary Cards */}
            {report && reportType === 'history' && report.records && (
                <div className="grid grid-4 mb-4">
                    <div className="card status-card">
                        <div className="status-card-icon primary"><Icon name="ClipboardList" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Total Record</h3>
                            <p>{report.total || report.records.length}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon success"><Icon name="Check" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Hadir</h3>
                            <p>{report.records.filter(r => r.check_in_time).length}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon warning"><Icon name="Check" size={16} inline /><Icon name="Check" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>Lengkap</h3>
                            <p>{report.records.filter(r => r.check_in_time && r.check_out_time).length}</p>
                        </div>
                    </div>
                    <div className="card status-card">
                        <div className="status-card-icon primary"><Icon name="Palmtree" size={16} inline /></div>
                        <div className="status-card-content">
                            <h3>OFF</h3>
                            <p>{report.records.filter(r => r.is_off_day).length}</p>
                        </div>
                    </div>
                    {report.records.some(r => r.leave_type) && (
                        <div className="card status-card">
                            <div className="status-card-icon secondary"><Icon name="FileText" size={16} inline /></div>
                            <div className="status-card-content">
                                <h3>Izin/Cuti</h3>
                                <p>{report.records.filter(r => r.leave_type).length}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Report Table */}
            <div className="card">
                <div className="card-header report-card-header">
                    <h2 className="card-title">
                        {reportType === 'daily'
                            ? `Laporan ${formatIsoDate(dailyStart)}${dailyStart === dailyEnd ? '' : ` - ${formatIsoDate(dailyEnd)}`}`
                            : reportType === 'monthly'
                                ? `Laporan ${months[month - 1]} ${year}`
                                : reportType === 'history'
                                    ? `Riwayat Absensi: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}`
                                    : `Laporan Off: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}`
                        }
                    </h2>
                    <div className="report-export-actions">
                        <button
                            className="btn btn-outline"
                            onClick={handlePrint}
                            disabled={!report || visibleRecords.length === 0}
                        >
                            <Icon name="Printer" size={16} inline /> Print
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={handleExportPDF}
                            disabled={exporting || !report || visibleRecords.length === 0}
                        >
                            {exporting ? <Icon name="Hourglass" size={16} inline /> : <Icon name="FileText" size={16} inline />} PDF
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={handleExportExcel}
                            disabled={exporting || !report || visibleRecords.length === 0}
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
                        <div className="empty-state-icon"><Icon name="BarChart3" size={16} inline /></div>
                        <p className="empty-state-text">{error}</p>
                    </div>
                ) : !report || visibleRecords.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icon name="BarChart3" size={16} inline /></div>
                        <p className="empty-state-text">
                            {report?.records?.length ? 'Tidak ada karyawan yang cocok dengan filter ini.' : 'Tidak ada data untuk periode ini'}
                        </p>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const sortedRecords = pagedRecords.items;

                            // Render based on type
                            if (reportType === 'daily') {
                                return (
                                    <div className="table-container">
                                        <table className="table stack-table">
                                            <thead>
                                                <tr>
                                                    <th onClick={() => requestSort('report_date')} style={{ cursor: 'pointer' }}>
                                                        Tanggal {sortConfig.key === 'report_date' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('employee_id')} style={{ cursor: 'pointer' }}>
                                                        Employee ID {sortConfig.key === 'employee_id' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                                                        Nama {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('department')} style={{ cursor: 'pointer' }}>
                                                        Departemen {sortConfig.key === 'department' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('division')} style={{ cursor: 'pointer' }}>
                                                        Divisi {sortConfig.key === 'division' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('check_in_time')} style={{ cursor: 'pointer' }}>
                                                        Check-in {sortConfig.key === 'check_in_time' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('check_out_time')} style={{ cursor: 'pointer' }}>
                                                        Check-out {sortConfig.key === 'check_out_time' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('location_name')} style={{ cursor: 'pointer' }}>
                                                        Lokasi {sortConfig.key === 'location_name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedRecords.map((record) => (
                                                    <tr key={`${record.user_id}-${record.report_date}`}>
                                                        <td data-label="Tanggal">{record.report_date || '-'}</td>
                                                        <td data-label="Employee ID" style={{ fontWeight: 500 }}>{record.employee_id}</td>
                                                        <td data-label="Nama">{record.name}</td>
                                                        <td data-label="Departemen">{record.department || '-'}</td>
                                                        <td data-label="Divisi">{record.division || '-'}</td>
                                                        <td data-label="Check-in">
                                                            {record.check_in_time ? (
                                                                <div>
                                                                    <span>{formatTime(record.check_in_time)}</span>
                                                                    {!record.check_in_valid && (
                                                                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                                                                            <Icon name="AlertTriangle" size={16} inline />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Check-out">
                                                            {record.check_out_time ? (
                                                                <div>
                                                                    <span>{formatTime(record.check_out_time)}</span>
                                                                    {!record.check_out_valid && (
                                                                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                                                                            <Icon name="AlertTriangle" size={16} inline />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Lokasi">{record.location_name || '-'}</td>
                                                        <td data-label="Status">
                                                            <span className={`badge ${statusText(record) === 'Lengkap' ? 'badge-success' : statusText(record) === 'Tidak Hadir' ? 'badge-danger' : statusText(record) === 'Cuti' || statusText(record) === 'OFF' ? 'badge-primary' : 'badge-warning'}`}>
                                                                {statusText(record)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }

                            if (reportType === 'monthly') {
                                return (
                                    <div className="table-container">
                                        <table className="table stack-table">
                                            <thead>
                                                <tr>
                                                    <th onClick={() => requestSort('employee_id')} style={{ cursor: 'pointer' }}>
                                                        Employee ID {sortConfig.key === 'employee_id' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                                                        Nama {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th>Departemen</th>
                                                    <th>Divisi</th>
                                                    <th onClick={() => requestSort('total_present')} style={{ cursor: 'pointer' }}>
                                                        Hadir {sortConfig.key === 'total_present' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('total_absent')} style={{ cursor: 'pointer' }}>
                                                        Tidak Hadir {sortConfig.key === 'total_absent' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('valid_checkins')} style={{ cursor: 'pointer' }}>
                                                        Valid {sortConfig.key === 'valid_checkins' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('invalid_checkins')} style={{ cursor: 'pointer' }}>
                                                        Diluar Area {sortConfig.key === 'invalid_checkins' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('attendance_rate')} style={{ cursor: 'pointer' }}>
                                                        Persentase {sortConfig.key === 'attendance_rate' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedRecords.map((record) => (
                                                    <tr key={record.user_id}>
                                                        <td data-label="Employee ID" style={{ fontWeight: 500 }}>{record.employee_id}</td>
                                                        <td data-label="Nama">{record.name}</td>
                                                        <td data-label="Departemen">{record.department || '-'}</td>
                                                        <td data-label="Divisi">{record.division || '-'}</td>
                                                        <td data-label="Hadir">{record.total_present}</td>
                                                        <td data-label="Tidak Hadir">{record.total_absent}</td>
                                                        <td data-label="Valid">{record.valid_checkins}</td>
                                                        <td data-label="Diluar Area">{record.invalid_checkins}</td>
                                                        <td data-label="Persentase">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{
                                                                    width: 60,
                                                                    height: 6,
                                                                    background: 'var(--gray-700)',
                                                                    borderRadius: 3,
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        width: `${record.attendance_rate}%`,
                                                                        height: '100%',
                                                                        background: record.attendance_rate >= 80
                                                                            ? 'var(--success-500)'
                                                                            : record.attendance_rate >= 60
                                                                                ? 'var(--warning-500)'
                                                                                : 'var(--danger-500)'
                                                                    }} />
                                                                </div>
                                                                <span>{record.attendance_rate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }

                            if (reportType === 'history') {
                                return (
                                    <div className="table-container">
                                        <table className="table stack-table">
                                            <thead>
                                                <tr>
                                                    <th onClick={() => requestSort('attendance_date')} style={{ cursor: 'pointer' }}>
                                                        Tanggal {sortConfig.key === 'attendance_date' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('employee_id')} style={{ cursor: 'pointer' }}>
                                                        ID Karyawan {sortConfig.key === 'employee_id' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                                                        Nama {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th>Departemen</th>
                                                    <th>Divisi</th>
                                                    <th>Check-in</th>
                                                    <th>Check-out</th>
                                                    <th onClick={() => requestSort('location_name')} style={{ cursor: 'pointer' }}>
                                                        Lokasi {sortConfig.key === 'location_name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                    </th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedRecords.map((record, index) => (
                                                    <tr key={`${record.user_id}-${record.attendance_date}-${index}`}>
                                                        <td data-label="Tanggal">{formatDateShort(record.attendance_date)}</td>
                                                        <td data-label="ID Karyawan" style={{ fontWeight: 500 }}>{record.employee_id}</td>
                                                        <td data-label="Nama">{record.name}</td>
                                                        <td data-label="Departemen">{record.department || '-'}</td>
                                                        <td data-label="Divisi">{record.division || '-'}</td>
                                                        <td data-label="Check-in">
                                                            {record.is_off_day ? (
                                                                <span className="text-muted">OFF</span>
                                                            ) : record.leave_type ? (
                                                                <span className="text-muted">IZIN</span>
                                                            ) : record.check_in_time ? (
                                                                <div>
                                                                    <span>{formatTime(record.check_in_time)}</span>
                                                                    {!record.check_in_valid && (
                                                                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                                                                            <Icon name="AlertTriangle" size={16} inline />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Check-out">
                                                            {record.is_off_day ? (
                                                                <span className="text-muted">OFF</span>
                                                            ) : record.leave_type ? (
                                                                <span className="text-muted">IZIN</span>
                                                            ) : record.check_out_time ? (
                                                                <span>{formatTime(record.check_out_time)}</span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Lokasi">{record.location_name || '-'}</td>
                                                        <td data-label="Status">
                                                            {record.is_off_day ? (
                                                                <span className="badge badge-primary"><Icon name="Palmtree" size={16} inline /> OFF</span>
                                                            ) : record.leave_type === 'late' ? (
                                                                <span className="badge badge-warning"><Icon name="Clock" size={16} inline /> Izin Terlambat</span>
                                                            ) : record.leave_type === 'sick' ? (
                                                                <span className="badge badge-danger"><Icon name="HeartPulse" size={16} inline /> Izin Sakit</span>
                                                            ) : record.leave_type === 'leave' ? (
                                                                <span className="badge badge-primary"><Icon name="Palmtree" size={16} inline /> Cuti</span>
                                                            ) : record.leave_type === 'change_off' ? (
                                                                <span className="badge badge-secondary"><Icon name="Repeat" size={16} inline /> Tukar Libur</span>
                                                            ) : record.leave_type ? (
                                                                <span className="badge badge-secondary"><Icon name="FileText" size={16} inline /> Izin</span>
                                                            ) : record.check_in_time && record.check_out_time ? (
                                                                <span className="badge badge-success"><Icon name="CheckCircle2" size={16} inline /> Lengkap</span>
                                                            ) : record.check_in_time ? (
                                                                <span className="badge badge-warning"><Icon name="Hourglass" size={16} inline /> Belum Pulang</span>
                                                            ) : (
                                                                <span className="badge badge-danger"><Icon name="XCircle" size={16} inline /> Tidak Hadir</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }

                            return (
                                    <div className="table-container">
                                    <table className="table stack-table">
                                        <thead>
                                            <tr>
                                                <th onClick={() => requestSort('off_date')} style={{ cursor: 'pointer' }}>
                                                    Tanggal {sortConfig.key === 'off_date' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                </th>
                                                <th onClick={() => requestSort('employee_id')} style={{ cursor: 'pointer' }}>
                                                    ID Karyawan {sortConfig.key === 'employee_id' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                </th>
                                                    <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                                                    Nama {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                </th>
                                                <th>Departemen</th>
                                                <th>Divisi</th>
                                                <th onClick={() => requestSort('type')} style={{ cursor: 'pointer' }}>
                                                    Kategori {sortConfig.key === 'type' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                </th>
                                                <th onClick={() => requestSort('reason')} style={{ cursor: 'pointer' }}>
                                                    Keterangan {sortConfig.key === 'reason' && (sortConfig.direction === 'ascending' ? <Icon name="ChevronUp" size={12} /> : <Icon name="ChevronDown" size={12} />)}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRecords.map((record, index) => (
                                                <tr key={index}>
                                                    <td data-label="Tanggal">{new Date(record.off_date).toLocaleDateString('id-ID', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}</td>
                                                    <td data-label="ID Karyawan" style={{ fontWeight: 500 }}>{record.employee_id}</td>
                                                    <td data-label="Nama">{record.name}</td>
                                                    <td data-label="Departemen">{record.department || '-'}</td>
                                                    <td data-label="Divisi">{record.division || '-'}</td>
                                                    <td data-label="Kategori">
                                                        {record.type === 'off_day' ? (
                                                            <span className="badge badge-primary">Libur Rutin</span>
                                                        ) : record.category === 'sick' ? (
                                                            <span className="badge badge-danger">Sakit</span>
                                                        ) : record.category === 'leave' ? (
                                                            <span className="badge badge-warning">Cuti</span>
                                                        ) : (
                                                            <span className="badge badge-secondary">{record.category}</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Keterangan">{record.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                        <ListPagination
                            page={pagedRecords.pageSafe}
                            total={sortedRecords.length}
                            onPageChange={setPage}
                            itemLabel="baris"
                        />
                    </>
                )}
            </div>
        </div>
    );
}
