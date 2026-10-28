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

function resolveReportRange(query, maxDays = 62) {
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
    if (days > maxDays) {
        return { error: maxDays > 62 ? 'Rentang tanggal maksimal 1 tahun' : 'Rentang tanggal maksimal 62 hari' };
    }
    return { start, end };
}

function attendanceStatusLabel(row) {
    if (row.is_off_day) return 'OFF';
    if (row.check_in_time && row.check_out_time) {
        if (row.leave_type === 'leave' && row.leave_is_hourly && row.leave_duration_hours) {
            return `Lengkap (Cuti ${row.leave_duration_hours} Jam)`;
        }
        return 'Lengkap';
    }
    if (row.check_in_time) {
        if (row.leave_type === 'leave' && row.leave_is_hourly && row.leave_duration_hours) {
            return `Belum Pulang (Cuti ${row.leave_duration_hours} Jam)`;
        }
        return 'Belum Pulang';
    }
    if (row.leave_type === 'late') return 'Izin Terlambat';
    if (row.leave_type === 'leave') {
        if (row.leave_is_hourly && row.leave_duration_hours) {
            return `Cuti (${row.leave_duration_hours} Jam)`;
        }
        return 'Cuti';
    }
    if (row.leave_type === 'sick') return 'Sakit';
    if (row.leave_type === 'permission') return 'Izin Tidak Masuk';
    if (row.leave_type === 'change_off') return 'Tukar Libur';
    if (row.manual_id) return 'Pengajuan Absensi';
    return 'Tidak Hadir';
}

function computeOvertimeCategory(otStart, otEnd, shiftStart, shiftEnd, isOffDay) {
    if (!otStart || !otEnd) return '';
    if (isOffDay) return 'Lembur Libur';
    if (!shiftStart || !shiftEnd) return 'Lembur Bebas';
    const toM = (t) => {
        const parts = String(t).substring(0, 5).split(':').map(Number);
        return parts[0] * 60 + parts[1];
    };
    const os = toM(otStart);
    const oe = toM(otEnd);
    const ss = toM(shiftStart);
    const se = toM(shiftEnd);

    if (ss < se) {
        if (oe <= ss || (os < ss && oe <= ss + 60)) return 'Lembur Awal';
        if (os >= se || (os >= se - 60 && oe > se)) return 'Lembur Akhir';
        if (os < ss) return 'Lembur Awal';
        if (os >= se) return 'Lembur Akhir';
        return 'Lembur';
    } else {
        const midpoint = (se + ss) / 2;
        if (os >= midpoint && os < ss) return 'Lembur Awal';
        if (os >= se && os < midpoint) return 'Lembur Akhir';
        return 'Lembur';
    }
}

