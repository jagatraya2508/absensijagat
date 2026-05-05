// Use environment variable for production, fallback to /api for development (proxied by Vite)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper to get auth token
function getToken() {
    return localStorage.getItem('token');
}

// Helper for API requests
async function request(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        ...options.headers,
    };

    // Don't set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`Requesting: ${API_BASE}${endpoint}`);
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const contentType = response.headers.get('content-type');

    // Read text buffer once
    const text = await response.text();

    if (contentType && contentType.includes('text/html')) {
        console.error('Received HTML response:', text.substring(0, 100));
        throw new Error(`Server Error (Received HTML instead of JSON from ${API_BASE}${endpoint})`);
    }

    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error('Failed to parse JSON:', text.substring(0, 100));
        throw new Error('Server Error (Invalid JSON response)');
    }

    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
}

// Auth API
export const authAPI = {
    login: (employee_id, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ employee_id, password }),
        }),

    register: (userData) =>
        request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        }),

    getMe: () => request('/auth/me'),

    getUsers: () => request('/auth/users'),

    deleteUser: (id) =>
        request(`/auth/users/${id}`, { method: 'DELETE' }),

    updateUser: (id, userData) =>
        request(`/auth/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        }),

    // Change own password
    changePassword: (currentPassword, newPassword) =>
        request('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        }),

    // Reset user password (admin only)
    resetPassword: (userId, newPassword) =>
        request(`/auth/reset-password/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ new_password: newPassword }),
        }),

    // Update own profile (off_day)
    updateProfile: (data) =>
        request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};

// Attendance API
export const attendanceAPI = {
    checkIn: (formData) =>
        request('/attendance/check-in', {
            method: 'POST',
            body: formData,
        }),

    checkOut: (formData) =>
        request('/attendance/check-out', {
            method: 'POST',
            body: formData,
        }),

    getToday: () => request('/attendance/today'),

    getHistory: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/attendance/history?${query}`);
    },

    delete: (id) => request(`/attendance/${id}`, { method: 'DELETE' }),
};

// Locations API
export const locationsAPI = {
    getAll: () => request('/locations'),

    getActive: () => request('/locations/active'),

    getById: (id) => request(`/locations/${id}`),

    create: (data) =>
        request('/locations', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id, data) =>
        request(`/locations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id) =>
        request(`/locations/${id}`, { method: 'DELETE' }),
};

// Reports API
export const reportsAPI = {
    getDaily: (date) => {
        const query = date ? `?date=${date}` : '';
        return request(`/reports/daily${query}`);
    },

    getMonthly: (year, month) => {
        const params = new URLSearchParams();
        if (year) params.set('year', year);
        if (month) params.set('month', month);
        return request(`/reports/monthly?${params}`);
    },

    getEmployee: (id, startDate, endDate) => {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        return request(`/reports/employee/${id}?${params}`);
    },

    getOff: (startDate, endDate) => {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        return request(`/reports/off?${params}`);
    },

    // Export functions - return download URLs
    exportDailyPDF: (date) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/daily/pdf?date=${date}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-absensi-${date}.pdf`;
                link.click();
            });
    },

    exportDailyExcel: (date) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/daily/excel?date=${date}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-absensi-${date}.xlsx`;
                link.click();
            });
    },

    exportMonthlyPDF: (year, month) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/monthly/pdf?year=${year}&month=${month}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-bulanan-${year}-${month}.pdf`;
                link.click();
            });
    },

    exportMonthlyExcel: (year, month) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/monthly/excel?year=${year}&month=${month}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-bulanan-${year}-${month}.xlsx`;
                link.click();
            });
    },

    exportOffPDF: (startDate, endDate) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/off/pdf?start_date=${startDate}&end_date=${endDate}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-off-${startDate}-to-${endDate}.pdf`;
                link.click();
            });
    },

    exportOffExcel: (startDate, endDate) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reports/export/off/excel?start_date=${startDate}&end_date=${endDate}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `laporan-off-${startDate}-to-${endDate}.xlsx`;
                link.click();
            });
    },

    // History report (Riwayat Absensi)
    getHistory: (startDate, endDate, userId) => {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (userId && userId !== 'all') params.set('user_id', userId);
        return request(`/reports/history?${params}`);
    },

    exportHistoryPDF: (startDate, endDate, userId) => {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (userId && userId !== 'all') params.set('user_id', userId);
        const url = `${API_BASE}/reports/export/history/pdf?${params}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `riwayat-absensi-${startDate}-to-${endDate}.pdf`;
                link.click();
            });
    },

    exportHistoryExcel: (startDate, endDate, userId) => {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (userId && userId !== 'all') params.set('user_id', userId);
        const url = `${API_BASE}/reports/export/history/excel?${params}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `riwayat-absensi-${startDate}-to-${endDate}.xlsx`;
                link.click();
            });
    },
};


// Leaves API
export const leavesAPI = {
    // Create new leave request
    create: (formData) => request('/leaves', {
        method: 'POST',
        body: formData, // FormData for file upload
    }),

    // Get my leave requests
    getMy: (status) => {
        const params = status ? `?status=${status}` : '';
        return request(`/leaves/my${params}`);
    },

    // Get all leave requests (admin)
    getAll: (status, userId) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (userId) params.set('user_id', userId);
        return request(`/leaves/all?${params}`);
    },

    // Get pending count (admin)
    getPendingCount: () => request('/leaves/pending-count'),

    // Approve/reject leave request (admin)
    updateStatus: (id, status, adminNotes) => request(`/leaves/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: adminNotes }),
    }),

    // Get my leave quota info
    getQuota: () => request('/leaves/my-quota'),

    // Delete leave request
    delete: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),
};

