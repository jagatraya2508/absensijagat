import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import PayslipFieldSettings from '../components/PayslipFieldSettings';
import { parsePayslipFields } from '../utils/payslipFields';
import { FACE_MATCH_MAX, FACE_MATCH_MIN, normalizeFaceMatchPercent } from '../utils/faceMatch';
import { settingsAPI } from '../utils/api';
import { AVAILABLE_EMPLOYEE_COLUMNS, DEFAULT_VISIBLE_COLUMNS, STORAGE_KEY_EMPLOYEE_COLUMNS, getInitialVisibleColumns } from '../utils/employeeColumns';

const THEME_PRESETS = [
    { name: 'Merah Marun', icon: 'Circle', primary: '#6D0000', bg: '#fff8f8', card_bg: '#ffffff', btn_bg: '#ef4444' },
    { name: 'Biru Navy', icon: 'Circle', primary: '#0A1929', bg: '#f0f4ff', card_bg: '#ffffff', btn_bg: '#3b82f6' },
    { name: 'Hijau Emerald', icon: 'Circle', primary: '#064E3B', bg: '#f0fdf4', card_bg: '#ffffff', btn_bg: '#10b981' },
    { name: 'Ungu Royal', icon: 'Circle', primary: '#4C1D95', bg: '#faf5ff', card_bg: '#ffffff', btn_bg: '#8b5cf6' },
    { name: 'Slate Dark', icon: 'Circle', primary: '#1E293B', bg: '#f8fafc', card_bg: '#ffffff', btn_bg: '#64748b' },
    { name: 'Amber Gold', icon: 'Circle', primary: '#78350F', bg: '#fffbeb', card_bg: '#ffffff', btn_bg: '#f59e0b' },
];

