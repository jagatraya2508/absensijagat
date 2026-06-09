require('dotenv').config();
const { pool } = require('./db');

async function fix() {
    try {
        const columns = [
            'is_collector BOOLEAN DEFAULT false',
            'use_tracking BOOLEAN DEFAULT false',
            'driver_subuh_allowance NUMERIC(15,2) DEFAULT 0',
            'driver_rit_allowance NUMERIC(15,2) DEFAULT 0',
            'driver_inap_allowance NUMERIC(15,2) DEFAULT 0',
            'driver_ritase_dekat_allowance NUMERIC(15,2) DEFAULT 0',
            'driver_ritase_jauh_allowance NUMERIC(15,2) DEFAULT 0',
            'vehicle_type_id INTEGER REFERENCES vehicle_types(id)'
        ];

        for (let col of columns) {
            try {
                await pool.query(`ALTER TABLE employee_details ADD COLUMN ${col}`);
                console.log(`Added ${col}`);
            } catch (err) {
                // Ignore if column already exists (code 42701)
                if (err.code !== '42701') {
                    console.error(`Error adding ${col}:`, err.message);
                } else {
                    console.log(`Column ${col.split(' ')[0]} already exists.`);
                }
            }
        }
        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
