require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const locationsRoutes = require('./routes/locations');
const reportsRoutes = require('./routes/reports');
const leavesRoutes = require('./routes/leaves');
const faceRoutes = require('./routes/face');
const announcementsRoutes = require('./routes/announcements');
const settingsRoutes = require('./routes/settings');
const licenseRoutes = require('./routes/license');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, 'uploads/attendance');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files (uploaded photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/departments', require('./routes/departments'));
app.use('/api/positions', require('./routes/positions'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/off-days', require('./routes/offDays'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/overtime', require('./routes/overtime'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/recruitment', require('./routes/recruitment'));
app.use('/api/work-schedules', require('./routes/workSchedules'));
app.use('/api/driver-activities', require('./routes/driverActivities'));
app.use('/api/driver-tracking', require('./routes/driverTracking'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/vehicle-types', require('./routes/vehicleTypes'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/manual-attendances', require('./routes/manual_attendances'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/daily-work-reports', require('./routes/dailyWorkReports'));
app.use('/api/backup', require('./routes/backup'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database tables
async function initDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'db/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Error handler middleware
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Terjadi kesalahan server internal'
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await initDatabase();
});

module.exports = app;
