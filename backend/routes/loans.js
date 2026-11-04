const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, hasPermission } = require('../middleware/auth');
const canManageLoans = hasPermission('admin.loans');

// Get all loans (with optional filters)
router.get('/', authenticateToken, canManageLoans, async (req, res) => {
    try {
        const { user_id, status } = req.query;
        let query = `
            SELECT l.*, u.name as user_name, u.employee_id
            FROM employee_loans l
            JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (user_id) {
            query += ` AND l.user_id = $${paramCount++}`;
            values.push(user_id);
        }
        if (status) {
            query += ` AND l.status = $${paramCount++}`;
            values.push(status);
        }

        query += ' ORDER BY l.created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

router.get('/employees', authenticateToken, canManageLoans, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.employee_id, u.name, u.role,
                    COALESCE(ed.salary_type, 'monthly') AS salary_type
             FROM users u
             LEFT JOIN LATERAL (
                SELECT salary_type FROM employee_details
                WHERE user_id = u.id
                ORDER BY id DESC LIMIT 1
             ) ed ON TRUE
             WHERE u.role NOT IN ('admin', 'super_admin', 'superadmin', 'kiosk')
               AND COALESCE(u.is_active, true) = true
             ORDER BY u.name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get loan employees error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get loan detail with payments
router.get('/:id', authenticateToken, canManageLoans, async (req, res) => {
    try {
        const { id } = req.params;
        const loanResult = await pool.query(`
            SELECT l.*, u.name as user_name, u.employee_id
            FROM employee_loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = $1
        `, [id]);

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pinjaman tidak ditemukan' });
        }

        const paymentsResult = await pool.query(
            'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC',
            [id]
        );
        const scheduleResult = await pool.query(
            'SELECT id, installment_no, amount, is_paid FROM loan_installments WHERE loan_id = $1 ORDER BY installment_no',
            [id]
        );

        res.json({
            ...loanResult.rows[0],
            payments: paymentsResult.rows,
            schedule: scheduleResult.rows
        });
    } catch (error) {
        console.error('Get loan detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create new loan
router.post('/', authenticateToken, canManageLoans, async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, loan_date, amount, installment_amount, total_installments, description } = req.body;

        if (!user_id || !amount || !installment_amount || !total_installments) {
            return res.status(400).json({ error: 'Data pinjaman harus lengkap' });
        }

        const count = parseInt(total_installments, 10);
        if (!Number.isInteger(count) || count < 1 || count > 120) {
            return res.status(400).json({ error: 'Jumlah cicilan harus antara 1 dan 120' });
        }

        const loanAmount = Math.round(parseFloat(amount) * 100) / 100;
        let schedule = Array.isArray(req.body.schedule) ? req.body.schedule : [];
        if (schedule.length === 0) {
            const base = Math.floor(loanAmount / count);
            const remainder = Math.round((loanAmount - base * count) * 100) / 100;
            schedule = Array.from({ length: count }, (_, index) => ({
                installment_no: index + 1,
                amount: index === count - 1 ? base + remainder : base,
            }));
        }
        if (schedule.length !== count) {
            return res.status(400).json({ error: 'Jumlah baris tabel cicilan harus sama dengan jumlah cicilan' });
        }
        const rows = schedule.map((row, index) => ({
            installment_no: index + 1,
            amount: Math.round((parseFloat(row.amount) || 0) * 100) / 100,
        }));
        if (rows.some((row) => row.amount < 0)) {
            return res.status(400).json({ error: 'Nominal cicilan tidak boleh minus' });
        }
        const scheduleTotal = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
        if (Math.abs(scheduleTotal - loanAmount) > 1) {
            return res.status(400).json({ error: 'Total tabel cicilan harus sama dengan jumlah pinjaman' });
        }

        const employee = await pool.query(
            `SELECT COALESCE(ed.salary_type, 'monthly') AS salary_type
             FROM users u
             LEFT JOIN LATERAL (
                SELECT salary_type FROM employee_details
                WHERE user_id = u.id
                ORDER BY id DESC LIMIT 1
             ) ed ON TRUE
             WHERE u.id = $1`,
            [user_id]
        );
        const requestedPeriod = req.body.installment_period;
        const installmentPeriod = requestedPeriod === 'weekly' || requestedPeriod === 'monthly'
            ? requestedPeriod
            : (employee.rows[0]?.salary_type === 'weekly' ? 'weekly' : 'monthly');

        await client.query('BEGIN');
        const result = await client.query(`
            INSERT INTO employee_loans (user_id, loan_date, amount, installment_amount, installment_period, total_installments, remaining_balance, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $3, $7, $8)
            RETURNING *
        `, [user_id, loan_date || new Date(), loanAmount, rows[0].amount, installmentPeriod, count, description || null, req.user.id]);
        for (const row of rows) {
            await client.query(
                `INSERT INTO loan_installments (loan_id, installment_no, amount) VALUES ($1, $2, $3)`,
                [result.rows[0].id, row.installment_no, row.amount]
            );
        }
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) { /* transaksi belum mulai */ }
        console.error('Create loan error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Update loan
router.put('/:id', authenticateToken, canManageLoans, async (req, res) => {
    try {
        const { id } = req.params;
        const { description, status } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }
        if (status) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');

        values.push(id);
        const result = await pool.query(
            `UPDATE employee_loans SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pinjaman tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update loan error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Record manual payment
router.post('/:id/payment', authenticateToken, canManageLoans, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;
        const requestedPeriods = Math.max(1, parseInt(req.body.periods, 10) || 1);

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Jumlah pembayaran harus valid' });
        }

        await client.query('BEGIN');

        // Get current loan
        const loanResult = await client.query('SELECT * FROM employee_loans WHERE id = $1 FOR UPDATE', [id]);
        if (loanResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pinjaman tidak ditemukan' });
        }

        const loan = loanResult.rows[0];
        if (loan.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Pinjaman sudah tidak aktif' });
        }

        const paymentAmount = Math.min(parseFloat(amount), parseFloat(loan.remaining_balance));
        const totalInstallments = parseInt(loan.total_installments, 10) || 0;
        const alreadyPaid = parseInt(loan.paid_installments, 10) || 0;
        const periodsLeft = Math.max(1, totalInstallments - alreadyPaid);
        const periods = Math.min(requestedPeriods, periodsLeft);
        const dueRows = await client.query(
            `SELECT id FROM loan_installments
             WHERE loan_id = $1 AND is_paid = FALSE
             ORDER BY installment_no
             LIMIT $2`,
            [id, periods]
        );
        const periodsApplied = dueRows.rows.length > 0 ? dueRows.rows.length : periods;
        if (dueRows.rows.length > 0) {
            await client.query(
                'UPDATE loan_installments SET is_paid = TRUE WHERE id = ANY($1::int[])',
                [dueRows.rows.map((row) => row.id)]
            );
        }

        await client.query(`
            INSERT INTO loan_payments (loan_id, payment_date, amount, payment_method, notes, periods)
            VALUES ($1, $2, $3, 'manual', $4, $5)
        `, [id, payment_date || new Date(), paymentAmount, notes || null, periodsApplied]);

        const newBalance = parseFloat(loan.remaining_balance) - paymentAmount;
        const newPaidInstallments = newBalance <= 0
            ? totalInstallments
            : Math.min(totalInstallments, alreadyPaid + periodsApplied);
        const newStatus = newBalance <= 0 ? 'paid_off' : 'active';

        await client.query(`
            UPDATE employee_loans SET
                remaining_balance = $1,
                paid_installments = $2,
                status = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [Math.max(0, newBalance), newPaidInstallments, newStatus, id]);

        await client.query('COMMIT');

        // Return updated loan
        const updated = await pool.query(`
            SELECT l.*, u.name as user_name, u.employee_id
            FROM employee_loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = $1
        `, [id]);

        res.json(updated.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Record payment error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

// Delete/cancel loan (hard delete)
router.delete('/:id', authenticateToken, canManageLoans, async (req, res) => {
    try {
        const { id } = req.params;
        // Delete payments first due to foreign key constraint
        await pool.query("DELETE FROM loan_payments WHERE loan_id = $1", [id]);
        // Delete the loan
        const result = await pool.query("DELETE FROM employee_loans WHERE id = $1 RETURNING id", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pinjaman tidak ditemukan' });
        }
        res.json({ message: 'Data pinjaman berhasil dihapus secara permanen' });
    } catch (error) {
        console.error('Delete loan error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat menghapus data' });
    }
});

module.exports = router;
