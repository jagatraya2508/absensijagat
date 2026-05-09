import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import History from './pages/History';
import AdminLocations from './pages/AdminLocations';
import AdminUsers from './pages/AdminUsers';
import AdminReports from './pages/AdminReports';
import AdminFaceRegistration from './pages/AdminFaceRegistration';
import Leaves from './pages/Leaves';
import AdminLeaves from './pages/AdminLeaves';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminSettings from './pages/AdminSettings';
import ChangePassword from './pages/ChangePassword';
import OffDays from './pages/OffDays';
import AdminEmployees from './pages/AdminEmployees';
import ManualAttendance from './pages/ManualAttendance';
import AdminManualAttendance from './pages/AdminManualAttendance';

import AdminLoans from './pages/AdminLoans';
import AdminPayroll from './pages/AdminPayroll';
import AdminAssessments from './pages/AdminAssessments';
import AdminRecruitment from './pages/AdminRecruitment';
import AdminWorkSchedule from './pages/AdminWorkSchedule';
import EmployeeSchedule from './pages/EmployeeSchedule';
import AdminDepartments from './pages/AdminDepartments';
import AdminPositions from './pages/AdminPositions';
import AdminVehicleTypes from './pages/AdminVehicleTypes';
import ManagerApprovals from './pages/ManagerApprovals';
import Overtime from './pages/Overtime';
import AdminDriverActivities from './pages/AdminDriverActivities';
import DriverTracking from './pages/DriverTracking';
import AdminDriverTracking from './pages/AdminDriverTracking';
import LicenseSettings from './pages/LicenseSettings';
import AdminAssets from './pages/AdminAssets';
import AdminCustomers from './pages/AdminCustomers';

function ProtectedRoute({ children, adminOnly = false, managerOrAdmin = false }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    if (managerOrAdmin && user.role !== 'admin' && user.role !== 'manager') {
        return <Navigate to="/" replace />;
    }

    return children;
}

function AppLayout({ children }) {
    const { settings } = useSettings();

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content" style={{ position: 'relative' }}>
                {settings?.app_logo && (
                    <div className="global-logo-container">
                        <img src={settings.app_logo} alt="Company Logo" className="global-logo" />
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={user ? <Navigate to="/" replace /> : <Login />}
            />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <Dashboard />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/attendance"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <Attendance />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/history"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <History />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/change-password"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <ChangePassword />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/off-days"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <OffDays />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/locations"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminLocations />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminUsers />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/reports"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminReports />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/face-registration"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminFaceRegistration />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/leaves"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <Leaves />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/overtime"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <Overtime />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/manual-attendance"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <ManualAttendance />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/schedule"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <EmployeeSchedule />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/leaves"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminLeaves />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/manual-attendance"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminManualAttendance />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/approvals"
                element={
                    <ProtectedRoute managerOrAdmin>
                        <AppLayout>
                            <ManagerApprovals />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/announcements"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminAnnouncements />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/settings"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminSettings />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/license"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <LicenseSettings />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/employees"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminEmployees />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />



            <Route
                path="/admin/loans"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminLoans />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/payroll"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminPayroll />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/assessments"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminAssessments />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/recruitment"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminRecruitment />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/work-schedule"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminWorkSchedule />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/departments"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminDepartments />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/positions"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminPositions />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/vehicle-types"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminVehicleTypes />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/driver-activities"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminDriverActivities />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/driver-tracking"
                element={
                    <ProtectedRoute>
                        <AppLayout>
                            <DriverTracking />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/driver-tracking"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminDriverTracking />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/assets"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminAssets />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/customers"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminCustomers />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <SettingsProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </SettingsProvider>
        </BrowserRouter>
    );
}