async function fetchAttendanceRows(start, end, userId = null) {
    const params = [start, end];
    let userFilter = '';
    if (userId) {
        params.push(userId);
        userFilter = `AND u.id = $${params.length}`;
    }
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
            lr.is_hourly AS leave_is_hourly,
            COALESCE(LEFT(lr.start_time::text, 5), '') AS leave_start_time,
            COALESCE(LEFT(lr.end_time::text, 5), '') AS leave_end_time,
            lr.duration_hours AS leave_duration_hours,
            lr.duration_days AS leave_duration_days,
            CASE WHEN uod.id IS NOT NULL THEN true ELSE false END AS is_off_day,
            ma.id AS manual_id,
            ma.status AS manual_status,
            COALESCE(LEFT(ot_req.overtime_start::text, 5), '') AS overtime_start,
            COALESCE(LEFT(ot_req.overtime_end::text, 5), '') AS overtime_end,
            COALESCE(ot_req.hours, ot_rec.hours, 0)::numeric AS overtime_hours,
            COALESCE(NULLIF(ot_req.reason, ''), ot_rec.description, '') AS overtime_reason,
            COALESCE(ot_req.shift_name, esa_shift.shift_name, '') AS overtime_shift_name,
            COALESCE(ot_req.shift_start, esa_shift.shift_start) AS overtime_shift_start,
            COALESCE(ot_req.shift_end, esa_shift.shift_end) AS overtime_shift_end
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
            SELECT type, is_hourly, start_time, end_time, duration_hours, duration_days
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
        LEFT JOIN LATERAL (
            SELECT 
                otr.overtime_start,
                otr.overtime_end,
                COALESCE(ore.actual_hours, otr.estimated_hours, 0) AS hours,
                otr.reason,
                ws.name AS shift_name,
                ws.start_time AS shift_start,
                ws.end_time AS shift_end
            FROM overtime_request_employees ore
            JOIN overtime_requests otr ON ore.overtime_request_id = otr.id
            LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
            WHERE ore.user_id = u.id
              AND otr.date = d.day::date
              AND otr.status IN ('approved', 'completed')
            ORDER BY otr.id DESC
            LIMIT 1
        ) ot_req ON true
        LEFT JOIN LATERAL (
            SELECT ws.name AS shift_name, ws.start_time AS shift_start, ws.end_time AS shift_end
            FROM employee_shift_assignments esa
            JOIN work_shifts ws ON ws.id = esa.shift_id
            WHERE esa.user_id = u.id AND esa.assignment_date = d.day::date
            LIMIT 1
        ) esa_shift ON true
        LEFT JOIN LATERAL (
            SELECT 
                hours,
                description
            FROM overtime_records
            WHERE user_id = u.id
              AND date = d.day::date
              AND status = 'approved'
            ORDER BY id DESC
            LIMIT 1
        ) ot_rec ON true
        WHERE u.role IN ('employee', 'manager') ${userFilter}
        ORDER BY d.day, u.name`,
        params
    );

    return result.rows.map((row) => ({
        ...row,
        report_date: dateOnly(row.report_date),
        department: row.department || '',
        division: row.division || '',
        is_off_day: row.is_off_day === true || row.is_off_day === 't',
        manual_id: row.manual_id || null,
        overtime_hours: parseFloat(row.overtime_hours) || 0,
        overtime_start: row.overtime_start || '',
        overtime_end: row.overtime_end || '',
        overtime_reason: row.overtime_reason || '',
        overtime_category: computeOvertimeCategory(row.overtime_start, row.overtime_end, row.overtime_shift_start, row.overtime_shift_end, row.is_off_day)
    }));
}

function summarizeAttendance(records, start, end) {
    const otRecords = records.filter((row) => (parseFloat(row.overtime_hours) || 0) > 0);
    const totalOtHours = otRecords.reduce((sum, row) => sum + (parseFloat(row.overtime_hours) || 0), 0);
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
        on_sick: records.filter((row) => row.leave_type === 'sick').length,
        total_overtime_hours: Math.round(totalOtHours * 10) / 10,
        on_overtime: otRecords.length
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

router.get('/employee/:id/days', authenticateToken, canViewReports, async (req, res) => {
    try {
        const range = resolveReportRange(req.query, 366);
        if (range.error) {
            return res.status(400).json({ error: range.error });
        }

        const userResult = await pool.query(
            `SELECT u.id, u.employee_id, u.name,
                    COALESCE(ed.department, '') AS department,
                    COALESCE(ed.division, '') AS division
             FROM users u
             LEFT JOIN LATERAL (
                SELECT department, division FROM employee_details
                WHERE user_id = u.id ORDER BY id DESC LIMIT 1
             ) ed ON true
             WHERE u.id = $1 AND u.role IN ('employee', 'manager')`,
            [req.params.id]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
        }

        const records = await fetchAttendanceRows(range.start, range.end, req.params.id);
        res.json({
            user: userResult.rows[0],
            start_date: range.start,
            end_date: range.end,
            summary: summarizeAttendance(records, range.start, range.end),
            records
        });
    } catch (error) {
        console.error('Get employee attendance days error:', error);
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
        doc.fontSize(10);
        doc.text(`Karyawan: ${summary.total_employees}   Hadir: ${summary.present}   Tidak Hadir: ${summary.absent}   Lengkap: ${summary.completed}`);
        doc.text(`Izin Terlambat: ${summary.on_late}   Cuti: ${summary.on_leave}   Pengajuan Absensi: ${summary.on_manual}   Lembur: ${summary.on_overtime || 0} (${summary.total_overtime_hours || 0} jam)`);
        doc.moveDown(1);

        const tableTop = doc.y;
        const columns = [36, 56, 126, 216, 296, 366, 426, 476, 526, 616, 686];
        doc.font('Helvetica-Bold').fontSize(8);
        ['No', 'ID', 'Nama', 'Departemen', 'Divisi', 'Tanggal', 'Masuk', 'Pulang', 'Waktu Lembur', 'Durasi', 'Status'].forEach((label, index) => {
            doc.text(label, columns[index], tableTop, { width: index === 8 ? 85 : 68 });
        });
        doc.moveTo(36, tableTop + 14).lineTo(770, tableTop + 14).stroke();

        doc.font('Helvetica').fontSize(8);
        let yPosition = tableTop + 22;
        rows.forEach((row, index) => {
            if (yPosition > 540) {
                doc.addPage();
                yPosition = 40;
            }
            const otCat = row.overtime_category ? ` (${row.overtime_category === 'Lembur Awal' ? 'Awal' : row.overtime_category === 'Lembur Akhir' ? 'Akhir' : row.overtime_category})` : '';
            const otTime = row.overtime_start && row.overtime_end
                ? `${row.overtime_start} - ${row.overtime_end}${otCat}`
                : (row.overtime_hours > 0 ? 'Lembur' : '-');
            const otDuration = row.overtime_hours > 0 ? `${row.overtime_hours} jam` : '-';
            const values = [
                String(index + 1),
                row.employee_id || '-',
                row.name || '-',
                row.department || '-',
                row.division || '-',
                row.report_date || '-',
                row.check_in_time ? formatTimeID(row.check_in_time) : '-',
                row.check_out_time ? formatTimeID(row.check_out_time) : '-',
                otTime,
                otDuration,
                attendanceStatusLabel(row)
            ];
            values.forEach((value, col) => {
                doc.text(String(value), columns[col], yPosition, { width: col === 2 ? 88 : col === 8 ? 85 : 68 });
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
        worksheet.mergeCells('A1:L1');
        worksheet.getCell('A1').value = 'LAPORAN ABSENSI HARIAN';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:L2');
        worksheet.getCell('A2').value = `Periode: ${formatDateID(range.start)} - ${formatDateID(range.end)}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.getRow(4).values = ['No', 'ID Karyawan', 'Nama', 'Departemen', 'Divisi', 'Tanggal', 'Check-in', 'Check-out', 'Waktu Lembur', 'Durasi Lembur (Jam)', 'Lokasi', 'Status'];
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };

        rows.forEach((row, index) => {
            const otCat = row.overtime_category ? ` (${row.overtime_category === 'Lembur Awal' ? 'Awal' : row.overtime_category === 'Lembur Akhir' ? 'Akhir' : row.overtime_category})` : '';
            const otTime = row.overtime_start && row.overtime_end
                ? `${row.overtime_start} - ${row.overtime_end}${otCat}`
                : (row.overtime_hours > 0 ? 'Lembur' : '-');
            const otDuration = row.overtime_hours > 0 ? `${row.overtime_hours} jam` : '-';
            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                row.department || '-',
                row.division || '-',
                row.report_date || '-',
                row.check_in_time ? formatTimeID(row.check_in_time) : '-',
                row.check_out_time ? formatTimeID(row.check_out_time) : '-',
                otTime,
                otDuration,
                row.location_name || '-',
                attendanceStatusLabel(row)
            ]);
        });

        worksheet.columns = [
            { width: 5 }, { width: 14 }, { width: 24 }, { width: 16 }, { width: 16 },
            { width: 14 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 18 },
            { width: 18 }, { width: 18 }
        ];

        const excelSummary = summarizeAttendance(rows, range.start, range.end);
        const summaryRow = worksheet.rowCount + 2;
        worksheet.getCell(`A${summaryRow}`).value = `Hadir: ${excelSummary.present} | Tidak Hadir: ${excelSummary.absent} | Lengkap: ${excelSummary.completed} | Izin Terlambat: ${excelSummary.on_late} | Cuti: ${excelSummary.on_leave} | Pengajuan Absensi: ${excelSummary.on_manual} | Lembur: ${excelSummary.on_overtime || 0} (${excelSummary.total_overtime_hours || 0} jam)`;
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
                u.id as user_id,
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
                u.id as user_id,
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
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day,
                COALESCE(LEFT(ot_req.overtime_start::text, 5), '') AS overtime_start,
                COALESCE(LEFT(ot_req.overtime_end::text, 5), '') AS overtime_end,
                COALESCE(ot_req.hours, ot_rec.hours, 0)::numeric AS overtime_hours,
                COALESCE(NULLIF(ot_req.reason, ''), ot_rec.description, '') AS overtime_reason,
                COALESCE(ot_req.shift_name, esa_shift.shift_name, '') AS overtime_shift_name,
                COALESCE(ot_req.shift_start, esa_shift.shift_start) AS overtime_shift_start,
                COALESCE(ot_req.shift_end, esa_shift.shift_end) AS overtime_shift_end
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
            LEFT JOIN LATERAL (
                SELECT 
                    otr.overtime_start,
                    otr.overtime_end,
                    COALESCE(ore.actual_hours, otr.estimated_hours, 0) AS hours,
                    otr.reason,
                    ws.name AS shift_name,
                    ws.start_time AS shift_start,
                    ws.end_time AS shift_end
                FROM overtime_request_employees ore
                JOIN overtime_requests otr ON ore.overtime_request_id = otr.id
                LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
                WHERE ore.user_id = u.id
                  AND otr.date = d.date::date
                  AND otr.status IN ('approved', 'completed')
                ORDER BY otr.id DESC
                LIMIT 1
            ) ot_req ON true
            LEFT JOIN LATERAL (
                SELECT ws.name AS shift_name, ws.start_time AS shift_start, ws.end_time AS shift_end
                FROM employee_shift_assignments esa
                JOIN work_shifts ws ON ws.id = esa.shift_id
                WHERE esa.user_id = u.id AND esa.assignment_date = d.date::date
                LIMIT 1
            ) esa_shift ON true
            LEFT JOIN LATERAL (
                SELECT 
                    hours,
                    description
                FROM overtime_records
                WHERE user_id = u.id
                  AND date = d.date::date
                  AND status = 'approved'
                ORDER BY id DESC
                LIMIT 1
            ) ot_rec ON true
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL OR ot_req.hours IS NOT NULL OR ot_rec.hours IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const records = result.rows.map(r => ({
            ...r,
            attendance_date: r.attendance_date || r.check_in_time || r.check_out_time,
            overtime_hours: parseFloat(r.overtime_hours) || 0,
            overtime_start: r.overtime_start || '',
            overtime_end: r.overtime_end || '',
            overtime_reason: r.overtime_reason || '',
            overtime_category: computeOvertimeCategory(r.overtime_start, r.overtime_end, r.overtime_shift_start, r.overtime_shift_end, r.is_off_day)
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
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day,
                COALESCE(LEFT(ot_req.overtime_start::text, 5), '') AS overtime_start,
                COALESCE(LEFT(ot_req.overtime_end::text, 5), '') AS overtime_end,
                COALESCE(ot_req.hours, ot_rec.hours, 0)::numeric AS overtime_hours,
                COALESCE(ot_req.shift_start, esa_shift.shift_start) AS overtime_shift_start,
                COALESCE(ot_req.shift_end, esa_shift.shift_end) AS overtime_shift_end
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
            LEFT JOIN LATERAL (
                SELECT 
                    otr.overtime_start,
                    otr.overtime_end,
                    COALESCE(ore.actual_hours, otr.estimated_hours, 0) AS hours,
                    ws.start_time AS shift_start,
                    ws.end_time AS shift_end
                FROM overtime_request_employees ore
                JOIN overtime_requests otr ON ore.overtime_request_id = otr.id
                LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
                WHERE ore.user_id = u.id
                  AND otr.date = d.date::date
                  AND otr.status IN ('approved', 'completed')
                ORDER BY otr.id DESC
                LIMIT 1
            ) ot_req ON true
            LEFT JOIN LATERAL (
                SELECT ws.start_time AS shift_start, ws.end_time AS shift_end
                FROM employee_shift_assignments esa
                JOIN work_shifts ws ON ws.id = esa.shift_id
                WHERE esa.user_id = u.id AND esa.assignment_date = d.date::date
                LIMIT 1
            ) esa_shift ON true
            LEFT JOIN LATERAL (
                SELECT 
                    hours
                FROM overtime_records
                WHERE user_id = u.id
                  AND date = d.date::date
                  AND status = 'approved'
                ORDER BY id DESC
                LIMIT 1
            ) ot_rec ON true
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL OR ot_req.hours IS NOT NULL OR ot_rec.hours IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });

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
        const otCount = result.rows.filter(r => (parseFloat(r.overtime_hours) || 0) > 0).length;
        const totalOtHours = Math.round(result.rows.reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0) * 10) / 10;
        doc.fontSize(10);
        doc.text(`Total Record: ${totalRecords}  |  Hadir: ${totalPresent}  |  OFF: ${totalOff}  |  Izin/Cuti: ${totalLeave}  |  Lembur: ${otCount} (${totalOtHours} jam)`);
        doc.moveDown(1);

        // Table Header
        const tableTop = doc.y;
        const col1 = 36, col2 = 60, col3 = 135, col4 = 230, col5 = 330, col6 = 390, col7 = 450, col8 = 540, col9 = 620, col10 = 700;

        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('No', col1, tableTop);
        doc.text('ID', col2, tableTop);
        doc.text('Nama', col3, tableTop);
        doc.text('Tanggal', col4, tableTop);
        doc.text('Masuk', col5, tableTop);
        doc.text('Pulang', col6, tableTop);
        doc.text('Waktu Lembur', col7, tableTop);
        doc.text('Durasi', col8, tableTop);
        doc.text('Lokasi', col9, tableTop);
        doc.text('Status', col10, tableTop);

        doc.moveTo(col1, tableTop + 14).lineTo(770, tableTop + 14).stroke();

        // Table Rows
        doc.font('Helvetica').fontSize(8);
        let yPosition = tableTop + 22;

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

            const otCategory = computeOvertimeCategory(row.overtime_start, row.overtime_end, row.overtime_shift_start, row.overtime_shift_end, row.is_off_day);
            const otCat = otCategory ? ` (${otCategory === 'Lembur Awal' ? 'Awal' : otCategory === 'Lembur Akhir' ? 'Akhir' : otCategory})` : '';
            const otHours = parseFloat(row.overtime_hours) || 0;
            const otTime = row.overtime_start && row.overtime_end
                ? `${row.overtime_start} - ${row.overtime_end}${otCat}`
                : (otHours > 0 ? 'Lembur' : '-');
            const otDuration = otHours > 0 ? `${otHours} jam` : '-';

            doc.text(String(index + 1), col1, yPosition);
            doc.text(row.employee_id || '-', col2, yPosition);
            doc.text(row.name || '-', col3, yPosition, { width: 90 });
            doc.text(row.attendance_date ? formatDateID(row.attendance_date) : '-', col4, yPosition, { width: 95 });
            doc.text(row.is_off_day ? 'OFF' : (row.check_in_time ? formatTimeID(row.check_in_time) : '-'), col5, yPosition);
            doc.text(row.is_off_day ? 'OFF' : (row.check_out_time ? formatTimeID(row.check_out_time) : '-'), col6, yPosition);
            doc.text(otTime, col7, yPosition, { width: 85 });
            doc.text(otDuration, col8, yPosition, { width: 75 });
            doc.text(row.location_name || '-', col9, yPosition, { width: 75 });
            doc.text(status, col10, yPosition);

            yPosition += 16;
        });

        // Footer
        const footerY = doc.page.height - 30;
        doc.fontSize(7).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 36, footerY);

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
                CASE WHEN uod.id IS NOT NULL THEN true ELSE false END as is_off_day,
                COALESCE(LEFT(ot_req.overtime_start::text, 5), '') AS overtime_start,
                COALESCE(LEFT(ot_req.overtime_end::text, 5), '') AS overtime_end,
                COALESCE(ot_req.hours, ot_rec.hours, 0)::numeric AS overtime_hours,
                COALESCE(ot_req.shift_start, esa_shift.shift_start) AS overtime_shift_start,
                COALESCE(ot_req.shift_end, esa_shift.shift_end) AS overtime_shift_end
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
            LEFT JOIN LATERAL (
                SELECT 
                    otr.overtime_start,
                    otr.overtime_end,
                    COALESCE(ore.actual_hours, otr.estimated_hours, 0) AS hours,
                    ws.start_time AS shift_start,
                    ws.end_time AS shift_end
                FROM overtime_request_employees ore
                JOIN overtime_requests otr ON ore.overtime_request_id = otr.id
                LEFT JOIN work_shifts ws ON ws.id = otr.shift_id
                WHERE ore.user_id = u.id
                  AND otr.date = d.date::date
                  AND otr.status IN ('approved', 'completed')
                ORDER BY otr.id DESC
                LIMIT 1
            ) ot_req ON true
            LEFT JOIN LATERAL (
                SELECT ws.start_time AS shift_start, ws.end_time AS shift_end
                FROM employee_shift_assignments esa
                JOIN work_shifts ws ON ws.id = esa.shift_id
                WHERE esa.user_id = u.id AND esa.assignment_date = d.date::date
                LIMIT 1
            ) esa_shift ON true
            LEFT JOIN LATERAL (
                SELECT 
                    hours
                FROM overtime_records
                WHERE user_id = u.id
                  AND date = d.date::date
                  AND status = 'approved'
                ORDER BY id DESC
                LIMIT 1
            ) ot_rec ON true
            WHERE u.role IN ('employee', 'manager') ${userFilter}
                AND (ci.id IS NOT NULL OR co.id IS NOT NULL OR uod.id IS NOT NULL OR lr.id IS NOT NULL OR ot_req.hours IS NOT NULL OR ot_rec.hours IS NOT NULL)
            ORDER BY d.date DESC, u.name ASC`,
            params
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Riwayat Absensi');

        // Title
        worksheet.mergeCells('A1:J1');
        worksheet.getCell('A1').value = 'LAPORAN RIWAYAT ABSENSI';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:J2');
        worksheet.getCell('A2').value = `Periode: ${formatDateID(targetStart)} - ${formatDateID(targetEnd)}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        worksheet.getRow(4).values = ['No', 'ID Karyawan', 'Nama', 'Tanggal', 'Check-in', 'Check-out', 'Waktu Lembur', 'Durasi Lembur (Jam)', 'Lokasi', 'Status'];
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

            const otCategory = computeOvertimeCategory(row.overtime_start, row.overtime_end, row.overtime_shift_start, row.overtime_shift_end, row.is_off_day);
            const otCat = otCategory ? ` (${otCategory === 'Lembur Awal' ? 'Awal' : otCategory === 'Lembur Akhir' ? 'Akhir' : otCategory})` : '';
            const otHours = parseFloat(row.overtime_hours) || 0;
            const otTime = row.overtime_start && row.overtime_end
                ? `${row.overtime_start} - ${row.overtime_end}${otCat}`
                : (otHours > 0 ? 'Lembur' : '-');
            const otDuration = otHours > 0 ? `${otHours} jam` : '-';

            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                row.attendance_date ? formatDateID(row.attendance_date) : '-',
                row.is_off_day ? 'OFF' : (row.check_in_time ? formatTimeID(row.check_in_time) : '-'),
                row.is_off_day ? 'OFF' : (row.check_out_time ? formatTimeID(row.check_out_time) : '-'),
                otTime,
                otDuration,
                row.location_name || '-',
                status
            ]);
        });

        // Column widths
        worksheet.columns = [
            { width: 5 },
            { width: 15 },
            { width: 25 },
            { width: 26 },
            { width: 12 },
            { width: 12 },
            { width: 16 },
            { width: 18 },
            { width: 20 },
            { width: 15 }
        ];

        // Summary row
        const summaryRow = worksheet.rowCount + 2;
        const totalPresent = result.rows.filter(r => r.check_in_time).length;
        const totalOff = result.rows.filter(r => r.is_off_day).length;
        const totalLeave = result.rows.filter(r => r.leave_type).length;
        const otCount = result.rows.filter(r => (parseFloat(r.overtime_hours) || 0) > 0).length;
        const totalOtHours = Math.round(result.rows.reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0) * 10) / 10;
        worksheet.getCell(`A${summaryRow}`).value = `Total Record: ${result.rows.length}  |  Hadir: ${totalPresent}  |  OFF: ${totalOff}  |  Izin/Cuti: ${totalLeave}  |  Lembur: ${otCount} (${totalOtHours} jam)`;
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

