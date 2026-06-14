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
        
        console.log('Connected. Uploading migrate_employee_docs.js...');
        // Upload migration script to root of app where it expects to run (it requires ./backend/db)
        await ssh.putFile('../migrate_employee_docs.js', '/home/wisnu/absensijagat/migrate_employee_docs.js');
        
        console.log('Running migrate_employee_docs.js on remote...');
        const res1 = await ssh.execCommand('node migrate_employee_docs.js', { cwd: '/home/wisnu/absensijagat' });
        console.log('Output Migration:\n', res1.stdout);
        if (res1.stderr) console.error('Error Migration:\n', res1.stderr);

        console.log('Restarting PM2 backend services...');
        const res2 = await ssh.execCommand('pm2 restart absensijagat-backend-5000');
        console.log('Restarted.');

        ssh.dispose();
        console.log('Selesai!');
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
fixRemote();
