import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../utils/api';

const SettingsContext = createContext(null);

// Default theme colors
const DEFAULT_THEME = {
    primary: '#6D0000',
    bg: '#fff8f8'
};

// Helper: convert hex to RGB values
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 109, g: 0, b: 0 };
}

// Helper: darken a hex color by a percentage
function darkenColor(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const factor = 1 - percent / 100;
    return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

// Helper: lighten a hex color (mix with white)
function lightenColor(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const factor = percent / 100;
    const lr = Math.round(r + (255 - r) * factor);
    const lg = Math.round(g + (255 - g) * factor);
    const lb = Math.round(b + (255 - b) * factor);
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// Apply theme CSS variables to document
function applyThemeToDOM(primary, bg) {
    const root = document.documentElement;
    const rgb = hexToRgb(primary);
    const bgRgb = hexToRgb(bg);

    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    root.style.setProperty('--theme-primary-dark', darkenColor(primary, 17));
    root.style.setProperty('--theme-primary-darker', darkenColor(primary, 30));
    root.style.setProperty('--theme-primary-darkest', darkenColor(primary, 58));
    root.style.setProperty('--theme-primary-light', lightenColor(primary, 60));
    root.style.setProperty('--theme-primary-lighter', lightenColor(primary, 80));
    root.style.setProperty('--theme-bg', bg);
    root.style.setProperty('--theme-bg-rgb', `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`);
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        app_logo: '/logo.png'
    });
    const [themeColors, setThemeColors] = useState(DEFAULT_THEME);
    const [loading, setLoading] = useState(true);

    // Apply theme on mount and when colors change
    useEffect(() => {
        applyThemeToDOM(themeColors.primary, themeColors.bg);
    }, [themeColors]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await settingsAPI.getAll();
            if (data) {
                if (data.app_logo) {
                    setSettings(data);
                }
                // Apply saved theme colors
                const primary = data.theme_primary_color || DEFAULT_THEME.primary;
                const bg = data.theme_bg_color || DEFAULT_THEME.bg;
                setThemeColors({ primary, bg });
                applyThemeToDOM(primary, bg);
            }
        } catch (error) {
            console.error('Fetch settings failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateLogo = async (formData) => {
        try {
            const response = await settingsAPI.updateLogo(formData);
            if (response.logoPath) {
                setSettings(prev => ({ ...prev, app_logo: response.logoPath }));
                return response;
            }
        } catch (error) {
            console.error('Update logo failed:', error);
            throw error;
        }
    };

    const updateTheme = async (colors) => {
        try {
            await settingsAPI.updateTheme({
                primary_color: colors.primary,
                bg_color: colors.bg,
            });
            setThemeColors(colors);
            applyThemeToDOM(colors.primary, colors.bg);
        } catch (error) {
            console.error('Update theme failed:', error);
            throw error;
        }
    };

    // Preview theme without saving (for live preview)
    const previewTheme = useCallback((colors) => {
        applyThemeToDOM(colors.primary, colors.bg);
    }, []);

    // Reset preview to saved colors
    const resetPreview = useCallback(() => {
        applyThemeToDOM(themeColors.primary, themeColors.bg);
    }, [themeColors]);

    return (
        <SettingsContext.Provider value={{
            settings, loading, fetchSettings, updateLogo,
            themeColors, updateTheme, previewTheme, resetPreview,
            DEFAULT_THEME
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
}
