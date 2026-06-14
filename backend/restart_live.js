const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function restartRemote() {
    try {
        console.log('Connecting to remote server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Connected to remote server! Restarting PM2 backend services...');
        
        // Kita coba restart berbagai kemungkinan nama process dari PM2 
        // yang ada di server (absensi-backend-5000, absensijagat-backend-5000, atau backend)
        const res = await ssh.execCommand('pm2 restart absensi-backend-5000 || pm2 restart absensijagat-backend-5000 || pm2 restart backend || pm2 restart all');
        
        console.log('PM2 restart output:\n', res.stdout);
        if (res.stderr) console.error('PM2 restart warning/error:\n', res.stderr);

        ssh.dispose();
        console.log('Restart selesai!');
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
restartRemote();
