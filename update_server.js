const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function updateServer() {
    try {
        console.log('Menghubungkan ke server 203.194.114.152...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        console.log('Koneksi berhasil!\n');

        const cwd = '/home/wisnu/absensijagat';

        // 1. Git pull
        console.log('1. Mengambil kode terbaru dari GitHub...');
        const pullResult = await ssh.execCommand('git pull origin main', { cwd });
        console.log('   ', pullResult.stdout || pullResult.stderr);

        // 2. Install dependencies
        console.log('\n2. Menginstall dependencies...');
        const installResult = await ssh.execCommand('npm run install:all', { cwd });
        console.log('   Install selesai.');

        // 3. Build frontend
        console.log('\n3. Build frontend...');
        const buildResult = await ssh.execCommand('cd frontend && npm run build', { cwd });
        if (buildResult.stderr && buildResult.stderr.includes('ERROR')) {
            console.log('   Build errors:', buildResult.stderr.substring(0, 300));
        } else {
            console.log('   Build selesai!');
        }

        // 4. Restart PM2
        console.log('\n4. Restart PM2...');
        const pm2Result = await ssh.execCommand('pm2 restart absensi-backend-5000 absensi-frontend-3000', { cwd });
        console.log('   ', pm2Result.stdout.split('\n').slice(-10).join('\n'));

        console.log('\n============================');
        console.log('✅ UPDATE SERVER BERHASIL!');
        console.log('============================');

        ssh.dispose();
    } catch (error) {
        console.error('GAGAL:', error);
        ssh.dispose();
    }
}

updateServer();
