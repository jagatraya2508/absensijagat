const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');
const requireReportPermission = hasPermission('admin.reports');

function canViewReports(req, res, next) {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
        return next();
    }
    return requireReportPermission(req, res, next);
}
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

router.get('/employees', authenticateToken, canViewReports, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.employee_id, u.name, u.role,
                    COALESCE(ed.department, '') AS department,
                    COALESCE(ed.division, '') AS division
             FROM users u
             LEFT JOIN LATERAL (
                SELECT department, division
                FROM employee_details
                WHERE user_id = u.id
                ORDER BY id DESC
                LIMIT 1
             ) ed ON true
             WHERE u.role IN ('employee', 'manager')
             ORDER BY u.name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get report employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

function dateOnly(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const d = new Date(value);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

function resolveReportRange(query) {
    const today = new Date();
    const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let start = query.start_date || query.date || fallback;
    let end = query.end_date || query.date || start;
    if (start > end) {
        const swap = start;
        start = end;
        end = swap;
    }
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return { error: 'Tanggal tidak valid' };
    }
    const days = Math.round((endMs - startMs) / 86400000) + 1;
    if (days > 62) {
        return { error: 'Rentang tanggal maksimal 62 hari' };
    }
    return { start, end };
}

function attendanceStatusLabel(row) {
    if (row.is_off_day) return 'OFF';
    if (row.leave_type === 'late') return 'Izin Terlambat';
    if (row.leave_type === 'leave') return 'Cuti';
    if (row.leave_type === 'sick') return 'Sakit';
    if (row.leave_type === 'permission') return 'Izin Tidak Masuk';
    if (row.leave_type === 'change_off') return 'Tukar Libur';
    if (row.check_in_time && row.check_out_time) return 'Lengkap';
    if (row.check_in_time) return 'Belum Pulang';
    if (row.manual_id) return 'Pengajuan Absensi';
    return 'Tidak Hadir';
}

async function fetchAttendanceRows(start, end) {
    const result = await pool.query(
        `SELECT
            u.id AS user_id,
            u.employee_id,
            u.name,
            COALESCE(ed.department, '') AS department,
            COALESCE(ed.division, '') AS division,
            d.day::date AS report_date,
            ci.recorded_at AS check_in_time,
            ci.is_valid AS check_in_valid,
            co.recorded_at AS check_out_time,
            co.is_valid AS check_out_valid,
            al.name AS location_name,
            lr.type AS leave_type,
            CASE WHEN uod.id IS NOT NULL THEN true ELSE false END AS is_off_day,
            ma.id AS manual_id,
            ma.status AS manual_status
        FROM users u
        CROSS JOIN generate_series($1::date, $2::date, '1 day') AS d(day)
        LEFT JOIN LATERAL (
            SELECT department, division
            FROM employee_details
            WHERE user_id = u.id
            ORDER BY id DESC
            LIMIT 1
        ) ed ON true
        LEFT JOIN LATERAL (
            SELECT recorded_at, is_valid, location_id
            FROM attendance_records
            WHERE user_id = u.id AND type = 'check_in' AND DATE(recorded_at) = d.day::date
            ORDER BY recorded_at ASC
            LIMIT 1
        ) ci ON true
        LEFT JOIN LATERAL (
            SELECT recorded_at, is_valid, location_id
            FROM attendance_records
            WHERE user_id = u.id AND type = 'check_out' AND DATE(recorded_at) = d.day::date
            ORDER BY recorded_at DESC
            LIMIT 1
        ) co ON true
        LEFT JOIN attendance_locations al ON al.id = COALESCE(ci.location_id, co.location_id)
        LEFT JOIN LATERAL (
            SELECT type
            FROM leave_requests
            WHERE user_id = u.id
              AND status = 'approved'
              AND d.day::date BETWEEN start_date AND end_date
            ORDER BY id DESC
            LIMIT 1
        ) lr ON true
        LEFT JOIN user_off_days uod ON uod.user_id = u.id AND uod.off_date = d.day::date
        LEFT JOIN LATERAL (
            SELECT id, status
            FROM manual_attendances
            WHERE user_id = u.id
              AND date = d.day::date
              AND status IN ('pending', 'approved')
            ORDER BY id DESC
            LIMIT 1
        ) ma ON true
        WHERE u.role IN ('employee', 'manager')
        ORDER BY d.day, u.name`,
        [start, end]
    );

    return result.rows.map((row) => ({
        ...row,
        report_date: dateOnly(row.report_date),
        department: row.department || '',
        division: row.division || '',
        is_off_day: row.is_off_day === true || row.is_off_day === 't',
        manual_id: row.manual_id || null
    }));
}

function summarizeAttendance(records, start, end) {
    return {
        start_date: start,
        end_date: end,
        total_employees: new Set(records.map((row) => row.user_id)).size,
        present: records.filter((row) => row.check_in_time).length,
        absent: records.filter((row) => !row.check_in_time && !row.leave_type && !row.is_off_day && !row.manual_id).length,
        completed: records.filter((row) => row.check_in_time && row.check_out_time).length,
        on_late: records.filter((row) => row.leave_type === 'late').length,
        on_leave: records.filter((row) => row.leave_type === 'leave').length,
        on_manual: records.filter((row) => row.manual_id).length,
        on_off: records.filter((row) => row.is_off_day).length,
        on_sick: records.filter((row) => row.leave_type === 'sick').length
    };
}

// Get daily report
router.get('/daily', authenticateToken, canViewReports, async (req, res) => {
    try {
        const range = resolveReportRange(req.query);
        if (range.error) {
            return res.status(400).json({ error: range.error });
        }
        const records = await fetchAttendanceRows(range.start, range.end);
        res.json({
            summary: summarizeAttendance(records, range.start, range.end),
            records
        });
    } catch (error) {
        console.error('Get daily report error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get monthly report (Admin only)
router.get('/monthly', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;

        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
        u.id as user_id,
        u.employee_id,
        u.name,
        COALESCE(ed.department, '') AS department,
        COALESCE(ed.division, '') AS division,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' THEN DATE(ar.recorded_at) END) as total_present,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = true THEN DATE(ar.recorded_at) END) as valid_checkins,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = false THEN DATE(ar.recorded_at) END) as invalid_checkins
      FROM users u
      LEFT JOIN LATERAL (
        SELECT department, division FROM employee_details WHERE user_id = u.id ORDER BY id DESC LIMIT 1
      ) ed ON true
      LEFT JOIN attendance_records ar ON u.id = ar.user_id 
        AND DATE(ar.recorded_at) BETWEEN $1 AND $2
      WHERE u.role IN ('employee', 'manager')
      GROUP BY u.id, u.employee_id, u.name, ed.department, ed.division
      ORDER BY u.name`,
            [startDate, endDate]
        );

        // Calculate working days in the month
        const workingDays = getWorkingDays(targetYear, targetMonth);

        const records = result.rows.map(r => ({
            ...r,
            total_absent: workingDays - parseInt(r.total_present),
            attendance_rate: Math.round((parseInt(r.total_present) / workingDays) * 100)
        }));

        res.json({
            year: targetYear,
            month: targetMonth,
            working_days: workingDays,
            records
        });
    } catch (error) {
        console.error('Get monthly report error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get individual employee report
router.get('/employee/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.query;

        const isSelf = req.user.id === parseInt(id, 10);
        if (!isSelf && req.user.role !== 'admin' && req.user.role !== 'manager') {
            const access = await pool.query(
                `SELECT 1 FROM role_permissions rp
                 JOIN roles r ON rp.role_id = r.id
                 WHERE r.name = $1 AND rp.permission_key = 'admin.reports'`,
                [req.user.role]
            );
            if (access.rows.length === 0) {
                return res.status(403).json({ error: 'Akses ditolak' });
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
        ar.*,
        al.name as location_name
      FROM attendance_records ar
      LEFT JOIN attendance_locations al ON ar.location_id = al.id
      WHERE ar.user_id = $1 
        AND DATE(ar.recorded_at) BETWEEN $2 AND $3
      ORDER BY ar.recorded_at DESC`,
            [id, start_date || thirtyDaysAgo, end_date || today]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get employee report error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// ============================================
// EXPORT ENDPOINTS - PDF & Excel
// ============================================

// Export Daily Report as PDF
router.get('/export/daily/pdf', authenticateToken, canViewReports, async (req, res) => {
    try {
        const range = resolveReportRange(req.query);
        if (range.error) {
            return res.status(400).json({ error: range.error });
        }
        const rows = await fetchAttendanceRows(range.start, range.end);
        const targetDate = range.start === range.end ? range.start : `${range.start}-sd-${range.end}`;

        // Create PDF
        const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-absensi-${targetDate}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).text('LAPORAN ABSENSI HARIAN', { align: 'center' });
        doc.fontSize(12).text(`Periode: ${formatDateID(range.start)} - ${formatDateID(range.end)}`, { align: 'center' });
        doc.moveDown(2);

        const summary = summarizeAttendance(rows, range.start, range.end);
        doc.fontSize(11);
        doc.text(`Karyawan: ${summary.total_employees}   Hadir: ${summary.present}   Tidak Hadir: ${summary.absent}   Lengkap: ${summary.completed}`);
        doc.text(`Izin Terlambat: ${summary.on_late}   Cuti: ${summary.on_leave}   Pengajuan Absensi: ${summary.on_manual}`);
        doc.moveDown(1);

        const tableTop = doc.y;
        const columns = [36, 60, 150, 250, 340, 430, 520, 600, 680];
        doc.font('Helvetica-Bold').fontSize(8);
        ['No', 'ID', 'Nama', 'Departemen', 'Divisi', 'Tanggal', 'Masuk', 'Pulang', 'Status'].forEach((label, index) => {
            doc.text(label, columns[index], tableTop, { width: 80 });
        });
        doc.moveTo(36, tableTop + 14).lineTo(800, tableTop + 14).stroke();

        doc.font('Helvetica').fontSize(8);
        let yPosition = tableTop + 22;
        rows.forEach((row, index) => {
            if (yPosition > 540) {
                doc.addPage();
                yPosition = 40;
            }
            const values = [
                String(index + 1),
                row.employee_id || '-',
                row.name || '-',
                row.department || '-',
                row.division || '-',
                row.report_date || '-',
                row.check_in_time ? formatTimeID(row.check_in_time) : '-',
                row.check_out_time ? formatTimeID(row.check_out_time) : '-',
                attendanceStatusLabel(row)
            ];
            values.forEach((value, col) => {
                doc.text(String(value), columns[col], yPosition, { width: col === 2 ? 95 : 80 });
            });
            yPosition += 16;
        });

        // Footer
        doc.fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50, 750);

        doc.end();
    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Daily Report as Excel
router.get('/export/daily/excel', authenticateToken, canViewReports, async (req, res) => {
    try {
        const range = resolveReportRange(req.query);
        if (range.error) {
            return res.status(400).json({ error: range.error });
        }
        const rows = await fetchAttendanceRows(range.start, range.end);
        const targetDate = range.start === range.end ? range.start : `${range.start}-sd-${range.end}`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Absensi');

        // Title
        worksheet.mergeCells('A1:J1');
        worksheet.getCell('A1').value = 'LAPORAN ABSENSI HARIAN';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:J2');
        worksheet.getCell('A2').value = `Periode: ${formatDateID(range.start)} - ${formatDateID(range.end)}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.getRow(4).values = ['No', 'ID Karyawan', 'Nama', 'Departemen', 'Divisi', 'Tanggal', 'Check-in', 'Check-out', 'Lokasi', 'Status'];
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };

        rows.forEach((row, index) => {
            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                row.department || '-',
                row.division || '-',
                row.report_date || '-',
                row.check_in_time ? formatTimeID(row.check_in_time) : '-',
                row.check_out_time ? formatTimeID(row.check_out_time) : '-',
                row.location_name || '-',
                attendanceStatusLabel(row)
            ]);
        });

        worksheet.columns = [
            { width: 5 }, { width: 14 }, { width: 24 }, { width: 16 }, { width: 16 },
            { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 18 }
        ];

        const excelSummary = summarizeAttendance(rows, range.start, range.end);
        const summaryRow = worksheet.rowCount + 2;
        worksheet.getCell(`A${summaryRow}`).value = `Hadir: ${excelSummary.present} | Tidak Hadir: ${excelSummary.absent} | Lengkap: ${excelSummary.completed} | Izin Terlambat: ${excelSummary.on_late} | Cuti: ${excelSummary.on_leave} | Pengajuan Absensi: ${excelSummary.on_manual}`;
        worksheet.getCell(`A${summaryRow}`).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-absensi-${targetDate}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

// Export Monthly Report as PDF
router.get('/export/monthly/pdf', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
        u.employee_id,
        u.name,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' THEN DATE(ar.recorded_at) END) as total_present,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = true THEN DATE(ar.recorded_at) END) as valid_checkins,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = false THEN DATE(ar.recorded_at) END) as invalid_checkins
      FROM users u
      LEFT JOIN attendance_records ar ON u.id = ar.user_id 
        AND DATE(ar.recorded_at) BETWEEN $1 AND $2
      WHERE u.role IN ('employee', 'manager')
      GROUP BY u.id, u.employee_id, u.name
      ORDER BY u.name`,
            [startDate, endDate]
        );

        const workingDays = getWorkingDays(targetYear, targetMonth);

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-bulanan-${targetYear}-${targetMonth}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).text('LAPORAN ABSENSI BULANAN', { align: 'center' });
        doc.fontSize(12).text(`${monthNames[targetMonth]} ${targetYear}`, { align: 'center' });
        doc.moveDown(2);

        // Summary
        doc.fontSize(11);
        doc.text(`Hari Kerja: ${workingDays} hari`);
        doc.text(`Total Karyawan: ${result.rows.length}`);
        doc.moveDown(2);

        // Table Header
        const tableTop = doc.y;
        const col1 = 50, col2 = 80, col3 = 200, col4 = 290, col5 = 360, col6 = 430, col7 = 490;

        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('No', col1, tableTop);
        doc.text('ID', col2, tableTop);
        doc.text('Nama', col3, tableTop);
        doc.text('Hadir', col4, tableTop);
        doc.text('Tidak Hadir', col5, tableTop);
        doc.text('Valid', col6, tableTop);
        doc.text('%', col7, tableTop);

        doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica').fontSize(9);
        let yPosition = tableTop + 25;

        result.rows.forEach((row, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const absent = workingDays - parseInt(row.total_present);
            const rate = Math.round((parseInt(row.total_present) / workingDays) * 100);

            doc.text(String(index + 1), col1, yPosition);
            doc.text(row.employee_id || '-', col2, yPosition);
            doc.text(row.name || '-', col3, yPosition, { width: 85 });
            doc.text(String(row.total_present), col4, yPosition);
            doc.text(String(absent), col5, yPosition);
            doc.text(String(row.valid_checkins), col6, yPosition);
            doc.text(`${rate}%`, col7, yPosition);

            yPosition += 20;
        });

        // Footer
        doc.fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50, 750);

        doc.end();
    } catch (error) {
        console.error('Export Monthly PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Monthly Report as Excel
router.get('/export/monthly/excel', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
        u.employee_id,
        u.name,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' THEN DATE(ar.recorded_at) END) as total_present,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = true THEN DATE(ar.recorded_at) END) as valid_checkins,
        COUNT(DISTINCT CASE WHEN ar.type = 'check_in' AND ar.is_valid = false THEN DATE(ar.recorded_at) END) as invalid_checkins
      FROM users u
      LEFT JOIN attendance_records ar ON u.id = ar.user_id 
        AND DATE(ar.recorded_at) BETWEEN $1 AND $2
      WHERE u.role IN ('employee', 'manager')
      GROUP BY u.id, u.employee_id, u.name
      ORDER BY u.name`,
            [startDate, endDate]
        );

        const workingDays = getWorkingDays(targetYear, targetMonth);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Bulanan');

        // Title
        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = 'LAPORAN ABSENSI BULANAN';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:H2');
        worksheet.getCell('A2').value = `${monthNames[targetMonth]} ${targetYear}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.getCell('A3').value = `Hari Kerja: ${workingDays} hari`;

        // Header
        worksheet.getRow(5).values = ['No', 'ID Karyawan', 'Nama', 'Hadir', 'Tidak Hadir', 'Valid', 'Invalid', 'Persentase'];
        worksheet.getRow(5).font = { bold: true };
        worksheet.getRow(5).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };
        worksheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Data rows
        result.rows.forEach((row, index) => {
            const absent = workingDays - parseInt(row.total_present);
            const rate = Math.round((parseInt(row.total_present) / workingDays) * 100);

            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                parseInt(row.total_present),
                absent,
                parseInt(row.valid_checkins),
                parseInt(row.invalid_checkins),
                `${rate}%`
            ]);
        });

        // Column width
        worksheet.columns = [
            { width: 5 },
            { width: 15 },
            { width: 25 },
            { width: 10 },
            { width: 12 },
            { width: 10 },
            { width: 10 },
            { width: 12 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-bulanan-${targetYear}-${targetMonth}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Monthly Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

// Helper function to calculate working days (excluding weekends)
function getWorkingDays(year, month) {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            count++;
        }
    }

    return count;
}

// Helper function to format date in Indonesian
function formatDateID(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to format time in Indonesian
function formatTimeID(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Get Off/Leave report (Admin only)
router.get('/off', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        // Default to current month if not specified
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const targetStart = start_date || firstDay;
        const targetEnd = end_date || lastDay;

        const result = await pool.query(
            `SELECT 
                u.employee_id,
                u.name,
                COALESCE(ed.department, '') AS department,
                COALESCE(ed.division, '') AS division,
                d.date::date as off_date,
                'leave' as type,
                lr.type as category,
                lr.reason
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT department, division FROM employee_details WHERE user_id = u.id ORDER BY id DESC LIMIT 1
            ) ed ON true
            CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day') AS d(date)
            WHERE lr.status = 'approved' AND d.date BETWEEN $1 AND $2

            UNION ALL

            SELECT 
                u.employee_id,
                u.name,
                COALESCE(ed.department, '') AS department,
                COALESCE(ed.division, '') AS division,
                uod.off_date,
                'off_day' as type,
                'Libur' as category,
                'Jadwal Libur' as reason
            FROM user_off_days uod
            JOIN users u ON uod.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT department, division FROM employee_details WHERE user_id = u.id ORDER BY id DESC LIMIT 1
            ) ed ON true
            WHERE uod.off_date BETWEEN $1 AND $2

            ORDER BY off_date DESC, name ASC`,
            [targetStart, targetEnd]
        );

        res.json({
            start_date: targetStart,
            end_date: targetEnd,
            records: result.rows
        });
    } catch (error) {
        console.error('Get off report error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Export Off Report as PDF
router.get('/export/off/pdf', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const now = new Date();
        const targetStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const targetEnd = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
                u.employee_id,
                u.name,
                d.date::date as off_date,
                'leave' as type,
                lr.type as category,
                lr.reason
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day') AS d(date)
            WHERE lr.status = 'approved' AND d.date BETWEEN $1 AND $2

            UNION ALL

            SELECT 
                u.employee_id,
                u.name,
                uod.off_date,
                'off_day' as type,
                'Libur' as category,
                'Jadwal Libur' as reason
            FROM user_off_days uod
            JOIN users u ON uod.user_id = u.id
            WHERE uod.off_date BETWEEN $1 AND $2

            ORDER BY off_date ASC, name ASC`,
            [targetStart, targetEnd]
        );

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-off-${targetStart}-to-${targetEnd}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(18).text('LAPORAN KARYAWAN OFF / CUTI', { align: 'center' });
        doc.fontSize(12).text(`Periode: ${formatDateID(targetStart)} - ${formatDateID(targetEnd)}`, { align: 'center' });
        doc.moveDown(2);

        // Table Header
        const tableTop = doc.y;
        const col1 = 50, col2 = 130, col3 = 210, col4 = 350, col5 = 450;

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Tanggal', col1, tableTop);
        doc.text('ID', col2, tableTop);
        doc.text('Nama', col3, tableTop);
        doc.text('Kategori', col4, tableTop);
        doc.text('Keterangan', col5, tableTop);

        doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica').fontSize(9);
        let yPosition = tableTop + 25;

        result.rows.forEach((row) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const categoryLabel = row.type === 'off_day' ? 'Libur Rutin' :
                (row.category === 'sick' ? 'Sakit' :
                    (row.category === 'leave' ? 'Cuti' : 'Izin'));

            doc.text(formatDateID(row.off_date), col1, yPosition);
            doc.text(row.employee_id || '-', col2, yPosition);
            doc.text(row.name || '-', col3, yPosition, { width: 130 });
            doc.text(categoryLabel, col4, yPosition);
            doc.text(row.reason || '-', col5, yPosition, { width: 100 });

            yPosition += 20;
        });

        // Footer
        doc.fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50, 750);

        doc.end();
    } catch (error) {
        console.error('Export Off PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Off Report as Excel
router.get('/export/off/excel', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const now = new Date();
        const targetStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const targetEnd = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
                u.employee_id,
                u.name,
                d.date::date as off_date,
                'leave' as type,
                lr.type as category,
                lr.reason
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day') AS d(date)
            WHERE lr.status = 'approved' AND d.date BETWEEN $1 AND $2

            UNION ALL

            SELECT 
                u.employee_id,
                u.name,
                uod.off_date,
                'off_day' as type,
                'Libur' as category,
                'Jadwal Libur' as reason
            FROM user_off_days uod
            JOIN users u ON uod.user_id = u.id
            WHERE uod.off_date BETWEEN $1 AND $2

            ORDER BY off_date ASC, name ASC`,
            [targetStart, targetEnd]
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Cuti & Libur');

        // Title
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = 'LAPORAN KARYAWAN OFF / CUTI';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:E2');
        worksheet.getCell('A2').value = `Periode: ${formatDateID(targetStart)} - ${formatDateID(targetEnd)}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        worksheet.getRow(4).values = ['Tanggal', 'ID Karyawan', 'Nama', 'Kategori', 'Keterangan'];
        worksheet.getRow(4).font = { bold: true };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Data
        result.rows.forEach((row) => {
            const categoryLabel = row.type === 'off_day' ? 'Libur Rutin' :
                (row.category === 'sick' ? 'Sakit' :
                    (row.category === 'leave' ? 'Cuti' : 'Izin'));

            worksheet.addRow([
                formatDateID(row.off_date),
                row.employee_id,
                row.name,
                categoryLabel,
                row.reason
            ]);
        });

        // Widths
        worksheet.columns = [
            { width: 25 },
            { width: 15 },
            { width: 30 },
            { width: 15 },
            { width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-off-${targetStart}-to-${targetEnd}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Off Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

// ============================================
// RIWAYAT ABSENSI (History) REPORT - Admin Only
// ============================================

// Get history report (Admin only) — detailed per-record data
router.get('/history', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date, user_id } = req.query;
        const now = new Date();
        const targetStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const targetEnd = end_date || now.toISOString().split('T')[0];

        const params = [targetStart, targetEnd];
        let userFilter = '';

        if (user_id && user_id !== 'all') {
            params.push(user_id);
            userFilter = `AND u.id = $${params.length}`;
        }

        // Get attendance records grouped per user per day (check-in & check-out)
        const result = await pool.query(
            `SELECT 
                u.id as user_id,
                u.employee_id,
                u.name,
                COALESCE(ed.department, '') AS department,
                COALESCE(ed.division, '') AS division,
                d.date::date as attendance_date,
                ci.recorded_at as check_in_time,
                ci.is_valid as check_in_valid,
                ci.distance_meters as check_in_distance,
                co.recorded_at as check_out_time,
                co.is_valid as check_out_valid,
                al.name as location_name,
                lr.type as leave_type,
                lr.reason as leave_reason,
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day
            FROM users u
            CROSS JOIN generate_series($1::date, $2::date, '1 day'::interval) AS d(date)
            LEFT JOIN LATERAL (
                SELECT department, division FROM employee_details WHERE user_id = u.id ORDER BY id DESC LIMIT 1
            ) ed ON true
            LEFT JOIN attendance_records ci ON u.id = ci.user_id 
                AND ci.type = 'check_in' 
                AND DATE(ci.recorded_at) = d.date::date
            LEFT JOIN attendance_records co ON u.id = co.user_id 
                AND co.type = 'check_out' 
                AND DATE(co.recorded_at) = d.date::date
            LEFT JOIN attendance_locations al ON COALESCE(ci.location_id, co.location_id) = al.id
            LEFT JOIN leave_requests lr ON u.id = lr.user_id
                AND lr.status = 'approved'
                AND d.date::date BETWEEN lr.start_date AND lr.end_date
            LEFT JOIN user_off_days uod ON u.id = uod.user_id
                AND uod.off_date = d.date::date
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const records = result.rows.map(r => ({
            ...r,
            attendance_date: r.attendance_date || r.check_in_time || r.check_out_time
        }));

        res.json({
            start_date: targetStart,
            end_date: targetEnd,
            total: records.length,
            records
        });
    } catch (error) {
        console.error('Get history report error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Export History Report as PDF
router.get('/export/history/pdf', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date, user_id } = req.query;
        const now = new Date();
        const targetStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const targetEnd = end_date || now.toISOString().split('T')[0];

        const params = [targetStart, targetEnd];
        let userFilter = '';

        if (user_id && user_id !== 'all') {
            params.push(user_id);
            userFilter = `AND u.id = $${params.length}`;
        }

        const result = await pool.query(
            `SELECT 
                u.employee_id,
                u.name,
                d.date::date as attendance_date,
                ci.recorded_at as check_in_time,
                ci.is_valid as check_in_valid,
                co.recorded_at as check_out_time,
                al.name as location_name,
                lr.type as leave_type,
                lr.reason as leave_reason,
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day
            FROM users u
            CROSS JOIN generate_series($1::date, $2::date, '1 day'::interval) AS d(date)
            LEFT JOIN attendance_records ci ON u.id = ci.user_id 
                AND ci.type = 'check_in' 
                AND DATE(ci.recorded_at) = d.date::date
            LEFT JOIN attendance_records co ON u.id = co.user_id 
                AND co.type = 'check_out' 
                AND DATE(co.recorded_at) = d.date::date
            LEFT JOIN attendance_locations al ON COALESCE(ci.location_id, co.location_id) = al.id
            LEFT JOIN leave_requests lr ON u.id = lr.user_id
                AND lr.status = 'approved'
                AND d.date::date BETWEEN lr.start_date AND lr.end_date
            LEFT JOIN user_off_days uod ON u.id = uod.user_id
                AND uod.off_date = d.date::date
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=riwayat-absensi-${targetStart}-to-${targetEnd}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(18).text('LAPORAN RIWAYAT ABSENSI', { align: 'center' });
        doc.fontSize(11).text(`Periode: ${formatDateID(targetStart)} - ${formatDateID(targetEnd)}`, { align: 'center' });
        doc.moveDown(1);

        // Summary
        const totalRecords = result.rows.length;
        const totalPresent = result.rows.filter(r => r.check_in_time).length;
        const totalOff = result.rows.filter(r => r.is_off_day).length;
        const totalLeave = result.rows.filter(r => r.leave_type).length;
        doc.fontSize(10);
        doc.text(`Total Record: ${totalRecords}  |  Hadir: ${totalPresent}  |  OFF: ${totalOff}  |  Izin/Cuti: ${totalLeave}`);
        doc.moveDown(1);

        // Table Header
        const tableTop = doc.y;
        const col1 = 40, col2 = 70, col3 = 170, col4 = 290, col5 = 420, col6 = 510, col7 = 610, col8 = 710;

        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('No', col1, tableTop);
        doc.text('ID', col2, tableTop);
        doc.text('Nama', col3, tableTop);
        doc.text('Tanggal', col4, tableTop);
        doc.text('Check-in', col5, tableTop);
        doc.text('Check-out', col6, tableTop);
        doc.text('Lokasi', col7, tableTop);
        doc.text('Status', col8, tableTop);

        doc.moveTo(col1, tableTop + 15).lineTo(790, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica').fontSize(8);
        let yPosition = tableTop + 25;

        result.rows.forEach((row, index) => {
            if (yPosition > 540) {
                doc.addPage();
                yPosition = 40;
            }

            let status = 'Tidak Hadir';
            if (row.is_off_day) {
                status = 'OFF';
            } else if (row.leave_type) {
                status = row.leave_type === 'late'
                    ? 'Izin Terlambat'
                    : row.leave_type === 'sick'
                        ? 'Izin Sakit'
                        : row.leave_type === 'leave'
                            ? 'Cuti'
                            : row.leave_type === 'change_off'
                                ? 'Tukar Libur'
                                : 'Izin';
            } else if (row.check_in_time && row.check_out_time) {
                status = row.check_in_valid ? 'Lengkap' : 'Diluar Radius';
            } else if (row.check_in_time) {
                status = 'Belum Pulang';
            }

            doc.text(String(index + 1), col1, yPosition);
            doc.text(row.employee_id || '-', col2, yPosition);
            doc.text(row.name || '-', col3, yPosition, { width: 115 });
            doc.text(row.attendance_date ? formatDateID(row.attendance_date) : '-', col4, yPosition, { width: 125 });
            doc.text(row.is_off_day ? 'OFF' : (row.check_in_time ? formatTimeID(row.check_in_time) : '-'), col5, yPosition);
            doc.text(row.is_off_day ? 'OFF' : (row.check_out_time ? formatTimeID(row.check_out_time) : '-'), col6, yPosition);
            doc.text(row.location_name || '-', col7, yPosition, { width: 95 });
            doc.text(status, col8, yPosition);

            yPosition += 18;
        });

        // Footer
        const footerY = doc.page.height - 30;
        doc.fontSize(7).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 40, footerY);

        doc.end();
    } catch (error) {
        console.error('Export History PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export History Report as Excel
router.get('/export/history/excel', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { start_date, end_date, user_id } = req.query;
        const now = new Date();
        const targetStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const targetEnd = end_date || now.toISOString().split('T')[0];

        const params = [targetStart, targetEnd];
        let userFilter = '';

        if (user_id && user_id !== 'all') {
            params.push(user_id);
            userFilter = `AND u.id = $${params.length}`;
        }

        const result = await pool.query(
            `SELECT 
                u.employee_id,
                u.name,
                d.date::date as attendance_date,
                ci.recorded_at as check_in_time,
                ci.is_valid as check_in_valid,
                ci.distance_meters as check_in_distance,
                co.recorded_at as check_out_time,
                al.name as location_name,
                lr.type as leave_type,
                lr.reason as leave_reason,
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day
            FROM users u
            CROSS JOIN generate_series($1::date, $2::date, '1 day'::interval) AS d(date)
            LEFT JOIN attendance_records ci ON u.id = ci.user_id 
                AND ci.type = 'check_in' 
                AND DATE(ci.recorded_at) = d.date::date
            LEFT JOIN attendance_records co ON u.id = co.user_id 
                AND co.type = 'check_out' 
                AND DATE(co.recorded_at) = d.date::date
            LEFT JOIN attendance_locations al ON COALESCE(ci.location_id, co.location_id) = al.id
            LEFT JOIN leave_requests lr ON u.id = lr.user_id
                AND lr.status = 'approved'
                AND d.date::date BETWEEN lr.start_date AND lr.end_date
            LEFT JOIN user_off_days uod ON u.id = uod.user_id
                AND uod.off_date = d.date::date
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Riwayat Absensi');

        // Title
        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = 'LAPORAN RIWAYAT ABSENSI';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:H2');
        worksheet.getCell('A2').value = `Periode: ${formatDateID(targetStart)} - ${formatDateID(targetEnd)}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        worksheet.getRow(4).values = ['No', 'ID Karyawan', 'Nama', 'Tanggal', 'Check-in', 'Check-out', 'Lokasi', 'Status'];
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };

        // Data rows
        result.rows.forEach((row, index) => {
            let status = 'Tidak Hadir';
            if (row.is_off_day) {
                status = 'OFF';
            } else if (row.leave_type) {
                status = row.leave_type === 'late'
                    ? 'Izin Terlambat'
                    : row.leave_type === 'sick'
                        ? 'Izin Sakit'
                        : row.leave_type === 'leave'
                            ? 'Cuti'
                            : row.leave_type === 'change_off'
                                ? 'Tukar Libur'
                                : 'Izin';
            } else if (row.check_in_time && row.check_out_time) {
                status = row.check_in_valid ? 'Lengkap' : 'Diluar Radius';
            } else if (row.check_in_time) {
                status = 'Belum Pulang';
            }

            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                row.attendance_date ? formatDateID(row.attendance_date) : '-',
                row.is_off_day ? 'OFF' : (row.check_in_time ? formatTimeID(row.check_in_time) : '-'),
                row.is_off_day ? 'OFF' : (row.check_out_time ? formatTimeID(row.check_out_time) : '-'),
                row.location_name || '-',
                status
            ]);
        });

        // Column widths
        worksheet.columns = [
            { width: 5 },
            { width: 15 },
            { width: 25 },
            { width: 30 },
            { width: 12 },
            { width: 12 },
            { width: 20 },
            { width: 15 }
        ];

        // Summary row
        const summaryRow = worksheet.rowCount + 2;
        const totalPresent = result.rows.filter(r => r.check_in_time).length;
        const totalOff = result.rows.filter(r => r.is_off_day).length;
        const totalLeave = result.rows.filter(r => r.leave_type).length;
        worksheet.getCell(`A${summaryRow}`).value = `Total Record: ${result.rows.length}  |  Hadir: ${totalPresent}  |  OFF: ${totalOff}  |  Izin/Cuti: ${totalLeave}`;
        worksheet.getCell(`A${summaryRow}`).font = { bold: true };

        // Footer
        const footerRow = summaryRow + 1;
        worksheet.getCell(`A${footerRow}`).value = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
        worksheet.getCell(`A${footerRow}`).font = { italic: true, size: 9 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=riwayat-absensi-${targetStart}-to-${targetEnd}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export History Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

module.exports = router;
