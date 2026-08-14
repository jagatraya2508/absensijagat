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

    // Forgot password (trigger email)
    forgotPassword: (employee_id) =>
        request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ employee_id }),
        }),

    // Update own profile (off_day)
    updateProfile: (data) =>
        request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Update own profile photo
    updateProfilePhoto: (formData) =>
        request('/auth/profile/photo', {
            method: 'PUT',
            body: formData,
        }),

    downloadUserTemplate: () => {
        const token = getToken();
        return fetch(`${API_BASE}/auth/users/template`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
            if (!res.ok) {
                let message = 'Gagal mengunduh template';
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch (_) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template-import-user.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
        });
    },

    importUsers: (formData) =>
        request('/auth/users/import', {
            method: 'POST',
            body: formData,
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

    kioskAttend: (formData) =>
        request('/attendance/kiosk', {
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

    // Get pending count (admin / approver)
    getPendingCount: () => request('/leaves/pending-count'),

    getPendingForMe: () => request('/leaves/pending-for-me'),

    // Approve/reject leave request
    updateStatus: (id, status, adminNotes, extra = {}) => request(`/leaves/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: adminNotes, ...extra }),
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

    // Get all face descriptors (admin, for kiosk)
    getAllDescriptors: () => request('/face/all-descriptors'),
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
    getLeave: () => request('/settings/leave'),
    updateLeave: (data) => request('/settings/leave', {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    updateSmtp: (data) => request('/settings/smtp', {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
};

// Database backup & restore (admin only)
export const backupAPI = {
    download: async () => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/backup/download`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            let message = 'Gagal membuat backup';
            try {
                const data = await response.json();
                message = data.error || message;
            } catch (_) { /* ignore */ }
            throw new Error(message);
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const filename = match?.[1] || `absensi-backup-${new Date().toISOString().slice(0, 10)}.sql`;

        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    },
    restore: (formData) => request('/backup/restore', {
        method: 'POST',
        body: formData,
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

    downloadTemplate: () => {
        const token = getToken();
        return fetch(`${API_BASE}/employees/template`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
            if (!res.ok) {
                let message = 'Gagal mengunduh template';
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch (_) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template-import-karyawan.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
        });
    },

    import: (formData) =>
        request('/employees/import', {
            method: 'POST',
            body: formData,
        }),
};

export const organizationAPI = {
    getTree: () => request('/organization'),
    getMembers: () => request('/organization/members'),
    setSupervisor: (userId, supervisorId) => request(`/organization/${userId}/supervisor`, {
        method: 'PUT',
        body: JSON.stringify({ supervisor_id: supervisorId || null }),
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

    downloadTemplate: () => {
        const token = getToken();
        return fetch(`${API_BASE}/positions/template`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
            if (!res.ok) {
                let message = 'Gagal mengunduh template';
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch (_) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template-import-jabatan.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
        });
    },

    import: (formData) =>
        request('/positions/import', {
            method: 'POST',
            body: formData,
        }),
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
    getDirectory: (params = {}) => {
        const query = new URLSearchParams({
            page: params.page || 1,
            limit: params.limit || 10,
            q: params.q || '',
        }).toString();
        return request(`/customers/directory?${query}`);
    },
    getAll: () => request('/customers'),
    getCodeSettings: () => request('/customers/code-settings'),
    updateCodeSettings: (data) => request('/customers/code-settings', {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    create: (data) => request('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

    downloadTemplate: () => {
        const token = getToken();
        return fetch(`${API_BASE}/customers/template`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
            if (!res.ok) {
                let message = 'Gagal mengunduh template';
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch (_) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template-import-customer.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
        });
    },

    import: (formData) =>
        request('/customers/import', {
            method: 'POST',
            body: formData,
        }),
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

// Manual Attendance API
export const manualAttendanceAPI = {
    // Create new manual attendance request
    create: (data) => request('/manual-attendances', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data),
    }),

    // Get my requests
    getMy: () => request('/manual-attendances/my'),

    // Get all requests (admin)
    getAll: (status) => {
        const query = status && status !== 'all' ? `?status=${status}` : '';
        return request(`/manual-attendances/all${query}`);
    },

    // Approve/reject request (admin)
    updateStatus: (id, status, adminNotes) => request(`/manual-attendances/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: adminNotes }),
    }),

    // Delete request
    delete: (id) => request(`/manual-attendances/${id}`, { method: 'DELETE' }),
};

// Roles API
export const rolesAPI = {
    getAll: () => request('/roles'),
    getPermissions: () => request('/roles/permissions'),
    create: (data) => request('/roles', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/roles/${id}`, { method: 'DELETE' }),

    downloadTemplate: () => {
        const token = getToken();
        return fetch(`${API_BASE}/roles/template`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
            if (!res.ok) {
                let message = 'Gagal mengunduh template';
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch (_) { /* ignore */ }
                throw new Error(message);
            }
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template-import-role.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
        });
    },

    import: (formData) =>
        request('/roles/import', {
            method: 'POST',
            body: formData,
        }),
};

// Daily Work Report API
export const dailyWorkReportAPI = {
    // Employee endpoints
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/daily-work-reports${query ? `?${query}` : ''}`);
    },
    getById: (id) => request(`/daily-work-reports/${id}`),
    create: (data) => request('/daily-work-reports', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/daily-work-reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/daily-work-reports/${id}`, { method: 'DELETE' }),

    // Items
    addItem: (reportId, data) => request(`/daily-work-reports/${reportId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateItem: (itemId, data) => request(`/daily-work-reports/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    deleteItem: (itemId) => request(`/daily-work-reports/items/${itemId}`, { method: 'DELETE' }),

    // Pending & Schedule
    getPending: () => request('/daily-work-reports/pending/all'),
    getSchedule: (days = 30) => request(`/daily-work-reports/schedule/upcoming?days=${days}`),

    // Admin endpoints
    adminGetAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/daily-work-reports/admin/all${query ? `?${query}` : ''}`);
    },
    adminGetStats: (date) => request(`/daily-work-reports/admin/stats${date ? `?date=${date}` : ''}`),
    adminReview: (id, data) => request(`/daily-work-reports/admin/${id}/review`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
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
    backupAPI,
    scheduleAPI,
    offDaysAPI,
    employeesAPI,
    organizationAPI,
    overtimeAPI,
    loansAPI,
    payrollAPI,
    departmentsAPI,
    positionsAPI,
    driverActivitiesAPI,
    driverTrackingAPI,
    customersAPI,
    licenseAPI,
    vehicleTypesAPI,
    manualAttendanceAPI,
    rolesAPI,
    dailyWorkReportAPI
};