// ============================================
// CONTRACT EXPIRATION REPORT ENDPOINTS
// ============================================

const CONTRACT_PARAMETER_LABELS = {
    '1_month': 'Sisa Kontrak ≤ 1 Bulan (≤ 30 Hari)',
    '2_months': 'Sisa Kontrak ≤ 2 Bulan (≤ 60 Hari)',
    '3_months': 'Sisa Kontrak ≤ 3 Bulan (≤ 90 Hari)',
    'all_expiring': 'Semua Kontrak Akan Habis (≤ 3 Bulan)',
    'expired': 'Kontrak Sudah Habis / Lewat',
    'all': 'Semua Karyawan Kontrak',
    'no_date': 'Karyawan Kontrak Belum Ada Tanggal'
};

function formatRemainingContract(daysLeft) {
    if (daysLeft === null || daysLeft === undefined) {
        return {
            days_left: null,
            status: 'unset',
            label: 'Belum Diatur',
            badge: 'secondary',
            color: '#6b7280'
        };
    }
    const num = parseInt(daysLeft, 10);
    if (num < 0) {
        const absDays = Math.abs(num);
        return {
            days_left: num,
            status: 'expired',
            label: `Lewat ${absDays} hari`,
            badge: 'danger',
            color: '#dc2626'
        };
    }
    if (num === 0) {
        return {
            days_left: 0,
            status: 'today',
            label: 'Habis Hari Ini',
            badge: 'danger',
            color: '#dc2626'
        };
    }
    if (num <= 30) {
        return {
            days_left: num,
            status: 'urgent',
            label: `${num} hari lagi (≤ 1 Bulan)`,
            badge: 'danger',
            color: '#ef4444'
        };
    }
    if (num <= 60) {
        const m = Math.floor(num / 30);
        const d = num % 30;
        const txt = d > 0 ? `${m} bln ${d} hr lagi` : `${m} bulan lagi`;
        return {
            days_left: num,
            status: 'warning',
            label: `${txt} (≤ 2 Bulan)`,
            badge: 'warning',
            color: '#f59e0b'
        };
    }
    if (num <= 90) {
        const m = Math.floor(num / 30);
        const d = num % 30;
        const txt = d > 0 ? `${m} bln ${d} hr lagi` : `${m} bulan lagi`;
        return {
            days_left: num,
            status: 'monitoring',
            label: `${txt} (≤ 3 Bulan)`,
            badge: 'info',
            color: '#3b82f6'
        };
    }
    const m = Math.floor(num / 30);
    return {
        days_left: num,
        status: 'safe',
        label: `> ${m} bulan lagi`,
        badge: 'success',
        color: '#10b981'
    };
}

