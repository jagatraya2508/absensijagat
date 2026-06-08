const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'sa',
  database: 'postgres' // connect to default db
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to local PostgreSQL server.');

    // Memutus koneksi aktif ke database sumber agar proses duplikasi (template) tidak terblokir
    console.log('Menutup koneksi aktif ke database "absensi"...');
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'absensi'
      AND pid <> pg_backend_pid();
    `);
    console.log('Koneksi ke "absensi" telah ditutup.');

    // Membuat database baru menggunakan template
    console.log('Menduplikat database "absensi" menjadi "absensijagat"...');
    await client.query(`CREATE DATABASE absensijagat WITH TEMPLATE absensi OWNER postgres;`);
    console.log('BERHASIL! Database "absensijagat" berhasil dibuat sebagai duplikat dari "absensi".');

  } catch (err) {
    console.error('GAGAL:', err.message);
  } finally {
    await client.end();
  }
}

run();
