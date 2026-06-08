const { Client } = require('pg');

async function checkSettings(dbName) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'sa',
    database: dbName
  });

  try {
    await client.connect();
    const res = await client.query("SELECT key, value FROM settings WHERE key IN ('app_logo', 'login_logo', 'company_name');");
    console.log(`\n--- Settings in [${dbName}] ---`);
    if (res.rows.length === 0) {
      console.log('No logo settings found or settings table empty.');
    }
    res.rows.forEach(r => {
      console.log(`${r.key} = ${r.value}`);
    });
  } catch (e) {
    console.error(`[${dbName}] Error: ${e.message}`);
  } finally {
    try { await client.end(); } catch(e){}
  }
}

async function run() {
  await checkSettings('dbabsen');
  await checkSettings('absensijagat');
}

run();