async function fetchExpiringContracts(options = {}) {
    const { parameter = '3_months', department, division, search } = options;
    const conditions = [
        "u.role != 'admin'",
        "(ed.contract_end_date IS NOT NULL OR LOWER(COALESCE(ed.employment_status, '')) LIKE '%kontrak%')"
    ];
    const params = [];

    if (department) {
        params.push(department);
        conditions.push(`ed.department = $${params.length}`);
    }
    if (division) {
        params.push(division);
        conditions.push(`ed.division = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(u.name ILIKE $${params.length} OR u.employee_id ILIKE $${params.length} OR ed.nik ILIKE $${params.length})`);
    }

    if (parameter === '1_month') {
        conditions.push(`ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 30`);
    } else if (parameter === '2_months') {
        conditions.push(`ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 60`);
    } else if (parameter === '3_months') {
        conditions.push(`ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 90`);
    } else if (parameter === 'expired') {
        conditions.push(`ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) < 0`);
    } else if (parameter === 'all_expiring') {
        conditions.push(`ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) <= 90`);
    } else if (parameter === 'no_date') {
        conditions.push(`ed.contract_end_date IS NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listQuery = `
        SELECT 
            u.id, 
            u.employee_id, 
            u.name, 
            u.email, 
            ed.phone, 
            ed.nik,
            ed.department, 
            ed.division, 
            ed.position, 
            COALESCE(ed.employment_status, 'Kontrak') as employment_status, 
            ed.join_date,
            ed.contract_start_date, 
            ed.contract_end_date,
            CURRENT_DATE as today,
            CASE 
                WHEN ed.contract_end_date IS NOT NULL THEN (ed.contract_end_date - CURRENT_DATE) 
                ELSE NULL 
            END as days_left
        FROM users u
        LEFT JOIN employee_details ed ON u.id = ed.user_id
        ${whereClause}
        ORDER BY 
            CASE WHEN ed.contract_end_date IS NULL THEN 1 ELSE 0 END ASC,
            ed.contract_end_date ASC,
            u.name ASC
    `;

    // Summary query across all contract employees respecting dept/div/search
    const summaryConditions = [
        "u.role != 'admin'",
        "(ed.contract_end_date IS NOT NULL OR LOWER(COALESCE(ed.employment_status, '')) LIKE '%kontrak%')"
    ];
    const summaryParams = [];
    if (department) {
        summaryParams.push(department);
        summaryConditions.push(`ed.department = $${summaryParams.length}`);
    }
    if (division) {
        summaryParams.push(division);
        summaryConditions.push(`ed.division = $${summaryParams.length}`);
    }
    if (search) {
        summaryParams.push(`%${search}%`);
        summaryConditions.push(`(u.name ILIKE $${summaryParams.length} OR u.employee_id ILIKE $${summaryParams.length} OR ed.nik ILIKE $${summaryParams.length})`);
    }

    const summaryQuery = `
        SELECT
            COUNT(*)::int as total_contracts,
            COUNT(*) FILTER (WHERE ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 30)::int as within_1_month,
            COUNT(*) FILTER (WHERE ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 60)::int as within_2_months,
            COUNT(*) FILTER (WHERE ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) >= 0 AND (ed.contract_end_date - CURRENT_DATE) <= 90)::int as within_3_months,
            COUNT(*) FILTER (WHERE ed.contract_end_date IS NOT NULL AND (ed.contract_end_date - CURRENT_DATE) < 0)::int as expired,
            COUNT(*) FILTER (WHERE ed.contract_end_date IS NULL)::int as unset
        FROM users u
        LEFT JOIN employee_details ed ON u.id = ed.user_id
        WHERE ${summaryConditions.join(' AND ')}
    `;

    const [listResult, summaryResult] = await Promise.all([
        pool.query(listQuery, params),
        pool.query(summaryQuery, summaryParams)
    ]);

    const records = listResult.rows.map(row => {
        const remaining = formatRemainingContract(row.days_left);
        return {
            ...row,
            contract_start_date: row.contract_start_date ? dateOnly(row.contract_start_date) : null,
            contract_end_date: row.contract_end_date ? dateOnly(row.contract_end_date) : null,
            join_date: row.join_date ? dateOnly(row.join_date) : null,
            days_left: remaining.days_left,
            remaining_label: remaining.label,
            status_code: remaining.status,
            badge_type: remaining.badge,
            color: remaining.color
        };
    });

    return {
        records,
        summary: summaryResult.rows[0] || {
            total_contracts: 0,
            within_1_month: 0,
            within_2_months: 0,
            within_3_months: 0,
            expired: 0,
            unset: 0
        },
        parameter,
        parameter_label: CONTRACT_PARAMETER_LABELS[parameter] || 'Semua Karyawan Kontrak'
    };
}

// Get expiring contract report JSON
router.get('/contracts/expiring', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { parameter = '3_months', department, division, search } = req.query;
        const data = await fetchExpiringContracts({ parameter, department, division, search });
        res.json(data);
    } catch (error) {
        console.error('Get contract expiring report error:', error);
        res.status(500).json({ error: 'Gagal memuat laporan kontrak karyawan' });
    }
});

// Export Contract Expiration Report as PDF
router.get('/export/contracts/pdf', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { parameter = '3_months', department, division, search } = req.query;
        const data = await fetchExpiringContracts({ parameter, department, division, search });

        const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-habis-kontrak-${parameter}.pdf`);

        doc.pipe(res);

        // Header Title
        doc.fontSize(18).text('LAPORAN DATA KARYAWAN AKAN HABIS KONTRAK', { align: 'center' });
        doc.fontSize(11).text(`Kriteria: ${data.parameter_label}${department ? ` | Departemen: ${department}` : ''}${division ? ` | Divisi: ${division}` : ''}`, { align: 'center' });
        doc.moveDown(1.5);

        // Summary Bar
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text(
            `Total Kontrak: ${data.summary.total_contracts}   |   ≤ 1 Bulan: ${data.summary.within_1_month}   |   ≤ 2 Bulan: ${data.summary.within_2_months}   |   ≤ 3 Bulan: ${data.summary.within_3_months}   |   Sudah Habis: ${data.summary.expired}   |   Belum Ada Tgl: ${data.summary.unset}`,
            { align: 'center' }
        );
        doc.moveDown(1);

        const tableTop = doc.y;
        // 11 Columns: No, ID, Nama, Dept, Divisi, Jabatan, Status, Mulai, Habis, Sisa, Keterangan
        const columns = [36, 60, 130, 230, 310, 390, 460, 520, 580, 640, 710];
        doc.font('Helvetica-Bold').fontSize(8);
        ['No', 'ID', 'Nama Karyawan', 'Departemen', 'Divisi', 'Jabatan', 'Status', 'Mulai', 'Habis Kontrak', 'Sisa Hari', 'Keterangan'].forEach((label, index) => {
            doc.text(label, columns[index], tableTop, { width: index === 2 ? 95 : 65 });
        });
        doc.moveTo(36, tableTop + 14).lineTo(780, tableTop + 14).stroke();

        doc.font('Helvetica').fontSize(8);
        let yPosition = tableTop + 20;

        if (data.records.length === 0) {
            doc.text('Tidak ada data karyawan yang sesuai dengan kriteria filter.', 36, yPosition, { align: 'center', width: 740 });
        } else {
            data.records.forEach((row, index) => {
                if (yPosition > 520) {
                    doc.addPage();
                    yPosition = 40;
                }
                const values = [
                    String(index + 1),
                    row.employee_id || '-',
                    row.name || '-',
                    row.department || '-',
                    row.division || '-',
                    row.position || '-',
                    row.employment_status || 'Kontrak',
                    row.contract_start_date ? row.contract_start_date : '-',
                    row.contract_end_date ? row.contract_end_date : 'Belum Diatur',
                    row.days_left !== null ? (row.days_left >= 0 ? `${row.days_left} hr` : `-${Math.abs(row.days_left)} hr`) : '-',
                    row.remaining_label || '-'
                ];

                values.forEach((value, col) => {
                    doc.text(String(value), columns[col], yPosition, { width: col === 2 ? 95 : col === 10 ? 70 : 65 });
                });

                yPosition += 16;
            });
        }

        // Footer
        doc.fontSize(8).text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 36, 560);
        doc.end();
    } catch (error) {
        console.error('Export Contract PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF laporan kontrak' });
    }
});

