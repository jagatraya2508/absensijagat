const { Client } = require('pg');

async function fixSettings() {
  const clientDbAbsen = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'sa', database: 'dbabsen' });
  const clientAbsensiJagat = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'sa', database: 'absensijagat' });

  try {
    await clientDbAbsen.connect();
    const res = await clientDbAbsen.query("SELECT key, value FROM settings WHERE key IN ('app_logo', 'login_logo', 'company_name');");
    await clientDbAbsen.end();

    await clientAbsensiJagat.connect();
    
    for (const row of res.rows) {
      // Coba update dulu
      const updateRes = await clientAbsensiJagat.query("UPDATE settings SET value = $1 WHERE key = $2 RETURNING id", [row.value, row.key]);
      
      // Jika key belum ada (seperti login_logo yang tidak ada di absensi)
      if (updateRes.rowCount === 0) {
         await clientAbsensiJagat.query("INSERT INTO settings (key, value) VALUES ($1, $2)", [row.key, row.value]);
      }
    }
    console.log("Pengaturan logo dan nama perusahaan berhasil disinkronkan dari database lama.");
  } catch (e) {
    console.error(e);
  } finally {
    try { await clientAbsensiJagat.end(); } catch(e){}
  }
}

fixSettings();
