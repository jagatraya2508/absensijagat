const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authenticateToken, isAdmin, hasPermission } = require('../middleware/auth');
const { calculateDistance } = require('../utils/distance');
const Holidays = require('date-holidays');
const hd = new Holidays('ID');

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/attendance');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${req.user.id}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diizinkan'));
        }
    }
});

// Helper to detect holiday for a user on a given date (YYYY-MM-DD)
async function detectHoliday(userId, today) {
    const todayDate = new Date(today + 'T12:00:00');
    const dayOfWeek = todayDate.getDay();

    let holidayType = null;
    let holidayName = '';

    // 1. Off Day for this user
    const offDayCheck = await pool.query(
        'SELECT * FROM user_off_days WHERE user_id = $1 AND off_date = $2',
        [userId, today]
    );
    if (offDayCheck.rows.length > 0) {
        holidayType = 'offday';
        holidayName = 'Hari Libur Karyawan';
    }

    // 2. Sunday
    if (dayOfWeek === 0) {
        holidayType = 'sunday';
        holidayName = 'Hari Minggu';
    }

    // 3. National Public Holiday (takes highest priority)
    const natMatch = hd.isHoliday(today);
    if (natMatch && Array.isArray(natMatch)) {
        const pub = natMatch.find(h => h.type === 'public');
        if (pub) {
            holidayType = 'national';
            holidayName = pub.name;
        }
    }

    return { holidayType, holidayName };
}

