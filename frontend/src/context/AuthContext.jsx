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
        if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'superadmin') return true;
        if (user.role === 'kiosk') return permissionKey === 'admin.kiosk';
        if (!user.permissions) return false;
        return user.permissions.includes(permissionKey);
    }

    function isSuperAdmin() {
        return user?.role === 'super_admin' || user?.role === 'superadmin';
    }

    function isAdminUser() {
        return user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';
    }

    function isKioskOnly() {
        return user?.role === 'kiosk';
    }

    async function updateHiddenMenus(newHiddenMenus) {
        try {
            const res = await authAPI.updateMenuPreferences(newHiddenMenus);
            setUser(prev => prev ? { ...prev, hidden_menus: res.hidden_menus || newHiddenMenus } : prev);
            return res;
        } catch (err) {
            console.error('Failed to update hidden menus:', err);
            throw err;
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, setUser, hasPermission, isKioskOnly, isSuperAdmin, isAdminUser, updateHiddenMenus }}>
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
