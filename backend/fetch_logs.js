const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fetchLogs() {
    try {
        console.log('Connecting to remote server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Fetching PM2 logs for backend...');
        const res = await ssh.execCommand('pm2 logs absensijagat-backend-5000 --lines 50 --nostream');
        console.log('--- STDOUT ---');
        console.log(res.stdout);
        
        if (res.stderr) {
            console.log('--- STDERR ---');
            console.error(res.stderr);
        }

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
fetchLogs();
