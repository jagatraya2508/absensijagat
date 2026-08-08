import { useState, useEffect, useCallback } from 'react';
import { dailyWorkReportAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CATEGORY_MAP = {
    task: { label: 'Task', icon: '📋', color: '#3b82f6' },
    meeting: { label: 'Meeting', icon: '👥', color: '#8b5cf6' },
    admin: { label: 'Administrasi', icon: '📁', color: '#f59e0b' },
    other: { label: 'Lainnya', icon: '📌', color: '#6b7280' }
};

const STATUS_MAP = {
    completed: { label: 'Selesai', icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    in_progress: { label: 'Dikerjakan', icon: '🔄', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    pending: { label: 'Pending', icon: '⏳', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    blocked: { label: 'Blocked', icon: '🚫', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
};

const PRIORITY_MAP = {
    urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    high: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    medium: { label: 'Medium', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    low: { label: 'Low', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
};

const REPORT_STATUS_MAP = {
    draft: { label: 'Draft', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    submitted: { label: 'Submitted', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    reviewed: { label: 'Reviewed', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
};

export default function DailyWorkReport() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentReport, setCurrentReport] = useState(null);
    const [reports, setReports] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);
    const [scheduleItems, setScheduleItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [summary, setSummary] = useState('');

    const [itemForm, setItemForm] = useState({
        title: '', description: '', category: 'task',
        start_time: '', end_time: '', status: 'completed',
        priority: 'medium', due_date: '', completion_percentage: 0, notes: ''
    });

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const data = await dailyWorkReportAPI.getAll({ start_date: selectedDate, end_date: selectedDate });
            if (data.length > 0) {
                const detail = await dailyWorkReportAPI.getById(data[0].id);
                setCurrentReport(detail);
                setSummary(detail.summary || '');
            } else {
                setCurrentReport(null);
                setSummary('');
            }
        } catch (e) {
            console.error('Error fetching report:', e);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    const fetchPending = useCallback(async () => {
        try {
            const data = await dailyWorkReportAPI.getPending();
            setPendingItems(data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchSchedule = useCallback(async () => {
        try {
            const data = await dailyWorkReportAPI.getSchedule(30);
            setScheduleItems(data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchReportHistory = useCallback(async () => {
        try {
            const data = await dailyWorkReportAPI.getAll({});
            setReports(data);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        if (activeTab === 'pending') fetchPending();
        if (activeTab === 'schedule') fetchSchedule();
        if (activeTab === 'daily') fetchReportHistory();
    }, [activeTab, fetchPending, fetchSchedule, fetchReportHistory]);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    async function handleCreateReport() {
        try {
            setSaving(true);
            const result = await dailyWorkReportAPI.create({ report_date: selectedDate, summary: '' });
            const detail = await dailyWorkReportAPI.getById(result.id);
            setCurrentReport(detail);
            setSummary('');
            setSuccess('Laporan harian berhasil dibuat');
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveSummary() {
        if (!currentReport) return;
        try {
            setSaving(true);
            await dailyWorkReportAPI.update(currentReport.id, { summary });
            setSuccess('Ringkasan berhasil disimpan');
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmitReport() {
        if (!currentReport) return;
        try {
            setSaving(true);
            await dailyWorkReportAPI.update(currentReport.id, { summary, status: 'submitted' });
            await fetchReport();
            setSuccess('Laporan berhasil disubmit');
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    function openAddItem() {
        setEditingItem(null);
        setItemForm({
            title: '', description: '', category: 'task',
            start_time: '', end_time: '', status: 'completed',
            priority: 'medium', due_date: '', completion_percentage: 0, notes: ''
        });
        setShowItemModal(true);
        setError('');
    }

    function openEditItem(item) {
        setEditingItem(item);
        setItemForm({
            title: item.title || '',
            description: item.description || '',
            category: item.category || 'task',
            start_time: item.start_time ? item.start_time.substring(0, 5) : '',
            end_time: item.end_time ? item.end_time.substring(0, 5) : '',
            status: item.status || 'completed',
            priority: item.priority || 'medium',
            due_date: item.due_date ? item.due_date.split('T')[0] : '',
            completion_percentage: item.completion_percentage || 0,
            notes: item.notes || ''
        });
        setShowItemModal(true);
        setError('');
    }

    async function handleSaveItem(e) {
        e.preventDefault();
        if (!itemForm.title.trim()) {
            setError('Judul pekerjaan wajib diisi');
            return;
        }
        try {
            setSaving(true);
            setError('');
            const payload = {
                ...itemForm,
                start_time: itemForm.start_time || null,
                end_time: itemForm.end_time || null,
                due_date: itemForm.due_date || null,
                completion_percentage: itemForm.status === 'completed' ? 100 : Number(itemForm.completion_percentage)
            };

            if (editingItem) {
                await dailyWorkReportAPI.updateItem(editingItem.id, payload);
                setSuccess('Item pekerjaan berhasil diupdate');
            } else {
                await dailyWorkReportAPI.addItem(currentReport.id, payload);
                setSuccess('Item pekerjaan berhasil ditambah');
            }
            setShowItemModal(false);
            await fetchReport();
            if (activeTab === 'pending') fetchPending();
            if (activeTab === 'schedule') fetchSchedule();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteItem(itemId) {
        if (!confirm('Hapus item pekerjaan ini?')) return;
        try {
            await dailyWorkReportAPI.deleteItem(itemId);
            setSuccess('Item berhasil dihapus');
            await fetchReport();
            if (activeTab === 'pending') fetchPending();
        } catch (e) {
            setError(e.message);
        }
    }

    async function handleDeleteReport() {
        if (!currentReport) return;
        if (!confirm('Hapus laporan harian ini beserta semua item di dalamnya?')) return;
        try {
            await dailyWorkReportAPI.delete(currentReport.id);
            setCurrentReport(null);
            setSummary('');
            setSuccess('Laporan berhasil dihapus');
        } catch (e) {
            setError(e.message);
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function handleExportExcel() {
        if (!currentReport || !currentReport.items) return;
        try {
            const pendingDataRaw = await dailyWorkReportAPI.getPending();
            const todayItemIds = new Set(currentReport.items.map(i => i.id));
            const pendingData = pendingDataRaw.filter(item => !todayItemIds.has(item.id));
            
            const department = user?.department || '-';
            
            const wsData = [];
            wsData.push([`Activity Daily Divisi ${department}`]);
            wsData.push(['Date', formatShortDate(selectedDate)]);
            wsData.push([]); 
            
            const headers = ['No', 'Jam Mulai', 'Jam Selesai', 'Pekerjaan', 'Kategori', 'Status', 'Prioritas', 'Progress (%)'];
            wsData.push(headers);
            
            currentReport.items.forEach((item, index) => {
                wsData.push([
                    index + 1,
                    item.start_time ? item.start_time.substring(0, 5) : '-',
                    item.end_time ? item.end_time.substring(0, 5) : '-',
                    item.title + (item.description ? `\n${item.description}` : ''),
                    CATEGORY_MAP[item.category]?.label || item.category,
                    STATUS_MAP[item.status]?.label || item.status,
                    PRIORITY_MAP[item.priority]?.label || item.priority,
                    item.completion_percentage
                ]);
            });
            
            wsData.push([]);
            wsData.push(['Pekerjaan Pending']);
            wsData.push(headers);
            
            pendingData.forEach((item, index) => {
                wsData.push([
                    index + 1,
                    item.start_time ? item.start_time.substring(0, 5) : '-',
                    item.end_time ? item.end_time.substring(0, 5) : '-',
                    item.title + (item.description ? `\n${item.description}` : ''),
                    CATEGORY_MAP[item.category]?.label || item.category,
                    STATUS_MAP[item.status]?.label || item.status,
                    PRIORITY_MAP[item.priority]?.label || item.priority,
                    item.completion_percentage
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            if(!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }); 
            ws['!merges'].push({ s: { r: currentReport.items.length + 5, c: 0 }, e: { r: currentReport.items.length + 5, c: 7 } }); 
            
            ws['!cols'] = [ { wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 } ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');
            XLSX.writeFile(wb, `Laporan_Harian_Saya_${selectedDate}.xlsx`);
        } catch (error) {
            console.error('Failed to export Excel:', error);
            alert('Gagal export Excel');
        }
    }

    async function handleExportPDF() {
        if (!currentReport || !currentReport.items) return;
        try {
            const pendingDataRaw = await dailyWorkReportAPI.getPending();
            const todayItemIds = new Set(currentReport.items.map(i => i.id));
            const pendingData = pendingDataRaw.filter(item => !todayItemIds.has(item.id));
            
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const department = user?.department || '-';

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(`Activity Daily Divisi ${department}`, pageWidth / 2, 15, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Date: ${formatShortDate(selectedDate)}`, 15, 22);

            const tableColumn = ['No', 'Jam Mulai', 'Jam Selesai', 'Pekerjaan', 'Kategori', 'Status', 'Prioritas', 'Progress'];
            
            const formatRow = (item, i) => [
                i + 1, 
                item.start_time ? item.start_time.substring(0, 5) : '-',
                item.end_time ? item.end_time.substring(0, 5) : '-',
                item.title + (item.description ? `\n(${item.description})` : ''), 
                CATEGORY_MAP[item.category]?.label || item.category,
                STATUS_MAP[item.status]?.label || item.status, 
                PRIORITY_MAP[item.priority]?.label || item.priority,
                `${item.completion_percentage}%`
            ];

            const table1Rows = currentReport.items.map(formatRow);

            doc.autoTable({
                head: [tableColumn],
                body: table1Rows,
                startY: 28,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
                headStyles: { fillColor: [200, 200, 200], textColor: 20, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { halign: 'center', cellWidth: 10 } }
            });

            const finalY = doc.lastAutoTable.finalY || 30;

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text('Pekerjaan Pending', pageWidth / 2, finalY + 12, { align: 'center' });

            const table2Rows = pendingData.map(formatRow);

            doc.autoTable({
                head: [tableColumn],
                body: table2Rows,
                startY: finalY + 18,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
                headStyles: { fillColor: [200, 200, 200], textColor: 20, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { halign: 'center', cellWidth: 10 } }
            });

            doc.save(`Laporan_Harian_Saya_${selectedDate}.pdf`);
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Gagal export PDF');
        }
    }

    async function handlePrint() {
        if (!currentReport || !currentReport.items) return;
        try {
            const pendingDataRaw = await dailyWorkReportAPI.getPending();
            const todayItemIds = new Set(currentReport.items.map(i => i.id));
            const pendingData = pendingDataRaw.filter(item => !todayItemIds.has(item.id));
            
            const department = user?.department || '-';
            
            const formatRowHtml = (item, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${item.start_time ? item.start_time.substring(0, 5) : '-'}</td>
                    <td class="text-center">${item.end_time ? item.end_time.substring(0, 5) : '-'}</td>
                    <td>${item.title}${item.description ? '<br><small style="color:#666">' + item.description + '</small>' : ''}</td>
                    <td class="text-center">${CATEGORY_MAP[item.category]?.label || item.category}</td>
                    <td class="text-center">${STATUS_MAP[item.status]?.label || item.status}</td>
                    <td class="text-center">${PRIORITY_MAP[item.priority]?.label || item.priority}</td>
                    <td class="text-center">${item.completion_percentage}%</td>
                </tr>
            `;

            const tableHeaders = `
                <tr>
                    <th style="width: 40px;">No</th>
                    <th style="width: 70px;">Jam Mulai</th>
                    <th style="width: 70px;">Jam Selesai</th>
                    <th>Pekerjaan</th>
                    <th style="width: 90px;">Kategori</th>
                    <th style="width: 90px;">Status</th>
                    <th style="width: 80px;">Prioritas</th>
                    <th style="width: 70px;">Progress</th>
                </tr>
            `;

            let html = `
                <html>
                <head>
                    <title>Print Laporan Harian</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h3 { text-align: center; margin-bottom: 5px; }
                        .date { margin-bottom: 20px; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { border: 1px solid black; padding: 6px; text-align: left; font-size: 13px; }
                        th { background-color: #d1d5db; text-align: center; font-weight: bold; }
                        .text-center { text-align: center; }
                    </style>
                </head>
                <body>
                    <h3>Activity Daily Divisi ${department}</h3>
                    <div class="date">Date: ${formatShortDate(selectedDate)}</div>
                    
                    <table>
                        <thead>${tableHeaders}</thead>
                        <tbody>
            `;
            
            currentReport.items.forEach((item, i) => { html += formatRowHtml(item, i); });
            
            html += `
                        </tbody>
                    </table>

                    <h3 style="margin-top: 40px;">Pekerjaan Pending</h3>
                    <table>
                        <thead>${tableHeaders}</thead>
                        <tbody>
            `;
            
            pendingData.forEach((item, i) => { html += formatRowHtml(item, i); });
            
            html += `
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
                    </script>
                </body>
                </html>
            `;
            
            const printWin = window.open('', '_blank');
            printWin.document.write(html);
            printWin.document.close();
        } catch (e) {
            console.error(e);
            alert('Gagal menyiapkan print');
        }
    }

    function isOverdue(dueDate) {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]);
    }

    function getDaysLeft(dueDate) {
        if (!dueDate) return null;
        const diff = Math.ceil((new Date(dueDate) - new Date(new Date().toISOString().split('T')[0])) / (1000 * 60 * 60 * 24));
        return diff;
    }

    // ============================================
    // RENDER
    // ============================================

    const tabItems = [
        { key: 'daily', label: 'Laporan Hari Ini', icon: '📋' },
        { key: 'pending', label: 'Pekerjaan Pending', icon: '⏳' },
        { key: 'schedule', label: 'Jadwal Penyelesaian', icon: '📅' }
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>📝 Laporan Kerjaan Harian</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    Catat dan lacak pekerjaan harian Anda
                </p>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅</span> {success}
                </div>
            )}
            {error && !showItemModal && (
                <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>❌</span> {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: 4, border: '1px solid var(--border-color)' }}>
                {tabItems.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, padding: '10px 16px', border: 'none', borderRadius: 'var(--radius-md)',
                            background: activeTab === tab.key ? 'var(--theme-primary)' : 'transparent',
                            color: activeTab === tab.key ? 'white' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.key ? 700 : 500,
                            cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.25s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* ========== TAB 1: DAILY REPORT ========== */}
            {activeTab === 'daily' && (
                <div>
                    {/* Date Picker + Report Status */}
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>📅 Tanggal:</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="form-input"
                                    style={{ width: 'auto' }}
                                />
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {formatDate(selectedDate)}
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {currentReport && (
                                    <span style={{
                                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                        background: REPORT_STATUS_MAP[currentReport.status]?.bg,
                                        color: REPORT_STATUS_MAP[currentReport.status]?.color
                                    }}>
                                        {REPORT_STATUS_MAP[currentReport.status]?.label}
                                    </span>
                                )}
                                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                    <button className="btn btn-outline" onClick={handleExportPDF} style={{ fontSize: '0.8rem', padding: '4px 10px' }} title="Export PDF" disabled={!currentReport || !currentReport.items}>
                                        📄 PDF
                                    </button>
                                    <button className="btn btn-outline" onClick={handleExportExcel} style={{ fontSize: '0.8rem', padding: '4px 10px' }} title="Export Excel" disabled={!currentReport || !currentReport.items}>
                                        📊 Excel
                                    </button>
                                    <button className="btn btn-outline" onClick={handlePrint} style={{ fontSize: '0.8rem', padding: '4px 10px' }} title="Print / Cetak">
                                        🖨️ Cetak
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                            <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
                            <p style={{ color: 'var(--text-secondary)' }}>Memuat laporan...</p>
                        </div>
                    ) : !currentReport ? (
                        /* No report yet for this date */
                        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                            <h3 style={{ marginBottom: 8 }}>Belum ada laporan untuk tanggal ini</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Buat laporan kerjaan harian untuk mencatat aktivitas Anda
                            </p>
                            <button className="btn btn-primary" onClick={handleCreateReport} disabled={saving}>
                                {saving ? 'Membuat...' : '+ Buat Laporan Harian'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 8, fontSize: '0.9rem' }}>📝 Ringkasan Hari Ini</h3>
                                <textarea
                                    value={summary}
                                    onChange={e => setSummary(e.target.value)}
                                    placeholder="Tuliskan ringkasan pekerjaan hari ini..."
                                    className="form-input"
                                    rows={3}
                                    style={{ resize: 'vertical', width: '100%' }}
                                    disabled={currentReport.status === 'reviewed'}
                                />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary" onClick={handleSaveSummary} disabled={saving || currentReport.status === 'reviewed'} style={{ fontSize: '0.82rem' }}>
                                        💾 Simpan Ringkasan
                                    </button>
                                    {currentReport.status === 'draft' && (
                                        <button className="btn btn-primary" onClick={handleSubmitReport} disabled={saving} style={{ fontSize: '0.82rem' }}>
                                            📤 Submit Laporan
                                        </button>
                                    )}
                                    {currentReport.status === 'draft' && (
                                        <button className="btn btn-danger" onClick={handleDeleteReport} disabled={saving} style={{ fontSize: '0.82rem', marginLeft: 'auto' }}>
                                            🗑️ Hapus
                                        </button>
                                    )}
                                </div>

                                {/* Review notes if reviewed */}
                                {currentReport.status === 'reviewed' && currentReport.review_notes && (
                                    <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#10b981', marginBottom: 4 }}>
                                            💬 Catatan Review dari {currentReport.reviewer_name || 'Admin'}:
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}>{currentReport.review_notes}</div>
                                    </div>
                                )}
                            </div>

                            {/* Timeline Table */}
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: '0.9rem' }}>⏰ Timeline Pekerjaan</h3>
                                    {currentReport.status !== 'reviewed' && (
                                        <button className="btn btn-primary" onClick={openAddItem} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                                            + Tambah Pekerjaan
                                        </button>
                                    )}
                                </div>

                                {(!currentReport.items || currentReport.items.length === 0) ? (
                                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                                        <p>Belum ada item pekerjaan</p>
                                        <p style={{ fontSize: '0.8rem' }}>Klik "Tambah Pekerjaan" untuk memulai</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: 80 }}>Jam Mulai</th>
                                                    <th style={{ width: 80 }}>Jam Selesai</th>
                                                    <th>Pekerjaan</th>
                                                    <th style={{ width: 90 }}>Kategori</th>
                                                    <th style={{ width: 100 }}>Status</th>
                                                    <th style={{ width: 80 }}>Prioritas</th>
                                                    <th style={{ width: 90 }}>Progress</th>
                                                    {currentReport.status !== 'reviewed' && <th style={{ width: 80 }}>Aksi</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentReport.items.map(item => (
                                                    <tr key={item.id}>
                                                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                                                            {item.start_time ? item.start_time.substring(0, 5) : '-'}
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                                                            {item.end_time ? item.end_time.substring(0, 5) : '-'}
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.title}</div>
                                                            {item.description && (
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                                    {item.description.substring(0, 80)}{item.description.length > 80 ? '...' : ''}
                                                                </div>
                                                            )}
                                                            {item.due_date && (
                                                                <div style={{
                                                                    fontSize: '0.72rem', marginTop: 3,
                                                                    color: isOverdue(item.due_date) ? '#ef4444' : 'var(--text-secondary)'
                                                                }}>
                                                                    📅 Due: {formatShortDate(item.due_date)}
                                                                    {isOverdue(item.due_date) && ' (Overdue!)'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                fontSize: '0.75rem', padding: '3px 8px', borderRadius: 12,
                                                                background: `${CATEGORY_MAP[item.category]?.color}18`,
                                                                color: CATEGORY_MAP[item.category]?.color
                                                            }}>
                                                                {CATEGORY_MAP[item.category]?.icon} {CATEGORY_MAP[item.category]?.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                fontSize: '0.75rem', padding: '3px 8px', borderRadius: 12,
                                                                background: STATUS_MAP[item.status]?.bg,
                                                                color: STATUS_MAP[item.status]?.color, fontWeight: 600
                                                            }}>
                                                                {STATUS_MAP[item.status]?.icon} {STATUS_MAP[item.status]?.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10,
                                                                background: PRIORITY_MAP[item.priority]?.bg,
                                                                color: PRIORITY_MAP[item.priority]?.color, fontWeight: 600
                                                            }}>
                                                                {PRIORITY_MAP[item.priority]?.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div style={{
                                                                    flex: 1, height: 6, borderRadius: 3,
                                                                    background: 'var(--border-color)', overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        height: '100%', borderRadius: 3,
                                                                        width: `${item.completion_percentage}%`,
                                                                        background: item.completion_percentage === 100 ? '#10b981' :
                                                                            item.completion_percentage >= 50 ? '#f59e0b' : '#ef4444',
                                                                        transition: 'width 0.3s ease'
                                                                    }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, minWidth: 32 }}>
                                                                    {item.completion_percentage}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {currentReport.status !== 'reviewed' && (
                                                            <td>
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    <button
                                                                        className="btn btn-secondary"
                                                                        onClick={() => openEditItem(item)}
                                                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                                        title="Edit"
                                                                    >✏️</button>
                                                                    <button
                                                                        className="btn btn-danger"
                                                                        onClick={() => handleDeleteItem(item.id)}
                                                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                                        title="Hapus"
                                                                    >🗑️</button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Recent Reports History */}
                            <div className="card" style={{ marginTop: 16 }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>📊 Riwayat Laporan</h3>
                                {reports.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Belum ada riwayat laporan</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {reports.slice(0, 10).map(r => (
                                            <div
                                                key={r.id}
                                                onClick={() => setSelectedDate(r.report_date.split('T')[0])}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                                    background: r.report_date.split('T')[0] === selectedDate ? 'var(--theme-primary-alpha)' : 'var(--bg-secondary)',
                                                    border: r.report_date.split('T')[0] === selectedDate ? '1px solid var(--theme-primary)' : '1px solid transparent',
                                                    cursor: 'pointer', transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, minWidth: 120 }}>
                                                    {formatShortDate(r.report_date)}
                                                </div>
                                                <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    {r.item_count || 0} item • {r.pending_count || 0} pending
                                                </div>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                                                    background: REPORT_STATUS_MAP[r.status]?.bg,
                                                    color: REPORT_STATUS_MAP[r.status]?.color
                                                }}>
                                                    {REPORT_STATUS_MAP[r.status]?.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ========== TAB 2: PENDING ITEMS ========== */}
            {activeTab === 'pending' && (
                <div>
                    {pendingItems.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                            <h3 style={{ marginBottom: 8 }}>Tidak ada pekerjaan pending!</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Semua pekerjaan Anda sudah selesai. Kerja bagus!
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                                {['pending', 'in_progress', 'blocked'].map(s => {
                                    const count = pendingItems.filter(i => i.status === s).length;
                                    return (
                                        <div key={s} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                                            <div style={{ fontSize: 24 }}>{STATUS_MAP[s]?.icon}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: STATUS_MAP[s]?.color }}>{count}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{STATUS_MAP[s]?.label}</div>
                                        </div>
                                    );
                                })}
                                <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                                    <div style={{ fontSize: 24 }}>🔥</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>
                                        {pendingItems.filter(i => isOverdue(i.due_date)).length}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overdue</div>
                                </div>
                            </div>

                            {/* Group by Priority */}
                            {['urgent', 'high', 'medium', 'low'].map(priority => {
                                const items = pendingItems.filter(i => i.priority === priority);
                                if (items.length === 0) return null;
                                return (
                                    <div key={priority} style={{ marginBottom: 16 }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                                            padding: '6px 12px', borderRadius: 'var(--radius-md)',
                                            background: PRIORITY_MAP[priority]?.bg
                                        }}>
                                            <span style={{ fontWeight: 700, color: PRIORITY_MAP[priority]?.color, fontSize: '0.82rem' }}>
                                                {PRIORITY_MAP[priority]?.label} Priority
                                            </span>
                                            <span style={{
                                                background: PRIORITY_MAP[priority]?.color, color: 'white',
                                                padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700
                                            }}>
                                                {items.length}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {items.map(item => (
                                                <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.title}</span>
                                                                <span style={{
                                                                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                                                                    background: STATUS_MAP[item.status]?.bg,
                                                                    color: STATUS_MAP[item.status]?.color, fontWeight: 600
                                                                }}>
                                                                    {STATUS_MAP[item.status]?.icon} {STATUS_MAP[item.status]?.label}
                                                                </span>
                                                            </div>
                                                            {item.description && (
                                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                    📋 Dari: {formatShortDate(item.report_date)}
                                                                </span>
                                                                {item.due_date && (
                                                                    <span style={{
                                                                        fontSize: '0.75rem', fontWeight: 600,
                                                                        color: isOverdue(item.due_date) ? '#ef4444' : getDaysLeft(item.due_date) <= 3 ? '#f59e0b' : 'var(--text-secondary)'
                                                                    }}>
                                                                        📅 Due: {formatShortDate(item.due_date)}
                                                                        {isOverdue(item.due_date) && ' ⚠️ OVERDUE'}
                                                                        {!isOverdue(item.due_date) && getDaysLeft(item.due_date) !== null && (
                                                                            <> ({getDaysLeft(item.due_date)} hari lagi)</>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', minWidth: 80 }}>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: item.completion_percentage >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                                {item.completion_percentage}%
                                                            </div>
                                                            <div style={{
                                                                height: 6, borderRadius: 3, background: 'var(--border-color)',
                                                                overflow: 'hidden', marginTop: 4
                                                            }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 3,
                                                                    width: `${item.completion_percentage}%`,
                                                                    background: item.completion_percentage >= 50 ? '#f59e0b' : '#ef4444',
                                                                    transition: 'width 0.3s ease'
                                                                }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ========== TAB 3: SCHEDULE ========== */}
            {activeTab === 'schedule' && (
                <div>
                    {scheduleItems.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                            <h3 style={{ marginBottom: 8 }}>Tidak ada jadwal penyelesaian</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Tidak ada pekerjaan pending dengan due date dalam 30 hari ke depan
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Group by date */}
                            {(() => {
                                const grouped = {};
                                scheduleItems.forEach(item => {
                                    const date = item.due_date?.split('T')[0] || 'no-date';
                                    if (!grouped[date]) grouped[date] = [];
                                    grouped[date].push(item);
                                });

                                return Object.entries(grouped).map(([date, items]) => {
                                    const overdue = isOverdue(date);
                                    const daysLeft = getDaysLeft(date);
                                    const isToday = date === new Date().toISOString().split('T')[0];

                                    return (
                                        <div key={date} style={{ marginBottom: 16 }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                                                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                                background: overdue ? 'rgba(239,68,68,0.1)' : isToday ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                                                borderLeft: `4px solid ${overdue ? '#ef4444' : isToday ? '#3b82f6' : 'var(--border-color)'}`
                                            }}>
                                                <span style={{ fontSize: '1.2em' }}>{overdue ? '🔥' : isToday ? '📌' : '📅'}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: overdue ? '#ef4444' : 'var(--text-primary)' }}>
                                                        {formatDate(date)}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: overdue ? '#ef4444' : 'var(--text-secondary)' }}>
                                                        {overdue ? `Overdue ${Math.abs(daysLeft)} hari!` : isToday ? 'Hari ini' : `${daysLeft} hari lagi`}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    marginLeft: 'auto', background: overdue ? '#ef4444' : isToday ? '#3b82f6' : 'var(--text-secondary)',
                                                    color: 'white', padding: '2px 10px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700
                                                }}>
                                                    {items.length} item
                                                </span>
                                            </div>

                                            <div style={{ display: 'grid', gap: 6, paddingLeft: 20 }}>
                                                {items.map(item => (
                                                    <div key={item.id} className="card" style={{
                                                        padding: '12px 16px',
                                                        borderLeft: `3px solid ${PRIORITY_MAP[item.priority]?.color || '#6b7280'}`
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{item.title}</span>
                                                            <span style={{
                                                                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                                                                background: PRIORITY_MAP[item.priority]?.bg,
                                                                color: PRIORITY_MAP[item.priority]?.color, fontWeight: 600
                                                            }}>
                                                                {PRIORITY_MAP[item.priority]?.label}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                                                                background: STATUS_MAP[item.status]?.bg,
                                                                color: STATUS_MAP[item.status]?.color, fontWeight: 600
                                                            }}>
                                                                {STATUS_MAP[item.status]?.icon} {STATUS_MAP[item.status]?.label}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                                            <div style={{
                                                                flex: 1, height: 5, borderRadius: 3,
                                                                background: 'var(--border-color)', overflow: 'hidden'
                                                            }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 3,
                                                                    width: `${item.completion_percentage}%`,
                                                                    background: item.completion_percentage >= 75 ? '#10b981' :
                                                                        item.completion_percentage >= 50 ? '#f59e0b' : '#ef4444',
                                                                    transition: 'width 0.3s ease'
                                                                }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                                                {item.completion_percentage}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </>
                    )}
                </div>
            )}

            {/* ========== MODAL: Add/Edit Item ========== */}
            {showItemModal && (
                <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h3>{editingItem ? '✏️ Edit Pekerjaan' : '➕ Tambah Pekerjaan'}</h3>
                            <button className="modal-close" onClick={() => setShowItemModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSaveItem}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                                        {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Judul Pekerjaan *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={itemForm.title}
                                        onChange={e => setItemForm({ ...itemForm, title: e.target.value })}
                                        placeholder="Contoh: Review dokumen pengajuan"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Deskripsi</label>
                                    <textarea
                                        className="form-input"
                                        value={itemForm.description}
                                        onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                                        placeholder="Detail pekerjaan..."
                                        rows={2}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Jam Mulai</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={itemForm.start_time}
                                            onChange={e => setItemForm({ ...itemForm, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Jam Selesai</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={itemForm.end_time}
                                            onChange={e => setItemForm({ ...itemForm, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Kategori</label>
                                        <select
                                            className="form-input"
                                            value={itemForm.category}
                                            onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                                        >
                                            {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                                                <option key={key} value={key}>{val.icon} {val.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select
                                            className="form-input"
                                            value={itemForm.status}
                                            onChange={e => {
                                                const newStatus = e.target.value;
                                                setItemForm({
                                                    ...itemForm,
                                                    status: newStatus,
                                                    completion_percentage: newStatus === 'completed' ? 100 : itemForm.completion_percentage
                                                });
                                            }}
                                        >
                                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                                                <option key={key} value={key}>{val.icon} {val.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Prioritas</label>
                                        <select
                                            className="form-input"
                                            value={itemForm.priority}
                                            onChange={e => setItemForm({ ...itemForm, priority: e.target.value })}
                                        >
                                            {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                                                <option key={key} value={key}>{val.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={itemForm.due_date}
                                            onChange={e => setItemForm({ ...itemForm, due_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                {itemForm.status !== 'completed' && (
                                    <div className="form-group">
                                        <label className="form-label">Progress: {itemForm.completion_percentage}%</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={itemForm.completion_percentage}
                                            onChange={e => setItemForm({ ...itemForm, completion_percentage: Number(e.target.value) })}
                                            style={{ width: '100%' }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            <span>0%</span><span>50%</span><span>100%</span>
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Catatan</label>
                                    <textarea
                                        className="form-input"
                                        value={itemForm.notes}
                                        onChange={e => setItemForm({ ...itemForm, notes: e.target.value })}
                                        placeholder="Catatan tambahan..."
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Menyimpan...' : (editingItem ? 'Update' : 'Tambah')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
