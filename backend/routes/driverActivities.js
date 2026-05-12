const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Get driver activities (with filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year, user_id } = req.query;
        let query = `
            SELECT da.*, u.name as user_name, u.employee_id,
                   ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance,
                   ed.driver_ritase_dekat_allowance, ed.driver_ritase_jauh_allowance
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM da.activity_date) = $${paramIdx} AND EXTRACT(YEAR FROM da.activity_date) = $${paramIdx + 1}`;
            params.push(month, year);
            paramIdx += 2;
        }
        if (user_id) {
            query += ` AND da.user_id = $${paramIdx}`;
            params.push(user_id);
            paramIdx++;
        }

        query += ' ORDER BY da.activity_date DESC, u.name ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get driver activities error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get summary for payroll (per driver per month)
router.get('/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const result = await pool.query(`
            SELECT da.user_id, u.name as user_name, u.employee_id,
                   COUNT(*) as total_days,
                   SUM(CASE WHEN da.is_subuh THEN 1 ELSE 0 END) as total_subuh,
                   SUM(da.rit_count) as total_rit,
                   SUM(CASE WHEN da.is_overnight THEN 1 ELSE 0 END) as total_overnight,
                   SUM(COALESCE(da.ritase_dekat, 0)) as total_ritase_dekat,
                   SUM(COALESCE(da.ritase_jauh, 0)) as total_ritase_jauh,
                   COALESCE(ed.driver_subuh_allowance, 0) as tarif_subuh,
                   COALESCE(ed.driver_rit_allowance, 0) as tarif_rit,
                   COALESCE(ed.driver_inap_allowance, 0) as tarif_inap,
                   COALESCE(ed.driver_ritase_dekat_allowance, 0) as tarif_ritase_dekat,
                   COALESCE(ed.driver_ritase_jauh_allowance, 0) as tarif_ritase_jauh
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE EXTRACT(MONTH FROM da.activity_date) = $1
              AND EXTRACT(YEAR FROM da.activity_date) = $2
            GROUP BY da.user_id, u.name, u.employee_id, 
                     ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_dekat_allowance, ed.driver_ritase_jauh_allowance
            ORDER BY u.name ASC
        `, [month, year]);

        // Calculate totals
        const summary = result.rows.map(row => {
            const subuhAmt = parseInt(row.total_subuh) * parseFloat(row.tarif_subuh);
            const ritAmt = parseInt(row.total_rit) * parseFloat(row.tarif_rit);
            const overnightAmt = parseInt(row.total_overnight) * parseFloat(row.tarif_inap);
            const ritaseDekatAmt = parseInt(row.total_ritase_dekat) * parseFloat(row.tarif_ritase_dekat);
            const ritaseJauhAmt = parseInt(row.total_ritase_jauh) * parseFloat(row.tarif_ritase_jauh);
            const ritaseAmt = ritaseDekatAmt + ritaseJauhAmt;
            return {
                ...row,
                total_subuh_amount: subuhAmt,
                total_rit_amount: ritAmt,
                total_overnight_amount: overnightAmt,
                total_ritase_dekat_amount: ritaseDekatAmt,
                total_ritase_jauh_amount: ritaseJauhAmt,
                total_ritase_amount: ritaseAmt,
                grand_total: subuhAmt + ritAmt + overnightAmt + ritaseAmt
            };
        });

        res.json(summary);
    } catch (error) {
        console.error('Get driver summary error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get all drivers (for dropdown)
router.get('/drivers', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.employee_id
            FROM users u
            JOIN employee_details ed ON u.id = ed.user_id
            WHERE u.role = 'employee' AND ed.is_driver = true
            ORDER BY u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create driver activity
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, ritase_dekat, ritase_jauh } = req.body;

        if (!user_id || !activity_date) {
            return res.status(400).json({ error: 'Driver dan tanggal harus diisi' });
        }

        // Verify user is a driver
        const driverCheck = await pool.query(
            'SELECT ed.is_driver FROM employee_details ed WHERE ed.user_id = $1',
            [user_id]
        );
        if (driverCheck.rows.length === 0 || !driverCheck.rows[0].is_driver) {
            return res.status(400).json({ error: 'Karyawan ini bukan driver' });
        }

        const result = await pool.query(`
            INSERT INTO driver_activities (user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, created_by, ritase_dekat, ritase_jauh)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id, activity_date) DO UPDATE SET
                is_subuh = EXCLUDED.is_subuh,
                departure_time = EXCLUDED.departure_time,
                rit_count = EXCLUDED.rit_count,
                rit_notes = EXCLUDED.rit_notes,
                is_overnight = EXCLUDED.is_overnight,
                notes = EXCLUDED.notes,
                ritase_dekat = EXCLUDED.ritase_dekat,
                ritase_jauh = EXCLUDED.ritase_jauh,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user_id, activity_date,
            is_subuh || false,
            departure_time || null,
            rit_count || 1,
            rit_notes || null,
            is_overnight || false,
            notes || null,
            req.user.id,
            ritase_dekat || 0,
            ritase_jauh || 0
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update driver activity
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, ritase_dekat, ritase_jauh } = req.body;

        const result = await pool.query(`
            UPDATE driver_activities SET
                is_subuh = $1, departure_time = $2, rit_count = $3, rit_notes = $4,
                is_overnight = $5, notes = $6, ritase_dekat = $7, ritase_jauh = $8, updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
        `, [
            is_subuh || false, departure_time || null, rit_count || 1,
            rit_notes || null, is_overnight || false, notes || null, 
            ritase_dekat || 0, ritase_jauh || 0, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete driver activity
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM driver_activities WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }
        res.json({ message: 'Data berhasil dihapus' });
    } catch (error) {
        console.error('Delete driver activity error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Bulk create/update (for quick entry of multiple days)
router.post('/bulk', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { activities } = req.body; // Array of { user_id, activity_date, is_subuh, rit_count, is_overnight, ... }
        if (!Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({ error: 'Data aktivitas tidak valid' });
        }

        await client.query('BEGIN');

        const results = [];
        for (const act of activities) {
            const result = await client.query(`
                INSERT INTO driver_activities (user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, created_by, ritase_dekat, ritase_jauh)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (user_id, activity_date) DO UPDATE SET
                    is_subuh = EXCLUDED.is_subuh,
                    departure_time = EXCLUDED.departure_time,
                    rit_count = EXCLUDED.rit_count,
                    rit_notes = EXCLUDED.rit_notes,
                    is_overnight = EXCLUDED.is_overnight,
                    notes = EXCLUDED.notes,
                    ritase_dekat = EXCLUDED.ritase_dekat,
                    ritase_jauh = EXCLUDED.ritase_jauh,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                act.user_id, act.activity_date,
                act.is_subuh || false, act.departure_time || null,
                act.rit_count || 1, act.rit_notes || null,
                act.is_overnight || false, act.notes || null,
                req.user.id,
                act.ritase_dekat || 0, act.ritase_jauh || 0
            ]);
            results.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: `${results.length} data berhasil disimpan`, data: results });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk create driver activities error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// ============================================
// EXPORT ENDPOINTS
// ============================================

// Helper function to format currency
function formatCurrency(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
}

// Export Summary as PDF
router.get('/export/summary/pdf', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const targetMonth = parseInt(month);
        const targetYear = parseInt(year);
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const result = await pool.query(`
            SELECT da.user_id, u.name as user_name, u.employee_id,
                   COUNT(*) as total_days,
                   SUM(CASE WHEN da.is_subuh THEN 1 ELSE 0 END) as total_subuh,
                   SUM(da.rit_count) as total_rit,
                   SUM(CASE WHEN da.is_overnight THEN 1 ELSE 0 END) as total_overnight,
                   SUM(COALESCE(da.ritase_dekat, 0)) as total_ritase_dekat,
                   SUM(COALESCE(da.ritase_jauh, 0)) as total_ritase_jauh,
                   COALESCE(ed.driver_subuh_allowance, 0) as tarif_subuh,
                   COALESCE(ed.driver_rit_allowance, 0) as tarif_rit,
                   COALESCE(ed.driver_inap_allowance, 0) as tarif_inap,
                   COALESCE(ed.driver_ritase_dekat_allowance, 0) as tarif_ritase_dekat,
                   COALESCE(ed.driver_ritase_jauh_allowance, 0) as tarif_ritase_jauh
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE EXTRACT(MONTH FROM da.activity_date) = $1
              AND EXTRACT(YEAR FROM da.activity_date) = $2
            GROUP BY da.user_id, u.name, u.employee_id, 
                     ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_dekat_allowance, ed.driver_ritase_jauh_allowance
            ORDER BY u.name ASC
        `, [targetMonth, targetYear]);

        const summary = result.rows.map(row => {
            const subuhAmt = parseInt(row.total_subuh) * parseFloat(row.tarif_subuh);
            const ritAmt = parseInt(row.total_rit) * parseFloat(row.tarif_rit);
            const overnightAmt = parseInt(row.total_overnight) * parseFloat(row.tarif_inap);
            const ritaseDekatAmt = parseInt(row.total_ritase_dekat) * parseFloat(row.tarif_ritase_dekat);
            const ritaseJauhAmt = parseInt(row.total_ritase_jauh) * parseFloat(row.tarif_ritase_jauh);
            const ritaseAmt = ritaseDekatAmt + ritaseJauhAmt;
            return {
                ...row,
                total_subuh_amount: subuhAmt,
                total_rit_amount: ritAmt,
                total_overnight_amount: overnightAmt,
                total_ritase_dekat_amount: ritaseDekatAmt,
                total_ritase_jauh_amount: ritaseJauhAmt,
                total_ritase_amount: ritaseAmt,
                grand_total: subuhAmt + ritAmt + overnightAmt + ritaseAmt
            };
        });

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=rekap-driver-${targetYear}-${targetMonth}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(18).text('REKAP AKTIVITAS DRIVER', { align: 'center' });
        doc.fontSize(12).text(`Periode: ${monthNames[targetMonth]} ${targetYear}`, { align: 'center' });
        doc.moveDown(2);

        // Table Header
        const tableTop = doc.y;
        const colDriver = 40, colHari = 160, colSubuh = 230, colRit = 340, colInap = 450, colTotal = 560;

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Driver', colDriver, tableTop);
        doc.text('Hari Kerja', colHari, tableTop);
        doc.text('Subuh (Hari & Pph)', colSubuh, tableTop);
        doc.text('RIT (Trip & Pph)', colRit, tableTop);
        doc.text('Menginap (Hari & Pph)', colInap, tableTop);
        doc.text('Grand Total', colTotal, tableTop, { width: 100, align: 'right' });

        doc.moveTo(40, tableTop + 15).lineTo(760, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica').fontSize(9);
        let yPosition = tableTop + 25;
        let totalAllSubuh = 0, totalAllRit = 0, totalAllInap = 0, grandTotalAll = 0;

        summary.forEach((row) => {
            if (yPosition > 500) {
                doc.addPage({ layout: 'landscape' });
                yPosition = 50;
            }

            totalAllSubuh += parseInt(row.total_subuh);
            totalAllRit += parseInt(row.total_rit);
            totalAllInap += parseInt(row.total_overnight);
            grandTotalAll += row.grand_total;

            doc.text(row.user_name || '-', colDriver, yPosition);
            doc.text(String(row.total_days), colHari, yPosition);
            doc.text(`${row.total_subuh} (${formatCurrency(row.total_subuh_amount)})`, colSubuh, yPosition);
            doc.text(`${row.total_rit} (${formatCurrency(row.total_rit_amount)})`, colRit, yPosition);
            doc.text(`${row.total_overnight} (${formatCurrency(row.total_overnight_amount)})`, colInap, yPosition);
            doc.text(formatCurrency(row.grand_total), colTotal, yPosition, { width: 100, align: 'right' });

            yPosition += 20;
        });

        doc.moveTo(40, yPosition).lineTo(760, yPosition).stroke();
        yPosition += 10;
        
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TOTAL', colDriver, yPosition);
        doc.text(`${totalAllSubuh} Hari`, colSubuh, yPosition);
        doc.text(`${totalAllRit} Trip`, colRit, yPosition);
        doc.text(`${totalAllInap} Hari`, colInap, yPosition);
        doc.text(formatCurrency(grandTotalAll), colTotal, yPosition, { width: 100, align: 'right' });

        // Footer
        doc.fontSize(8).font('Helvetica').text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 40, 550);

        doc.end();
    } catch (error) {
        console.error('Export Summary PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF' });
    }
});

// Export Summary as Excel
router.get('/export/summary/excel', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const targetMonth = parseInt(month);
        const targetYear = parseInt(year);
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const result = await pool.query(`
            SELECT da.user_id, u.name as user_name, u.employee_id,
                   COUNT(*) as total_days,
                   SUM(CASE WHEN da.is_subuh THEN 1 ELSE 0 END) as total_subuh,
                   SUM(da.rit_count) as total_rit,
                   SUM(CASE WHEN da.is_overnight THEN 1 ELSE 0 END) as total_overnight,
                   SUM(COALESCE(da.ritase_dekat, 0)) as total_ritase_dekat,
                   SUM(COALESCE(da.ritase_jauh, 0)) as total_ritase_jauh,
                   COALESCE(ed.driver_subuh_allowance, 0) as tarif_subuh,
                   COALESCE(ed.driver_rit_allowance, 0) as tarif_rit,
                   COALESCE(ed.driver_inap_allowance, 0) as tarif_inap,
                   COALESCE(ed.driver_ritase_dekat_allowance, 0) as tarif_ritase_dekat,
                   COALESCE(ed.driver_ritase_jauh_allowance, 0) as tarif_ritase_jauh
            FROM driver_activities da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            WHERE EXTRACT(MONTH FROM da.activity_date) = $1
              AND EXTRACT(YEAR FROM da.activity_date) = $2
            GROUP BY da.user_id, u.name, u.employee_id, 
                     ed.driver_subuh_allowance, ed.driver_rit_allowance, ed.driver_inap_allowance, ed.driver_ritase_dekat_allowance, ed.driver_ritase_jauh_allowance
            ORDER BY u.name ASC
        `, [targetMonth, targetYear]);

        const summary = result.rows.map(row => {
            const subuhAmt = parseInt(row.total_subuh) * parseFloat(row.tarif_subuh);
            const ritAmt = parseInt(row.total_rit) * parseFloat(row.tarif_rit);
            const overnightAmt = parseInt(row.total_overnight) * parseFloat(row.tarif_inap);
            const ritaseDekatAmt = parseInt(row.total_ritase_dekat) * parseFloat(row.tarif_ritase_dekat);
            const ritaseJauhAmt = parseInt(row.total_ritase_jauh) * parseFloat(row.tarif_ritase_jauh);
            const ritaseAmt = ritaseDekatAmt + ritaseJauhAmt;
            return {
                ...row,
                total_subuh_amount: subuhAmt,
                total_rit_amount: ritAmt,
                total_overnight_amount: overnightAmt,
                total_ritase_dekat_amount: ritaseDekatAmt,
                total_ritase_jauh_amount: ritaseJauhAmt,
                total_ritase_amount: ritaseAmt,
                grand_total: subuhAmt + ritAmt + overnightAmt + ritaseAmt
            };
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Driver');

        // Title
        worksheet.mergeCells('A1:K1');
        worksheet.getCell('A1').value = 'REKAP AKTIVITAS DRIVER';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:K2');
        worksheet.getCell('A2').value = `Periode: ${monthNames[targetMonth]} ${targetYear}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Header
        worksheet.getRow(4).values = [
            'No', 'ID Karyawan', 'Nama', 'Hari Kerja', 
            'Total Subuh', 'Uang Subuh', 
            'Total RIT', 'Uang RIT', 
            'Total Menginap', 'Uang Menginap', 
            'Total'
        ];
        worksheet.getRow(4).font = { bold: true };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
        };
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Data rows
        summary.forEach((row, index) => {
            worksheet.addRow([
                index + 1,
                row.employee_id || '-',
                row.user_name || '-',
                parseInt(row.total_days),
                parseInt(row.total_subuh),
                row.total_subuh_amount,
                parseInt(row.total_rit),
                row.total_rit_amount,
                parseInt(row.total_overnight),
                row.total_overnight_amount,
                row.grand_total
            ]);
        });

        // Column formatting
        worksheet.columns = [
            { width: 5 }, { width: 15 }, { width: 25 }, { width: 12 },
            { width: 12 }, { width: 15 }, { width: 12 }, { width: 15 },
            { width: 15 }, { width: 18 }, { width: 20 }
        ];

        // Ensure amount columns are formatted as numbers
        [6, 8, 10, 11].forEach(colIndex => {
            worksheet.getColumn(colIndex).numFmt = '#,##0';
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap-driver-${targetYear}-${targetMonth}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Summary Excel error:', error);
        res.status(500).json({ error: 'Gagal membuat Excel' });
    }
});

module.exports = router;
