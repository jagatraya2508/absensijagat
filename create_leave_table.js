require('dotenv').config();
const { pool } = require('./db');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('late', 'sick', 'leave', 'change_off')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment_path VARCHAR(255),
    replacement_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_date ON leave_requests(start_date);
`;

async function main() {
    try {
        console.log('Creating leave_requests table...');
        await pool.query(createTableQuery);
        console.log('Table leave_requests created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error creating table:', err.message);
        process.exit(1);
    }
}

main();