// Face API
export const faceAPI = {
    // Register face for user (admin)
    register: (userId, faceDescriptor) => request(`/face/register/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ face_descriptor: faceDescriptor }),
    }),

    // Self register face (employee)
    registerSelf: (faceDescriptor) => request('/face/register-self', {
        method: 'POST',
        body: JSON.stringify({ face_descriptor: faceDescriptor }),
    }),

    // Check if current user has face registered
    getStatus: () => request('/face/status'),

    // Get face descriptor for current user
    getMyDescriptor: () => request('/face/my-descriptor'),

    // Get all users with face status (admin)
    getUsersStatus: () => request('/face/users-status'),

    // Delete face registration (admin)
    delete: (userId) => request(`/face/${userId}`, { method: 'DELETE' }),
};

// Announcements API
export const announcementsAPI = {
    getAll: () => request('/announcements'),
    getActive: () => request('/announcements/active'),
    create: (data) => request('/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/announcements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
};

export const settingsAPI = {
    getAll: () => request('/settings'),
    updateLogo: (formData) => request('/settings/logo', {
        method: 'POST',
        body: formData, // FormData for file upload
    }),
    getBpjs: () => request('/settings/bpjs'),
    updateTheme: (colors) => request('/settings/theme', {
        method: 'PUT',
        body: JSON.stringify(colors),
    }),
};

// Schedule API
export const scheduleAPI = {
    getOffDays: () => request('/schedule/off-days'),
    addOffDays: (dates) => request('/schedule/off-days', {
        method: 'POST',
        body: JSON.stringify({ off_dates: dates }),
    }),
    deleteOffDay: (date) => request(`/schedule/off-days/${date}`, {
        method: 'DELETE',
    }),
};

// Off Days API (Admin per user)
export const offDaysAPI = {
    getByUser: (userId) => request(`/off-days/${userId}`),

    add: (userId, date) => request('/off-days', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, date }),
    }),

    delete: (id) => request(`/off-days/${id}`, { method: 'DELETE' }),
};

// Employees API (HR Detail)
export const employeesAPI = {
    getAll: () => request('/employees'),
    getById: (id) => request(`/employees/${id}`),
    update: (id, data) => request(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    getDocuments: (id) => request(`/employees/${id}/documents`),
    uploadDocument: (id, formData) => request(`/employees/${id}/documents`, {
        method: 'POST',
        body: formData, // FormData for file upload
    }),
    deleteDocument: (id, docId) => request(`/employees/${id}/documents/${docId}`, {
        method: 'DELETE',
    }),
};

// Overtime API
export const overtimeAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/overtime?${query}`);
    },
    create: (data) => request('/overtime', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/overtime/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => request(`/overtime/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    }),
    delete: (id) => request(`/overtime/${id}`, { method: 'DELETE' }),
};

// Loans API
export const loansAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/loans?${query}`);
    },
    getById: (id) => request(`/loans/${id}`),
    create: (data) => request('/loans', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/loans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    recordPayment: (id, data) => request(`/loans/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/loans/${id}`, { method: 'DELETE' }),
};

