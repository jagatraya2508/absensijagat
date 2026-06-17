const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('--- Check attendance.js on Live Server ---');
        const res = await ssh.execCommand('sed -n "430,460p" /home/wisnu/absensijagat/backend/routes/attendance.js');
        console.log(res.stdout);
        
        console.log('--- Check auth.js on Live Server ---');
        const res2 = await ssh.execCommand('sed -n "140,165p" /home/wisnu/absensijagat/backend/routes/auth.js');
        console.log(res2.stdout);

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
checkRemote();
