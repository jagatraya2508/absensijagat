const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkServer() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });

        const SUDO = 'echo "sa" | sudo -S';

        console.log('1. Resolving domain absensi.jagatrayasolusindo.com...');
        const ping = await ssh.execCommand('ping -c 1 absensi.jagatrayasolusindo.com');
        console.log(ping.stdout || ping.stderr);

        console.log('\n2. Cek Docker container di port 80:');
        const docker = await ssh.execCommand(`${SUDO} docker ps | grep -E "80|443"`);
        console.log(docker.stdout || 'Tidak ada docker container di port 80');

        console.log('\n3. Cek apakah certbot terinstall:');
        const certbot = await ssh.execCommand('which certbot');
        console.log(certbot.stdout || 'Certbot belum terinstall');

        ssh.dispose();
    } catch (e) {
        console.error(e);
        ssh.dispose();
    }
}
checkServer();
