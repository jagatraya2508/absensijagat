import { PAYSLIP_GROUPS } from '../utils/payslipFields';

export default function PayslipFieldSettings({ value, onChange }) {
    function toggle(key) {
        onChange({
            ...value,
            fields: { ...value.fields, [key]: value.fields[key] === false },
        });
    }

    function setAll(checked) {
        const fields = {};
        PAYSLIP_GROUPS.forEach((group) => {
            group.fields.forEach((field) => { fields[field.key] = checked; });
        });
        onChange({ ...value, fields });
    }

    return (
        <div className="payslip-field-settings">
            <p className="payslip-field-note">
                Centang nilai yang ingin tampil di slip. Pengaturan ini dipakai di layar, PDF, Excel, dan cetak. Perhitungan gaji tidak berubah.
            </p>
            <label className="payslip-field-check">
                <input
                    type="checkbox"
                    checked={!!value.hideZero}
                    onChange={(e) => onChange({ ...value, hideZero: e.target.checked })}
                />
                Sembunyikan baris yang nilainya Rp 0
            </label>
            <div className="payslip-field-tools">
                <button type="button" className="btn btn-outline" onClick={() => setAll(true)}>Pilih semua</button>
                <button type="button" className="btn btn-outline" onClick={() => setAll(false)}>Kosongkan</button>
            </div>
            {PAYSLIP_GROUPS.map((group) => (
                <div key={group.id} className="payslip-field-group">
                    <h4>{group.title}</h4>
                    <div className="payslip-field-grid">
                        {group.fields.map((field) => (
                            <label key={field.key} className="payslip-field-check">
                                <input
                                    type="checkbox"
                                    checked={value.fields[field.key] !== false}
                                    onChange={() => toggle(field.key)}
                                />
                                {field.label}
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