// Export Contract Expiration Report as Excel
router.get('/export/contracts/excel', authenticateToken, canViewReports, async (req, res) => {
    try {
        const { parameter = '3_months', department, division, search } = req.query;
        const data = await fetchExpiringContracts({ parameter, department, division, search });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Habis Kontrak');

        // Title
        worksheet.mergeCells('A1:K1');
        worksheet.getCell('A1').value = 'LAPORAN DATA KARYAWAN AKAN HABIS KONTRAK';
        worksheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF1E3A8A' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:K2');
        worksheet.getCell('A2').value = `Kriteria Parameter: ${data.parameter_label}${department ? ` | Departemen: ${department}` : ''}${division ? ` | Divisi: ${division}` : ''}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:K3');
        worksheet.getCell('A3').value = `Total Kontrak: ${data.summary.total_contracts}  |  ≤ 1 Bulan: ${data.summary.within_1_month}  |  ≤ 2 Bulan: ${data.summary.within_2_months}  |  ≤ 3 Bulan: ${data.summary.within_3_months}  |  Sudah Habis: ${data.summary.expired}  |  Belum Ada Tgl: ${data.summary.unset}`;
        worksheet.getCell('A3').font = { italic: true, size: 10 };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        // Headers
        worksheet.getRow(5).values = [
            'No', 'ID Karyawan', 'Nama Lengkap', 'Departemen', 'Divisi',
            'Jabatan', 'Status Karyawan', 'Tgl Mulai Kontrak', 'Tgl Habis Kontrak',
            'Sisa Hari', 'Keterangan Masa Kontrak'
        ];
        worksheet.getRow(5).height = 24;
        worksheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(5).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };

        data.records.forEach((row, index) => {
            const addedRow = worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.name || '-',
                row.department || '-',
                row.division || '-',
                row.position || '-',
                row.employment_status || 'Kontrak',
                row.contract_start_date ? formatDateID(row.contract_start_date) : '-',
                row.contract_end_date ? formatDateID(row.contract_end_date) : 'Belum Diatur',
                row.days_left !== null ? row.days_left : '-',
                row.remaining_label || '-'
            ]);

            // Light highlight if <= 30 days or expired
            if (row.days_left !== null && row.days_left < 0) {
                addedRow.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                addedRow.getCell(11).font = { color: { argb: 'FFDC2626' }, bold: true };
            } else if (row.days_left !== null && row.days_left <= 30) {
                addedRow.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
                addedRow.getCell(11).font = { color: { argb: 'FFEA580C' }, bold: true };
            }
        });

        worksheet.columns = [
            { width: 6 },
            { width: 14 },
            { width: 26 },
            { width: 18 },
            { width: 18 },
            { width: 20 },
            { width: 16 },
            { width: 22 },
            { width: 22 },
            { width: 12 },
            { width: 26 }
        ];

        const footerRow = worksheet.rowCount + 2;
        worksheet.getCell(`A${footerRow}`).value = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
        worksheet.getCell(`A${footerRow}`).font = { italic: true, size: 9 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-habis-kontrak-${parameter}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Contract Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel laporan kontrak' });
    }
});

module.exports = router;

