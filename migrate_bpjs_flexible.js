require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

(async () => {
  try {
    console.log('=== Migrasi BPJS Flexible ===\n');

    // Add enrollment flags & override rates to employee_details
    const columns = [
      // BPJS enrollment flags (default true = aktif)
      { name: 'bpjs_kes_enrolled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'bpjs_jht_enrolled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'bpjs_jp_enrolled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'bpjs_jkk_enrolled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'bpjs_jkm_enrolled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'pph21_enabled', type: 'BOOLEAN DEFAULT TRUE' },
      // Override rates (NULL = gunakan default dari bpjs_settings)
      { name: 'bpjs_kes_employee_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_kes_company_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jht_employee_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jht_company_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jp_employee_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jp_company_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jkk_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
      { name: 'bpjs_jkm_rate', type: 'DECIMAL(6,4) DEFAULT NULL' },
    ];

    for (const col of columns) {
      try {
        await pool.query(`ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`✅ Kolom ${col.name} berhasil ditambahkan`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`⏭️  Kolom ${col.name} sudah ada`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migrasi selesai!');
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
