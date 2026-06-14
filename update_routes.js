const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// Replace specific routes
const replacements = [
    { path: '/admin/locations', perm: 'admin.locations' },
    { path: '/admin/departments', perm: 'admin.departments' },
    { path: '/admin/positions', perm: 'admin.positions' },
    { path: '/admin/vehicle-types', perm: 'admin.vehicle_types' },
    { path: '/admin/employees', perm: 'admin.employees' },
    { path: '/admin/face-registration', perm: 'admin.face_registration' },
    { path: '/admin/work-schedule', perm: 'admin.work_schedule' },
    { path: '/admin/customers', perm: 'admin.customers' },
    { path: '/off-days', perm: 'admin.off_days' },
    { path: '/admin/announcements', perm: 'admin.announcements' },
    { path: '/admin/driver-activities', perm: 'admin.driver_activities' },
    { path: '/admin/driver-tracking', perm: 'admin.driver_tracking' },
    { path: '/admin/leaves', perm: 'admin.leaves' },
    { path: '/admin/manual-attendance', perm: 'admin.manual_attendance' },
    { path: '/admin/loans', perm: 'admin.loans' },
    { path: '/admin/payroll', perm: 'admin.payroll' },
    { path: '/admin/assessments', perm: 'admin.assessments' },
    { path: '/admin/recruitment', perm: 'admin.recruitment' },
    { path: '/admin/assets', perm: 'admin.assets' },
    { path: '/admin/reports', perm: 'admin.reports' },
    { path: '/admin/settings', perm: 'admin.settings' },
    { path: '/admin/license', perm: 'admin.license' },
    { path: '/kiosk', perm: 'admin.kiosk' },
    { path: '/approvals', perm: 'manager.approvals', replaceStr: 'managerOrAdmin' }
];

for (const r of replacements) {
    const searchStr = `path="${r.path}"\\s+element=\\{\\s*<ProtectedRoute ${r.replaceStr || 'adminOnly'}>`;
    const regex = new RegExp(searchStr, 'g');
    content = content.replace(regex, `path="${r.path}"\n                element={\n                    <ProtectedRoute permission="${r.perm}">`);
}

fs.writeFileSync(appJsxPath, content);
console.log('App.jsx routes updated');
