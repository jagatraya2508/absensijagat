const { Client } = require('pg');

async function fixPassword() {
  const clientDbAbsen = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'sa', database: 'dbabsen' });
  const clientAbsensiJagat = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'sa', database: 'absensijagat' });

  try {
    await clientDbAbsen.connect();
    const res = await clientDbAbsen.query("SELECT password FROM users WHERE employee_id = 'ADMIN001'");
    const currentHash = res.rows[0].password;
    await clientDbAbsen.end();

    await clientAbsensiJagat.connect();
    await clientAbsensiJagat.query("UPDATE users SET password = $1 WHERE employee_id = 'ADMIN001'", [currentHash]);
    console.log("Password ADMIN001 berhasil disamakan dengan database sebelumnya (dbabsen).");
  } catch (e) {
    console.error(e);
  } finally {
    try { await clientAbsensiJagat.end(); } catch(e){}
  }
}

fixPassword();
