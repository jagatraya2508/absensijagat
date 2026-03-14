const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all loans (with optional filters)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
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

// Get loan detail with payments
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
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

        res.json({
            ...loanResult.rows[0],
            payments: paymentsResult.rows
        });
    } catch (error) {
        console.error('Get loan detail error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Create new loan
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { user_id, loan_date, amount, installment_amount, total_installments, description } = req.body;

        if (!user_id || !amount || !installment_amount || !total_installments) {
            return res.status(400).json({ error: 'Data pinjaman harus lengkap' });
        }

        const result = await pool.query(`
            INSERT INTO employee_loans (user_id, loan_date, amount, installment_amount, total_installments, remaining_balance, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $3, $6, $7)
            RETURNING *
        `, [user_id, loan_date || new Date(), amount, installment_amount, total_installments, description || null, req.user.id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create loan error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Update loan
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
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
router.post('/:id/payment', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;

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

        // Insert payment
        await client.query(`
            INSERT INTO loan_payments (loan_id, payment_date, amount, payment_method, notes)
            VALUES ($1, $2, $3, 'manual', $4)
        `, [id, payment_date || new Date(), paymentAmount, notes || null]);

        // Update loan
        const newBalance = parseFloat(loan.remaining_balance) - paymentAmount;
        const newPaidInstallments = parseInt(loan.paid_installments) + 1;
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
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
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
