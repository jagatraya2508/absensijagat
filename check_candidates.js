const { pool } = require('./backend/db');
pool.query("SELECT * FROM candidates LIMIT 1").then(res => {
    console.log(res.fields.map(f => `${f.name} (${f.dataTypeID})`));
    process.exit(0);
});
