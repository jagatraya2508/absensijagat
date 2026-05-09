const { pool } = require('./backend/db');
pool.query("ALTER TABLE candidates ALTER COLUMN resume_path TYPE TEXT").then(() => {
    console.log('Altered table candidates');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
