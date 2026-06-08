const { Client } = require('pg');

async function checkUser(dbName) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'sa',
    database: dbName
  });

  try {
    await client.connect();
    const res = await client.query("SELECT employee_id, password FROM users WHERE employee_id = 'ADMIN001' LIMIT 1;");
    if (res.rows.length > 0) {
      console.log(`[${dbName}] Found ADMIN001: password hash=${res.rows[0].password.substring(0, 15)}...`);
    } else {
      console.log(`[${dbName}] ADMIN001 NOT FOUND!`);
    }
  } catch (e) {
    console.error(`[${dbName}] Error: ${e.message}`);
  } finally {
    await client.end();
  }
}

async function run() {
  await checkUser('dbabsen');
  await checkUser('absensi');
  await checkUser('absensijagat');
}

run();
