const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixRemote() {
    try {
        console.log('Connecting to remote server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Connected to remote server!');

        // Upload an updated migration file that requires dotenv
        const script = `
require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
    try {
        console.log('Connecting to database:', process.env.DB_NAME || 'absensi');
        console.log('Starting migration to add photo column to users...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo VARCHAR(255);');
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}
migrate();
`;
        await ssh.execCommand(`echo "${script.replace(/"/g, '\\"')}" > migrate_real.js`, { cwd: '/home/wisnu/absensijagat/backend' });

        // Run the script
        console.log('Menjalankan migrasi pada database absensijagat...');
        const res = await ssh.execCommand('node migrate_real.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('Output Migrasi:', res.stdout);
        if (res.stderr) console.error('Error Migrasi:', res.stderr);

        // Restart PM2 just in case
        console.log('Restarting PM2 backend...');
        const res2 = await ssh.execCommand('pm2 restart absensijagat-backend-5000', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('PM2 restarted.');

        ssh.dispose();
        console.log('Migrasi di database absensijagat selesai!');
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
fixRemote();
