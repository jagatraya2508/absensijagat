import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import AdminRoles from './pages/AdminRoles';

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
import Kiosk from './pages/Kiosk';

function ProtectedRoute({ children, adminOnly = false, managerOrAdmin = false, permission = null }) {
    const { user, loading, hasPermission } = useAuth();

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

    if (permission && !hasPermission(permission)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function AppLayout({ children }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content" style={{ position: 'relative' }}>
                <div className="global-logo-container">
                    {user?.photo ? (
                        <img 
                            src={user.photo} 
                            alt="Profile" 
                            className="sidebar-user-avatar"
                            style={{
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                objectFit: 'cover',
                                padding: 0,
                                border: '2px solid rgba(255,255,255,0.2)'
                            }}
                            title={user?.name || 'User'}
                            onClick={() => navigate('/change-password')}
                        />
                    ) : (
                        <div
                            className="sidebar-user-avatar"
                            style={{
                                width: '32px',
                                height: '32px',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                            title={user?.name || 'User'}
                            onClick={() => navigate('/change-password')}
                        >
                            {user?.name?.charAt(0) || '?'}
                        </div>
                    )}
                </div>
                {children}
            </main>
        </div>
    );
}

import Careers from './pages/Careers';

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
            <Route path="/careers" element={<Careers />} />

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
                    <ProtectedRoute permission="admin.off_days">
                        <AppLayout>
                            <OffDays />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/locations"
                element={
                    <ProtectedRoute permission="admin.locations">
                        <AppLayout>
                            <AdminLocations />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute permission="admin.users">
                        <AppLayout>
                            <AdminUsers />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/roles"
                element={
                    <ProtectedRoute permission="admin.roles">
                        <AppLayout>
                            <AdminRoles />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/reports"
                element={
                    <ProtectedRoute permission="admin.reports">
                        <AppLayout>
                            <AdminReports />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/face-registration"
                element={
                    <ProtectedRoute permission="admin.face_registration">
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
                    <ProtectedRoute permission="admin.leaves">
                        <AppLayout>
                            <AdminLeaves />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/manual-attendance"
                element={
                    <ProtectedRoute permission="admin.manual_attendance">
                        <AppLayout>
                            <AdminManualAttendance />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/approvals"
                element={
                    <ProtectedRoute permission="manager.approvals">
                        <AppLayout>
                            <ManagerApprovals />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/announcements"
                element={
                    <ProtectedRoute permission="admin.announcements">
                        <AppLayout>
                            <AdminAnnouncements />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/settings"
                element={
                    <ProtectedRoute permission="admin.settings">
                        <AppLayout>
                            <AdminSettings />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/license"
                element={
                    <ProtectedRoute permission="admin.license">
                        <AppLayout>
                            <LicenseSettings />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/employees"
                element={
                    <ProtectedRoute permission="admin.employees">
                        <AppLayout>
                            <AdminEmployees />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />



            <Route
                path="/admin/loans"
                element={
                    <ProtectedRoute permission="admin.loans">
                        <AppLayout>
                            <AdminLoans />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/payroll"
                element={
                    <ProtectedRoute permission="admin.payroll">
                        <AppLayout>
                            <AdminPayroll />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/assessments"
                element={
                    <ProtectedRoute permission="admin.assessments">
                        <AppLayout>
                            <AdminAssessments />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/recruitment"
                element={
                    <ProtectedRoute permission="admin.recruitment">
                        <AppLayout>
                            <AdminRecruitment />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/work-schedule"
                element={
                    <ProtectedRoute permission="admin.work_schedule">
                        <AppLayout>
                            <AdminWorkSchedule />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/departments"
                element={
                    <ProtectedRoute permission="admin.departments">
                        <AppLayout>
                            <AdminDepartments />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/positions"
                element={
                    <ProtectedRoute permission="admin.positions">
                        <AppLayout>
                            <AdminPositions />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/vehicle-types"
                element={
                    <ProtectedRoute permission="admin.vehicle_types">
                        <AppLayout>
                            <AdminVehicleTypes />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/driver-activities"
                element={
                    <ProtectedRoute permission="admin.driver_activities">
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
                    <ProtectedRoute permission="admin.driver_tracking">
                        <AppLayout>
                            <AdminDriverTracking />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/assets"
                element={
                    <ProtectedRoute permission="admin.assets">
                        <AppLayout>
                            <AdminAssets />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/customers"
                element={
                    <ProtectedRoute permission="admin.customers">
                        <AppLayout>
                            <AdminCustomers />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/kiosk"
                element={
                    <ProtectedRoute permission="admin.kiosk">
                        <Kiosk />
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
