const LEAVE_TYPES = ['late', 'sick', 'leave', 'change_off', 'permission'];

async function ensureOrgApprovalSchema(pool) {
    await pool.query(`ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 1`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leave_approval_config (
            id SERIAL PRIMARY KEY,
            leave_type VARCHAR(20) NOT NULL UNIQUE,
            approval_levels INTEGER NOT NULL DEFAULT 1 CHECK (approval_levels >= 1 AND approval_levels <= 5),
            fallback_to_admin BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leave_approval_steps (
            id SERIAL PRIMARY KEY,
            leave_request_id INTEGER REFERENCES leave_requests(id) ON DELETE CASCADE,
            step_order INTEGER NOT NULL,
            approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            approver_label VARCHAR(100),
            status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped')),
            notes TEXT,
            acted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(leave_request_id, step_order)
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_emp_supervisor ON employee_details(supervisor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_steps_request ON leave_approval_steps(leave_request_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_steps_approver ON leave_approval_steps(approver_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_steps_status ON leave_approval_steps(status)`);

    for (const type of LEAVE_TYPES) {
        await pool.query(
            `INSERT INTO leave_approval_config (leave_type, approval_levels, fallback_to_admin)
             VALUES ($1, 1, TRUE)
             ON CONFLICT (leave_type) DO NOTHING`,
            [type]
        );
    }

    try {
        await pool.query(`
            INSERT INTO role_permissions (role_id, permission_key)
            SELECT r.id, 'manager.leave_approvals'
            FROM roles r
            WHERE r.name = 'manager'
            ON CONFLICT DO NOTHING
        `);
    } catch (_) { /* roles table may not exist yet */ }
}

async function wouldCreateCycle(pool, userId, supervisorId) {
    if (!supervisorId) return false;
    if (Number(userId) === Number(supervisorId)) return true;

    let current = supervisorId;
    const seen = new Set([Number(userId)]);
    for (let i = 0; i < 25; i++) {
        if (!current) return false;
        if (seen.has(Number(current))) return true;
        seen.add(Number(current));
        const result = await pool.query(
            'SELECT supervisor_id FROM employee_details WHERE user_id = $1',
            [current]
        );
        current = result.rows[0]?.supervisor_id || null;
    }
    return true;
}

async function userHasLeaveAdminAccess(pool, user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const result = await pool.query(
        `SELECT 1 FROM role_permissions rp
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $1 AND rp.permission_key = 'admin.leaves'`,
        [user.role]
    );
    return result.rows.length > 0;
}

async function buildApprovalChain(client, requesterId, leaveType) {
    const cfgRes = await client.query(
        'SELECT approval_levels, fallback_to_admin FROM leave_approval_config WHERE leave_type = $1',
        [leaveType]
    );
    const levels = Math.max(1, Math.min(5, cfgRes.rows[0]?.approval_levels || 1));
    const fallback = cfgRes.rows[0]?.fallback_to_admin !== false;

    const chain = [];
    let currentId = requesterId;
    const seen = new Set([Number(requesterId)]);

    for (let i = 0; i < levels; i++) {
        const result = await client.query(
            `SELECT ed.supervisor_id, u.name
             FROM employee_details ed
             LEFT JOIN users u ON u.id = ed.supervisor_id
             WHERE ed.user_id = $1`,
            [currentId]
        );
        const supervisorId = result.rows[0]?.supervisor_id;
        if (!supervisorId || seen.has(Number(supervisorId))) break;
        seen.add(Number(supervisorId));
        chain.push({
            approver_id: supervisorId,
            approver_label: i === 0 ? 'Atasan Langsung' : `Atasan Tingkat ${i + 1}`
        });
        currentId = supervisorId;
    }

    if (chain.length === 0 || (chain.length < levels && fallback)) {
        chain.push({
            approver_id: null,
            approver_label: 'Admin / HR'
        });
    }

    return chain;
}

async function createApprovalSteps(client, leaveRequestId, requesterId, leaveType) {
    const chain = await buildApprovalChain(client, requesterId, leaveType);
    for (let i = 0; i < chain.length; i++) {
        await client.query(
            `INSERT INTO leave_approval_steps
                (leave_request_id, step_order, approver_id, approver_label, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                leaveRequestId,
                i + 1,
                chain[i].approver_id,
                chain[i].approver_label,
                i === 0 ? 'pending' : 'waiting'
            ]
        );
    }
    await client.query(
        `UPDATE leave_requests SET current_step = 1, total_steps = $1 WHERE id = $2`,
        [chain.length, leaveRequestId]
    );
    return chain;
}

async function attachApprovalSteps(pool, requests) {
    if (!requests.length) return requests;
    const ids = requests.map((row) => row.id);
    const stepsRes = await pool.query(
        `SELECT las.*, u.name as approver_name
         FROM leave_approval_steps las
         LEFT JOIN users u ON u.id = las.approver_id
         WHERE las.leave_request_id = ANY($1::int[])
         ORDER BY las.step_order ASC`,
        [ids]
    );
    const byRequest = {};
    for (const step of stepsRes.rows) {
        if (!byRequest[step.leave_request_id]) byRequest[step.leave_request_id] = [];
        byRequest[step.leave_request_id].push(step);
    }
    return requests.map((row) => ({
        ...row,
        approval_steps: byRequest[row.id] || []
    }));
}

async function getApprovalAccess(pool, user, requestId) {
    const isHr = await userHasLeaveAdminAccess(pool, user);
    const stepRes = await pool.query(
        `SELECT * FROM leave_approval_steps
         WHERE leave_request_id = $1 AND status = 'pending'
         ORDER BY step_order ASC
         LIMIT 1`,
        [requestId]
    );
    const currentStep = stepRes.rows[0] || null;
    if (!currentStep) {
        return { allowed: isHr, isHr, currentStep: null, isAssigned: false };
    }
    const isAssigned = currentStep.approver_id === user.id;
    const isOpenAdminStep = !currentStep.approver_id && isHr;
    return {
        allowed: isAssigned || isOpenAdminStep || isHr,
        isHr,
        currentStep,
        isAssigned
    };
}

module.exports = {
    LEAVE_TYPES,
    ensureOrgApprovalSchema,
    wouldCreateCycle,
    userHasLeaveAdminAccess,
    buildApprovalChain,
    createApprovalSteps,
    attachApprovalSteps,
    getApprovalAccess
};