function LogoUploader({ title, type, currentLogoUrl, updateLogoFn }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(currentLogoUrl || '/logo.png');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            if (f.size > 2 * 1024 * 1024) {
                setMessage({ type: 'danger', text: 'Ukuran file maksimal 2MB' });
                return;
            }
            setFile(f);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(f);
            setMessage({ type: '', text: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage({ type: 'danger', text: 'Silakan pilih file logo terlebih dahulu' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        const formData = new FormData();
        formData.append('logo', file);
        formData.append('type', type);

        try {
            await updateLogoFn(formData);
            setMessage({ type: 'success', text: `${title} berhasil diperbarui` });
            setFile(null);
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || `Gagal memperbarui ${title.toLowerCase()}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: '1rem' }}>
                {title}
            </h3>
            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
                    <span className="alert-icon">{message.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor={`logo_${type}`}>
                                Pilih File Logo Baru (PNG, JPG, SVG)
                            </label>
                            <input
                                type="file"
                                id={`logo_${type}`}
                                className="form-input"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
                                Ukuran maksimal: 2MB. {type === 'favicon_logo' ? 'Disarankan 1:1 (persegi).' : 'Disarankan aspek rasio 1:1 atau horizontal.'}
                            </p>
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '0.5rem' }}
                            disabled={loading || !file}
                        >
                            {loading ? (
                                <>
                                    <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                `Simpan ${title}`
                            )}
                        </button>
                    </div>
                    <div style={{ width: '160px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: '0.5rem' }}>Preview</p>
                        <div style={{
                            border: '1px solid var(--gray-200)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            background: 'var(--gray-50)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '120px'
                        }}>
                            <img
                                src={previewUrl}
                                alt={`Preview ${title}`}
                                style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}


const TABS = [
    { id: 'general', label: 'Umum & Tampilan', icon: 'Building2', count: 4, desc: 'Identitas, logo, tema & kolom' },
    { id: 'attendance', label: 'Aturan Absensi', icon: 'MapPin', count: 2, desc: 'Validasi pulang & kemiripan wajah' },
    { id: 'payroll', label: 'Gaji & Lembur', icon: 'Banknote', count: 3, desc: 'Potongan telat, lembur libur & slip gaji' },
    { id: 'leave', label: 'Cuti & Izin', icon: 'Palmtree', count: 1, desc: 'Kuota, satuan, approval & cuti besar' },
    { id: 'system', label: 'Sistem & Backup', icon: 'Save', count: 2, desc: 'SMTP email & backup database' },
];

const TAB_ALIASES = {
    late: 'payroll',
    lembur: 'payroll',
    overtime: 'payroll',
    slip: 'payroll',
    gaji: 'payroll',
    payroll: 'payroll',
    cuti: 'leave',
    izin: 'leave',
    approval: 'leave',
    leave: 'leave',
    lokasi: 'attendance',
    wajah: 'attendance',
    face: 'attendance',
    attendance: 'attendance',
    logo: 'general',
    tema: 'general',
    theme: 'general',
    kolom: 'general',
    company: 'general',
    general: 'general',
    smtp: 'system',
    email: 'system',
    backup: 'system',
    system: 'system'
};

export default function AdminSettings() {

    const location = useLocation();
    const navigate = useNavigate();

    const resolveTab = (key) => {
        if (!key) return null;
        const clean = key.replace(/^[#?]/, '').toLowerCase();
        if (TABS.some(t => t.id === clean)) return clean;
        return TAB_ALIASES[clean] || null;
    };

    const [activeTab, setActiveTab] = useState(() => {
        const hashTab = resolveTab(window.location.hash);
        if (hashTab) return hashTab;
        const searchTab = resolveTab(new URLSearchParams(window.location.search).get('tab'));
        if (searchTab) return searchTab;
        return localStorage.getItem('admin_settings_active_tab') || 'general';
    });

    useEffect(() => {
        const hashTab = resolveTab(location.hash);
        const searchTab = resolveTab(new URLSearchParams(location.search).get('tab'));
        const next = hashTab || searchTab;
        if (next && next !== activeTab) {
            setActiveTab(next);
        }
    }, [location.hash, location.search]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        localStorage.setItem('admin_settings_active_tab', tabId);
        navigate(`/admin/settings?tab=${tabId}`, { replace: true });
    };

    const { logout, hasPermission } = useAuth();
    const canEditPayslipLayout = hasPermission('admin.payslip_layout');
    const { settings, fetchSettings, updateLogo, updatePayslipShowLogo, updatePayslipFields, themeColors, updateTheme, previewTheme, resetPreview, companyName, updateCompanyName, DEFAULT_THEME } = useSettings();

    // Company Name state
    const [editCompanyName, setEditCompanyName] = useState(companyName || 'Absensi');
    const [companyLoading, setCompanyLoading] = useState(false);
    const [companyMessage, setCompanyMessage] = useState({ type: '', text: '' });

    // Theme state
    const [selectedPrimary, setSelectedPrimary] = useState(themeColors.primary);
    const [selectedBg, setSelectedBg] = useState(themeColors.bg);
    const [selectedCardBg, setSelectedCardBg] = useState(themeColors.card_bg || '#ffffff');
    const [selectedBtnBg, setSelectedBtnBg] = useState(themeColors.btn_bg || '#ef4444');
    const [themeLoading, setThemeLoading] = useState(false);
    const [themeMessage, setThemeMessage] = useState({ type: '', text: '' });
    const [activePreset, setActivePreset] = useState(null);

    // Leave Settings state
    const [leaveSettings, setLeaveSettings] = useState({
        annual_leave_quota: 12,
        leave_calculation_mode: 'both',
        hours_per_leave_day: 8,
        late_deducts_leave: false,
        sick_deducts_leave: false,
        permission_deducts_leave: false
    });
    const [approvalConfig, setApprovalConfig] = useState([
        { leave_type: 'late', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'sick', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'permission', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'leave', approval_levels: 1, fallback_to_admin: true },
        { leave_type: 'change_off', approval_levels: 1, fallback_to_admin: true }
    ]);
    const [bigLeaveRules, setBigLeaveRules] = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(false);
    const [leaveMessage, setLeaveMessage] = useState({ type: '', text: '' });

    // SMTP Settings state
    const [smtpSettings, setSmtpSettings] = useState({
        smtp_host: '',
        smtp_port: '',
        smtp_user: '',
        smtp_pass: '',
        smtp_secure: false
    });
    const [smtpLoading, setSmtpLoading] = useState(false);
    const [smtpMessage, setSmtpMessage] = useState({ type: '', text: '' });
    const [showPayslipLogo, setShowPayslipLogo] = useState(settings.payslip_show_logo !== 'false');
    const [payslipLogoLoading, setPayslipLogoLoading] = useState(false);
    const [payslipLogoMessage, setPayslipLogoMessage] = useState({ type: '', text: '' });
    const [payslipFields, setPayslipFields] = useState(() => parsePayslipFields(settings.payslip_fields));
    const [payslipFieldsLoading, setPayslipFieldsLoading] = useState(false);
    const [payslipFieldsMessage, setPayslipFieldsMessage] = useState({ type: '', text: '' });
    const [payslipLayouts, setPayslipLayouts] = useState([]);
    const [faceMatchPercent, setFaceMatchPercent] = useState(() => normalizeFaceMatchPercent(settings.face_match_percent));
    const [faceMatchLoading, setFaceMatchLoading] = useState(false);
    const [faceMatchMessage, setFaceMatchMessage] = useState({ type: '', text: '' });

    // Backup & Restore state
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [backupMessage, setBackupMessage] = useState({ type: '', text: '' });
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreConfirm, setRestoreConfirm] = useState('');
    const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });
    const [dbInfo, setDbInfo] = useState(null);

    // Attendance Location Settings state
    const [attLocSettings, setAttLocSettings] = useState({
        require_different_location_checkout: false,
        checkout_location_rule_mode: 'specific',
        min_checkout_distance_meters: 0
    });
    const [attLocLoading, setAttLocLoading] = useState(false);
    const [attLocMessage, setAttLocMessage] = useState({ type: '', text: '' });

    // Holiday Overtime Settings state
    const [holidayOtSettings, setHolidayOtSettings] = useState({
        holiday_overtime_enabled: true,
        holiday_overtime_allow_checkin: true,
        holiday_overtime_calc_mode: 'multiplier',
        holiday_overtime_rate_sunday: 2.0,
        holiday_overtime_rate_national: 3.0,
        holiday_overtime_rate_offday: 2.0,
        holiday_overtime_fixed_sunday: 50000,
        holiday_overtime_fixed_national: 75000,
        holiday_overtime_fixed_offday: 50000
    });
    const [holidayOtLoading, setHolidayOtLoading] = useState(false);
    const [holidayOtMessage, setHolidayOtMessage] = useState({ type: '', text: '' });

    // Late Deduction Settings state
    const [lateDeductionSettings, setLateDeductionSettings] = useState({
        late_deduction_enabled: false,
        late_deduction_mode: 'per_minute',
        late_deduction_rate_per_minute: 1000,
        late_deduction_rate_per_hour: 25000,
        late_deduction_hour_round: 'round_up',
        late_grace_period_minutes: 0,
        late_deduct_grace_period: false,
        late_exempt_approved_leave: true,
        late_fallback_start_time: '08:00'
    });
    const [lateDeductionLoading, setLateDeductionLoading] = useState(false);
    const [lateDeductionMessage, setLateDeductionMessage] = useState({ type: '', text: '' });

    // Employee Columns Configuration state
    const [empColumns, setEmpColumns] = useState(() => getInitialVisibleColumns());
    const [empColumnsLoading, setEmpColumnsLoading] = useState(false);
    const [empColumnsMessage, setEmpColumnsMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        settingsAPI.getEmployeeColumns().then(res => {
            if (res && res.columns) {
                const cols = getInitialVisibleColumns(res.columns);
                setEmpColumns(cols);
            }
        }).catch(err => {
            console.warn('Failed to load employee columns in settings:', err);
        });
    }, []);

    const handleEmpColumnsSave = async () => {
        setEmpColumnsLoading(true);
        setEmpColumnsMessage({ type: '', text: '' });
        try {
            const colsToSave = [...empColumns];
            if (!colsToSave.includes('name')) colsToSave.push('name');
            if (!colsToSave.includes('actions')) colsToSave.push('actions');

            await settingsAPI.updateEmployeeColumns(colsToSave);
            try {
                localStorage.setItem(STORAGE_KEY_EMPLOYEE_COLUMNS, JSON.stringify(colsToSave));
            } catch (e) {}
            setEmpColumnsMessage({ type: 'success', text: 'Pengaturan kolom data karyawan berhasil disimpan!' });
        } catch (error) {
            setEmpColumnsMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan kolom' });
        } finally {
            setEmpColumnsLoading(false);
        }
    };

    const toggleEmpColumn = (key) => {
        if (key === 'name' || key === 'actions') return;
        setEmpColumns(prev => {
            if (prev.includes(key)) {
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    // Sync when themeColors change (e.g. after save)
    useEffect(() => {
        setSelectedPrimary(themeColors.primary);
        setSelectedBg(themeColors.bg);
        setSelectedCardBg(themeColors.card_bg || '#ffffff');
        setSelectedBtnBg(themeColors.btn_bg || '#ef4444');
        // find active preset
        const match = THEME_PRESETS.findIndex(
            p => p.primary.toLowerCase() === themeColors.primary.toLowerCase() && p.bg.toLowerCase() === themeColors.bg.toLowerCase() && p.card_bg.toLowerCase() === (themeColors.card_bg || '#ffffff').toLowerCase() && p.btn_bg.toLowerCase() === (themeColors.btn_bg || '#ef4444').toLowerCase()
        );
        setActivePreset(match >= 0 ? match : null);
    }, [themeColors]);

    useEffect(() => {
        setEditCompanyName(companyName || 'Absensi');
    }, [companyName]);

    useEffect(() => {
        setShowPayslipLogo(settings.payslip_show_logo !== 'false');
    }, [settings.payslip_show_logo]);

    useEffect(() => {
        setPayslipFields(parsePayslipFields(settings.payslip_fields));
    }, [settings.payslip_fields]);

    useEffect(() => {
        if (!canEditPayslipLayout) return;
        settingsAPI.getPayslipLayouts().then(setPayslipLayouts).catch(() => setPayslipLayouts([]));
    }, [canEditPayslipLayout, settings.payslip_fields]);

    useEffect(() => {
        fetchLeaveSettings();
        fetchSmtpSettings();
        fetchBackupInfo();
        fetchAttendanceLocationSettings();
        fetchHolidayOvertimeSettings();
        fetchLateDeductionSettings();
    }, []);

    const fetchBackupInfo = async () => {
        try {
            const { backupAPI } = await import('../utils/api');
            const info = await backupAPI.getInfo();
            setDbInfo(info);
        } catch (error) {
            console.error('Failed to load backup info:', error);
        }
    };

    const fetchSmtpSettings = async () => {
        try {
            const { settingsAPI } = await import('../utils/api');
            const data = await settingsAPI.getAll();
            setSmtpSettings({
                smtp_host: data.smtp_host || '',
                smtp_port: data.smtp_port || '',
                smtp_user: data.smtp_user || '',
                smtp_pass: data.smtp_pass || '',
                smtp_secure: data.smtp_secure === 'true'
            });
        } catch (error) {
            console.error('Failed to load SMTP settings:', error);
        }
    };

    const fetchLeaveSettings = async () => {
        try {
            const { settingsAPI } = await import('../utils/api');
            const data = await settingsAPI.getLeave();
            if (data.settings) {
                setLeaveSettings({
                    annual_leave_quota: data.settings.annual_leave_quota,
                    leave_calculation_mode: data.settings.leave_calculation_mode || 'both',
                    hours_per_leave_day: parseFloat(data.settings.hours_per_leave_day) || 8,
                    late_deducts_leave: data.settings.late_deducts_leave,
                    sick_deducts_leave: data.settings.sick_deducts_leave,
                    permission_deducts_leave: data.settings.permission_deducts_leave
                });
            }
            if (data.approval_config && data.approval_config.length > 0) {
                setApprovalConfig((prev) => prev.map((item) => {
                    const found = data.approval_config.find((c) => c.leave_type === item.leave_type);
                    return found ? { ...item, ...found } : item;
                }));
            }
            if (data.big_leave_rules) {
                setBigLeaveRules(data.big_leave_rules);
            }
        } catch (error) {
            console.error('Failed to load leave settings:', error);
        }
    };

    const fetchAttendanceLocationSettings = async () => {
        try {
            const data = await settingsAPI.getAttendanceLocation();
            setAttLocSettings({
                require_different_location_checkout: data.require_different_location_checkout || false,
                checkout_location_rule_mode: data.checkout_location_rule_mode || (data.require_different_location_checkout ? 'all' : 'specific'),
                min_checkout_distance_meters: data.min_checkout_distance_meters || 0
            });
        } catch (error) {
            console.error('Failed to load attendance location settings:', error);
        }
    };

    const handleAttendanceLocationSave = async () => {
        setAttLocLoading(true);
        setAttLocMessage({ type: '', text: '' });
        try {
            const res = await settingsAPI.updateAttendanceLocation(attLocSettings);
            setAttLocMessage({ type: 'success', text: res.message || 'Pengaturan lokasi absensi berhasil disimpan' });
        } catch (error) {
            setAttLocMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan lokasi absensi' });
        } finally {
            setAttLocLoading(false);
        }
    };

    const fetchHolidayOvertimeSettings = async () => {
        try {
            const data = await settingsAPI.getHolidayOvertime();
            if (data) {
                setHolidayOtSettings({
                    holiday_overtime_enabled: data.holiday_overtime_enabled !== false,
                    holiday_overtime_allow_checkin: data.holiday_overtime_allow_checkin !== false,
                    holiday_overtime_calc_mode: data.holiday_overtime_calc_mode || 'multiplier',
                    holiday_overtime_rate_sunday: data.holiday_overtime_rate_sunday !== undefined ? data.holiday_overtime_rate_sunday : 2.0,
                    holiday_overtime_rate_national: data.holiday_overtime_rate_national !== undefined ? data.holiday_overtime_rate_national : 3.0,
                    holiday_overtime_rate_offday: data.holiday_overtime_rate_offday !== undefined ? data.holiday_overtime_rate_offday : 2.0,
                    holiday_overtime_fixed_sunday: data.holiday_overtime_fixed_sunday !== undefined ? data.holiday_overtime_fixed_sunday : 50000,
                    holiday_overtime_fixed_national: data.holiday_overtime_fixed_national !== undefined ? data.holiday_overtime_fixed_national : 75000,
                    holiday_overtime_fixed_offday: data.holiday_overtime_fixed_offday !== undefined ? data.holiday_overtime_fixed_offday : 50000
                });
            }
        } catch (error) {
            console.error('Failed to load holiday overtime settings:', error);
        }
    };

    const handleHolidayOvertimeSave = async (e) => {
        if (e) e.preventDefault();
        setHolidayOtLoading(true);
        setHolidayOtMessage({ type: '', text: '' });
        try {
            const res = await settingsAPI.updateHolidayOvertime(holidayOtSettings);
            setHolidayOtMessage({ type: 'success', text: res.message || 'Pengaturan lembur hari libur berhasil disimpan!' });
        } catch (error) {
            setHolidayOtMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan lembur hari libur' });
        } finally {
            setHolidayOtLoading(false);
        }
    };

    const fetchLateDeductionSettings = async () => {
        try {
            const data = await settingsAPI.getLateDeduction();
            if (data) {
                setLateDeductionSettings({
                    late_deduction_enabled: data.late_deduction_enabled === true,
                    late_deduction_mode: data.late_deduction_mode || 'per_minute',
                    late_deduction_rate_per_minute: data.late_deduction_rate_per_minute !== undefined ? data.late_deduction_rate_per_minute : 1000,
                    late_deduction_rate_per_hour: data.late_deduction_rate_per_hour !== undefined ? data.late_deduction_rate_per_hour : 25000,
                    late_deduction_hour_round: data.late_deduction_hour_round || 'round_up',
                    late_grace_period_minutes: data.late_grace_period_minutes !== undefined ? data.late_grace_period_minutes : 0,
                    late_deduct_grace_period: data.late_deduct_grace_period === true,
                    late_exempt_approved_leave: data.late_exempt_approved_leave !== false,
                    late_fallback_start_time: data.late_fallback_start_time || '08:00'
                });
            }
        } catch (error) {
            console.error('Failed to load late deduction settings:', error);
        }
    };

    const handleLateDeductionSave = async (e) => {
        if (e) e.preventDefault();
        setLateDeductionLoading(true);
        setLateDeductionMessage({ type: '', text: '' });
        try {
            const res = await settingsAPI.updateLateDeduction(lateDeductionSettings);
            setLateDeductionMessage({ type: 'success', text: res.message || 'Pengaturan potongan keterlambatan berhasil disimpan!' });
        } catch (error) {
            setLateDeductionMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan potongan keterlambatan' });
        } finally {
            setLateDeductionLoading(false);
        }
    };

    const handlePresetSelect = (index) => {
        const preset = THEME_PRESETS[index];
        setActivePreset(index);
        setSelectedPrimary(preset.primary);
        setSelectedBg(preset.bg);
        setSelectedCardBg(preset.card_bg);
        setSelectedBtnBg(preset.btn_bg);
        previewTheme({ primary: preset.primary, bg: preset.bg, card_bg: preset.card_bg, btn_bg: preset.btn_bg });
    };

    const handleCustomColorChange = (field, value) => {
        setActivePreset(null);
        if (field === 'primary') {
            setSelectedPrimary(value);
            previewTheme({ primary: value, bg: selectedBg, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
        } else if (field === 'bg') {
            setSelectedBg(value);
            previewTheme({ primary: selectedPrimary, bg: value, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
        } else if (field === 'card_bg') {
            setSelectedCardBg(value);
            previewTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: value, btn_bg: selectedBtnBg });
        } else if (field === 'btn_bg') {
            setSelectedBtnBg(value);
            previewTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: selectedCardBg, btn_bg: value });
        }
    };

    const handleThemeSave = async () => {
        setThemeLoading(true);
        setThemeMessage({ type: '', text: '' });
        try {
            await updateTheme({ primary: selectedPrimary, bg: selectedBg, card_bg: selectedCardBg, btn_bg: selectedBtnBg });
            setThemeMessage({ type: 'success', text: 'Tema berhasil disimpan!' });
        } catch (error) {
            setThemeMessage({ type: 'danger', text: error.message || 'Gagal menyimpan tema' });
            resetPreview();
        } finally {
            setThemeLoading(false);
        }
    };

    const handleThemeReset = () => {
        setSelectedPrimary(DEFAULT_THEME.primary);
        setSelectedBg(DEFAULT_THEME.bg);
        setSelectedCardBg(DEFAULT_THEME.card_bg);
        setSelectedBtnBg(DEFAULT_THEME.btn_bg);
        setActivePreset(0);
        previewTheme({ primary: DEFAULT_THEME.primary, bg: DEFAULT_THEME.bg, card_bg: DEFAULT_THEME.card_bg, btn_bg: DEFAULT_THEME.btn_bg });
    };

    // Leave Settings Handlers
    const handleLeaveSave = async (e) => {
        e.preventDefault();
        setLeaveLoading(true);
        setLeaveMessage({ type: '', text: '' });
        try {
            const { settingsAPI } = await import('../utils/api');
            await settingsAPI.updateLeave({
                ...leaveSettings,
                big_leave_rules: bigLeaveRules,
                approval_config: approvalConfig
            });
            setLeaveMessage({ type: 'success', text: 'Pengaturan cuti berhasil disimpan!' });
        } catch (error) {
            setLeaveMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan cuti' });
        } finally {
            setLeaveLoading(false);
        }
    };

    const addBigLeaveRule = () => {
        setBigLeaveRules([...bigLeaveRules, { min_years: 0, leave_days: 0, is_active: true }]);
    };

    const removeBigLeaveRule = (index) => {
        const newRules = [...bigLeaveRules];
        newRules.splice(index, 1);
        setBigLeaveRules(newRules);
    };

    const updateBigLeaveRule = (index, field, value) => {
        const newRules = [...bigLeaveRules];
        newRules[index][field] = value;
        setBigLeaveRules(newRules);
    };

    const handleSmtpSave = async (e) => {
        e.preventDefault();
        setSmtpLoading(true);
        setSmtpMessage({ type: '', text: '' });
        try {
            const { settingsAPI } = await import('../utils/api');
            await settingsAPI.updateSmtp(smtpSettings);
            setSmtpMessage({ type: 'success', text: 'Pengaturan SMTP berhasil disimpan!' });
        } catch (error) {
            setSmtpMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan SMTP' });
        } finally {
            setSmtpLoading(false);
        }
    };

    const handleBackupDownload = async () => {
        setBackupLoading(true);
        setBackupMessage({ type: '', text: '' });
        try {
            const { backupAPI } = await import('../utils/api');
            await backupAPI.download();
            setBackupMessage({ type: 'success', text: 'Backup berhasil diunduh.' });
        } catch (error) {
            setBackupMessage({ type: 'danger', text: error.message || 'Gagal membuat backup' });
        } finally {
            setBackupLoading(false);
        }
    };

    const busyBackup = backupLoading || restoreLoading;

    const handleRestore = async (e) => {
        e.preventDefault();
        if (!restoreFile) {
            setRestoreMessage({ type: 'danger', text: 'Pilih file backup terlebih dahulu' });
            return;
        }
        if (restoreConfirm.trim().toUpperCase() !== 'TIMPA') {
            setRestoreMessage({ type: 'danger', text: 'Ketik TIMPA untuk konfirmasi restore' });
            return;
        }

        const ok = window.confirm(
            'PERINGATAN: Restore akan menimpa SELURUH data database saat ini dengan isi file backup.\n\nLanjutkan?'
        );
        if (!ok) return;

        setRestoreLoading(true);
        setRestoreMessage({ type: '', text: '' });
        try {
            const { backupAPI } = await import('../utils/api');
            const formData = new FormData();
            formData.append('backup', restoreFile);
            formData.append('confirm', 'TIMPA');
            const result = await backupAPI.restore(formData);
            const extra = result.summary ? ` (${result.summary})` : '';
            setRestoreMessage({
                type: 'success',
                text: `${result.message || 'Restore berhasil.'}${extra} Anda akan diarahkan ke halaman login.`
            });
            setRestoreFile(null);
            setRestoreConfirm('');
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 2500);
        } catch (error) {
            setRestoreMessage({ type: 'danger', text: error.message || 'Gagal restore database' });
        } finally {
            setRestoreLoading(false);
        }
    };

    useEffect(() => {
        setFaceMatchPercent(normalizeFaceMatchPercent(settings.face_match_percent));
    }, [settings.face_match_percent]);

    const handleFaceMatchSave = async () => {
        const percent = normalizeFaceMatchPercent(faceMatchPercent);
        setFaceMatchLoading(true);
        setFaceMatchMessage({ type: '', text: '' });
        try {
            const { settingsAPI } = await import('../utils/api');
            await settingsAPI.updateFaceMatch(percent);
            await fetchSettings();
            setFaceMatchMessage({ type: 'success', text: `Batas kemiripan wajah disimpan: ${percent}%` });
        } catch (error) {
            setFaceMatchMessage({ type: 'danger', text: error.message || 'Gagal menyimpan batas kemiripan' });
        } finally {
            setFaceMatchLoading(false);
        }
    };

    const handleCompanyNameSave = async () => {
        if (!editCompanyName.trim()) return;
        setCompanyLoading(true);
        setCompanyMessage({ type: '', text: '' });
        try {
            await updateCompanyName(editCompanyName.trim());
            setCompanyMessage({ type: 'success', text: 'Nama perusahaan berhasil disimpan!' });
        } catch (error) {
            setCompanyMessage({ type: 'danger', text: error.message || 'Gagal menyimpan nama perusahaan' });
        } finally {
            setCompanyLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title"><Icon name="Settings" size={16} inline /> Pengaturan Aplikasi</h1>
                <p className="page-subtitle">Kelola konfigurasi sistem dan tampilan</p>
            </div>

            {/* Sheet / Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap',
                marginBottom: '1.75rem',
                padding: '0.35rem',
                background: 'var(--bg-card, #f8fafc)',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                maxWidth: '960px'
            }}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.65rem 1.15rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: isActive ? 600 : 500,
                                transition: 'all 0.15s ease',
                                background: isActive ? 'var(--primary-600, #2563eb)' : 'transparent',
                                color: isActive ? '#ffffff' : 'var(--gray-600, #64748b)',
                                boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none'
                            }}
                        >
                            <Icon name={tab.icon} size={16} inline />
                            <span>{tab.label}</span>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '9999px',
                                background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'var(--gray-200, rgba(148, 163, 184, 0.2))',
                                color: isActive ? '#ffffff' : 'var(--gray-500, #64748b)',
                                marginLeft: '0.15rem'
                            }}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '960px' }}>


                
                {activeTab === 'general' && (
                    <>
                        {/* ============ COMPANY NAME SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Building2" size={16} inline /> Nama Perusahaan</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {companyMessage.text && (
                            <div className={`alert alert-${companyMessage.type}`} style={{ marginBottom: '1rem' }}>
                                <span className="alert-icon">{companyMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {companyMessage.text}
                            </div>
                        )}

                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                            Nama ini akan ditampilkan di sidebar navigasi dan area branding aplikasi.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Nama Perusahaan
                                </label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={editCompanyName}
                                    onChange={(e) => setEditCompanyName(e.target.value)}
                                    placeholder="Contoh: PT Jagatraya"
                                    maxLength={50}
                                    style={{ background: 'white', color: 'var(--gray-900)', border: '1.5px solid var(--gray-200)' }}
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleCompanyNameSave}
                                disabled={companyLoading || !editCompanyName.trim()}
                                style={{ minWidth: '120px', height: '42px' }}
                            >
                                {companyLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        <span>Simpan...</span>
                                    </>
                                ) : (
                                    'Simpan'
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                        {/* ============ LOGO SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Image" size={16} inline /> Manajemen Logo</h2>
                    </div>
                    
                    <div style={{ padding: '0 0.5rem' }}>
                        <LogoUploader 
                            title="Logo Utama Aplikasi" 
                            type="app_logo" 
                            currentLogoUrl={settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />
                        
                        <LogoUploader 
                            title="Logo Login Page" 
                            type="login_logo" 
                            currentLogoUrl={settings.login_logo || settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />
                        
                        <LogoUploader 
                            title="Favicon (Ikon Tab Browser)" 
                            type="favicon_logo" 
                            currentLogoUrl={settings.favicon_logo || settings.app_logo} 
                            updateLogoFn={updateLogo} 
                        />

                        <div style={{ padding: '0.25rem 0 1.25rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={showPayslipLogo}
                                    disabled={payslipLogoLoading}
                                    onChange={async (e) => {
                                        const next = e.target.checked;
                                        setShowPayslipLogo(next);
                                        setPayslipLogoLoading(true);
                                        setPayslipLogoMessage({ type: '', text: '' });
                                        try {
                                            await updatePayslipShowLogo(next);
                                            setPayslipLogoMessage({
                                                type: 'success',
                                                text: next ? 'Logo akan tampil di slip gaji' : 'Logo disembunyikan dari slip gaji'
                                            });
                                        } catch (error) {
                                            setShowPayslipLogo(!next);
                                            setPayslipLogoMessage({ type: 'danger', text: error.message || 'Gagal menyimpan pengaturan logo slip' });
                                        } finally {
                                            setPayslipLogoLoading(false);
                                        }
                                    }}
                                    style={{ width: '18px', height: '18px', marginTop: '0.15rem' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Tampilkan logo pada slip gaji</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        Logo Utama Aplikasi muncul di atas judul slip, termasuk saat diunduh PDF. Matikan jika slip tidak perlu menampilkan logo.
                                    </div>
                                </div>
                            </label>
                            {payslipLogoMessage.text && (
                                <div className={`alert alert-${payslipLogoMessage.type}`} style={{ marginTop: '1rem' }}>
                                    {payslipLogoMessage.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                        {/* ============ THEME COLOR SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Palette" size={16} inline /> Kustomisasi Warna Tema</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {themeMessage.text && (
                            <div className={`alert alert-${themeMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{themeMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {themeMessage.text}
                            </div>
                        )}

                        {/* Color Presets */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: 'var(--gray-600)',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                            }}>
                                Pilih Tema Preset
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                {THEME_PRESETS.map((preset, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handlePresetSelect(index)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '1rem 0.75rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: activePreset === index
                                                ? `2.5px solid ${preset.primary}`
                                                : '2px solid var(--gray-200)',
                                            background: activePreset === index
                                                ? `linear-gradient(135deg, ${preset.bg}, white)`
                                                : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s ease',
                                            transform: activePreset === index ? 'scale(1.03)' : 'scale(1)',
                                            boxShadow: activePreset === index
                                                ? `0 4px 16px ${preset.primary}30`
                                                : 'var(--shadow-sm)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Color swatch */}
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${preset.primary}, ${preset.primary}cc)`,
                                            boxShadow: `0 2px 8px ${preset.primary}40`,
                                            border: '3px solid white',
                                            transition: 'transform 0.3s ease',
                                            transform: activePreset === index ? 'scale(1.1)' : 'scale(1)',
                                        }} />
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            color: activePreset === index ? preset.primary : 'var(--gray-600)',
                                            textAlign: 'center',
                                            lineHeight: 1.2,
                                        }}>
                                            {preset.name}
                                        </span>
                                        {/* Active check */}
                                        {activePreset === index && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '6px',
                                                right: '6px',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                background: preset.primary,
                                                color: 'white',
                                                fontSize: '0.6rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                            }}><Icon name="Check" size={16} inline /></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Color Pickers */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1.25rem',
                            marginBottom: '1.5rem'
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Utama (Sidebar)
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedPrimary}
                                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedPrimary}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Sidebar, header, aksen
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Background
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedBg}
                                        onChange={(e) => handleCustomColorChange('bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Latar belakang halaman
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Card / Form BG Color */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Dasar Card/Form
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedCardBg}
                                        onChange={(e) => handleCustomColorChange('card_bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedCardBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Form input & master
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Button BG Color */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--gray-600)',
                                    marginBottom: '0.5rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}>
                                    Warna Tombol
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'var(--gray-50)',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--gray-200)'
                                }}>
                                    <input
                                        type="color"
                                        value={selectedBtnBg}
                                        onChange={(e) => handleCustomColorChange('btn_bg', e.target.value)}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'transparent',
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: 'var(--gray-800)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {selectedBtnBg}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            Tombol aksi utama
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid var(--gray-200)',
                            background: 'var(--gray-50)'
                        }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--gray-500)',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Preview Tema
                            </label>
                            <div style={{
                                display: 'flex',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-md)',
                                height: '90px',
                            }}>
                                {/* Mini sidebar preview */}
                                <div style={{
                                    width: '60px',
                                    background: `linear-gradient(180deg, ${selectedPrimary}, ${selectedPrimary}cc)`,
                                    padding: '0.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
                                    <div style={{ width: '80%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
                                </div>
                                {/* Mini content preview */}
                                <div style={{
                                    flex: 1,
                                    background: selectedBg,
                                    padding: '0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                }}>
                                    <div style={{ width: '40%', height: '8px', borderRadius: '3px', background: selectedPrimary, opacity: 0.8 }} />
                                    <div style={{ width: '60%', height: '5px', borderRadius: '2px', background: 'var(--gray-300)' }} />
                                    <div style={{
                                        flex: 1,
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '0.3rem',
                                        marginTop: '0.25rem'
                                    }}>
                                        <div style={{ borderRadius: '4px', background: selectedCardBg, border: '1px solid var(--gray-200)' }} />
                                        <div style={{ borderRadius: '4px', background: selectedCardBg, border: '1px solid var(--gray-200)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleThemeSave}
                                disabled={themeLoading}
                                style={{ flex: 1 }}
                            >
                                {themeLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan Tema'
                                )}
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={handleThemeReset}
                                disabled={themeLoading}
                                style={{ minWidth: '140px' }}
                            >
                                <Icon name="RefreshCw" size={16} inline /> Reset Default
                            </button>
                        </div>
                    </div>
                </div>

                        {/* ============ EMPLOYEE TABLE COLUMNS SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="SlidersHorizontal" size={16} inline /> Kolom Tampilan Data Karyawan</h2>
                    </div>
                    <div style={{ padding: '0.5rem 0' }}>
                        {empColumnsMessage.text && (
                            <div className={`alert alert-${empColumnsMessage.type}`} style={{ marginBottom: '1.25rem' }}>
                                <span className="alert-icon">{empColumnsMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {empColumnsMessage.text}
                            </div>
                        )}
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1.25rem' }}>
                            Atur kolom atau field data yang ingin ditampilkan pada tabel <strong>Data Karyawan</strong> (/admin/employees). Kolom yang dipilih juga berlaku otomatis pada tampilan cetak (Print), PDF, dan ekspor Excel.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)', fontWeight: 500 }}>
                                <strong>{empColumns.length}</strong> kolom aktif dari {AVAILABLE_EMPLOYEE_COLUMNS.length} kolom yang tersedia
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setEmpColumns(AVAILABLE_EMPLOYEE_COLUMNS.map(c => c.key))}
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                >
                                    Pilih Semua
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setEmpColumns([...DEFAULT_VISIBLE_COLUMNS])}
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                >
                                    Reset Bawaan
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            {AVAILABLE_EMPLOYEE_COLUMNS.map(col => {
                                const isChecked = empColumns.includes(col.key);
                                const isRequired = col.required;
                                const isHighlighted = col.key === 'appreciation_allowance';
                                return (
                                    <label
                                        key={col.key}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 0.9rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: `1.5px solid ${isChecked ? (isHighlighted ? 'var(--primary, #7f1d1d)' : 'var(--gray-400)') : 'var(--gray-200)'}`,
                                            background: isChecked ? (isHighlighted ? 'rgba(127, 29, 29, 0.04)' : '#f9fafb') : '#fff',
                                            cursor: isRequired ? 'not-allowed' : 'pointer',
                                            userSelect: 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isRequired}
                                            onChange={() => toggleEmpColumn(col.key)}
                                            style={{ width: '17px', height: '17px', cursor: isRequired ? 'not-allowed' : 'pointer' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                {col.label}
                                                {isRequired && <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 400 }}>(Wajib)</span>}
                                                {isHighlighted && <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>Pilihan Baru</span>}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                Kategori: {col.category}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        <div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleEmpColumnsSave}
                                disabled={empColumnsLoading}
                                style={{ minWidth: '150px', height: '42px' }}
                            >
                                {empColumnsLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan Pengaturan Kolom'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                    </>
                )}

                {activeTab === 'attendance' && (
                    <>
                        {/* ============ ATTENDANCE LOCATION SETTINGS SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="MapPin" size={16} inline /> Validasi Lokasi Absen Pulang (Check-Out)</h2>
                    </div>
                    <div style={{ padding: '0.5rem 0' }}>
                        {attLocMessage.text && (
                            <div className={`alert alert-${attLocMessage.type}`} style={{ marginBottom: '1rem' }}>
                                <span className="alert-icon">{attLocMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {attLocMessage.text}
                            </div>
                        )}
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1.25rem' }}>
                            Atur aturan titik lokasi untuk absen pulang (Check-out) dibandingkan dengan lokasi saat absen masuk (Check-in).
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>
                                    Pemberlakuan Validasi Beda Lokasi / Titik Pulang:
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                    {/* Option 1: Specific employees */}
                                    <div
                                        onClick={() => setAttLocSettings({ ...attLocSettings, checkout_location_rule_mode: 'specific' })}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: `2px solid ${attLocSettings.checkout_location_rule_mode === 'specific' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: attLocSettings.checkout_location_rule_mode === 'specific' ? 'rgba(59, 130, 246, 0.08)' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                            <input
                                                type="radio"
                                                name="checkout_location_rule_mode"
                                                checked={attLocSettings.checkout_location_rule_mode === 'specific'}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: attLocSettings.checkout_location_rule_mode === 'specific' ? 'var(--primary-600)' : 'var(--gray-800)' }}>
                                                Hanya Karyawan Tertentu
                                            </span>
                                            <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>Rekomendasi</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--gray-600)', lineHeight: 1.4, paddingLeft: '1.5rem' }}>
                                            Hanya berlaku untuk karyawan yang dicentang di <strong>Master Data Karyawan</strong> (misal kurir, sales lapangan, driver ritase).
                                        </p>
                                    </div>

                                    {/* Option 2: All employees */}
                                    <div
                                        onClick={() => setAttLocSettings({ ...attLocSettings, checkout_location_rule_mode: 'all' })}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: `2px solid ${attLocSettings.checkout_location_rule_mode === 'all' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: attLocSettings.checkout_location_rule_mode === 'all' ? 'rgba(59, 130, 246, 0.08)' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                            <input
                                                type="radio"
                                                name="checkout_location_rule_mode"
                                                checked={attLocSettings.checkout_location_rule_mode === 'all'}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: attLocSettings.checkout_location_rule_mode === 'all' ? 'var(--primary-600)' : 'var(--gray-800)' }}>
                                                Semua Karyawan
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--gray-600)', lineHeight: 1.4, paddingLeft: '1.5rem' }}>
                                            Berlaku wajib secara global untuk seluruh karyawan tanpa kecuali saat absen pulang.
                                        </p>
                                    </div>

                                    {/* Option 3: Disabled */}
                                    <div
                                        onClick={() => setAttLocSettings({ ...attLocSettings, checkout_location_rule_mode: 'disabled' })}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-lg)',
                                            border: `2px solid ${attLocSettings.checkout_location_rule_mode === 'disabled' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: attLocSettings.checkout_location_rule_mode === 'disabled' ? 'rgba(59, 130, 246, 0.08)' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                            <input
                                                type="radio"
                                                name="checkout_location_rule_mode"
                                                checked={attLocSettings.checkout_location_rule_mode === 'disabled'}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: attLocSettings.checkout_location_rule_mode === 'disabled' ? 'var(--primary-600)' : 'var(--gray-800)' }}>
                                                Nonaktifkan Aturan
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--gray-600)', lineHeight: 1.4, paddingLeft: '1.5rem' }}>
                                            Tidak ada pengecekan beda lokasi pulang untuk siapapun.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {attLocSettings.checkout_location_rule_mode !== 'disabled' && (
                                <div style={{
                                    padding: '1rem',
                                    background: 'white',
                                    border: '1.5px solid var(--gray-200)',
                                    borderRadius: 'var(--radius-lg)'
                                }}>
                                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.85rem' }}>
                                        Jarak Minimal Perpindahan Pulang dari Titik Masuk (Meter)
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', maxWidth: '300px' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            step="50"
                                            placeholder="Contoh: 100 atau 500"
                                            value={attLocSettings.min_checkout_distance_meters}
                                            onChange={(e) => setAttLocSettings({ ...attLocSettings, min_checkout_distance_meters: parseFloat(e.target.value) || 0 })}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: 500 }}>Meter</span>
                                    </div>
                                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                        Isi <strong>0</strong> jika cukup beda lokasi atau berada di luar radius lokasi masuk. Jika diisi (misal: 500), maka jarak GPS saat pulang wajib berjarak minimal 500 meter dari titik masuk.
                                    </p>
                                </div>
                            )}

                            <div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAttendanceLocationSave}
                                    disabled={attLocLoading}
                                    style={{ minWidth: '150px', height: '42px' }}
                                >
                                    {attLocLoading ? (
                                        <>
                                            <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        'Simpan Pengaturan Lokasi'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                        {/* ============ FACE MATCH SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="ScanFace" size={16} inline /> Kemiripan Wajah</h2>
                    </div>
                    <div style={{ padding: '0.5rem 0' }}>
                        {faceMatchMessage.text && (
                            <div className={`alert alert-${faceMatchMessage.type}`} style={{ marginBottom: '1rem' }}>
                                <span className="alert-icon">{faceMatchMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {faceMatchMessage.text}
                            </div>
                        )}
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                            Absensi dan kiosk menerima wajah jika kemiripannya mencapai angka ini. Menaikkan angka membuat pencocokan lebih ketat. Bawaan 60%.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 220px' }}>
                                <label className="form-label" htmlFor="face-match-percent">Minimal kemiripan (%)</label>
                                <input
                                    id="face-match-percent"
                                    className="form-input"
                                    type="number"
                                    min={FACE_MATCH_MIN}
                                    max={FACE_MATCH_MAX}
                                    step="1"
                                    value={faceMatchPercent}
                                    onChange={(e) => setFaceMatchPercent(e.target.value)}
                                />
                                <input
                                    type="range"
                                    min={FACE_MATCH_MIN}
                                    max={FACE_MATCH_MAX}
                                    step="1"
                                    value={normalizeFaceMatchPercent(faceMatchPercent)}
                                    onChange={(e) => setFaceMatchPercent(Number(e.target.value))}
                                    style={{ width: '100%', marginTop: '0.75rem' }}
                                    aria-label="Geser batas kemiripan wajah"
                                />
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleFaceMatchSave}
                                disabled={faceMatchLoading}
                                style={{ minWidth: '120px', height: '42px' }}
                            >
                                {faceMatchLoading ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                        <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                            Rentang {FACE_MATCH_MIN}% sampai {FACE_MATCH_MAX}%. Layar kiosk yang sudah terbuka perlu dimuat ulang agar angka baru dipakai.
                        </p>
                    </div>
                </div>
                    </>
                )}

                {activeTab === 'payroll' && (
                    <>
                        {/* ============ LATE DEDUCTION SECTION ============ */}
                <div className="card" style={{ marginBottom: '1.5rem', overflow: 'visible' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Icon name="Clock" size={18} inline /> Potongan Keterlambatan Otomatis (Global)
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.25rem', marginBottom: 0 }}>
                                Otomatis hitung dan terapkan pemotongan gaji pada payroll jika karyawan datang terlambat melewati jam masuk kerja.
                            </p>
                        </div>
                        <span className={`badge ${lateDeductionSettings.late_deduction_enabled ? 'badge-danger' : 'badge-secondary'}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
                            {lateDeductionSettings.late_deduction_enabled ? '● Potongan Telat Aktif' : '○ Nonaktif'}
                        </span>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {lateDeductionMessage.text && (
                            <div className={`alert alert-${lateDeductionMessage.type}`} style={{ marginBottom: '1.25rem' }}>
                                <span className="alert-icon">{lateDeductionMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {lateDeductionMessage.text}
                            </div>
                        )}

                        {/* Info Banner */}
                        <div style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md, 8px)',
                            background: 'var(--gray-50, #f8fafc)',
                            border: '1px solid var(--gray-200, #e2e8f0)',
                            marginBottom: '1.25rem',
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start'
                        }}>
                            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⏱️</span>
                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-700, #334155)', lineHeight: 1.5 }}>
                                <strong>Cara Kerja:</strong> Saat Payroll dihitung, sistem memeriksa jam check-in harian karyawan terhadap jadwal kerja/shift aktif mereka. Karyawan yang terlambat melewati batas toleransi akan diakumulasikan menit/jam keterlambatannya dan dikalikan dengan tarif global di bawah, kemudian otomatis mengurangi Take Home Pay pada slip gaji.
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--gray-300, #cbd5e1)', fontSize: '0.825rem', color: 'var(--primary-600, #2563eb)' }}>
                                    💡 <strong>Tarif Berbeda Tiap Jabatan?</strong> Pengaturan di bawah ini berlaku secara Global. Jika Anda ingin tarif atau toleransi yang berbeda untuk jabatan tertentu (atau membebaskan jabatan manajerial dari potongan), Anda dapat mengaturnya langsung di menu <a href="#/positions" style={{ textDecoration: 'underline', fontWeight: 600 }}>Data Jabatan</a>.
                                </div>
                            </div>
                        </div>

                        {/* Main Switches Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.5rem'
                        }}>
                            {/* Toggle 1: Enable Late Deduction */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: `1.5px solid ${lateDeductionSettings.late_deduction_enabled ? 'var(--danger-500, #ef4444)' : 'var(--gray-200, #e2e8f0)'}`,
                                background: lateDeductionSettings.late_deduction_enabled ? 'rgba(239, 68, 68, 0.04)' : '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.925rem' }}>
                                        Potongan Keterlambatan Otomatis
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        Otomatis potong gaji di payroll saat karyawan telat
                                    </div>
                                </div>
                                <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={lateDeductionSettings.late_deduction_enabled}
                                        onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_deduction_enabled: e.target.checked }))}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            {/* Toggle 2: Exempt Approved Leave */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1.5px solid var(--gray-200, #e2e8f0)',
                                background: '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.925rem' }}>
                                        Bebaskan Jika Ada Izin Terlambat
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        Tidak dipotong jika pengajuan Izin Terlambat disetujui atasan
                                    </div>
                                </div>
                                <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={lateDeductionSettings.late_exempt_approved_leave}
                                        onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_exempt_approved_leave: e.target.checked }))}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>

                        {/* Calculation Mode Selection */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                                Skema Hitungan Global Potongan
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                gap: '1rem'
                            }}>
                                {/* Mode: Per Menit */}
                                <div
                                    onClick={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_mode: 'per_minute' }))}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        border: `2px solid ${lateDeductionSettings.late_deduction_mode === 'per_minute' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-200, #e2e8f0)'}`,
                                        background: lateDeductionSettings.late_deduction_mode === 'per_minute' ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                        <input
                                            type="radio"
                                            name="late_mode"
                                            checked={lateDeductionSettings.late_deduction_mode === 'per_minute'}
                                            onChange={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_mode: 'per_minute' }))}
                                            style={{ margin: 0 }}
                                        />
                                        <strong style={{ fontSize: '0.95rem', color: 'var(--gray-800)' }}>Hitungan Per Menit</strong>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', paddingLeft: '1.5rem' }}>
                                        Dihitung proporsional persis per menit keterlambatan (misal Rp 1.000 × total menit).
                                    </div>
                                </div>

                                {/* Mode: Per Jam */}
                                <div
                                    onClick={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_mode: 'per_hour' }))}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        border: `2px solid ${lateDeductionSettings.late_deduction_mode === 'per_hour' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-200, #e2e8f0)'}`,
                                        background: lateDeductionSettings.late_deduction_mode === 'per_hour' ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                        <input
                                            type="radio"
                                            name="late_mode"
                                            checked={lateDeductionSettings.late_deduction_mode === 'per_hour'}
                                            onChange={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_mode: 'per_hour' }))}
                                            style={{ margin: 0 }}
                                        />
                                        <strong style={{ fontSize: '0.95rem', color: 'var(--gray-800)' }}>Hitungan Per Jam</strong>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', paddingLeft: '1.5rem' }}>
                                        Dihitung per jam keterlambatan (dengan opsi pembulatan ke atas, prorata, atau jam penuh).
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rate and Rounding Configuration */}
                        <div style={{
                            padding: '1.25rem',
                            borderRadius: 'var(--radius-md, 8px)',
                            background: 'var(--gray-50, #f8fafc)',
                            border: '1px solid var(--gray-200, #e2e8f0)',
                            marginBottom: '1.5rem'
                        }}>
                            {lateDeductionSettings.late_deduction_mode === 'per_minute' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>
                                            Tarif Potongan per Menit (Rp)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>Rp</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="100"
                                                className="form-input"
                                                value={lateDeductionSettings.late_deduction_rate_per_minute}
                                                onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_deduction_rate_per_minute: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                                style={{ fontWeight: 600 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            {[500, 1000, 2000, 5000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_rate_per_minute: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: lateDeductionSettings.late_deduction_rate_per_minute === val ? 'var(--primary-color)' : 'var(--gray-300)',
                                                        background: lateDeductionSettings.late_deduction_rate_per_minute === val ? 'var(--primary-color)' : '#fff',
                                                        color: lateDeductionSettings.late_deduction_rate_per_minute === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    Rp {val.toLocaleString('id-ID')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>
                                            Toleransi Keterlambatan (Grace Period)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="60"
                                                className="form-input"
                                                value={lateDeductionSettings.late_grace_period_minutes}
                                                onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_grace_period_minutes: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                                                style={{ fontWeight: 600 }}
                                            />
                                            <span style={{ fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>menit</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.4rem' }}>
                                            Contoh: Jika 5 menit, telat ≤ 5 menit dianggap tepat waktu (Rp 0).
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>
                                            Tarif Potongan per Jam (Rp)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>Rp</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1000"
                                                className="form-input"
                                                value={lateDeductionSettings.late_deduction_rate_per_hour}
                                                onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_deduction_rate_per_hour: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                                style={{ fontWeight: 600 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            {[15000, 20000, 25000, 50000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setLateDeductionSettings(prev => ({ ...prev, late_deduction_rate_per_hour: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: lateDeductionSettings.late_deduction_rate_per_hour === val ? 'var(--primary-color)' : 'var(--gray-300)',
                                                        background: lateDeductionSettings.late_deduction_rate_per_hour === val ? 'var(--primary-color)' : '#fff',
                                                        color: lateDeductionSettings.late_deduction_rate_per_hour === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {(val / 1000)}rb
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>
                                            Metode Pembulatan Jam
                                        </label>
                                        <select
                                            className="form-input form-select"
                                            value={lateDeductionSettings.late_deduction_hour_round}
                                            onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_deduction_hour_round: e.target.value }))}
                                        >
                                            <option value="round_up">Pembulatan Ke Atas Total (Ceil: misal telat 15 mnt = 1 jam)</option>
                                            <option value="round_up_daily">Pembulatan Ke Atas Per Hari Kejadian (15 mnt/hari = 1 jam/hari)</option>
                                            <option value="prorated">Proporsional / Prorata (Menit ÷ 60 × Tarif)</option>
                                            <option value="exact_hour">Hanya Kelipatan Jam Penuh (Floor)</option>
                                        </select>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>
                                            Toleransi Keterlambatan (Grace Period)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="60"
                                                className="form-input"
                                                value={lateDeductionSettings.late_grace_period_minutes}
                                                onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_grace_period_minutes: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                                                style={{ fontWeight: 600 }}
                                            />
                                            <span style={{ fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>menit</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Additional Options */}
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-700)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={lateDeductionSettings.late_deduct_grace_period}
                                        onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_deduct_grace_period: e.target.checked }))}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    <span>Kurangi menit toleransi saat memotong (hanya potong kelebihannya)</span>
                                </label>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
                                        Jam Masuk Standar (Fallback):
                                    </label>
                                    <input
                                        type="time"
                                        className="form-input"
                                        value={lateDeductionSettings.late_fallback_start_time}
                                        onChange={(e) => setLateDeductionSettings(prev => ({ ...prev, late_fallback_start_time: e.target.value }))}
                                        style={{ width: '110px', padding: '0.3rem 0.5rem' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Interactive Simulation Preview Box */}
                        {(() => {
                            const testMinutes = 35;
                            const grace = lateDeductionSettings.late_grace_period_minutes || 0;
                            const isLate = testMinutes > grace;
                            let charged = isLate ? (lateDeductionSettings.late_deduct_grace_period ? testMinutes - grace : testMinutes) : 0;
                            let simulatedAmount = 0;
                            let explanation = '';

                            if (lateDeductionSettings.late_deduction_mode === 'per_minute') {
                                simulatedAmount = charged * (lateDeductionSettings.late_deduction_rate_per_minute || 0);
                                explanation = `${charged} mnt x Rp ${(lateDeductionSettings.late_deduction_rate_per_minute || 0).toLocaleString('id-ID')}`;
                            } else {
                                const rate = lateDeductionSettings.late_deduction_rate_per_hour || 0;
                                if (lateDeductionSettings.late_deduction_hour_round === 'round_up' || lateDeductionSettings.late_deduction_hour_round === 'round_up_daily') {
                                    const h = Math.ceil(charged / 60);
                                    simulatedAmount = h * rate;
                                    explanation = `${h} jam (dibulatkan ke atas) x Rp ${rate.toLocaleString('id-ID')}`;
                                } else if (lateDeductionSettings.late_deduction_hour_round === 'prorated') {
                                    const h = charged / 60;
                                    simulatedAmount = Math.round(h * rate);
                                    explanation = `${charged}/60 jam (${h.toFixed(2)} jam prorata) x Rp ${rate.toLocaleString('id-ID')}`;
                                } else {
                                    const h = Math.floor(charged / 60);
                                    simulatedAmount = h * rate;
                                    explanation = `${h} jam penuh x Rp ${rate.toLocaleString('id-ID')}`;
                                }
                            }

                            return (
                                <div style={{
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md, 8px)',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Icon name="Calculator" size={16} inline /> Simulasi Contoh (Karyawan Telat 35 Menit):
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.2rem' }}>
                                            Toleransi: {grace} mnt | Menit dipotong: {charged} mnt ({explanation})
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Nominal Potongan:</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>
                                            Rp {simulatedAmount.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Save Action */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleLateDeductionSave}
                                disabled={lateDeductionLoading}
                                style={{ minWidth: '220px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {lateDeductionLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Save" size={16} inline />
                                        <span>Simpan Potongan Keterlambatan</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                        {/* ============ HOLIDAY OVERTIME SECTION ============ */}
                <div className="card" style={{ marginBottom: '1.5rem', overflow: 'visible' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Icon name="CalendarCheck" size={18} inline /> Lembur Otomatis Hari Libur & Tanggal Merah
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.25rem', marginBottom: 0 }}>
                                Otomatis hitung dan catat jam kerja sebagai lembur yang disetujui saat karyawan absen di Hari Minggu, Hari Libur Nasional, atau Hari Libur Kerja (Off Day)
                            </p>
                        </div>
                        <span className={`badge ${holidayOtSettings.holiday_overtime_enabled ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
                            {holidayOtSettings.holiday_overtime_enabled ? '● Lembur Otomatis Aktif' : '○ Nonaktif'}
                        </span>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        {holidayOtMessage.text && (
                            <div className={`alert alert-${holidayOtMessage.type}`} style={{ marginBottom: '1.25rem' }}>
                                <span className="alert-icon">{holidayOtMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {holidayOtMessage.text}
                            </div>
                        )}

                        {/* Info Banner */}
                        <div style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md, 8px)',
                            background: 'var(--gray-50, #f8fafc)',
                            border: '1px solid var(--gray-200, #e2e8f0)',
                            marginBottom: '1.25rem',
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start'
                        }}>
                            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>ℹ️</span>
                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-700, #334155)', lineHeight: 1.5 }}>
                                <strong>Cara Kerja:</strong> Saat karyawan melakukan Check-In di hari libur, sistem menandai kehadiran sebagai lembur libur. Saat Check-Out, sistem secara otomatis menghitung durasi jam kerja, mengalikan dengan tarif lembur libur yang dikonfigurasi di bawah, dan mencatatkannya ke <strong>Catatan Lembur (Overtime Records)</strong> dengan status <em>Disetujui (Approved)</em> sehingga langsung terhitung di rekap penggajian (Payroll).
                            </div>
                        </div>

                        {/* Main Switches Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.5rem'
                        }}>
                            {/* Toggle 1: Enable Auto Overtime */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: `1.5px solid ${holidayOtSettings.holiday_overtime_enabled ? 'var(--primary-color, #4f46e5)' : 'var(--gray-200, #e2e8f0)'}`,
                                background: holidayOtSettings.holiday_overtime_enabled ? 'rgba(79, 70, 229, 0.04)' : '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.925rem' }}>
                                        Hitung Lembur Otomatis
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        Otomatis catat kehadiran hari libur ke data lembur
                                    </div>
                                </div>
                                <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={holidayOtSettings.holiday_overtime_enabled}
                                        onChange={(e) => setHolidayOtSettings(prev => ({
                                            ...prev,
                                            holiday_overtime_enabled: e.target.checked
                                        }))}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            {/* Toggle 2: Allow Check-in on Holidays */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: `1.5px solid ${holidayOtSettings.holiday_overtime_allow_checkin ? 'var(--success-500, #10b981)' : 'var(--gray-200, #e2e8f0)'}`,
                                background: holidayOtSettings.holiday_overtime_allow_checkin ? 'rgba(16, 185, 129, 0.04)' : '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.925rem' }}>
                                        Izinkan Absen di Hari Libur
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                                        Jika nonaktif, absen masuk ditolak saat hari libur
                                    </div>
                                </div>
                                <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={holidayOtSettings.holiday_overtime_allow_checkin}
                                        onChange={(e) => setHolidayOtSettings(prev => ({
                                            ...prev,
                                            holiday_overtime_allow_checkin: e.target.checked
                                        }))}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>

                        {/* Calculation Mode Selector */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                                Metode Nilai / Tarif Lembur Hari Libur
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                <div
                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_calc_mode: 'multiplier' }))}
                                    style={{
                                        padding: '0.85rem 1rem',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        border: `2px solid ${holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-200, #e2e8f0)'}`,
                                        background: holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-800)' }}>
                                        <input
                                            type="radio"
                                            name="holiday_calc_mode"
                                            checked={holidayOtSettings.holiday_overtime_calc_mode === 'multiplier'}
                                            onChange={() => {}}
                                            style={{ margin: 0 }}
                                        />
                                        <span>Kelipatan Tarif Karyawan (Multiplier)</span>
                                    </div>
                                    <p style={{ margin: '0.35rem 0 0 1.5rem', fontSize: '0.785rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>
                                        Nilai lembur dihitung dari tarif lembur dasar karyawan dikalikan faktor (contoh: 2x pada Minggu, 3x pada Hari Besar).
                                    </p>
                                </div>

                                <div
                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_calc_mode: 'fixed' }))}
                                    style={{
                                        padding: '0.85rem 1rem',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        border: `2px solid ${holidayOtSettings.holiday_overtime_calc_mode === 'fixed' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-200, #e2e8f0)'}`,
                                        background: holidayOtSettings.holiday_overtime_calc_mode === 'fixed' ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: holidayOtSettings.holiday_overtime_calc_mode === 'fixed' ? 'var(--primary-color, #4f46e5)' : 'var(--gray-800)' }}>
                                        <input
                                            type="radio"
                                            name="holiday_calc_mode"
                                            checked={holidayOtSettings.holiday_overtime_calc_mode === 'fixed'}
                                            onChange={() => {}}
                                            style={{ margin: 0 }}
                                        />
                                        <span>Tarif Tetap Nominal (Rp / Jam)</span>
                                    </div>
                                    <p style={{ margin: '0.35rem 0 0 1.5rem', fontSize: '0.785rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>
                                        Menetapkan besaran nominal rupiah tetap per jam lembur tanpa bergantung pada tarif dasar karyawan.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Rate Cards Inputs */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.5rem'
                        }}>
                            {/* Card 1: Hari Minggu */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1px solid var(--gray-200, #e2e8f0)',
                                background: '#fff'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>☀️</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>Hari Minggu</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Absensi setiap hari Minggu</div>
                                    </div>
                                </div>

                                {holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Kelipatan Tarif (x)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_rate_sunday}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_sunday: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', whiteSpace: 'nowrap', fontWeight: 600 }}>x Tarif</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                                            {[1.5, 2.0, 2.5, 3.0].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_sunday: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_rate_sunday === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_rate_sunday === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_rate_sunday === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {val}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Tarif Per Jam (Rp)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', fontWeight: 600 }}>Rp</span>
                                            <input
                                                type="number"
                                                step="1000"
                                                min="0"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_fixed_sunday}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_sunday: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>/ jam</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            {[35000, 50000, 75000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_sunday: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_fixed_sunday === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_fixed_sunday === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_fixed_sunday === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {(val / 1000)}rb
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Hari Libur Nasional / Hari Besar */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                                background: '#fff'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🇮🇩</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>Hari Besar / Libur Nasional</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Tanggal merah kalender resmi Indonesia</div>
                                    </div>
                                </div>

                                {holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Kelipatan Tarif (x)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_rate_national}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_national: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', whiteSpace: 'nowrap', fontWeight: 600 }}>x Tarif</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                                            {[2.0, 2.5, 3.0, 4.0].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_national: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_rate_national === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_rate_national === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_rate_national === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {val}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Tarif Per Jam (Rp)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', fontWeight: 600 }}>Rp</span>
                                            <input
                                                type="number"
                                                step="1000"
                                                min="0"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_fixed_national}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_national: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>/ jam</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            {[50000, 75000, 100000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_national: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_fixed_national === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_fixed_national === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_fixed_national === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {(val / 1000)}rb
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Card 3: Libur Jadwal / Off Day */}
                            <div style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1px solid var(--gray-200, #e2e8f0)',
                                background: '#fff'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏖️</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-800)' }}>Libur Jadwal (Off Day)</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Hari libur sesuai roster kerja karyawan</div>
                                    </div>
                                </div>

                                {holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Kelipatan Tarif (x)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_rate_offday}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_offday: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', whiteSpace: 'nowrap', fontWeight: 600 }}>x Tarif</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                                            {[1.5, 2.0, 2.5].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_rate_offday: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_rate_offday === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_rate_offday === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_rate_offday === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {val}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.35rem', display: 'block' }}>
                                            Tarif Per Jam (Rp)
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)', fontWeight: 600 }}>Rp</span>
                                            <input
                                                type="number"
                                                step="1000"
                                                min="0"
                                                className="form-input"
                                                value={holidayOtSettings.holiday_overtime_fixed_offday}
                                                onChange={(e) => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_offday: parseFloat(e.target.value) || 0 }))}
                                                style={{ fontWeight: 600, fontSize: '1rem' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>/ jam</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            {[35000, 50000, 75000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setHolidayOtSettings(prev => ({ ...prev, holiday_overtime_fixed_offday: val }))}
                                                    className="btn btn-sm btn-outline"
                                                    style={{
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.75rem',
                                                        borderColor: holidayOtSettings.holiday_overtime_fixed_offday === val ? 'var(--primary-color)' : 'var(--gray-200)',
                                                        background: holidayOtSettings.holiday_overtime_fixed_offday === val ? 'var(--primary-color)' : 'transparent',
                                                        color: holidayOtSettings.holiday_overtime_fixed_offday === val ? '#fff' : 'inherit'
                                                    }}
                                                >
                                                    {(val / 1000)}rb
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Interactive Simulation Preview Box */}
                        <div style={{
                            padding: '1rem 1.25rem',
                            borderRadius: 'var(--radius-md, 8px)',
                            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(147, 51, 234, 0.06) 100%)',
                            border: '1px solid rgba(79, 70, 229, 0.2)',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>📊</span> Simulasi Perhitungan Lembur Hari Libur (Bekerja 8 Jam):
                            </div>
                            <div style={{ fontSize: '0.825rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>
                                {holidayOtSettings.holiday_overtime_calc_mode === 'multiplier' ? (
                                    <>
                                        <div>• <strong>Hari Minggu:</strong> 8 jam × (Rp 25.000 × {holidayOtSettings.holiday_overtime_rate_sunday || 2}x) = <strong>Rp {Math.round(8 * 25000 * (holidayOtSettings.holiday_overtime_rate_sunday || 2)).toLocaleString('id-ID')}</strong> (asumsi tarif dasar karyawan Rp 25.000/jam)</div>
                                        <div>• <strong>Hari Besar / Libur Nasional:</strong> 8 jam × (Rp 25.000 × {holidayOtSettings.holiday_overtime_rate_national || 3}x) = <strong>Rp {Math.round(8 * 25000 * (holidayOtSettings.holiday_overtime_rate_national || 3)).toLocaleString('id-ID')}</strong></div>
                                        <div>• <strong>Off Day Karyawan:</strong> 8 jam × (Rp 25.000 × {holidayOtSettings.holiday_overtime_rate_offday || 2}x) = <strong>Rp {Math.round(8 * 25000 * (holidayOtSettings.holiday_overtime_rate_offday || 2)).toLocaleString('id-ID')}</strong></div>
                                    </>
                                ) : (
                                    <>
                                        <div>• <strong>Hari Minggu:</strong> 8 jam × Rp {(holidayOtSettings.holiday_overtime_fixed_sunday || 50000).toLocaleString('id-ID')}/jam = <strong>Rp {Math.round(8 * (holidayOtSettings.holiday_overtime_fixed_sunday || 50000)).toLocaleString('id-ID')}</strong></div>
                                        <div>• <strong>Hari Besar / Libur Nasional:</strong> 8 jam × Rp {(holidayOtSettings.holiday_overtime_fixed_national || 75000).toLocaleString('id-ID')}/jam = <strong>Rp {Math.round(8 * (holidayOtSettings.holiday_overtime_fixed_national || 75000)).toLocaleString('id-ID')}</strong></div>
                                        <div>• <strong>Off Day Karyawan:</strong> 8 jam × Rp {(holidayOtSettings.holiday_overtime_fixed_offday || 50000).toLocaleString('id-ID')}/jam = <strong>Rp {Math.round(8 * (holidayOtSettings.holiday_overtime_fixed_offday || 50000)).toLocaleString('id-ID')}</strong></div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Save Action */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleHolidayOvertimeSave}
                                disabled={holidayOtLoading}
                                style={{ minWidth: '180px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {holidayOtLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Save" size={16} inline />
                                        <span>Simpan Pengaturan Lembur</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                        {canEditPayslipLayout && <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="FileText" size={16} inline /> Isi Slip Gaji</h2>
                    </div>
                    <p className="payslip-field-note">
                        Ini aturan untuk semua karyawan. Aturan departemen atau satu karyawan diatur dari tombol Atur tampilan di slip, dan mengalahkan aturan ini.
                    </p>
                    <PayslipFieldSettings value={payslipFields} onChange={setPayslipFields} />
                    {payslipFieldsMessage.text && (
                        <div className={`alert alert-${payslipFieldsMessage.type}`} style={{ marginBottom: '0.75rem' }}>
                            {payslipFieldsMessage.text}
                        </div>
                    )}
                    <button
                        className="btn btn-primary"
                        type="button"
                        disabled={payslipFieldsLoading}
                        onClick={async () => {
                            setPayslipFieldsLoading(true);
                            setPayslipFieldsMessage({ type: '', text: '' });
                            try {
                                await updatePayslipFields(payslipFields);
                                setPayslipFieldsMessage({ type: 'success', text: 'Tampilan slip gaji berhasil disimpan' });
                            } catch (error) {
                                setPayslipFieldsMessage({ type: 'danger', text: error.message || 'Gagal menyimpan tampilan slip' });
                            } finally {
                                setPayslipFieldsLoading(false);
                            }
                        }}
                    >
                        {payslipFieldsLoading ? 'Menyimpan...' : 'Simpan tampilan slip'}
                    </button>
                    {payslipLayouts.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Aturan khusus</h4>
                            {payslipLayouts.map((rule) => (
                                <div key={`${rule.scope_type}-${rule.scope_key}`} className="payslip-slip-line">
                                    <span>
                                        {rule.scope_type === 'department'
                                            ? `Departemen ${rule.scope_key}`
                                            : `${rule.user_name || 'Karyawan'} (${rule.employee_id || rule.scope_key})`}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: 'auto', padding: '0.3rem 0.7rem' }}
                                        onClick={async () => {
                                            await settingsAPI.deletePayslipLayoutByKey(rule.scope_type, rule.scope_key);
                                            setPayslipLayouts((rows) => rows.filter((item) => item.scope_key !== rule.scope_key || item.scope_type !== rule.scope_type));
                                        }}
                                    >
                                        Hapus
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>}
                    </>
                )}

                {activeTab === 'leave' && (
                    <>
                        {/* ============ LEAVE SETTINGS SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Palmtree" size={16} inline /> Pengaturan Cuti & Izin</h2>
                    </div>

                    <div style={{ padding: '1.5rem 0' }}>
                        {leaveMessage.text && (
                            <div className={`alert alert-${leaveMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{leaveMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {leaveMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleLeaveSave}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Kuota Cuti Tahunan Standar (Hari)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={leaveSettings.annual_leave_quota}
                                    onChange={(e) => setLeaveSettings({ ...leaveSettings, annual_leave_quota: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    required
                                />
                                <small style={{ color: 'var(--gray-500)', marginTop: '0.25rem', display: 'block' }}>
                                    Jumlah hari cuti yang didapatkan setiap tahun.
                                </small>
                            </div>

                            {/* Mode Perhitungan Cuti */}
                            <div style={{
                                padding: '1.25rem',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--gray-200)',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--gray-800)' }}>
                                    <Icon name="Clock" size={16} inline /> Mode Perhitungan & Satuan Cuti
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                    Tentukan apakah karyawan dapat mengajukan cuti per hari penuh, per jam, atau keduanya.
                                </p>

                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Pilihan Mode Pengajuan Cuti</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                                        <label style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)', border: `2px solid ${leaveSettings.leave_calculation_mode === 'both' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: leaveSettings.leave_calculation_mode === 'both' ? 'rgba(59,130,246,0.08)' : 'transparent',
                                            cursor: 'pointer'
                                        }}>
                                            <input
                                                type="radio"
                                                name="leave_calc_mode"
                                                value="both"
                                                checked={leaveSettings.leave_calculation_mode === 'both'}
                                                onChange={() => setLeaveSettings({ ...leaveSettings, leave_calculation_mode: 'both' })}
                                                style={{ marginTop: '0.2rem' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Keduanya (Rekomendasi)</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Bisa ajukan harian penuh atau cuti beberapa jam</div>
                                            </div>
                                        </label>

                                        <label style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)', border: `2px solid ${leaveSettings.leave_calculation_mode === 'daily' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: leaveSettings.leave_calculation_mode === 'daily' ? 'rgba(59,130,246,0.08)' : 'transparent',
                                            cursor: 'pointer'
                                        }}>
                                            <input
                                                type="radio"
                                                name="leave_calc_mode"
                                                value="daily"
                                                checked={leaveSettings.leave_calculation_mode === 'daily'}
                                                onChange={() => setLeaveSettings({ ...leaveSettings, leave_calculation_mode: 'daily' })}
                                                style={{ marginTop: '0.2rem' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Per Hari Saja</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Hanya cuti harian penuh (minimal 1 hari)</div>
                                            </div>
                                        </label>

                                        <label style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)', border: `2px solid ${leaveSettings.leave_calculation_mode === 'hourly' ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                                            background: leaveSettings.leave_calculation_mode === 'hourly' ? 'rgba(59,130,246,0.08)' : 'transparent',
                                            cursor: 'pointer'
                                        }}>
                                            <input
                                                type="radio"
                                                name="leave_calc_mode"
                                                value="hourly"
                                                checked={leaveSettings.leave_calculation_mode === 'hourly'}
                                                onChange={() => setLeaveSettings({ ...leaveSettings, leave_calculation_mode: 'hourly' })}
                                                style={{ marginTop: '0.2rem' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Per Jam Saja</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Semua pengajuan cuti dihitung dalam durasi jam</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>
                                        Konversi Jam Kerja ke 1 Hari Cuti
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '300px' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            step="0.5"
                                            min="1"
                                            max="24"
                                            value={leaveSettings.hours_per_leave_day}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, hours_per_leave_day: parseFloat(e.target.value) || 8 })}
                                            required
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>Jam = 1 Hari Cuti</span>
                                    </div>
                                    <small style={{ color: 'var(--gray-500)', marginTop: '0.35rem', display: 'block' }}>
                                        Contoh: Jika diatur 8 jam, cuti 2 jam akan memotong 0.25 hari cuti tahunan. Setelah terkumpul 8 jam cuti, otomatis genap memotong 1 hari kuota.
                                    </small>
                                </div>
                            </div>

                            <div style={{
                                padding: '1.25rem',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--gray-200)',
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--gray-800)' }}>Aturan Potong Cuti</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                    Aktifkan toggle di bawah jika pengajuan izin berikut akan mengurangi sisa kuota cuti karyawan.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.sick_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, sick_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Sakit Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin sakit akan mengurangi kuota cuti tahunan</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.permission_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, permission_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Tidak Masuk Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin seharian (keperluan lain) akan mengurangi cuti</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={leaveSettings.late_deducts_leave}
                                            onChange={(e) => setLeaveSettings({ ...leaveSettings, late_deducts_leave: e.target.checked })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Izin Terlambat Memotong Cuti</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pengajuan izin datang terlambat akan mengurangi cuti</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{
                                padding: '1.25rem',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--gray-200)',
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--gray-800)' }}>Tingkat Approval Izin & Cuti</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                    1 tingkat = cukup atasan langsung. 2+ tingkat = bertingkat mengikuti struktur organisasi (atasan → atasan dari atasan). Jika rantai atasan kurang, dilanjutkan ke Admin/HR.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {[
                                        { type: 'late', label: 'Izin Terlambat' },
                                        { type: 'sick', label: 'Izin Sakit' },
                                        { type: 'permission', label: 'Izin Tidak Masuk' },
                                        { type: 'leave', label: 'Cuti' },
                                        { type: 'change_off', label: 'Tukar Libur' }
                                    ].map((item) => {
                                        const cfg = approvalConfig.find((c) => c.leave_type === item.type) || { approval_levels: 1, fallback_to_admin: true };
                                        return (
                                            <div key={item.type} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.4fr 160px 1fr',
                                                gap: '0.75rem',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: 'white',
                                                border: '1px solid var(--gray-200)',
                                                borderRadius: 'var(--radius-md)'
                                            }}>
                                                <div style={{ fontWeight: 600 }}>{item.label}</div>
                                                <select
                                                    className="form-input form-select"
                                                    value={cfg.approval_levels}
                                                    onChange={(e) => setApprovalConfig((prev) => prev.map((c) =>
                                                        c.leave_type === item.type
                                                            ? { ...c, approval_levels: parseInt(e.target.value, 10) }
                                                            : c
                                                    ))}
                                                >
                                                    <option value={1}>1 tingkat</option>
                                                    <option value={2}>2 tingkat</option>
                                                    <option value={3}>3 tingkat</option>
                                                </select>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={cfg.fallback_to_admin !== false}
                                                        onChange={(e) => setApprovalConfig((prev) => prev.map((c) =>
                                                            c.leave_type === item.type
                                                                ? { ...c, fallback_to_admin: e.target.checked }
                                                                : c
                                                        ))}
                                                    />
                                                    Lanjut ke Admin/HR jika atasan tidak lengkap
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', color: 'var(--gray-800)' }}>Bonus Cuti Besar</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Tambahan kuota cuti di tahun tertentu berdasarkan masa kerja.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={addBigLeaveRule}
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                    >
                                        + Tambah Aturan
                                    </button>
                                </div>

                                {bigLeaveRules.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px dashed var(--gray-300)' }}>
                                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', margin: 0 }}>Belum ada aturan cuti besar.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {bigLeaveRules.map((rule, index) => (
                                            <div key={index} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto auto',
                                                gap: '1rem',
                                                alignItems: 'end',
                                                padding: '1rem',
                                                background: 'white',
                                                border: '1px solid var(--gray-200)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', display: 'block', marginBottom: '0.25rem' }}>Masa Kerja (Tahun)</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={rule.min_years}
                                                        onChange={(e) => updateBigLeaveRule(index, 'min_years', parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-600)', display: 'block', marginBottom: '0.25rem' }}>Bonus Kuota (Hari)</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={rule.leave_days}
                                                        onChange={(e) => updateBigLeaveRule(index, 'leave_days', parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={rule.is_active}
                                                            onChange={(e) => updateBigLeaveRule(index, 'is_active', e.target.checked)}
                                                        />
                                                        <span style={{ fontSize: '0.85rem' }}>Aktif</span>
                                                    </label>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger"
                                                    onClick={() => removeBigLeaveRule(index)}
                                                    style={{ height: '42px', padding: '0 1rem' }}
                                                    title="Hapus"
                                                >
                                                    <Icon name="Trash2" size={16} inline />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled={leaveLoading}
                            >
                                {leaveLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan Pengaturan Cuti'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
                    </>
                )}

                {activeTab === 'system' && (
                    <>
                        {/* ============ SMTP SETTINGS SECTION ============ */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Mail" size={16} inline /> Konfigurasi SMTP Email</h2>
                    </div>

                    <div style={{ padding: '1.5rem 0' }}>
                        {smtpMessage.text && (
                            <div className={`alert alert-${smtpMessage.type}`} style={{ marginBottom: '1.5rem' }}>
                                <span className="alert-icon">{smtpMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                {smtpMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleSmtpSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">SMTP Host</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Contoh: smtp.gmail.com"
                                        value={smtpSettings.smtp_host}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SMTP Port</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Contoh: 587 atau 465"
                                        value={smtpSettings.smtp_port}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Username (Email)</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="Alamat Email"
                                        value={smtpSettings.smtp_user}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password / App Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Password"
                                        value={smtpSettings.smtp_pass}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_pass: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={smtpSettings.smtp_secure}
                                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_secure: e.target.checked })}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Gunakan SSL/TLS (Secure)</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Biasanya dicentang jika menggunakan port 465</div>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={smtpLoading}
                            >
                                {smtpLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    'Simpan SMTP'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                        {/* ============ BACKUP & RESTORE SECTION ============ */}
                <div className="card" style={{ overflow: 'visible' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Icon name="Save" size={16} inline /> Backup & Restore Database</h2>
                    </div>

                    <div style={{ padding: '0.5rem 0' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '0.75rem' }}>
                            Unduh file backup (.sql), lalu restore file itu di komputer atau server tujuan.
                            Database tujuan akan ditimpa seluruhnya. File upload (foto, logo) tidak ikut tersalin.
                        </p>
                        {dbInfo && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1.25rem' }}>
                                Database saat ini: <strong>{dbInfo.database}</strong> @ {dbInfo.host}
                                {dbInfo.isLocal ? ' (lokal)' : ' (server)'}
                            </p>
                        )}

                        <div style={{
                            padding: '1.25rem',
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1.25rem',
                            background: 'var(--gray-50)'
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--gray-800)' }}>
                                Export Backup
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                                Menghasilkan file SQL data lengkap dari database saat ini.
                            </p>
                            {backupMessage.text && (
                                <div className={`alert alert-${backupMessage.type}`} style={{ marginBottom: '1rem' }}>
                                    <span className="alert-icon">{backupMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                    {backupMessage.text}
                                </div>
                            )}
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleBackupDownload}
                                disabled={busyBackup}
                            >
                                {backupLoading ? (
                                    <>
                                        <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                        <span>Membuat backup...</span>
                                    </>
                                ) : (
                                    'Unduh Backup (.sql)'
                                )}
                            </button>
                        </div>

                        <div style={{
                            padding: '1.25rem',
                            border: '1px solid #fecaca',
                            borderRadius: 'var(--radius-md)',
                            background: '#fff5f5'
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#991b1b' }}>
                                Restore dari File
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: '#b91c1c', marginBottom: '1rem' }}>
                                Semua data saat ini akan diganti dengan isi file backup.
                            </p>
                            {restoreMessage.text && (
                                <div className={`alert alert-${restoreMessage.type}`} style={{ marginBottom: '1rem' }}>
                                    <span className="alert-icon">{restoreMessage.type === 'success' ? 'CheckCircle2' : 'AlertTriangle'}</span>
                                    {restoreMessage.text}
                                </div>
                            )}
                            <form onSubmit={handleRestore}>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">File Backup (.sql)</label>
                                    <input
                                        type="file"
                                        className="form-input"
                                        accept=".sql,.dump,.backup,.json"
                                        disabled={busyBackup}
                                        onChange={(e) => {
                                            setRestoreFile(e.target.files?.[0] || null);
                                            setRestoreMessage({ type: '', text: '' });
                                        }}
                                    />
                                    {restoreFile && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.35rem' }}>
                                            Dipilih: {restoreFile.name} ({Math.round(restoreFile.size / 1024)} KB)
                                        </p>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">
                                        Ketik <strong>TIMPA</strong> untuk konfirmasi
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={restoreConfirm}
                                        onChange={(e) => setRestoreConfirm(e.target.value)}
                                        placeholder="TIMPA"
                                        disabled={busyBackup}
                                        autoComplete="off"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-danger"
                                    disabled={busyBackup || !restoreFile || restoreConfirm.trim().toUpperCase() !== 'TIMPA'}
                                >
                                    {restoreLoading ? (
                                        <>
                                            <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                            <span>Merestore...</span>
                                        </>
                                    ) : (
                                        'Restore & Timpa Database'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                    </>
                )}
            </div>
        </div>
    );
}
