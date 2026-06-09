const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function diagnose() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });

        // 1. Cek PM2 config / ecosystem
        console.log('=== PM2 STATUS ===');
        const pm2List = await ssh.execCommand('pm2 show absensi-frontend-3000');
        console.log(pm2List.stdout);

        console.log('\n=== PM2 LOGS (last 20 lines) ===');
        const pm2Logs = await ssh.execCommand('pm2 logs absensi-frontend-3000 --lines 20 --nostream');
        console.log(pm2Logs.stdout);
        if (pm2Logs.stderr) console.log(pm2Logs.stderr);

        console.log('\n=== PM2 LOGS BACKEND (last 20 lines) ===');
        const pm2LogsBack = await ssh.execCommand('pm2 logs absensi-backend-5000 --lines 20 --nostream');
        console.log(pm2LogsBack.stdout);
        if (pm2LogsBack.stderr) console.log(pm2LogsBack.stderr);

        // 2. Cek port yang sedang listen
        console.log('\n=== PORTS LISTENING ===');
        const ports = await ssh.execCommand('ss -tlnp | grep -E "3000|3012|5000|80"');
        console.log(ports.stdout);

        // 3. Cek nginx config
        console.log('\n=== NGINX CONFIG ===');
        const nginx = await ssh.execCommand('cat /etc/nginx/sites-enabled/default 2>/dev/null || cat /etc/nginx/nginx.conf 2>/dev/null || echo "No nginx config found"');
        console.log(nginx.stdout.substring(0, 1500));

        // 4. Cek ecosystem file PM2
        console.log('\n=== PM2 ECOSYSTEM FILE ===');
        const eco = await ssh.execCommand('cat /home/wisnu/absensijagat/ecosystem.config.js 2>/dev/null || echo "No ecosystem file found"');
        console.log(eco.stdout);

        // 5. Run migration
        console.log('\n=== RUNNING MIGRATION ON SERVER ===');
        const migration = await ssh.execCommand('cd /home/wisnu/absensijagat/backend && node migrate_license.js');
        console.log(migration.stdout);
        if (migration.stderr) console.log('ERROR:', migration.stderr);

        // 6. Restart PM2 backend
        console.log('\n=== RESTARTING BACKEND ===');
        const restart = await ssh.execCommand('pm2 restart absensijagat-backend-5000');
        console.log(restart.stdout);

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
diagnose();
