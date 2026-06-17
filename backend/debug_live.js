const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('--- PM2 Status ---');
        const res = await ssh.execCommand('pm2 list');
        console.log(res.stdout);

        console.log('--- PM2 Backend Describe ---');
        const res2 = await ssh.execCommand('pm2 describe backend');
        console.log(res2.stdout);

        console.log('--- DB connection from env ---');
        const res3 = await ssh.execCommand('cat .env', { cwd: '/home/wisnu/absensijagat/backend' });
        // Don't log full env for security, just DB stuff
        const dbLines = res3.stdout.split('\n').filter(line => line.includes('DB_'));
        console.log(dbLines.join('\n'));

        console.log('--- PM2 Logs ---');
        const res4 = await ssh.execCommand('pm2 logs backend --lines 50 --nostream');
        console.log(res4.stdout);
        console.log(res4.stderr);

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
checkRemote();
