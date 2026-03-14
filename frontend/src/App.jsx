import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
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
import AdminOvertime from './pages/AdminOvertime';
import AdminLoans from './pages/AdminLoans';
import AdminPayroll from './pages/AdminPayroll';
import AdminAssessments from './pages/AdminAssessments';
import AdminRecruitment from './pages/AdminRecruitment';

function ProtectedRoute({ children, adminOnly = false }) {
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

    return children;
}

function AppLayout({ children }) {
    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
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
                path="/admin/overtime"
                element={
                    <ProtectedRoute adminOnly>
                        <AppLayout>
                            <AdminOvertime />
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
