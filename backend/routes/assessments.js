const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all assessments (with filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { month, year, user_id } = req.query;
        let query = `
            SELECT da.*, u.name as employee_name, u.employee_id as emp_id,
                   ed.department, ed.position,
                   assessor.name as assessor_name
            FROM discipline_assessments da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN employee_details ed ON da.user_id = ed.user_id
            LEFT JOIN users assessor ON da.assessed_by = assessor.id
        `;
        const params = [];
        const conditions = [];

        if (month) {
            params.push(parseInt(month));
            conditions.push(`da.period_month = $${params.length}`);
        }
        if (year) {
            params.push(parseInt(year));
            conditions.push(`da.period_year = $${params.length}`);
        }
        if (user_id) {
            params.push(parseInt(user_id));
            conditions.push(`da.user_id = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY da.period_year DESC, da.period_month DESC, u.name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get assessments error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Calculate discipline score automatically from attendance data
router.get('/calculate/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ error: 'Bulan dan tahun harus diisi' });
        }

        const m = parseInt(month);
        const y = parseInt(year);

        // Get the first and last day of the month
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

        // Count total working days (exclude weekends and off days)
        const offDaysResult = await pool.query(
            `SELECT COUNT(*) as count FROM user_off_days WHERE user_id = $1 AND off_date BETWEEN $2 AND $3`,
            [userId, startDate, endDate]
        );
        const offDays = parseInt(offDaysResult.rows[0].count);

        // Calculate weekdays in the month
        let totalWeekdays = 0;
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(y, m - 1, d);
            const day = date.getDay();
            if (day !== 0 && day !== 6) totalWeekdays++; // Exclude Sun & Sat
        }
        const totalWorkingDays = totalWeekdays - offDays;

        // Count present days (days with check_in)
        const presentResult = await pool.query(
            `SELECT COUNT(DISTINCT DATE(recorded_at)) as count 
             FROM attendance_records 
             WHERE user_id = $1 AND type = 'check_in' 
             AND DATE(recorded_at) BETWEEN $2 AND $3`,
            [userId, startDate, endDate]
        );
        const presentDays = parseInt(presentResult.rows[0].count);

        // Count late days (check_in after 09:00)
        const lateResult = await pool.query(
            `SELECT COUNT(DISTINCT DATE(recorded_at)) as count 
             FROM attendance_records 
             WHERE user_id = $1 AND type = 'check_in' 
             AND DATE(recorded_at) BETWEEN $2 AND $3
             AND EXTRACT(HOUR FROM recorded_at) >= 9`,
            [userId, startDate, endDate]
        );
        const lateDays = parseInt(lateResult.rows[0].count);

        // Count approved leave days
        const leaveResult = await pool.query(
            `SELECT COALESCE(SUM(
                LEAST(end_date, $3::date) - GREATEST(start_date, $2::date) + 1
            ), 0) as count
             FROM leave_requests
             WHERE user_id = $1 AND status = 'approved'
             AND start_date <= $3 AND end_date >= $2`,
            [userId, startDate, endDate]
        );
        const leaveDays = parseInt(leaveResult.rows[0].count);

        // Count overtime days
        const overtimeResult = await pool.query(
            `SELECT COUNT(DISTINCT date) as count 
             FROM overtime_records 
             WHERE user_id = $1 AND status = 'approved'
             AND date BETWEEN $2 AND $3`,
            [userId, startDate, endDate]
        );
        const overtimeDays = parseInt(overtimeResult.rows[0].count);

        // Calculate absent days
        const absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);

        // Calculate attendance score (0-100)
        // Formula: (present_days / total_working_days) * 100 - (late_days * 2) + (overtime_days * 1)
        let attendanceScore = 0;
        if (totalWorkingDays > 0) {
            attendanceScore = (presentDays / totalWorkingDays) * 100;
            attendanceScore -= lateDays * 2; // Penalty for late
            attendanceScore += overtimeDays * 1; // Bonus for overtime
            attendanceScore = Math.max(0, Math.min(100, attendanceScore));
        }

        // Get user info
        const userResult = await pool.query(
            `SELECT u.name, u.employee_id, ed.department, ed.position
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.id = $1`,
            [userId]
        );

        res.json({
            user: userResult.rows[0] || {},
            stats: {
                total_working_days: totalWorkingDays,
                present_days: presentDays,
                late_days: lateDays,
                absent_days: absentDays,
                leave_days: leaveDays,
                overtime_days: overtimeDays,
                attendance_score: Math.round(attendanceScore * 100) / 100
            }
        });
    } catch (error) {
        console.error('Calculate assessment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create or update assessment
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const {
            user_id, period_month, period_year,
            total_working_days, present_days, late_days, absent_days,
            leave_days, overtime_days, attendance_score,
            attitude_score, performance_score, notes
        } = req.body;

        if (!user_id || !period_month || !period_year) {
            return res.status(400).json({ error: 'User, bulan, dan tahun harus diisi' });
        }

        // Calculate final score: attendance 40%, attitude 30%, performance 30%
        const attScore = parseFloat(attendance_score) || 0;
        const attdScore = parseFloat(attitude_score) || 0;
        const perfScore = parseFloat(performance_score) || 0;
        const finalScore = (attScore * 0.4) + (attdScore * 0.3) + (perfScore * 0.3);

        // Determine grade
        let grade = 'E';
        if (finalScore >= 90) grade = 'A';
        else if (finalScore >= 80) grade = 'B';
        else if (finalScore >= 70) grade = 'C';
        else if (finalScore >= 60) grade = 'D';

        // Upsert
        const result = await pool.query(
            `INSERT INTO discipline_assessments 
             (user_id, period_month, period_year, total_working_days, present_days, late_days,
              absent_days, leave_days, overtime_days, attendance_score, attitude_score,
              performance_score, final_score, grade, notes, assessed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (user_id, period_month, period_year)
             DO UPDATE SET
                total_working_days = EXCLUDED.total_working_days,
                present_days = EXCLUDED.present_days,
                late_days = EXCLUDED.late_days,
                absent_days = EXCLUDED.absent_days,
                leave_days = EXCLUDED.leave_days,
                overtime_days = EXCLUDED.overtime_days,
                attendance_score = EXCLUDED.attendance_score,
                attitude_score = EXCLUDED.attitude_score,
                performance_score = EXCLUDED.performance_score,
                final_score = EXCLUDED.final_score,
                grade = EXCLUDED.grade,
                notes = EXCLUDED.notes,
                assessed_by = EXCLUDED.assessed_by,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, period_month, period_year, total_working_days || 0,
                present_days || 0, late_days || 0, absent_days || 0,
                leave_days || 0, overtime_days || 0, attScore,
                attdScore, perfScore, Math.round(finalScore * 100) / 100,
                grade, notes || null, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create assessment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update assessment
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            attitude_score, performance_score, attendance_score, notes
        } = req.body;

        const attScore = parseFloat(attendance_score) || 0;
        const attdScore = parseFloat(attitude_score) || 0;
        const perfScore = parseFloat(performance_score) || 0;
        const finalScore = (attScore * 0.4) + (attdScore * 0.3) + (perfScore * 0.3);

        let grade = 'E';
        if (finalScore >= 90) grade = 'A';
        else if (finalScore >= 80) grade = 'B';
        else if (finalScore >= 70) grade = 'C';
        else if (finalScore >= 60) grade = 'D';

        const result = await pool.query(
            `UPDATE discipline_assessments 
             SET attitude_score = $1, performance_score = $2, attendance_score = $3,
                 final_score = $4, grade = $5, notes = $6, assessed_by = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 RETURNING *`,
            [attdScore, perfScore, attScore, Math.round(finalScore * 100) / 100, grade, notes || null, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penilaian tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update assessment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete assessment
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM discipline_assessments WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penilaian tidak ditemukan' });
        }

        res.json({ message: 'Penilaian berhasil dihapus' });
    } catch (error) {
        console.error('Delete assessment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get employees list for assessment dropdown
router.get('/employees', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.employee_id, ed.department, ed.position
             FROM users u
             LEFT JOIN employee_details ed ON u.id = ed.user_id
             WHERE u.role = 'employee'
             ORDER BY u.name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
