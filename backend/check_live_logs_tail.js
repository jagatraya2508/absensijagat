const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('--- Current Server Time ---');
        const resTime = await ssh.execCommand('date');
        console.log(resTime.stdout);

        console.log('--- Last 20 lines of PM2 Error Log ---');
        const res = await ssh.execCommand('tail -n 20 /home/wisnu/.pm2/logs/absensijagat-backend-5000-error.log');
        console.log(res.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
checkRemote();
