const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const Holidays = require('date-holidays');
const hd = new Holidays('ID');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { month, year, user_id } = req.query;

        let dateFilter = '';
        const params = [];
        let paramCount = 1;

        if (month && year) {
            dateFilter = ` AND EXTRACT(MONTH FROM {dateField}) = $${paramCount} AND EXTRACT(YEAR FROM {dateField}) = $${paramCount + 1}`;
            params.push(month, year);
            paramCount += 2;
        }

        let userFilter = '';
        if (user_id) {
            userFilter = ` AND u.id = $${paramCount}`;
            params.push(user_id);
        }

        const events = [];

        // 1. Fetch Shifts
        const shiftsQuery = `
            SELECT 
                esa.id, 
                u.name as user_name, 
                ws.name as shift_name, 
                ws.start_time, 
                ws.end_time, 
                esa.assignment_date as date
            FROM employee_shift_assignments esa
            JOIN users u ON esa.user_id = u.id
            JOIN work_shifts ws ON esa.shift_id = ws.id
            WHERE 1=1
            ${dateFilter.replace(/{dateField}/g, 'esa.assignment_date')}
            ${userFilter}
        `;
        const shiftsResult = await pool.query(shiftsQuery, params);
        
        shiftsResult.rows.forEach(shift => {
            const startDate = new Date(shift.date);
            const endDate = new Date(shift.date);
            
            // Parse time
            if (shift.start_time && shift.end_time) {
                const [startH, startM] = shift.start_time.split(':');
                const [endH, endM] = shift.end_time.split(':');
                startDate.setHours(parseInt(startH), parseInt(startM), 0);
                endDate.setHours(parseInt(endH), parseInt(endM), 0);
                
                // Handle overnight shifts
                if (parseInt(endH) < parseInt(startH)) {
                    endDate.setDate(endDate.getDate() + 1);
                }
            }

            events.push({
                id: `shift_${shift.id}`,
                title: `${shift.user_name} - ${shift.shift_name}`,
                start: startDate,
                end: endDate,
                allDay: false,
                type: 'shift',
                user_name: shift.user_name
            });
        });

        // 2. Fetch Leaves
        const leavesQuery = `
            SELECT 
                lr.id, 
                u.name as user_name, 
                lr.type, 
                lr.start_date, 
                lr.end_date
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            WHERE lr.status = 'approved'
            ${dateFilter.replace(/{dateField}/g, 'lr.start_date')}
            ${userFilter}
        `;
        const leavesResult = await pool.query(leavesQuery, params);
        
        leavesResult.rows.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            endDate.setHours(23, 59, 59); // End of the day

            events.push({
                id: `leave_${leave.id}`,
                title: `${leave.user_name} - ${leave.type.toUpperCase()}`,
                start: startDate,
                end: endDate,
                allDay: true,
                type: 'leave',
                leave_type: leave.type,
                user_name: leave.user_name
            });
        });

        // 3. Fetch Off Days (Holidays)
        const offDaysQuery = `
            SELECT 
                uod.id, 
                u.name as user_name, 
                uod.off_date
            FROM user_off_days uod
            JOIN users u ON uod.user_id = u.id
            WHERE 1=1
            ${dateFilter.replace(/{dateField}/g, 'uod.off_date')}
            ${userFilter}
        `;
        const offDaysResult = await pool.query(offDaysQuery, params);
        
        offDaysResult.rows.forEach(off => {
            const startDate = new Date(off.off_date);
            const endDate = new Date(off.off_date);
            endDate.setHours(23, 59, 59);

            events.push({
                id: `off_${off.id}`,
                title: `${off.user_name} - Libur/Off`,
                start: startDate,
                end: endDate,
                allDay: true,
                type: 'off_day',
                user_name: off.user_name
            });
        });

        // 4. Fetch Overtime
        const overtimeQuery = `
            SELECT 
                ore.id, 
                u.name as user_name, 
                orq.date, 
                orq.overtime_start, 
                orq.overtime_end,
                orq.department
            FROM overtime_request_employees ore
            JOIN overtime_requests orq ON ore.overtime_request_id = orq.id
            JOIN users u ON ore.user_id = u.id
            WHERE orq.status = 'approved'
            ${dateFilter.replace(/{dateField}/g, 'orq.date')}
            ${userFilter}
        `;
        const overtimeResult = await pool.query(overtimeQuery, params);
        
        overtimeResult.rows.forEach(ot => {
            const startDate = new Date(ot.date);
            const endDate = new Date(ot.date);
            
            if (ot.overtime_start && ot.overtime_end) {
                const [startH, startM] = ot.overtime_start.split(':');
                const [endH, endM] = ot.overtime_end.split(':');
                startDate.setHours(parseInt(startH), parseInt(startM), 0);
                endDate.setHours(parseInt(endH), parseInt(endM), 0);
                
                if (parseInt(endH) < parseInt(startH)) {
                    endDate.setDate(endDate.getDate() + 1);
                }
            }

            events.push({
                id: `ot_${ot.id}`,
                title: `${ot.user_name} - Lembur`,
                start: startDate,
                end: endDate,
                allDay: false,
                type: 'overtime',
                user_name: ot.user_name
            });
        });

        // 5. Fetch National Holidays
        const reqYear = year ? parseInt(year) : new Date().getFullYear();
        const reqMonth = month ? parseInt(month) : null;
        
        const nationalHolidays = hd.getHolidays(reqYear);
        nationalHolidays.forEach(h => {
            if (h.type === 'public') {
                // "date" property in date-holidays is something like "2026-01-01 00:00:00"
                const hDate = new Date(h.start || h.date);
                if (!reqMonth || hDate.getMonth() + 1 === reqMonth) {
                    events.push({
                        id: `nat_${hDate.getTime()}`,
                        title: `Libur Nasional: ${h.name}`,
                        start: hDate,
                        end: hDate,
                        allDay: true,
                        type: 'national_holiday',
                        user_name: 'Perusahaan'
                    });
                }
            }
        });

        res.json(events);
    } catch (error) {
        console.error('Calendar Fetch Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server saat mengambil data kalender' });
    }
});

module.exports = router;
