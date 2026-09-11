import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const userData = await authAPI.getMe();
                setUser(userData);
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }

    async function login(employee_id, password) {
        const data = await authAPI.login(employee_id, password);
        localStorage.setItem('token', data.token);
        setUser(data.user);
        return data;
    }

    function logout() {
        localStorage.removeItem('token');
        setUser(null);
    }

    function hasPermission(permissionKey) {
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role === 'kiosk') return permissionKey === 'admin.kiosk';
        if (!user.permissions) return false;
        return user.permissions.includes(permissionKey);
    }

    function isKioskOnly() {
        return user?.role === 'kiosk';
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, setUser, hasPermission, isKioskOnly }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