// Helper to calculate and record automatic holiday overtime on check-out
async function handleAutoHolidayOvertime({ userId, today, checkinRecord, checkoutTime, approverId }) {
    if (!checkinRecord || !(checkinRecord.notes || '').includes('[LEMBUR LIBUR:')) {
        return null;
    }

    const matchHoliday = (checkinRecord.notes || '').match(/\[LEMBUR LIBUR: (.+?)\]/);
    const holidayName = matchHoliday ? matchHoliday[1] : 'Hari Libur';

    let holidayType = 'offday';
    if (holidayName === 'Hari Minggu') {
        holidayType = 'sunday';
    } else if (holidayName !== 'Hari Libur Karyawan') {
        holidayType = 'national';
    }

    const checkInTime = new Date(checkinRecord.recorded_at);
    const checkOutTime = new Date(checkoutTime);
    const hoursWorked = Math.max(0.1, Math.round(((checkOutTime - checkInTime) / (1000 * 60 * 60)) * 10) / 10);

    if (hoursWorked <= 0) return null;

    // Load holiday overtime settings
    const hoSettingsRes = await pool.query(
        `SELECT key, value FROM settings WHERE key IN (
            'holiday_overtime_enabled',
            'holiday_overtime_calc_mode',
            'holiday_overtime_rate_sunday',
            'holiday_overtime_rate_national',
            'holiday_overtime_rate_offday',
            'holiday_overtime_fixed_sunday',
            'holiday_overtime_fixed_national',
            'holiday_overtime_fixed_offday'
        )`
    );
    const hoMap = {};
    hoSettingsRes.rows.forEach(r => { hoMap[r.key] = r.value; });

    if (hoMap.holiday_overtime_enabled === 'false') {
        return null;
    }

    const calcMode = hoMap.holiday_overtime_calc_mode || 'multiplier';
    let effectiveRate = 0;
    let rateMultiplier = null;
    let rateLabel = '';

    if (calcMode === 'fixed') {
        const fixedSunday = parseFloat(hoMap.holiday_overtime_fixed_sunday) || 50000;
        const fixedNational = parseFloat(hoMap.holiday_overtime_fixed_national) || 75000;
        const fixedOffday = parseFloat(hoMap.holiday_overtime_fixed_offday) || 50000;

        effectiveRate = holidayType === 'sunday' ? fixedSunday
            : holidayType === 'national' ? fixedNational
            : fixedOffday;
        rateLabel = `Rp ${effectiveRate.toLocaleString('id-ID')}/jam`;
    } else {
        const rateSunday = parseFloat(hoMap.holiday_overtime_rate_sunday) || 2.0;
        const rateNational = parseFloat(hoMap.holiday_overtime_rate_national) || 3.0;
        const rateOffday = parseFloat(hoMap.holiday_overtime_rate_offday) || 2.0;

        rateMultiplier = holidayType === 'sunday' ? rateSunday
            : holidayType === 'national' ? rateNational
            : rateOffday;

        const empDetail = await pool.query(
            'SELECT overtime_rate FROM employee_details WHERE user_id = $1',
            [userId]
        );
        const baseRate = empDetail.rows.length > 0 ? (parseFloat(empDetail.rows[0].overtime_rate) || 50000) : 50000;
        effectiveRate = Math.round(baseRate * rateMultiplier);
        rateLabel = `${rateMultiplier}x tarif dasar (Rp ${baseRate.toLocaleString('id-ID')}/jam)`;
    }

    const totalAmount = Math.round(hoursWorked * effectiveRate);
    const overtimeDesc = `Lembur otomatis - ${holidayName} (${rateLabel})`;

    // Check if auto overtime already recorded for this user and date
    const existingOt = await pool.query(
        `SELECT id FROM overtime_records WHERE user_id = $1 AND date = $2 AND description LIKE 'Lembur otomatis%'`,
        [userId, today]
    );

    if (existingOt.rows.length > 0) {
        await pool.query(
            `UPDATE overtime_records SET hours = $1, rate_per_hour = $2, total_amount = $3, description = $4, status = 'approved', approved_by = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
            [hoursWorked, effectiveRate, totalAmount, overtimeDesc, approverId, existingOt.rows[0].id]
        );
    } else {
        await pool.query(
            `INSERT INTO overtime_records (user_id, date, hours, rate_per_hour, total_amount, description, status, approved_by) VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)`,
            [userId, today, hoursWorked, effectiveRate, totalAmount, overtimeDesc, approverId]
        );
    }

    return {
        holiday_name: holidayName,
        holiday_type: holidayType,
        hours_worked: hoursWorked,
        calc_mode: calcMode,
        rate_multiplier: rateMultiplier,
        effective_rate: effectiveRate,
        rate_label: rateLabel,
        total_amount: totalAmount
    };
}

// Check-in
router.post('/check-in', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        const { latitude, longitude, location_id, notes } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Foto selfie harus diupload' });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Koordinat lokasi harus diisi' });
        }

        // Check if already checked in today
        const today = new Date().toISOString().split('T')[0];

        // Detect holiday type
        const { holidayType, holidayName } = await detectHoliday(req.user.id, today);

        // If it's a holiday, check if holiday overtime is enabled
        if (holidayType) {
            const holidaySettings = await pool.query(
                `SELECT key, value FROM settings WHERE key IN ('holiday_overtime_enabled', 'holiday_overtime_allow_checkin')`
            );
            let hoEnabled = true;
            let hoAllowCheckin = true;
            holidaySettings.rows.forEach(r => {
                if (r.key === 'holiday_overtime_enabled') hoEnabled = r.value === 'true';
                if (r.key === 'holiday_overtime_allow_checkin') hoAllowCheckin = r.value === 'true';
            });

            if (!hoEnabled || !hoAllowCheckin) {
                return res.status(400).json({ error: `Anda sedang libur hari ini (${holidayName}), tidak dapat melakukan absen.` });
            }
        }

        const existingCheckin = await pool.query(
            `SELECT * FROM attendance_records 
       WHERE user_id = $1 AND type = 'check_in' 
       AND DATE(recorded_at) = $2`,
            [req.user.id, today]
        );

        if (existingCheckin.rows.length > 0) {
            return res.status(400).json({ error: 'Anda sudah melakukan check-in hari ini' });
        }

        // Calculate distance from nearest location
        let nearestLocation = null;
        let distance = null;
        let isValid = true;

        if (location_id) {
            const locationResult = await pool.query(
                'SELECT * FROM attendance_locations WHERE id = $1 AND is_active = true',
                [location_id]
            );
            if (locationResult.rows.length > 0) {
                nearestLocation = locationResult.rows[0];
                if (nearestLocation.location_type === 'check_out') {
                    return res.status(400).json({
                        error: `Lokasi "${nearestLocation.name}" hanya diperuntukkan untuk absen pulang (Check-Out)`
                    });
                }
                distance = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(nearestLocation.latitude),
                    parseFloat(nearestLocation.longitude)
                );
                isValid = distance <= nearestLocation.radius_meters;
            }
        } else {
            // Find nearest active location among ALLOWED locations (only 'all' or 'check_in')
            const allowedCheck = await pool.query('SELECT location_id FROM user_locations WHERE user_id = $1', [req.user.id]);
            let locationsResult;
            
            if (allowedCheck.rows.length > 0) {
                // User has restricted locations
                const allowedIds = allowedCheck.rows.map(r => r.location_id);
                locationsResult = await pool.query(
                    `SELECT * FROM attendance_locations 
                     WHERE is_active = true AND id = ANY($1) 
                       AND (location_type = 'all' OR location_type = 'check_in' OR location_type IS NULL)`,
                    [allowedIds]
                );
            } else {
                // Option B: Fallback to ALL active check-in locations
                locationsResult = await pool.query(
                    `SELECT * FROM attendance_locations 
                     WHERE is_active = true 
                       AND (location_type = 'all' OR location_type = 'check_in' OR location_type IS NULL)`
                );
            }

            let minDistance = Infinity;
            for (const loc of locationsResult.rows) {
                const d = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(loc.latitude),
                    parseFloat(loc.longitude)
                );
                if (d < minDistance) {
                    minDistance = d;
                    nearestLocation = loc;
                    distance = d;
                }
            }
            if (nearestLocation) {
                isValid = distance <= nearestLocation.radius_meters;
            } else {
                isValid = false;
            }
        }

        if (!isValid) {
            return res.status(400).json({
                error: 'Lokasi Anda berada di luar jangkauan lokasi absen masuk yang diizinkan',
                distance: distance !== null ? Math.round(distance) : null
            });
        }

        const photoPath = `/uploads/attendance/${req.file.filename}`;

        // Enhance notes with holiday info
        let attendanceNotes = notes || null;
        if (holidayType) {
            const holidayPrefix = `[LEMBUR LIBUR: ${holidayName}]`;
            attendanceNotes = attendanceNotes ? `${holidayPrefix} ${attendanceNotes}` : holidayPrefix;
        }

        const result = await pool.query(
            `INSERT INTO attendance_records 
       (user_id, location_id, type, photo_path, latitude, longitude, distance_meters, is_valid, notes)
       VALUES ($1, $2, 'check_in', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                req.user.id,
                nearestLocation?.id || null,
                photoPath,
                latitude,
                longitude,
                distance,
                isValid,
                attendanceNotes
            ]
        );

        const responseData = {
            ...result.rows[0],
            location_name: nearestLocation?.name || null,
            message: holidayType
                ? `Check-in berhasil (Lembur Hari Libur: ${holidayName})`
                : 'Check-in berhasil'
        };

        if (holidayType) {
            responseData.holiday_type = holidayType;
            responseData.holiday_name = holidayName;
            responseData.is_holiday_overtime = true;
        }

        res.status(201).json(responseData);
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Check-out
router.post('/check-out', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        const { latitude, longitude, location_id, notes } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Foto selfie harus diupload' });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Koordinat lokasi harus diisi' });
        }

        // Check if checked in today
        const today = new Date().toISOString().split('T')[0];
        const existingCheckin = await pool.query(
            `SELECT * FROM attendance_records 
       WHERE user_id = $1 AND type = 'check_in' 
       AND DATE(recorded_at) = $2`,
            [req.user.id, today]
        );

        if (existingCheckin.rows.length === 0) {
            return res.status(400).json({ error: 'Anda belum melakukan check-in hari ini' });
        }

        // Check if already checked out today
        const existingCheckout = await pool.query(
            `SELECT * FROM attendance_records 
       WHERE user_id = $1 AND type = 'check_out' 
       AND DATE(recorded_at) = $2`,
            [req.user.id, today]
        );

        if (existingCheckout.rows.length > 0) {
            return res.status(400).json({ error: 'Anda sudah melakukan check-out hari ini' });
        }

        // Calculate distance from nearest location
        let nearestLocation = null;
        let distance = null;
        let isValid = true;

        if (location_id) {
            const locationResult = await pool.query(
                'SELECT * FROM attendance_locations WHERE id = $1 AND is_active = true',
                [location_id]
            );
            if (locationResult.rows.length > 0) {
                nearestLocation = locationResult.rows[0];
                if (nearestLocation.location_type === 'check_in') {
                    return res.status(400).json({
                        error: `Lokasi "${nearestLocation.name}" hanya diperuntukkan untuk absen masuk (Check-In)`
                    });
                }
                distance = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(nearestLocation.latitude),
                    parseFloat(nearestLocation.longitude)
                );
                isValid = distance <= nearestLocation.radius_meters;
            }
        } else {
            const allowedCheck = await pool.query('SELECT location_id FROM user_locations WHERE user_id = $1', [req.user.id]);
            let locationsResult;

            if (allowedCheck.rows.length > 0) {
                const allowedIds = allowedCheck.rows.map(r => r.location_id);
                locationsResult = await pool.query(
                    `SELECT * FROM attendance_locations 
                     WHERE is_active = true AND id = ANY($1) 
                       AND (location_type = 'all' OR location_type = 'check_out' OR location_type IS NULL)`,
                    [allowedIds]
                );
            } else {
                locationsResult = await pool.query(
                    `SELECT * FROM attendance_locations 
                     WHERE is_active = true 
                       AND (location_type = 'all' OR location_type = 'check_out' OR location_type IS NULL)`
                );
            }

            let minDistance = Infinity;
            for (const loc of locationsResult.rows) {
                const d = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(loc.latitude),
                    parseFloat(loc.longitude)
                );
                if (d < minDistance) {
                    minDistance = d;
                    nearestLocation = loc;
                    distance = d;
                }
            }
            if (nearestLocation) {
                isValid = distance <= nearestLocation.radius_meters;
            } else {
                isValid = false;
            }
        }

        if (!isValid) {
            return res.status(400).json({
                error: 'Lokasi Anda berada di luar jangkauan lokasi absen pulang yang diizinkan',
                distance: distance !== null ? Math.round(distance) : null
            });
        }

        // Validate different checkout location settings
        // Check system rule mode: 'disabled', 'specific' (only flagged users), or 'all' (every employee)
        const modeSetting = await pool.query(
            `SELECT key, value FROM settings WHERE key IN ('checkout_location_rule_mode', 'require_different_location_checkout')`
        );
        let ruleMode = 'specific';
        let legacyGlobal = false;
        modeSetting.rows.forEach(r => {
            if (r.key === 'checkout_location_rule_mode') ruleMode = r.value;
            if (r.key === 'require_different_location_checkout') legacyGlobal = r.value === 'true';
        });
        if (!modeSetting.rows.some(r => r.key === 'checkout_location_rule_mode') && legacyGlobal) {
            ruleMode = 'all';
        }

        let requireDiff = false;
        if (ruleMode === 'all') {
            requireDiff = true;
        } else if (ruleMode === 'specific') {
            const userDiffCheck = await pool.query(
                `SELECT COALESCE(require_different_checkout, false) as require_different_checkout 
                 FROM employee_details WHERE user_id = $1`,
                [req.user.id]
            );
            requireDiff = userDiffCheck.rows.length > 0 && userDiffCheck.rows[0].require_different_checkout;
        }

        if (requireDiff && existingCheckin.rows.length > 0) {
            const inRecord = existingCheckin.rows[0];

            // Get min distance setting
            const minDistSetting = await pool.query(
                `SELECT value FROM settings WHERE key = 'min_checkout_distance_meters'`
            );
            const minCheckoutDist = minDistSetting.rows.length > 0 ? (parseFloat(minDistSetting.rows[0].value) || 0) : 0;

            // 1. Check if same location_id
            if (inRecord.location_id && nearestLocation?.id && inRecord.location_id === nearestLocation.id) {
                return res.status(400).json({
                    error: `Absen pulang wajib di lokasi yang berbeda dengan absen masuk! (Lokasi masuk: ${nearestLocation.name})`
                });
            }

            // 2. Check distance between check-in and check-out coordinates
            if (inRecord.latitude && inRecord.longitude) {
                const distFromIn = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(inRecord.latitude),
                    parseFloat(inRecord.longitude)
                );

                if (minCheckoutDist > 0 && distFromIn < minCheckoutDist) {
                    return res.status(400).json({
                        error: `Absen pulang wajib berjarak minimal ${minCheckoutDist} meter dari titik absen masuk (jarak saat ini: ${Math.round(distFromIn)} meter)`
                    });
                } else if (minCheckoutDist <= 0 && distFromIn <= (nearestLocation?.radius_meters || 100)) {
                    return res.status(400).json({
                        error: 'Absen pulang harus dilakukan di titik koordinat yang berbeda dari absen masuk!'
                    });
                }
            }
        }

        const photoPath = `/uploads/attendance/${req.file.filename}`;

        const result = await pool.query(
            `INSERT INTO attendance_records 
       (user_id, location_id, type, photo_path, latitude, longitude, distance_meters, is_valid, notes)
       VALUES ($1, $2, 'check_out', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                req.user.id,
                nearestLocation?.id || null,
                photoPath,
                latitude,
                longitude,
                distance,
                isValid,
                notes || null
            ]
        );

        // Auto-create overtime record if check-in was on a holiday
        let holidayOvertimeCreated = false;
        let holidayOvertimeInfo = null;

        if (existingCheckin.rows.length > 0) {
            const otResult = await handleAutoHolidayOvertime({
                userId: req.user.id,
                today,
                checkinRecord: existingCheckin.rows[0],
                checkoutTime: result.rows[0].recorded_at,
                approverId: req.user.id
            });
            if (otResult) {
                holidayOvertimeCreated = true;
                holidayOvertimeInfo = otResult;
            }
        }

        const responseData = {
            ...result.rows[0],
            location_name: nearestLocation?.name || null,
            message: holidayOvertimeCreated
                ? `Check-out berhasil. Lembur otomatis tercatat: ${holidayOvertimeInfo.hours_worked} jam (${holidayOvertimeInfo.rate_label})`
                : 'Check-out berhasil'
        };

        if (holidayOvertimeCreated) {
            responseData.holiday_overtime = holidayOvertimeInfo;
        }

        res.status(201).json(responseData);
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Kiosk Attendance
router.post('/kiosk', authenticateToken, hasPermission('admin.kiosk'), upload.single('photo'), async (req, res) => {
    try {
        const { user_id, location_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID tidak ditemukan' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Detect holiday type for kiosk
        const { holidayType: kioskHolidayType, holidayName: kioskHolidayName } = await detectHoliday(user_id, today);

        if (kioskHolidayType) {
            const hoSettings = await pool.query(
                `SELECT key, value FROM settings WHERE key IN ('holiday_overtime_enabled', 'holiday_overtime_allow_checkin')`
            );
            let hoEnabled = true, hoAllow = true;
            hoSettings.rows.forEach(r => {
                if (r.key === 'holiday_overtime_enabled') hoEnabled = r.value === 'true';
                if (r.key === 'holiday_overtime_allow_checkin') hoAllow = r.value === 'true';
            });
            if (!hoEnabled || !hoAllow) {
                return res.status(400).json({ error: `Sedang libur hari ini (${kioskHolidayName}).` });
            }
        }

        // Get user details
        const userCheck = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        const userName = userCheck.rows[0].name;

        // Check existing records today
        const existingRecords = await pool.query(
            `SELECT type, notes, recorded_at FROM attendance_records 
             WHERE user_id = $1 AND DATE(recorded_at) = $2`,
            [user_id, today]
        );

        const hasCheckIn = existingRecords.rows.some(r => r.type === 'check_in');
        const hasCheckOut = existingRecords.rows.some(r => r.type === 'check_out');

        if (hasCheckIn && hasCheckOut) {
            return res.status(400).json({ error: 'Sudah selesai absen hari ini.' });
        }

        const type = hasCheckIn ? 'check_out' : 'check_in';
        const photoPath = req.file ? `/uploads/attendance/${req.file.filename}` : null;

        // Build kiosk notes with holiday tag
        let kioskNotes = 'Absen via Kiosk';
        if (kioskHolidayType && type === 'check_in') {
            kioskNotes = `[LEMBUR LIBUR: ${kioskHolidayName}] ${kioskNotes}`;
        }

        // Note: Kiosk mode automatically assumes valid location
        const result = await pool.query(
            `INSERT INTO attendance_records 
             (user_id, location_id, type, photo_path, latitude, longitude, distance_meters, is_valid, notes)
             VALUES ($1, $2, $3, $4, 0, 0, 0, true, $5)
             RETURNING *`,
            [user_id, location_id || null, type, photoPath, kioskNotes]
        );

        // Auto-create overtime for kiosk checkout on holiday
        let kioskOvertimeMsg = '';
        if (type === 'check_out') {
            const checkinRow = existingRecords.rows.find(r => r.type === 'check_in');
            if (checkinRow) {
                const otResult = await handleAutoHolidayOvertime({
                    userId: user_id,
                    today,
                    checkinRecord: checkinRow,
                    checkoutTime: result.rows[0].recorded_at,
                    approverId: req.user.id
                });
                if (otResult) {
                    kioskOvertimeMsg = ` | Lembur ${otResult.hours_worked} jam (${otResult.rate_label})`;
                }
            }
        }

        const kioskMsg = type === 'check_in'
            ? (kioskHolidayType ? `Check-in berhasil untuk ${userName} (Lembur: ${kioskHolidayName})` : `Check-in berhasil untuk ${userName}`)
            : `Check-out berhasil untuk ${userName}${kioskOvertimeMsg}`;

        res.status(201).json({
            ...result.rows[0],
            user_name: userName,
            message: kioskMsg
        });

    } catch (error) {
        console.error('Kiosk attendance error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get today's attendance status
router.get('/today', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT ar.*, al.name as location_name 
       FROM attendance_records ar
       LEFT JOIN attendance_locations al ON ar.location_id = al.id
       WHERE ar.user_id = $1 AND DATE(ar.recorded_at) = $2
       ORDER BY ar.recorded_at`,
            [req.user.id, today]
        );

        const checkIn = result.rows.find(r => r.type === 'check_in');
        const checkOut = result.rows.find(r => r.type === 'check_out');

        // Check if today is an off day
        const offDayResult = await pool.query(
            'SELECT id FROM user_off_days WHERE user_id = $1 AND off_date = $2',
            [req.user.id, today]
        );
        const isOffDay = offDayResult.rows.length > 0;

        res.json({
            checked_in: !!checkIn,
            checked_out: !!checkOut,
            check_in: checkIn || null,
            check_out: checkOut || null,
            is_off_day: isOffDay
        });
    } catch (error) {
        console.error('Get today attendance error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Get attendance history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date, limit = 50, user_id } = req.query;
        const isAdmin = req.user.role === 'admin';

        let query = `
      SELECT ar.*, al.name as location_name, u.name as user_name, u.employee_id, u.photo as user_photo
      FROM attendance_records ar
      LEFT JOIN attendance_locations al ON ar.location_id = al.id
      LEFT JOIN users u ON ar.user_id = u.id
    `;
        const params = [];
        const conditions = [];

        // If admin and user_id provided, filter by that user
        // If admin and no user_id, show all users
        // If not admin, only show own records
        if (!isAdmin) {
            params.push(req.user.id);
            conditions.push(`ar.user_id = $${params.length}`);
        } else if (user_id && user_id !== 'all') {
            params.push(user_id);
            conditions.push(`ar.user_id = $${params.length}`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`DATE(ar.recorded_at) >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`DATE(ar.recorded_at) <= $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY ar.recorded_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        // Also fetch APPROVED leave requests (late/sick/leave/change_off) per day within range
        // We'll materialize per-day rows using generate_series so they show up in history timeline.
        const targetUserId = !isAdmin ? req.user.id : (user_id && user_id !== 'all' ? user_id : null);

        const leaveParams = [];
        let leaveQuery = `
              SELECT 
                u.id as user_id,
                u.name as user_name,
                u.employee_id,
                d.date::date as leave_date,
                lr.id as leave_id,
                lr.type as leave_type,
                lr.reason as leave_reason
              FROM leave_requests lr
              JOIN users u ON lr.user_id = u.id
              CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day') AS d(date)
              WHERE lr.status = 'approved'
            `;

        const leaveConditions = [];
        if (targetUserId) {
            leaveParams.push(targetUserId);
            leaveConditions.push(`lr.user_id = $${leaveParams.length}`);
        }
        if (start_date) {
            leaveParams.push(start_date);
            leaveConditions.push(`d.date::date >= $${leaveParams.length}::date`);
        }
        if (end_date) {
            leaveParams.push(end_date);
            leaveConditions.push(`d.date::date <= $${leaveParams.length}::date`);
        }

        if (leaveConditions.length > 0) {
            leaveQuery += ` AND ${leaveConditions.join(' AND ')}`;
        }
        leaveQuery += ` ORDER BY d.date DESC, u.name ASC`;

        const leaveResult = await pool.query(leaveQuery, leaveParams);
        const leaveRecords = leaveResult.rows.map(row => ({
            id: `leave_${row.user_id}_${row.leave_id}_${row.leave_date}`,
            user_id: row.user_id,
            type: 'leave',
            leave_type: row.leave_type,
            leave_id: row.leave_id,
            recorded_at: row.leave_date,
            user_name: row.user_name,
            employee_id: row.employee_id,
            is_off_day: false,
            photo_path: null,
            location_name: null,
            latitude: null,
            longitude: null,
            distance_meters: null,
            is_valid: null,
            notes: row.leave_reason || null
        }));

        // Also fetch off days for the relevant user(s) and date range
        // If targetUserId is set (specific user), fetch for that user
        // If targetUserId is null (Admin viewing all), fetch for ALL users within range
        let offDayRecords = [];

        const offParams = [];
        let offQuery = `
              SELECT uod.off_date, u.name as user_name, u.employee_id, u.id as user_id
              FROM user_off_days uod
              JOIN users u ON uod.user_id = u.id
            `;

        const offConditions = [];

        if (targetUserId) {
            offParams.push(targetUserId);
            offConditions.push(`uod.user_id = $${offParams.length}`);
        }

        if (start_date) {
            offParams.push(start_date);
            offConditions.push(`uod.off_date >= $${offParams.length}`);
        }

        if (end_date) {
            offParams.push(end_date);
            offConditions.push(`uod.off_date <= $${offParams.length}`);
        }

        if (offConditions.length > 0) {
            offQuery += ` WHERE ${offConditions.join(' AND ')}`;
        }

        offQuery += ` ORDER BY uod.off_date DESC`;

        // If no date range and no user selected (e.g. initial load), we might want to limit?
        // But for history usually there is a date range or limit.
        // Let's just run the query.

        const offResult = await pool.query(offQuery, offParams);
        offDayRecords = offResult.rows.map(row => ({
            id: `off_${row.user_id}_${row.off_date}`,
            user_id: row.user_id,
            type: 'off_day',
            recorded_at: row.off_date,
            user_name: row.user_name,
            employee_id: row.employee_id,
            is_off_day: true,
            photo_path: null,
            location_name: null,
            latitude: null,
            longitude: null,
            distance_meters: null,
            is_valid: null,
            notes: 'Hari Libur'
        }));

        // Merge attendance records with off day records + leave records
        const allRecords = [...result.rows, ...offDayRecords, ...leaveRecords];
        // Sort by date descending
        allRecords.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

        res.json(allRecords);
    } catch (error) {
        console.error('Get attendance history error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Delete attendance record (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang bisa menghapus data.' });
        }

        const { id } = req.params;

        // Check if record exists
        const checkRecord = await pool.query('SELECT * FROM attendance_records WHERE id = $1', [id]);

        if (checkRecord.rows.length === 0) {
            return res.status(404).json({ error: 'Data absensi tidak ditemukan' });
        }

        // Delete photo if exists
        const record = checkRecord.rows[0];
        if (record.photo_path) {
            const photoFullPath = path.join(__dirname, '..', record.photo_path);
            if (fs.existsSync(photoFullPath)) {
                fs.unlinkSync(photoFullPath);
            }
        }

        // Delete record from database
        await pool.query('DELETE FROM attendance_records WHERE id = $1', [id]);

        res.json({ message: 'Data absensi berhasil dihapus' });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