// Payroll API
export const payrollAPI = {
    getAll: () => request('/payroll'),
    getById: (id) => request(`/payroll/${id}`),
    generate: (data) => request('/payroll/generate', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    finalize: (id) => request(`/payroll/${id}/finalize`, {
        method: 'PUT',
    }),
    getSlip: (runId, userId) => request(`/payroll/${runId}/slip/${userId}`),
    delete: (id) => request(`/payroll/${id}`, { method: 'DELETE' }),
};

// Departments API
export const departmentsAPI = {
    getAll: () => request('/departments'),
    create: (data) => request('/departments', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
};

// Positions API
export const positionsAPI = {
    getAll: () => request('/positions'),
    create: (data) => request('/positions', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/positions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/positions/${id}`, { method: 'DELETE' }),
};

// Driver Activities API
export const driverActivitiesAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/driver-activities?${query}`);
    },
    getSummary: (month, year) => request(`/driver-activities/summary?month=${month}&year=${year}`),
    getDrivers: () => request('/driver-activities/drivers'),
    create: (data) => request('/driver-activities', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/driver-activities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/driver-activities/${id}`, { method: 'DELETE' }),
    bulkCreate: (activities) => request('/driver-activities/bulk', {
        method: 'POST',
        body: JSON.stringify({ activities }),
    }),
    exportSummaryPDF: (month, year) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/driver-activities/export/summary/pdf?month=${month}&year=${year}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `rekap-driver-${year}-${month}.pdf`;
                link.click();
            });
    },
    exportSummaryExcel: (month, year) => {
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/driver-activities/export/summary/excel?month=${month}&year=${year}`;
        return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `rekap-driver-${year}-${month}.xlsx`;
                link.click();
            });
    },
};

// Driver Tracking API
export const driverTrackingAPI = {
    // Driver endpoints
    getMyToday: () => request('/driver-tracking/my-today'),
    getMyHistory: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/driver-tracking/my-history?${query}`);
    },
    checkin: (formData) => request('/driver-tracking/checkin', {
        method: 'POST',
        body: formData, // FormData for file upload
    }),
    checkout: (id, formData) => request(`/driver-tracking/${id}/checkout`, {
        method: 'PUT',
        body: formData, // FormData for file upload
    }),
    // Admin endpoints
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/driver-tracking?${query}`);
    },
    getDrivers: () => request('/driver-tracking/drivers'),
    getById: (id) => request(`/driver-tracking/${id}`),
    delete: (id) => request(`/driver-tracking/${id}`, { method: 'DELETE' }),
};

// Customers API
export const customersAPI = {
    search: (q = '') => request(`/customers/search?q=${encodeURIComponent(q)}`),
    getAll: () => request('/customers'),
    create: (data) => request('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
};

// License API
export const licenseAPI = {
    activate: (licenseKey) => request('/license/activate', {
        method: 'POST',
        body: JSON.stringify({ license_key: licenseKey }),
    }),
    getInfo: () => request('/license/info'),
    getStatus: () => request('/license/status'),
};

// Vehicle Types API
export const vehicleTypesAPI = {
    getAll: () => request('/vehicle-types'),
    create: (data) => request('/vehicle-types', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/vehicle-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/vehicle-types/${id}`, { method: 'DELETE' }),
};

export default {
    authAPI,
    attendanceAPI,
    locationsAPI,
    reportsAPI,
    leavesAPI,
    faceAPI,
    announcementsAPI,
    settingsAPI,
    scheduleAPI,
    offDaysAPI,
    employeesAPI,
    overtimeAPI,
    loansAPI,
    payrollAPI,
    departmentsAPI,
    positionsAPI,
    driverActivitiesAPI,
    driverTrackingAPI,
    customersAPI,
    licenseAPI,
    vehicleTypesAPI
};
