const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        // Cek pg_isready atau psql version
        const psqlCheck = await ssh.execCommand('psql -V');
        console.log('psql version:', psqlCheck.stdout);

        // Coba sudo postgres dengan echo password
        const sudoCheck = await ssh.execCommand('echo "sa" | sudo -S -u postgres psql -c "SELECT 1"');
        console.log('sudo postgres output:', sudoCheck.stdout);
        if (sudoCheck.stderr) console.log('sudo postgres stderr:', sudoCheck.stderr);

        // Cek .env file dari server live
        const envCheck = await ssh.execCommand('cat /home/wisnu/absensijagat/backend/.env | grep DB_');
        console.log('Server .env DB Config:', envCheck.stdout);

        ssh.dispose();
    } catch (e) {
        console.error('Connection error:', e);
        ssh.dispose();
    }
}
checkRemote();
