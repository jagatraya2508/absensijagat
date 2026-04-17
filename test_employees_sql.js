require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function testEx() {
    try {
        const id=1;
        const res = await pool.query(`
            INSERT INTO employee_details (
                user_id, nik, phone, address, birth_date, birth_place,
                gender, marital_status, religion, education,
                department, position, join_date,
                bank_name, bank_account, bank_holder,
                npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no,
                basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate,
                tax_status, emergency_contact_name, emergency_contact_phone,
                is_driver, is_collector, use_tracking, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance, driver_ritase_allowance,
                bpjs_kes_enrolled, bpjs_jht_enrolled, bpjs_jp_enrolled, bpjs_jkk_enrolled, bpjs_jkm_enrolled, pph21_enabled,
                bpjs_kes_employee_rate, bpjs_kes_company_rate, bpjs_jht_employee_rate, bpjs_jht_company_rate,
                bpjs_jp_employee_rate, bpjs_jp_company_rate, bpjs_jkk_rate, bpjs_jkm_rate,
                no_kk,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27,
                $28, $29, $30, $31, $32, $33, $34,
                $35, $36, $37, $38, $39, $40,
                $41, $42, $43, $44, $45, $46, $47, $48,
                $49,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO UPDATE SET
                nik = EXCLUDED.nik,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                birth_date = EXCLUDED.birth_date,
                birth_place = EXCLUDED.birth_place,
                gender = EXCLUDED.gender,
                marital_status = EXCLUDED.marital_status,
                religion = EXCLUDED.religion,
                education = EXCLUDED.education,
                department = EXCLUDED.department,
                position = EXCLUDED.position,
                join_date = EXCLUDED.join_date,
                bank_name = EXCLUDED.bank_name,
                bank_account = EXCLUDED.bank_account,
                bank_holder = EXCLUDED.bank_holder,
                npwp = EXCLUDED.npwp,
                bpjs_kesehatan_no = EXCLUDED.bpjs_kesehatan_no,
                bpjs_ketenagakerjaan_no = EXCLUDED.bpjs_ketenagakerjaan_no,
                basic_salary = EXCLUDED.basic_salary,
                salary_type = EXCLUDED.salary_type,
                transport_allowance = EXCLUDED.transport_allowance,
                meal_allowance = EXCLUDED.meal_allowance,
                overtime_rate = EXCLUDED.overtime_rate,
                tax_status = EXCLUDED.tax_status,
                emergency_contact_name = EXCLUDED.emergency_contact_name,
                emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                is_driver = EXCLUDED.is_driver,
                is_collector = EXCLUDED.is_collector,
                use_tracking = EXCLUDED.use_tracking,
                driver_subuh_allowance = EXCLUDED.driver_subuh_allowance,
                driver_rit_allowance = EXCLUDED.driver_rit_allowance,
                driver_inap_allowance = EXCLUDED.driver_inap_allowance,
                driver_ritase_allowance = EXCLUDED.driver_ritase_allowance,
                bpjs_kes_enrolled = EXCLUDED.bpjs_kes_enrolled,
                bpjs_jht_enrolled = EXCLUDED.bpjs_jht_enrolled,
                bpjs_jp_enrolled = EXCLUDED.bpjs_jp_enrolled,
                bpjs_jkk_enrolled = EXCLUDED.bpjs_jkk_enrolled,
                bpjs_jkm_enrolled = EXCLUDED.bpjs_jkm_enrolled,
                pph21_enabled = EXCLUDED.pph21_enabled,
                bpjs_kes_employee_rate = EXCLUDED.bpjs_kes_employee_rate,
                bpjs_kes_company_rate = EXCLUDED.bpjs_kes_company_rate,
                bpjs_jht_employee_rate = EXCLUDED.bpjs_jht_employee_rate,
                bpjs_jht_company_rate = EXCLUDED.bpjs_jht_company_rate,
                bpjs_jp_employee_rate = EXCLUDED.bpjs_jp_employee_rate,
                bpjs_jp_company_rate = EXCLUDED.bpjs_jp_company_rate,
                bpjs_jkk_rate = EXCLUDED.bpjs_jkk_rate,
                bpjs_jkm_rate = EXCLUDED.bpjs_jkm_rate,
                no_kk = EXCLUDED.no_kk,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            id, null, null, null, null, null,
            null, 'Belum Menikah', null, null,
            null, null, null,
            null, null, null,
            null, null, null,
            0, 'monthly', 0, 0, 50000,
            'TK/0', null, null,
            false, false, false, 0, 0, 0, 0,
            true, true, true, true, true, true,
            null, null, null, null,
            null, null, null, null,
            null
        ]);
        console.log("SQL Valid.");
    }catch(err){
        console.error(err);
    }finally{
        process.exit();
    }
}
testEx();
