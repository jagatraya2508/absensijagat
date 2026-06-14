const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deployLive() {
    try {
        console.log('Menghubungkan ke server live (203.194.114.152)...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Berhasil terhubung. Menjalankan update.sh...');
        const res = await ssh.execCommand('./update.sh', { cwd: '/home/wisnu/absensijagat' });
        
        console.log('Output Update:\n', res.stdout);
        if (res.stderr) {
            console.error('Error Output:\n', res.stderr);
        }

        ssh.dispose();
        console.log('Selesai update server live!');
    } catch (e) {
        console.error('Koneksi SSH Error:', e);
        ssh.dispose();
    }
}
deployLive();
