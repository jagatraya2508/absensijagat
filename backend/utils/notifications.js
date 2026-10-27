const { sendRequestNotice } = require('./email');

const LEAVE_LABELS = {
    late: 'Izin Terlambat',
    sick: 'Izin Sakit',
    permission: 'Izin Tidak Masuk',
    leave: 'Cuti',
    change_off: 'Tukar Libur',
};

function dateText(value) {
    if (!value) return '-';
    const text = value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value).slice(0, 10);
    return text;
}

function dateRange(start, end) {
    const a = dateText(start);
    const b = dateText(end);
    return a === b ? a : `${a} s/d ${b}`;
}

async function ensureNotificationSchema(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category VARCHAR(40) NOT NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR(200),
            reference_type VARCHAR(40),
            reference_id INTEGER,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE is_read = FALSE');
}

async function findUsersByAccess(db, { permissionKey, includeManagers, excludeUserId }) {
    const result = await db.query(
        `SELECT DISTINCT u.id, u.name, u.email, u.role
         FROM users u
         LEFT JOIN roles r ON r.name = u.role
         LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_key = $1
         WHERE u.id <> $2
           AND COALESCE(u.role, '') <> 'kiosk'
           AND (
                u.role = 'admin'
                OR ($3::boolean AND u.role = 'manager')
                OR rp.id IS NOT NULL
           )`,
        [permissionKey || '', excludeUserId || 0, !!includeManagers]
    );
    return result.rows;
}

function leaveLink(user) {
    return user.role === 'admin' ? '/admin/leaves' : '/leave-approvals';
}

async function createNotifications(db, rows) {
    const unique = [];
    const seen = new Set();
    for (const row of rows) {
        if (!row?.userId || seen.has(row.userId)) continue;
        seen.add(row.userId);
        unique.push(row);
    }
    if (!unique.length) return;

    for (const row of unique) {
        await db.query(
            `INSERT INTO notifications
                (user_id, category, title, message, link, reference_type, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [row.userId, row.category, row.title, row.message, row.link || null, row.referenceType || null, row.referenceId || null]
        );
    }

    const emails = unique.filter((row) => row.email && row.email.includes('@'));
    if (!emails.length) return;
    sendRequestNotice(emails.map((row) => ({
        email: row.email,
        name: row.name,
        title: row.title,
        message: row.message,
    }))).catch((error) => {
        console.warn('Notification email skipped:', error.message);
    });
}

async function notifyLeaveSubmitted(pool, { requestId, requesterId, requesterName, type, startDate, endDate, isHourly, startTime, endTime, durationHours }) {
    try {
        const label = LEAVE_LABELS[type] || 'Izin';
        let when = dateRange(startDate, endDate);
        if (isHourly && startTime && endTime) {
            when = `${dateRange(startDate, endDate)} (${startTime.substring(0, 5)} - ${endTime.substring(0, 5)}, ${durationHours} jam)`;
        }
        const title = `Pengajuan ${label}`;
        const message = `${requesterName} mengajukan ${label} untuk ${when}.`;

        const step = await pool.query(
            `SELECT approver_id
             FROM leave_approval_steps
             WHERE leave_request_id = $1 AND status = 'pending'
             ORDER BY step_order ASC
             LIMIT 1`,
            [requestId]
        );
        const approverId = step.rows[0]?.approver_id || null;
        const recipients = await findUsersByAccess(pool, {
            permissionKey: 'admin.leaves',
            includeManagers: false,
            excludeUserId: requesterId,
        });

        if (approverId && approverId !== requesterId && !recipients.some((user) => user.id === approverId)) {
            const approver = await pool.query(
                'SELECT id, name, email, role FROM users WHERE id = $1',
                [approverId]
            );
            if (approver.rows[0]) recipients.push(approver.rows[0]);
        }

        await createNotifications(pool, recipients.map((user) => ({
            userId: user.id,
            email: user.email,
            name: user.name,
            category: 'leave',
            title,
            message,
            link: leaveLink(user),
            referenceType: 'leave_request',
            referenceId: requestId,
        })));
    } catch (error) {
        console.error('Notify leave failed:', error.message);
    }
}

async function notifyOvertimeSubmitted(pool, { requestId, requesterId, requesterName, date, startTime, endTime, hours }) {
    try {
        const title = 'Pengajuan Lembur';
        const message = `${requesterName} mengajukan lembur pada ${dateText(date)}, pukul ${String(startTime).slice(0, 5)}–${String(endTime).slice(0, 5)} (${hours} jam).`;
        const recipients = await findUsersByAccess(pool, {
            permissionKey: 'manager.approvals',
            includeManagers: true,
            excludeUserId: requesterId,
        });
        await createNotifications(pool, recipients.map((user) => ({
            userId: user.id,
            email: user.email,
            name: user.name,
            category: 'overtime',
            title,
            message,
            link: '/approvals',
            referenceType: 'overtime_request',
            referenceId: requestId,
        })));
    } catch (error) {
        console.error('Notify overtime failed:', error.message);
    }
}

async function notifyManualAttendanceSubmitted(pool, { requestId, requesterId, requesterName, date }) {
    try {
        const title = 'Pengajuan Absen Manual';
        const message = `${requesterName} mengajukan absen manual pada ${dateText(date)}.`;
        const recipients = await findUsersByAccess(pool, {
            permissionKey: 'admin.manual_attendance',
            includeManagers: false,
            excludeUserId: requesterId,
        });
        await createNotifications(pool, recipients.map((user) => ({
            userId: user.id,
            email: user.email,
            name: user.name,
            category: 'manual_attendance',
            title,
            message,
            link: '/admin/manual-attendance',
            referenceType: 'manual_attendance',
            referenceId: requestId,
        })));
    } catch (error) {
        console.error('Notify manual attendance failed:', error.message);
    }
}

module.exports = {
    ensureNotificationSchema,
    notifyLeaveSubmitted,
    notifyOvertimeSubmitted,
    notifyManualAttendanceSubmitted,
};
